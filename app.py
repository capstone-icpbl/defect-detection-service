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
import requests # [추가] 이미지 다운로드용
from PIL import Image, ImageDraw, ImageFont # [추가] 이미지 처리용
import inference 
from datetime import datetime

load_dotenv()

app = Flask(__name__)
CORS(app) 

# --- 데이터베이스 및 S3 설정 ---
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DB_URI') 
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# DB 에러 났을 때 자동 복구 설정
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
# [NEW] PDF 생성용 헬퍼 함수
# ==========================================

def draw_boxes_on_image_in_memory(image_url, detections):
    """이미지를 메모리에서 다운받아 박스를 그리고 스트림 반환 (S3 저장 안함)"""
    try:
        response = requests.get(image_url)
        response.raise_for_status()
        img = Image.open(io.BytesIO(response.content))
        
        if img.mode != 'RGB':
            img = img.convert('RGB')
            
        draw = ImageDraw.Draw(img)
        # 이미지 크기에 비례하여 선 두께 설정
        line_width = max(3, int(img.width / 200))
        
        try:
            # 폰트가 없으면 기본 폰트 사용 (한글 깨질 수 있음 -> 영문 라벨 권장)
            font = ImageFont.load_default()
        except:
            font = None

        for det in detections:
            bbox = det.get('bbox') # [x1, y1, x2, y2]
            label = det.get('class', 'Unknown')
            conf = det.get('confidence', 0)
            
            if bbox and len(bbox) == 4:
                # 1. 빨간 박스
                draw.rectangle(bbox, outline="red", width=line_width)
                
                # 2. 텍스트 라벨 (선택 사항)
                text_caption = f"{label} {conf:.0%}"
                
                # 텍스트 배경 박스 (가독성 확보)
                if hasattr(draw, "textbbox"):
                    text_bg = draw.textbbox((bbox[0], bbox[1] - 15), text_caption, font=font)
                    draw.rectangle(text_bg, fill="red")
                
                draw.text((bbox[0], bbox[1] - 15), text_caption, fill="white", font=font)

        output_stream = io.BytesIO()
        img.save(output_stream, format='JPEG', quality=90)
        return output_stream
        
    except Exception as e:
        print(f"이미지 처리 중 에러: {e}")
        return None

def generate_summary_text(detections):
    """결함 데이터를 분석하여 줄글 요약 생성"""
    if not detections:
        return "정밀 분석 결과, 특이사항이나 결함이 발견되지 않았습니다. 차량 표면 상태가 매우 양호합니다."

    count = len(detections)
    types = [d.get('class', 'Unknown') for d in detections]
    type_counts = {t: types.count(t) for t in set(types)}
    
    summary = f"AI 비전 분석 결과, 총 {count}건의 결함이 탐지되었습니다. "
    
    detail_texts = []
    for dtype, dcount in type_counts.items():
        korean_name = {"Scratch": "스크래치", "Dent": "찌그러짐", "Paint Chip": "도장 까짐"}.get(dtype, dtype)
        detail_texts.append(f"{korean_name} {dcount}건")
    
    summary += ", ".join(detail_texts) + "이(가) 식별되었습니다.\n\n"
    summary += "[권장 조치]\n"
    
    if "Scratch" in type_counts:
        summary += "- 스크래치: 깊이에 따른 광택(Polishing) 작업 요망\n"
    if "Dent" in type_counts:
        summary += "- 찌그러짐: PDR 시공 또는 판금 도색 검토 필요\n"
    if "Paint Chip" in type_counts:
        summary += "- 도장 까짐: 부식 방지를 위한 터치업 페인트 시공 필요\n"
        
    return summary

# --- 기존 헬퍼 함수 ---
def make_history_list(results):
    history_data = []
    for r in results:
        try:
            parsed_data = json.loads(r.analysis_data) if r.analysis_data else []
        except:
            parsed_data = []
            
        defect_count = len(parsed_data) if isinstance(parsed_data, list) else 0
        summary_text = f"결함 {defect_count}개 발견"

        history_data.append({
            "id": r.id,
            "image_url": r.original_image_url,
            "status": r.status,
            "summary": summary_text,
            "date": r.created_at.strftime("%Y-%m-%d %H:%M")
        })
    return history_data

# ==========================================
# API 라우트
# ==========================================

@app.route('/')
def index():
    return "AI 서버 가동 중 (Updated Report)"

# 1. 접속 (Login)
@app.route('/access', methods=['POST', 'OPTIONS'])
def access_project():
    if request.method == 'OPTIONS': return '', 204
    try:
        data = request.get_json()
        if not data: return jsonify({"result": "error", "message": "데이터 없음"}), 400
        access_code = data.get('access_code')
        if not access_code: return jsonify({"result": "error", "message": "접속 코드 입력 필요"}), 400
        
        project = Project.query.filter_by(access_code=access_code).first()
        if not project:
            project = Project(access_code=access_code)
            db.session.add(project)
            db.session.commit()
        
        results = AnalysisResult.query.filter_by(project_id=project.id).order_by(AnalysisResult.created_at.desc()).all()
        history_data = make_history_list(results)

        return jsonify({
            "result": "success", "message": "접속 성공",
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
        if not project_id or not isinstance(project_id, int):
            return jsonify({"result": "error", "message": "유효하지 않은 ID"}), 400

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
        if not str(project_id).isdigit(): return jsonify({"result": "error", "message": "ID는 숫자여야 함"}), 400
        
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


# 4. 리포트 (B2B 실무용 - 로고/결재란 제거 버전)
@app.route('/report/<int:analysis_id>', methods=['GET'])
def get_report(analysis_id):
    result = db.session.get(AnalysisResult, analysis_id)
    if not result or result.status != 'completed':
        return jsonify({"error": "분석 완료 대기 중"}), 400

    try:
        analysis_details = json.loads(result.analysis_data)
        
        # 페이지 번호 출력을 위한 커스텀 클래스
        class ReportPDF(FPDF):
            def footer(self):
                self.set_y(-15)
                try:
                    self.add_font('Nanum', '', 'NanumGothic.ttf', uni=True)
                    self.set_font('Nanum', '', 8)
                except:
                    self.set_font('Helvetica', 'I', 8)
                self.set_text_color(128)
                self.cell(0, 10, f'Page {self.page_no()} | AI Generated Report', align='C')

        pdf = ReportPDF()
        pdf.add_page()
        
        # 폰트 로드
        try:
            pdf.add_font('Nanum', '', 'NanumGothic.ttf', uni=True)
            pdf.add_font('NanumB', 'B', 'NanumGothic.ttf', uni=True)
            base_font = 'Nanum'
            bold_font = 'NanumB'
        except:
            base_font = 'Helvetica'
            bold_font = 'Helvetica'

        # ------------------------------------------------
        # [1] 헤더 및 문서 정보
        # ------------------------------------------------
        pdf.set_font(bold_font, 'B', 20)
        pdf.cell(0, 15, '품질 검사 결과 보고서', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')
        
        pdf.set_font(base_font, '', 11)
        pdf.set_text_color(0)
        
        # 등급 판정 로직 (개수에 따라 등급 자동 부여)
        defect_count = len(analysis_details)
        if defect_count == 0:
            grade = "PASS (정상)"
            grade_color = (0, 150, 0) # Green
        elif defect_count <= 2:
            grade = "WARNING (주의)"
            grade_color = (255, 140, 0) # Orange
        else:
            grade = "FAIL (불량)"
            grade_color = (200, 0, 0) # Red

        # 문서 정보 출력
        pdf.cell(30, 8, "문서 번호:", align='L')
        pdf.cell(60, 8, f"REP-{result.project.access_code}-{analysis_id}", align='L')
        pdf.cell(30, 8, "검사 일시:", align='L')
        pdf.cell(0, 8, result.created_at.strftime('%Y-%m-%d %H:%M'), new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')
        
        pdf.cell(30, 8, "최종 등급:", align='L')
        pdf.set_text_color(*grade_color) # 등급 색상 적용
        pdf.set_font(bold_font, 'B', 12)
        pdf.cell(0, 8, grade, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')
        
        pdf.set_text_color(0) # 색상 초기화
        pdf.set_font(base_font, '', 11)
        pdf.set_line_width(0.5)
        pdf.line(10, pdf.get_y()+2, 200, pdf.get_y()+2) # 구분선
        pdf.ln(8)

        # ------------------------------------------------
        # [2] 시각적 분석 (박스 이미지)
        # ------------------------------------------------
        pdf.set_font(bold_font, 'B', 14)
        pdf.cell(0, 10, '1. 결함 시각화 (Visual Inspection)', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        
        processed_img_stream = draw_boxes_on_image_in_memory(result.original_image_url, analysis_details)
        if processed_img_stream:
            # 이미지 중앙 정렬 (A4 너비 210mm, 여백 고려하여 150mm 너비로 설정)
            pdf.image(processed_img_stream, x=30, y=None, w=150)
        else:
            pdf.cell(0, 20, "[이미지 처리 실패]", align='C')
        pdf.ln(5)

        # ------------------------------------------------
        # [3] 종합 의견 및 상세 내역
        # ------------------------------------------------
        pdf.set_font(bold_font, 'B', 14)
        pdf.cell(0, 10, '2. 상세 분석 결과', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        
        # 3-1. 줄글 요약 박스
        pdf.set_font(base_font, '', 11)
        pdf.set_fill_color(245, 245, 245) # 연회색 배경
        summary_text = generate_summary_text(analysis_details)
        pdf.multi_cell(0, 8, summary_text, fill=True, border=0)
        pdf.ln(5)

        # 3-2. 상세 테이블
        pdf.set_font(base_font, '', 10)
        pdf.set_fill_color(60, 60, 60) # 헤더: 진한 회색
        pdf.set_text_color(255) # 헤더: 흰색 글씨
        
        # 테이블 헤더
        pdf.cell(15, 8, "No.", border=1, align='C', fill=True)
        pdf.cell(40, 8, "결함 유형", border=1, align='C', fill=True)
        pdf.cell(25, 8, "신뢰도", border=1, align='C', fill=True)
        pdf.cell(60, 8, "위치 좌표 (BBox)", border=1, align='C', fill=True)
        pdf.cell(50, 8, "비고 (조치)", border=1, align='C', fill=True)
        pdf.ln()

        # 테이블 내용
        pdf.set_text_color(0) # 내용: 검은 글씨
        if not analysis_details:
            pdf.cell(190, 10, "발견된 결함이 없습니다.", border=1, align='C')
        else:
            for i, item in enumerate(analysis_details):
                cls_name = item.get('class', '-')
                conf = float(item.get('confidence', 0)) * 100
                bbox = item.get('bbox', [0,0,0,0])
                bbox_str = f"[{int(bbox[0])},{int(bbox[1])},{int(bbox[2])},{int(bbox[3])}]" if len(bbox)==4 else "-"
                
                # 조치 사항 매핑
                action = "관찰"
                if cls_name == "Scratch": action = "광택 필요"
                elif cls_name == "Dent": action = "판금/PDR"
                elif cls_name == "Paint Chip": action = "도색 요망"

                pdf.cell(15, 8, str(i+1), border=1, align='C')
                pdf.cell(40, 8, cls_name, border=1, align='C')
                pdf.cell(25, 8, f"{conf:.1f}%", border=1, align='C')
                pdf.cell(60, 8, bbox_str, border=1, align='C')
                pdf.cell(50, 8, action, border=1, align='C')
                pdf.ln()

        # [하단 면책 조항 - 간단하게]
        pdf.set_y(-25)
        pdf.set_font(base_font, '', 9)
        pdf.set_text_color(100)
        pdf.multi_cell(0, 5, "※ 본 보고서는 AI 분석 결과로, 실제 육안 검사 결과와 차이가 있을 수 있습니다.", align='C')

        # PDF 반환
        response = make_response(pdf.output(dest='S'))
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