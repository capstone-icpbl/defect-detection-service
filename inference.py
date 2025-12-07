from ultralytics import YOLO
import json
import numpy as np
import requests
from PIL import Image
import io
import warnings
import os

# [추가] 불필요한 경고 메시지 무시
warnings.filterwarnings('ignore')
# [추가] YOLO 로그 출력 최소화 (True로 하면 너무 많이 뜸)
os.environ['YOLO_VERBOSE'] = 'False'

model = YOLO("best.pt")

# --- 1) 이미지 다운로드 헬퍼 ---
def load_image_from_url(url):
    try:
        response = requests.get(url, stream=True, timeout=10)
        response.raise_for_status()
        img = Image.open(io.BytesIO(response.content))
        return img
    except Exception as e:
        print(f"❌ 이미지 다운로드 실패: {e}")
        return None

# --- 1) 심각도 계산 로직 (가중치 상향 조정) ---
def calculate_severity(detections):
    if len(detections) == 0:
        return 0 

    # 결함 개수
    defect_count = len(detections)

    # 결함 confidence 평균값
    conf_scores = [d['confidence'] for d in detections]
    mean_conf = float(np.mean(conf_scores)) if conf_scores else 0

    severity_sum = 0
    for d in detections:
        cls_name = d['class'].lower()
        
        # 가중치: 스크래치(10), 덴트(20), 파손/사고(40)
        # 이렇게 하면 덴트 하나만 있어도 기본 20점 깔고 들어감
        if 'scratch' in cls_name:       
            severity_sum += 10
        elif 'dent' in cls_name:        
            severity_sum += 20        
        elif 'glass' in cls_name:       
            severity_sum += 40        
        elif 'accident' in cls_name:    
            severity_sum += 50        
        else:
            severity_sum += 10

    # 기본 점수(가중치 합) + 개수 보너스(개당 5점) + 확신도 보정(최대 10점)
    score = severity_sum + (defect_count * 5) + (mean_conf * 10)

    # 최대 100점 제한
    return min(100, int(score))

# --- 2) 등급 산출 로직 (상식적으로 변경) ---
def severity_to_grade(score):
    if score == 0:
        return "A (정상)"
    elif score <= 30:
        return "B (양호 - 경미한 손상)"
    elif score <= 60:
        return "C (보통 - 수리 권장)"
    elif score <= 85:
        return "D (주의 - 주요 손상)"
    else:
        return "E (심각 - 즉시 조치)"

# --- 3) 추론 실행 함수 ---
def run_inference(image_path_or_url):
    print(f"\n📸 [DEBUG] 밸런스 패치된 분석 시작 (Threshold: 0.3)")
    
    try:
        # URL이면 다운로드
        if isinstance(image_path_or_url, str) and image_path_or_url.startswith("http"):
            source = load_image_from_url(image_path_or_url)
            if source is None:
                return json.dumps({"summary": {"grade": "Error"}, "detections": []}, ensure_ascii=False)
        else:
            source = image_path_or_url

        # 추론 실행 (verbose=False, stream=False 명시)
        results = model(source, conf=0.3, imgsz=1280, verbose=False, stream=False) 

        detections = []
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                xyxy = box.xyxy[0].tolist()
                class_name = r.names[cls_id]
                
                detections.append({
                    "class": class_name,
                    "confidence": round(conf, 4),
                    "bbox": xyxy,
                    "cls_id": cls_id
                })

        # 심각도 및 등급 계산
        severity_score = calculate_severity(detections)
        grade = severity_to_grade(severity_score)
        
        final_output = {
            "summary": {
                "total_detections": len(detections),
                "severity_score": severity_score,
                "grade": grade
            },
            "detections": detections
        }

        print(f"   👉 분석 결과: {grade} (점수: {severity_score})")

        return json.dumps(final_output, ensure_ascii=False)

    except Exception as e:
        print(f"❌ 에러: {e}")
        return json.dumps({"summary": {"grade": "Error", "severity_score": 0}, "detections": []}, ensure_ascii=False)