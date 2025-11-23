from flask import Flask, request, jsonify, make_response
from dotenv import load_dotenv
from flask_cors import CORS
import os 
from flask_sqlalchemy import SQLAlchemy
import boto3
from werkzeug.utils import secure_filename
from fpdf import FPDF, XPos, YPos
import io 
import json 
import requests 
from PIL import Image, ImageDraw, ImageFont 
import inference 
from datetime import datetime, timedelta

load_dotenv()

app = Flask(__name__)
CORS(app) 

# --- 데이터베이스 및 S3 설정 ---
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DB_URI') 
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    "pool_pre_ping": True,
    "pool_recycle": 300,
}

db = SQLAlchemy(app)

S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME')
S3_ACCESS_KEY = os.getenv('S3_ACCESS_KEY')
S3_SECRET_KEY = os.getenv('S3_SECRET_KEY')
S3_REGION = os.getenv('S3_REGION')

s3 = boto3.client(
    's3',
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    region_name=S3_REGION
)

# --- DB 테이블 모델 ---
class Project(db.Model):
    __tablename__ = 'projects'
    id = db.Column(db.Integer, primary_key=True)
    access_code = db.Column(db.String(100), unique=True, nullable=False) 
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    results = db.relationship('AnalysisResult', backref='project', lazy=True)

class AnalysisResult(db.Model):
    __tablename__ = 'analysis_results'
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    original_image_url = db.Column(db.String(255), nullable=False)
    result_image_url = db.Column(db.String(255), nullable=True)
    analysis_data = db.Column(db.Text, nullable=True) 
    status = db.Column(db.String(50), nullable=False, default='processing')
    created_at = db.Column(db.DateTime, server_default=db.func.now())

# ==========================================
# PDF 및 데이터 처리 헬퍼 함수
# ==========================================

# [설정] 클래스 한글 매핑 및 조치 DB
CLASS_MAPPING = {
    "good": "정상 (Good)",
    "bent": "변형/찌그러짐 (Bent)",
    "color": "변색/이염 (Color)",
    "crack": "균열/파손 (Crack)",
    "scratch": "스크래치 (Scratch)"
}

def draw_boxes_on_image_in_memory(image_url, detections):
    """이미지 박스 그리기 (good 클래스는 초록색, 나머지는 빨간색)"""
    try:
        response = requests.get(image_url)
        response.raise_for_status()
        img = Image.open(io.BytesIO(response.content))
        
        if img.mode != 'RGB':
            img = img.convert('RGB')
            
        draw = ImageDraw.Draw(img)
        line_width = max(3, int(img.width / 200))
        
        try:
            font = ImageFont.load_default()
        except:
            font = None

        for det in detections:
            bbox = det.get('bbox')
            cls_key = det.get('class', 'unknown')
            label = CLASS_MAPPING.get(cls_key, cls_key)
            conf = det.get('confidence', 0)
            
            # good은 초록색, 결함은 빨간색
            color = "green" if cls_key == "good" else "red"

            if bbox and len(bbox) == 4:
                draw.rectangle(bbox, outline=color, width=line_width)
                
                text_caption = f"{label}"
                if hasattr(draw, "textbbox"):
                    text_bg = draw.textbbox((bbox[0], bbox[1] - 15), text_caption, font=font)
                    draw.rectangle(text_bg, fill=color)
                draw.text((bbox[0], bbox[1] - 15), text_caption, fill="white", font=font)

        output_stream = io.BytesIO()
        img.save(output_stream, format='JPEG', quality=90)
        return output_stream
    except Exception as e:
        print(f"이미지 처리 에러: {e}")
        return None

def generate_summary_text(detections):
    """결함 요약 텍스트 생성"""
    if not detections:
        return "분석 결과, 특이사항이 발견되지 않았습니다. 대상물의 상태가 매우 양호합니다."

    # good을 제외한 실제 결함만 카운트
    defects_only = [d for d in detections if d.get('class') != 'good']
    count = len(defects_only)
    
    types = [d.get('class', 'unknown') for d in defects_only]
    type_counts = {t: types.count(t) for t in set(types)}
    
    if count == 0:
        return "분석 결과, '정상(Good)' 영역만 탐지되었습니다. 결함이 발견되지 않아 상태가 양호합니다."

    summary = f"AI 정밀 분석 결과, 총 {count}건의 결함이 식별되었습니다. "
    
    detail_texts = []
    for dtype, dcount in type_counts.items():
        k_name = CLASS_MAPPING.get(dtype, dtype)
        detail_texts.append(f"{k_name} {dcount}건")
    
    summary += ", ".join(detail_texts) + "이(가) 확인되었습니다."
    return summary

def get_detailed_advice(defect_type):
    """결함별 상세 조치 가이드"""
    advice_db = {
        "bent": (
            "변형/찌그러짐 (Bent):\n"
            "외부 충격이나 압력으로 인해 형태가 변형된 상태입니다. "
            "금속 재질의 경우 PDR(Paintless Dent Repair) 시공을 우선 고려하고, "
            "변형이 심하거나 도장 손상이 동반된 경우 판금/교체 작업이 필요할 수 있습니다."
        ),
        "color": (
            "변색/이염 (Color):\n"
            "자외선 노출, 화학 물질, 혹은 노후화로 인해 본래의 색상을 잃은 상태입니다. "
            "표면 오염인 경우 광택(Polishing) 및 클리닝으로 복원이 가능하나, "
            "페인트 층 자체의 변색인 경우 재도장 작업이 필요합니다."
        ),
        "crack": (
            "균열/파손 (Crack):\n"
            "재료의 피로도 누적이나 강한 충격으로 인해 표면이 갈라진 상태입니다. "
            "방치 시 균열이 확산되어 구조적 안전에 영향을 줄 수 있으므로, "
            "즉시 용접, 퍼티 작업 후 도색 또는 부품 교체를 강력히 권장합니다."
        ),
        "scratch": (
            "스크래치 (Scratch):\n"
            "표면 마찰로 인해 긁힘이 발생한 상태입니다. "
            "손톱에 걸리지 않는 미세 스크래치는 광택 작업으로 제거 가능하며, "
            "깊은 스크래치는 부식 방지를 위해 터치업 페인트나 부분 도색이 요구됩니다."
        ),
        "good": (
            "정상 (Good):\n"
            "해당 영역은 AI 분석 결과 결함이 없는 양호한 상태로 판단됩니다. "
            "별도의 조치가 필요하지 않으며, 현 상태를 유지하기 위한 주기적인 관리를 권장합니다."
        )
    }
    return advice_db.get(defect_type, "해당 결함 유형에 대해 전문가의 육안 정밀 진단이 필요합니다.")

# --- 기존 헬퍼 함수 ---
def make_history_list(results):
    history_data = []
    for r in results:
        try:
            parsed_data = json.loads(r.analysis_data) if r.analysis_data else []
        except:
            parsed_data = []
            
        # good 제외하고 결함 수 세기
        real_defects = [d for d in parsed_data if d.get('class') != 'good']
        defect_count = len(real_defects)
        
        kst_time = r.created_at + timedelta(hours=9)
        
        history_data.append({
            "id": r.id,
            "image_url": r.original_image_url,
            "status": r.status,
            "summary": f"결함 {defect_count}개 발견",
            "date": kst_time.strftime("%Y-%m-%d %H:%M")
        })
    return history_data

# ==========================================
# API 라우트
# ==========================================

@app.route('/')
def index():
    return "AI 서버 가동 중 (Final Version)"

# 1. 접속 (Login)
@app.route('/access', methods=['POST', 'OPTIONS'])
def access_project():
    if request.method == 'OPTIONS': return '', 204
    try:
        data = request.get_json()
        if not data: return jsonify({"result": "error", "message": "데이터 없음"}), 400
        access_code = data.get('access_code')
        if not access_code: return jsonify({"result": "error", "message": "코드 입력 필요"}), 400
        
        project = Project.query.filter_by(access_code=access_code).first()
        if not project:
            project = Project(access_code=access_code)
            db.session.add(project)
            db.session.commit()
        
        results = AnalysisResult.query.filter_by(project_id=project.id).order_by(AnalysisResult.created_at.desc()).all()
        history_data = make_history_list(results)

        return jsonify({
            "result": "success", 
            "project_id": project.id, "access_code": project.access_code, "history": history_data
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"result": "error", "message": str(e)}), 500

# 1.5 히스토리 갱신
@app.route('/history', methods=['POST', 'OPTIONS'])
def get_history():
    if request.method == 'OPTIONS': return '', 204
    try:
        data = request.get_json()
        project_id = data.get('project_id')
        if isinstance(project_id, str) and project_id.isdigit(): project_id = int(project_id)
        
        results = AnalysisResult.query.filter_by(project_id=project_id).order_by(AnalysisResult.created_at.desc()).all()
        return jsonify({"result": "success", "history": make_history_list(results)})
    except Exception as e:
        return jsonify({"result": "error", "message": str(e)}), 500

# 2. 분석 요청
@app.route('/predict', methods=['POST', 'OPTIONS'])
def predict():
    if request.method == 'OPTIONS': return '', 204
    if 'image' not in request.files: return jsonify({"result": "error", "message": "이미지 없음"}), 400
    
    try:
        project_id = request.form.get('project_id')
        if not project_id: return jsonify({"result": "error", "message": "ID 누락"}), 400
        
        file = request.files['image']
        filename = secure_filename(file.filename)
        
        s3.upload_fileobj(file, S3_BUCKET_NAME, filename, ExtraArgs={'ACL': 'public-read', 'ContentType': file.content_type})
        image_url = f"https://{S3_BUCKET_NAME}.s3.{S3_REGION}.amazonaws.com/{filename}"
        
        new_analysis = AnalysisResult(
            original_image_url=image_url, status='processing', project_id=int(project_id)
        )
        db.session.add(new_analysis)
        db.session.commit()

        return jsonify({"result": "success", "analysis_id": new_analysis.id})
    except Exception as e:
        db.session.rollback()
        return jsonify({"result": "error", "message": str(e)}), 500

# 3. 결과 조회
@app.route('/result/<int:analysis_id>', methods=['GET', 'OPTIONS'])
def get_result(analysis_id):
    if request.method == 'OPTIONS': return '', 204
    try:
        result = db.session.get(AnalysisResult, analysis_id)
        if not result: return jsonify({"message": "데이터 없음"}), 404

        if result.status == 'completed':
            return jsonify({
                "analysis_id": result.id, "status": "completed", 
                "original_image_url": result.original_image_url, 
                "details": json.loads(result.analysis_data)
            })
        
        raw_json = inference.run_inference(result.original_image_url)
        result.analysis_data = raw_json
        result.status = 'completed'
        db.session.commit()

        return jsonify({
            "analysis_id": result.id, "status": "completed", 
            "original_image_url": result.original_image_url, "details": json.loads(raw_json)
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "processing", "error": str(e)})


# 4. 리포트 (최종 버전: 5개 클래스 적용)
@app.route('/report/<int:analysis_id>', methods=['GET'])
def get_report(analysis_id):
    result = db.session.get(AnalysisResult, analysis_id)
    if not result or result.status != 'completed':
        return jsonify({"error": "분석 완료 대기 중"}), 400

    try:
        analysis_details = json.loads(result.analysis_data)
        
        kst_time = result.created_at + timedelta(hours=9)
        kst_str = kst_time.strftime('%Y-%m-%d %H:%M:%S')

        class ReportPDF(FPDF):
            def footer(self):
                self.set_y(-15)
                try:
                    self.add_font('Nanum', '', 'NanumGothic.ttf')
                    self.set_font('Nanum', '', 8)
                except:
                    self.set_font('Helvetica', 'I', 8)
                self.set_text_color(128)
                self.cell(0, 10, f'Page {self.page_no()} | AI Generated Report', align='C')

        pdf = ReportPDF()
        pdf.add_page()
        
        try:
            pdf.add_font('Nanum', '', 'NanumGothic.ttf')
            pdf.add_font('NanumB', 'B', 'NanumGothic.ttf')
            base_font = 'Nanum'
            bold_font = 'NanumB'
        except:
            base_font = 'Helvetica'
            bold_font = 'Helvetica'

        # [1] 헤더
        pdf.set_font(bold_font, 'B', 20)
        pdf.cell(0, 15, '품질 검사 결과 보고서', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')
        
        pdf.set_font(base_font, '', 11)
        pdf.set_text_color(0)
        
        # 등급 판정 로직 (good은 결함 수에서 제외)
        real_defects = [d for d in analysis_details if d.get('class') != 'good']
        defect_count = len(real_defects)
        
        if defect_count == 0:
            grade = "PASS (정상)"
            grade_color = (0, 150, 0)
        elif defect_count <= 2:
            grade = "WARNING (주의)"
            grade_color = (255, 140, 0)
        else:
            grade = "FAIL (불량)"
            grade_color = (200, 0, 0)

        pdf.cell(30, 8, "문서 번호:", align='L')
        pdf.cell(60, 8, f"REP-{result.project.access_code}-{analysis_id}", align='L')
        pdf.cell(30, 8, "검사 일시:", align='L')
        pdf.cell(0, 8, f"{kst_str} (KST)", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')
        
        pdf.cell(30, 8, "최종 등급:", align='L')
        pdf.set_text_color(*grade_color)
        pdf.set_font(bold_font, 'B', 12)
        pdf.cell(0, 8, grade, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')
        
        pdf.set_text_color(0)
        pdf.set_font(base_font, '', 11)
        pdf.line(10, pdf.get_y()+2, 200, pdf.get_y()+2)
        pdf.ln(8)

        # [2] 시각적 분석
        pdf.set_font(bold_font, 'B', 14)
        pdf.cell(0, 10, '1. 결함 시각화 (Visual Inspection)', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        
        processed_img_stream = draw_boxes_on_image_in_memory(result.original_image_url, analysis_details)
        if processed_img_stream:
            pdf.image(processed_img_stream, x=30, y=None, w=150)
        else:
            pdf.cell(0, 20, "[이미지 처리 실패]", align='C')
        pdf.ln(5)

        # [3] 상세 분석 결과
        pdf.set_font(bold_font, 'B', 14)
        pdf.cell(0, 10, '2. 상세 분석 결과', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        
        pdf.set_font(base_font, '', 11)
        pdf.set_fill_color(245, 245, 245)
        summary_text = generate_summary_text(analysis_details)
        pdf.multi_cell(0, 8, summary_text, fill=True, border=0)
        pdf.ln(5)

        # 테이블
        pdf.set_font(base_font, '', 10)
        pdf.set_fill_color(60, 60, 60)
        pdf.set_text_color(255)
        
        pdf.cell(15, 8, "No.", border=1, align='C', fill=True)
        pdf.cell(40, 8, "결함 유형", border=1, align='C', fill=True)
        pdf.cell(25, 8, "신뢰도", border=1, align='C', fill=True)
        pdf.cell(50, 8, "위치 좌표", border=1, align='C', fill=True)
        pdf.cell(60, 8, "간편 조치", border=1, align='C', fill=True)
        pdf.ln()

        pdf.set_text_color(0)
        
        unique_defects = set()

        if not analysis_details:
            pdf.cell(190, 10, "탐지된 데이터가 없습니다.", border=1, align='C')
        else:
            for i, item in enumerate(analysis_details):
                cls_key = item.get('class', 'unknown')
                
                # good은 결함 가이드에 넣을지 말지 결정 (여기서는 넣음)
                unique_defects.add(cls_key)
                
                cls_name = CLASS_MAPPING.get(cls_key, cls_key) # 한글 변환
                conf = float(item.get('confidence', 0)) * 100
                bbox = item.get('bbox', [0,0,0,0])
                bbox_str = f"[{int(bbox[0])},{int(bbox[1])}]"
                
                # 간편 조치 (표 내부용)
                action = "관찰 필요"
                if cls_key == "scratch": action = "광택 작업"
                elif cls_key == "dent": action = "PDR/판금"
                elif cls_key == "crack": action = "교체/용접"
                elif cls_key == "color": action = "재도장"
                elif cls_key == "good": action = "조치 없음"

                pdf.cell(15, 8, str(i+1), border=1, align='C')
                pdf.cell(40, 8, cls_name, border=1, align='C')
                pdf.cell(25, 8, f"{conf:.1f}%", border=1, align='C')
                pdf.cell(50, 8, bbox_str, border=1, align='C')
                pdf.cell(60, 8, action, border=1, align='C')
                pdf.ln()
        
        pdf.ln(5)

        # [4] 상세 가이드 (unique_defects 기반)
        # good만 있을 때는 굳이 가이드가 길게 필요 없을 수 있으나, 칭찬 문구로 넣음
        if unique_defects:
            pdf.set_font(bold_font, 'B', 14)
            pdf.cell(0, 10, '3. 유형별 상세 가이드', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            
            pdf.set_font(base_font, '', 10)
            
            for defect in unique_defects:
                advice = get_detailed_advice(defect)
                pdf.set_fill_color(250, 250, 250)
                pdf.multi_cell(0, 6, advice, fill=True, border='L')
                pdf.ln(2)

        pdf.set_y(-25)
        pdf.set_font(base_font, '', 9)
        pdf.set_text_color(100)
        pdf.multi_cell(0, 5, "※ 본 보고서는 AI 분석 결과로, 실제 육안 검사 결과와 차이가 있을 수 있습니다.", align='C')

        pdf_bytes = pdf.output() 
        response = make_response(bytes(pdf_bytes))
        
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename=Report_{analysis_id}.pdf'
        return response

    except Exception as e:
        print(f"Report Error: {e}")
        return jsonify({"error": str(e)}), 500

# --- DB 초기화 ---
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True)