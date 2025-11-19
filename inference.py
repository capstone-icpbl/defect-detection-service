from ultralytics import YOLO
import json

# 1. 모델을 미리 로드
model = YOLO("best.pt")

def run_inference(image_path_or_url):
    """
    이미지 경로(또는 S3 URL)를 받아서,
    YOLO 모델로 분석한 뒤 결과를 JSON 문자열로 반환하는 함수
    """
    
    # 2. 모델 실행 
    results = model(image_path_or_url)

    detections = []
    
    # 3. 결과 데이터 가공
    for r in results:
        for box in r.boxes:
            cls = int(box.cls[0])
            conf = float(box.conf[0])
            xyxy = box.xyxy[0].tolist() # 좌표 

            detections.append({
                "class": r.names[cls],      # 흠집 종류 
                "confidence": conf,         # 확률 
                "bbox": xyxy                # 위치 좌표
            })

    # 4. 결과를 JSON 문자열로 변환하여 반환 
    return json.dumps(detections)