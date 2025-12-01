from flask import Flask, request, jsonify, make_response, Response
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
CORS(app, resources={r"/*": {"origins": "*"}})

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
    filename = db.Column(db.String(255), nullable=True)
    result_image_url = db.Column(db.String(255), nullable=True)
    analysis_data = db.Column(db.Text, nullable=True) 
    status = db.Column(db.String(50), nullable=False, default='processing')
    created_at = db.Column(db.DateTime, server_default=db.func.now())

# ==========================================
# PDF 및 데이터 처리 헬퍼 함수
# ==========================================

CLASS_MAPPING = {
    "accident": "사고 흔적 (Accident)",
    "dent": "찌그러짐 (Dent)",
    "glass-break": "유리 파손 (Glass-Break)",
    "scratch": "스크래치 (Scratch)"
}

def draw_boxes_on_image_in_memory(image_url, detections):
    """이미지 박스 그리기"""
    try:
        response = requests.get(image_url)
        response.raise_for_status()
        img = Image.open(io.BytesIO(response.content))
        
        if img.mode != 'RGB':
            img = img.convert('RGB')
            
        draw = ImageDraw.Draw(img)
        line_width = max(3, int(img.width / 200))
        
        try:
            font = ImageFont.truetype("arial.ttf", size=int(img.width/40))
        except:
            font = ImageFont.load_default()

        for det in detections:
            bbox = det.get('bbox')
            cls_key = det.get('class', 'unknown').lower()
            label = CLASS_MAPPING.get(cls_key, cls_key)
            
            color = "red" # 모든 결함 빨간색

            if bbox and len(bbox) == 4:
                draw.rectangle(bbox, outline=color, width=line_width)
                
                text_caption = f"{label}"
                if hasattr(draw, "textbbox"):
                    left, top, right, bottom = draw.textbbox((bbox[0], bbox[1] - 10), text_caption, font=font)
                    draw.rectangle((left-2, top-2, right+2, bottom+2), fill=color)
                draw.text((bbox[0], bbox[1] - 10), text_caption, fill="white", font=font, anchor="lb")

        output_stream = io.BytesIO()
        img.save(output_stream, format='JPEG', quality=90)
        return output_stream
    except Exception as e:
        print(f"이미지 처리 에러: {e}")
        return None

def generate_summary_text(detections):
    """결함 요약 텍스트"""
    if not detections:
        return "분석 결과, 특이사항이 발견되지 않았습니다. 상태가 양호합니다."

    count = len(detections)
    
    types = [d.get('class', 'unknown').lower() for d in detections]
    type_counts = {t: types.count(t) for t in set(types)}
    
    if count == 0:
        return "분석 결과, 특이사항이 발견되지 않았습니다. 상태가 양호합니다."

    summary = f"AI 정밀 분석 결과, 총 {count}건의 결함이 식별되었습니다. "
    
    detail_texts = []
    for dtype, dcount in type_counts.items():
        k_name = CLASS_MAPPING.get(dtype, dtype)
        detail_texts.append(f"{k_name} {dcount}건")
    
    summary += ", ".join(detail_texts) + "이(가) 확인되었습니다."
    return summary

def get_detailed_advice(defect_type):
    """상세 조치 가이드"""
    defect_type = defect_type.lower()
    
    advice_db = {
        "accident": "심각한 사고 흔적 (Accident):\n차량 골격이나 내부 프레임 손상 가능성이 매우 높습니다. 단순 외형 복원이 아닌, 전문 공업사에서의 정밀 안전 진단 및 대규모 수리가 필요합니다.",
        "glass-break": "유리 파손 (Glass-Break):\n주행 중 시야 방해 및 파편 비산의 위험이 큽니다. 안전을 위해 즉시 유리 교체 또는 용접 복원 작업이 필요합니다.",
        "dent": "찌그러짐 (Dent):\n외부 충격으로 인해 표면 형태가 변형되었습니다. 도장 손상이 없다면 PDR 시공을, 심하면 판금 도색을 권장합니다.",
        "scratch": "스크래치 (Scratch):\n표면 긁힘이 발생했습니다. 손톱에 걸리지 않는 얕은 기스는 광택 작업으로, 깊은 기스는 도색이 필요합니다."
    }
    
    for key, msg in advice_db.items():
        if key in defect_type:
            return msg
    return "전문가 진단 필요:\n식별된 결함 유형에 대해 전문가의 육안 정밀 진단이 권장됩니다."

def make_history_list(results):
    history_data = []
    for r in results:
        try:
            raw_data = json.loads(r.analysis_data) if r.analysis_data else []
            if isinstance(raw_data, dict):
                detections = raw_data.get('detections', [])
            else:
                detections = raw_data
        except:
            detections = []
            
        defect_count = len(detections)
        kst_time = r.created_at + timedelta(hours=9)
        
        history_data.append({
            "analysis_id": r.id,
            "image_url": r.original_image_url,
            "filename": r.filename or f"Image_{r.id}",
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
    return "AI Server Running (Style Fixed)"

# 1. 접속
@app.route('/access', methods=['POST', 'OPTIONS'])
def access_project():
    if request.method == 'OPTIONS': return '', 204
    try:
        data = request.get_json()
        if not data: return jsonify({"result": "error", "message": "No Data"}), 400
        access_code = data.get('access_code')
        if not access_code: return jsonify({"result": "error", "message": "No Code"}), 400
        
        project = Project.query.filter_by(access_code=access_code).first()
        is_new = False
        if not project:
            project = Project(access_code=access_code)
            db.session.add(project)
            db.session.commit()
            is_new = True
        
        results = AnalysisResult.query.filter_by(project_id=project.id).order_by(AnalysisResult.created_at.desc()).all()
        history_data = make_history_list(results)

        print(f"🔑 접속 성공: {access_code} (ID: {project.id})")
        return jsonify({
            "result": "success", 
            "project_id": project.id, "access_code": project.access_code, "history": history_data
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"result": "error", "message": str(e)}), 500

# 1.5 히스토리
@app.route('/history', methods=['POST', 'OPTIONS'])
def get_history():
    if request.method == 'OPTIONS': return '', 204
    try:
        data = request.get_json()
        pid = int(data.get('project_id'))
        results = AnalysisResult.query.filter_by(project_id=pid).order_by(AnalysisResult.created_at.desc()).all()
        return jsonify({"result": "success", "history": make_history_list(results)})
    except Exception as e:
        return jsonify({"result": "error", "message": str(e)}), 500

# 2. 분석 요청
@app.route('/predict', methods=['POST', 'OPTIONS'])
def predict():
    if request.method == 'OPTIONS': return '', 204
    if 'image' not in request.files: return jsonify({"error": "No Image"}), 400
    
    try:
        pid = request.form.get('project_id')
        print(f"📸 업로드 요청: ID {pid}")
        
        file = request.files['image']
        original_filename = file.filename
        safe_filename = secure_filename(original_filename)
        
        s3.upload_fileobj(file, S3_BUCKET_NAME, safe_filename, ExtraArgs={'ACL': 'public-read', 'ContentType': file.content_type})
        image_url = f"https://{S3_BUCKET_NAME}.s3.{S3_REGION}.amazonaws.com/{safe_filename}"
        
        new_res = AnalysisResult(
            original_image_url=image_url, 
            filename=original_filename, 
            status='processing', 
            project_id=int(pid)
        )
        db.session.add(new_res)
        db.session.commit()

        return jsonify({"result": "success", "analysis_id": new_res.id})
    except Exception as e:
        db.session.rollback()
        return jsonify({"result": "error", "message": str(e)}), 500

# 3. 결과 조회
@app.route('/result/<int:analysis_id>', methods=['GET', 'OPTIONS'])
def get_result(analysis_id):
    if request.method == 'OPTIONS': return '', 204
    try:
        res = db.session.get(AnalysisResult, analysis_id)
        if not res: return jsonify({"message": "Not Found"}), 404
        
        resp = {
            "analysis_id": res.id, "status": "completed",
            "original_image_url": res.original_image_url,
            "filename": res.filename, "details": []
        }

        if res.status == 'completed':
            raw = json.loads(res.analysis_data)
            if isinstance(raw, dict) and 'detections' in raw:
                resp["details"] = raw['detections']
                resp["summary"] = raw.get('summary')
            else:
                resp["details"] = raw
            return jsonify(resp)
        
        print(f"🤖 AI 분석 시작 (ID: {analysis_id})")
        raw_json_str = inference.run_inference(res.original_image_url)
        
        res.analysis_data = raw_json_str
        res.status = 'completed'
        db.session.commit()
        
        parsed = json.loads(raw_json_str)
        if isinstance(parsed, dict) and 'detections' in parsed:
             resp["details"] = parsed['detections']
             resp["summary"] = parsed.get('summary')
        else:
             resp["details"] = parsed
             
        return jsonify(resp)
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "processing", "error": str(e)})

# 4. 리포트 (색상 로직 복구됨)
@app.route('/report/<int:analysis_id>', methods=['GET'])
def get_report(analysis_id):
    result = db.session.get(AnalysisResult, analysis_id)
    if not result or result.status != 'completed':
        return jsonify({"error": "분석 미완료"}), 400

    try:
        raw_data = json.loads(result.analysis_data)
        
        # 데이터 파싱
        if isinstance(raw_data, dict) and 'detections' in raw_data:
            analysis_details = raw_data['detections']
            summary_info = raw_data.get('summary', {})
            grade = summary_info.get('grade', "판정 불가")
            score = summary_info.get('severity_score', 0)
        else:
            analysis_details = raw_data if isinstance(raw_data, list) else []
            cnt = len(analysis_details)
            score = 0
            if cnt == 0: grade = "A (정상)"
            elif cnt <= 2: grade = "C (주의)"
            else: grade = "E (불량)"

        kst_time = result.created_at + timedelta(hours=9)
        kst_str = kst_time.strftime('%Y-%m-%d %H:%M:%S')

        # PDF 생성
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

        # 헤더
        pdf.set_font(bold_font, 'B', 20)
        pdf.cell(0, 15, '품질 검사 결과 보고서', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')
        
        pdf.set_font(base_font, '', 11)
        pdf.set_text_color(0)
        
        # [복구된 색상 로직] 5단계 등급 모두 대응
        grade_color = (0, 0, 0)
        # 녹색: A등급, B등급, 정상
        if any(x in grade for x in ["A", "B", "PASS"]): 
            grade_color = (0, 150, 0)
        # 오렌지색(노란색): C등급, D등급, 주의
        elif any(x in grade for x in ["C", "D", "WARNING"]): 
            grade_color = (255, 140, 0)
        # 빨간색: E등급, 불량
        elif any(x in grade for x in ["E", "FAIL"]): 
            grade_color = (200, 0, 0)

        pdf.cell(30, 8, "문서 번호:", align='L')
        pdf.cell(60, 8, f"REP-{result.project.access_code}-{analysis_id}", align='L')
        pdf.cell(30, 8, "검사 일시:", align='L')
        pdf.cell(0, 8, f"{kst_str} (KST)", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')
        
        pdf.cell(30, 8, "파일명:", align='L')
        pdf.cell(60, 8, f"{result.filename or '-'}", align='L')
        
        pdf.cell(30, 8, "최종 등급:", align='L')
        pdf.set_text_color(*grade_color)
        pdf.set_font(bold_font, 'B', 12)
        pdf.cell(0, 8, f"{grade} (점수: {score}점)", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')
        
        pdf.set_text_color(0)
        pdf.set_font(base_font, '', 11)
        pdf.line(10, pdf.get_y()+2, 200, pdf.get_y()+2)
        pdf.ln(8)

        # 시각적 분석
        pdf.set_font(bold_font, 'B', 14)
        pdf.cell(0, 10, '1. 결함 시각화 (Visual Inspection)', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        
        processed_img_stream = draw_boxes_on_image_in_memory(result.original_image_url, analysis_details)
        if processed_img_stream:
            pdf.image(processed_img_stream, x=30, y=None, w=150)
        else:
            pdf.cell(0, 20, "[이미지 처리 실패]", align='C')
        pdf.ln(5)

        # 상세 분석 결과
        pdf.set_font(bold_font, 'B', 14)
        pdf.cell(0, 10, '2. 상세 분석 결과', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        
        pdf.set_font(base_font, '', 11)
        # [복구] 회색 배경 박스
        pdf.set_fill_color(245, 245, 245)
        summary_text = generate_summary_text(analysis_details)
        pdf.multi_cell(0, 8, summary_text, fill=True, border=0)
        pdf.ln(5)

        # 테이블
        pdf.set_font(base_font, '', 10)
        # [복구] 진한 회색 헤더
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
                cls_key = item.get('class', 'unknown').lower()
                unique_defects.add(cls_key)
                
                cls_name = CLASS_MAPPING.get(cls_key, cls_key)
                conf = float(item.get('confidence', 0)) * 100
                bbox = item.get('bbox', [0,0,0,0])
                bbox_str = f"[{int(bbox[0])},{int(bbox[1])}]"
                
                action = "관찰 필요"
                if "scratch" in cls_key: action = "광택/도색"
                elif "dent" in cls_key: action = "PDR/판금"
                elif "glass" in cls_key: action = "유리 교체"
                elif "accident" in cls_key: action = "정밀 진단"

                pdf.cell(15, 8, str(i+1), border=1, align='C')
                pdf.cell(40, 8, cls_name, border=1, align='C')
                pdf.cell(25, 8, f"{conf:.1f}%", border=1, align='C')
                pdf.cell(50, 8, bbox_str, border=1, align='C')
                pdf.cell(60, 8, action, border=1, align='C')
                pdf.ln()
        
        pdf.ln(5)

        # 상세 가이드
        if unique_defects:
            pdf.set_font(bold_font, 'B', 14)
            pdf.cell(0, 10, '3. 유형별 상세 가이드', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            pdf.set_font(base_font, '', 10)
            
            for defect in unique_defects:
                advice = get_detailed_advice(defect)
                # [복구] 연한 회색 배경 박스
                pdf.set_fill_color(250, 250, 250)
                pdf.multi_cell(0, 6, advice, fill=True, border='L')
                pdf.ln(2)

        pdf.set_y(-25)
        pdf.set_font(base_font, '', 9)
        pdf.set_text_color(100)
        pdf.multi_cell(0, 5, "※ 본 보고서는 AI 분석 결과로, 실제 육안 검사 결과와 차이가 있을 수 있습니다.", align='C')

        return Response(bytes(pdf.output()), mimetype='application/pdf', headers={'Content-Disposition': f'attachment; filename=Report_{analysis_id}.pdf'})

    except Exception as e:
        print(f"Report Error: {e}")
        return jsonify({"error": str(e)}), 500

# --- DB 초기화 ---
with app.app_context():
    # db.drop_all() 
    db.create_all()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)