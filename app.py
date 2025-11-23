from flask import Flask, request, jsonify, make_response
from dotenv import load_dotenv
from flask_cors import CORS, cross_origin
import os 
from flask_sqlalchemy import SQLAlchemy
import boto3
from werkzeug.utils import secure_filename
from fpdf import FPDF, XPos, YPos
import io 
import json 
import inference 

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

# --- 헬퍼 함수 ---
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

# --- API ---

@app.route('/')
def index():
    return "AI 서버 가동 중 (CORS Fixed)"

# 1. 접속 (Login) - [수정 2] OPTIONS 메서드 명시적 허용
@app.route('/access', methods=['POST', 'OPTIONS'])
def access_project():
    # 브라우저가 간보는 요청(OPTIONS)이면 바로 OK 해줌
    if request.method == 'OPTIONS':
        return '', 204

    try:
        data = request.get_json()
        if not data:
            return jsonify({"result": "error", "message": "데이터가 비어있습니다."}), 400
            
        access_code = data.get('access_code')
        
        if not access_code:
            return jsonify({"result": "error", "message": "접속 코드를 입력해주세요."}), 400
            
        project = Project.query.filter_by(access_code=access_code).first()
        
        is_new = False
        if not project:
            project = Project(access_code=access_code)
            db.session.add(project)
            db.session.commit()
            is_new = True
        
        results = AnalysisResult.query.filter_by(project_id=project.id).order_by(AnalysisResult.created_at.desc()).all()
        history_data = make_history_list(results)

        print(f"🔑 접속 성공: {access_code} -> Project ID: {project.id}")

        return jsonify({
            "result": "success",
            "message": "접속 성공",
            "project_id": project.id,
            "access_code": project.access_code,
            "history": history_data
        })

    except Exception as e:
        db.session.rollback() # [수정 3] 에러나면 DB 꼬인거 풀어줌
        print(f"❌ 접속 에러: {e}")
        return jsonify({"result": "error", "message": str(e)}), 500


# 1.5 히스토리 갱신
@app.route('/history', methods=['POST', 'OPTIONS'])
def get_history():
    if request.method == 'OPTIONS': return '', 204

    try:
        data = request.get_json()
        project_id = data.get('project_id')
        
        # 혹시 문자열로 들어오면 숫자로 변환 시도 (방어 코드)
        if isinstance(project_id, str) and project_id.isdigit():
            project_id = int(project_id)

        if not project_id or not isinstance(project_id, int):
            return jsonify({"result": "error", "message": "유효한 Project ID가 아닙니다."}), 400

        print(f"📜 히스토리 갱신 (ID: {project_id})")

        results = AnalysisResult.query.filter_by(project_id=project_id).order_by(AnalysisResult.created_at.desc()).all()
        history_data = make_history_list(results)
        
        return jsonify({
            "result": "success",
            "history": history_data
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"result": "error", "message": str(e)}), 500


# 2. 분석 요청
@app.route('/predict', methods=['POST', 'OPTIONS'])
def predict():
    if request.method == 'OPTIONS': return '', 204

    if 'image' not in request.files:
        return jsonify({"result": "error", "message": "이미지 없음"}), 400
    
    try:
        project_id = request.form.get('project_id')
        print(f"📸 업로드 요청 ID: {project_id}")

        # 프론트가 실수로 문자열 보내도 서버가 안 죽게 방어
        if not project_id:
             return jsonify({"result": "error", "message": "Project ID 누락"}), 400
        
        if not str(project_id).isdigit():
             return jsonify({"result": "error", "message": "Project ID는 숫자여야 합니다."}), 400
        
        file = request.files['image']
        filename = secure_filename(file.filename)
        
        s3.upload_fileobj(file, S3_BUCKET_NAME, filename, ExtraArgs={'ACL': 'public-read', 'ContentType': file.content_type})
        image_url = f"https://{S3_BUCKET_NAME}.s3.{S3_REGION}.amazonaws.com/{filename}"
        
        new_analysis = AnalysisResult(
            original_image_url=image_url, 
            status='processing',
            project_id=int(project_id) # 강제로 숫자로 변환
        )
        db.session.add(new_analysis)
        db.session.commit()

        return jsonify({"result": "success", "analysis_id": new_analysis.id})

    except Exception as e:
        db.session.rollback()
        print(f"❌ 업로드 에러: {e}")
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
                "analysis_id": result.id, 
                "status": "completed", 
                "original_image_url": result.original_image_url, 
                "details": json.loads(result.analysis_data)
            })
        
        print(f"🤖 AI 분석 시작 (ID: {analysis_id})")
        raw_json = inference.run_inference(result.original_image_url)
        
        result.analysis_data = raw_json
        result.status = 'completed'
        db.session.commit()

        return jsonify({
            "analysis_id": result.id, 
            "status": "completed", 
            "original_image_url": result.original_image_url, 
            "details": json.loads(raw_json)
        })

    except Exception as e:
        db.session.rollback()
        print(f"❌ 분석 에러: {e}")
        return jsonify({"status": "processing", "error": str(e)})


# 4. 리포트
@app.route('/report/<int:analysis_id>', methods=['GET'])
def get_report(analysis_id):
    result = db.session.get(AnalysisResult, analysis_id)
    if not result or result.status != 'completed':
        return jsonify({"error": "준비 안됨"}), 400

    try:
        analysis_details = json.loads(result.analysis_data)
        
        pdf = FPDF()
        pdf.add_page()
        pdf.add_font('Nanum', '', 'NanumGothic.ttf', uni=True)
        
        pdf.set_font('Nanum', '', 20)
        pdf.cell(0, 15, f'흠집 탐지 분석 보고서', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
        
        pdf.set_font('Nanum', '', 12)
        pdf.cell(0, 10, f"프로젝트: {result.project.access_code} / 날짜: {result.created_at.strftime('%Y-%m-%d')}", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
        pdf.ln(10)

        response_img = requests.get(result.original_image_url)
        image_stream = io.BytesIO(response_img.content)
        pdf.image(image_stream, x=30, y=None, w=150)
        pdf.ln(10)

        pdf.set_font('Nanum', '', 16)
        pdf.cell(0, 10, '분석 결과 상세', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        
        pdf.set_font('Nanum', '', 12)
        
        if not analysis_details:
            pdf.cell(0, 8, '탐지된 흠집이 없습니다.', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        else:
            pdf.set_font('Nanum', '', 10)
            pdf.cell(20, 8, "No.", border=1, align='C')
            pdf.cell(60, 8, "탐지된 결함 종류", border=1, align='C')
            pdf.cell(40, 8, "AI 확신도(%)", border=1, align='C')
            pdf.ln()

            for i, item in enumerate(analysis_details):
                cls_name = item.get('class', 'Unknown')
                conf = float(item.get('confidence', 0)) * 100
                pdf.cell(20, 8, str(i+1), border=1, align='C')
                pdf.cell(60, 8, cls_name, border=1, align='C')
                pdf.cell(40, 8, f"{conf:.1f}%", border=1, align='C')
                pdf.ln()

        return Response(bytes(pdf.output()), mimetype='application/pdf', headers={'Content-Disposition': f'attachment;filename=report_{analysis_id}.pdf'})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- DB 초기화 ---
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True)