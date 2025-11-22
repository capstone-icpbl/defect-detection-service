from ultralytics import YOLO
import json

print("⏳ 모델 로딩 중... (inference.py)")
model = YOLO("best.pt")
print(f"✅ 모델 로드 완료! (학습된 클래스: {model.names})")

def run_inference(image_path_or_url):
    """
    이미지 경로(또는 URL)를 받아서 YOLO로 분석 후 JSON 반환
    디버깅을 위해 threshold를 0.2로 설정함
    """
    print(f"\n📸 [DEBUG] AI 분석 함수 호출됨 (Threshold: 0.2)")
    print(f"   대상 이미지: {image_path_or_url}")

    try:
        results = model(image_path_or_url, conf=0.2) 

        detections = []
        
        for r in results:
            print(f"🔍 [결과] 탐지된 박스 개수: {len(r.boxes)}")
            
            for box in r.boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                xyxy = box.xyxy[0].tolist()
                
                class_name = r.names[cls]
                
                print(f"   👉 발견: {class_name} (확률: {conf:.2f})")

                detections.append({
                    "class": class_name,
                    "confidence": round(conf, 4),
                    "bbox": xyxy
                })

        if not detections:
            print("   ⚠️ [경고] 탐지된 객체가 하나도 없습니다! (Threshold 0.2)")

        return json.dumps(detections, ensure_ascii=False)

    except Exception as e:
        print(f"❌ [오류] AI 분석 중 에러 발생: {e}")
        return json.dumps([], ensure_ascii=False)