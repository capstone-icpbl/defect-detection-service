from flask import Flask, request, jsonify, make_response, Response
from fpdf.enums import XPos, YPos
from dotenv import load_dotenv
from flask_cors import CORS
import os 
from flask_sqlalchemy import SQLAlchemy
import time
import random
import boto3
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
from fpdf import FPDF
import requests 
import io 
import json 
import inference 

load_dotenv()

app = Flask(__name__)
CORS(app)

# --- 데이터베이스 및 S3 설정 ---
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DB_URI') 
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

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

# --- DB 테이블 모델 (멀티테넌시 유지) ---

class Project(db.Model):
    __tablename__ = 'projects'
    id = db.Column(db.Integer, primary_key=True)
    # 접속 코드를 이름으로 사용 (예: ROBOTDETECT, DRONDETECT)
    access_code = db.Column(db.String(100), unique=True, nullable=False) 
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    
    results = db.relationship('AnalysisResult', backref='project', lazy=True)

class AnalysisResult(db.Model):
    __tablename__ = 'analysis_results'
    id = db.Column(db.Integer, primary_key=True)
    
    # 어떤 프로젝트(접속코드)에 속한 데이터인지 식별
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    
    original_image_url = db.Column(db.String(255), nullable=False)
    result_image_url = db.Column(db.String(255), nullable=True)
    analysis_data = db.Column(db.Text, nullable=True) 
    status = db.Column(db.String(50), nullable=False, default='processing')
    created_at = db.Column(db.DateTime, server_default=db.func.now())

# --- API ---

@app.route('/')
def index():
    return "모빌리티 표면 분석 AI 서버 (Access Code Ver. - Basic)"

# 1. 접속 코드 확인 및 히스토리 불러오기
@app.route('/api/access', methods=['POST'])
def access_project():
    data = request.get_json()
    access_code = data.get('access_code') # 예: "ROBOTDETECT"
    
    if not access_code:
        return jsonify({"result": "error", "message": "접속 코드를 입력해주세요."}), 400
        
    # 해당 코드를 가진 프로젝트 찾기
    project = Project.query.filter_by(access_code=access_code).first()
    
    is_new = False
    if not project:
        # 없으면 자동 생성 (시연 편의성)
        project = Project(access_code=access_code)
        db.session.add(project)
        db.session.commit()
        is_new = True
    
    # 해당 프로젝트의 과거 기록 조회 (최신순)
    results = AnalysisResult.query.filter_by(project_id=project.id).order_by(AnalysisResult.created_at.desc()).all()
    
    history_data = []
    for r in results:
        # 분석 데이터 파싱
        parsed_data = json.loads(r.analysis_data) if r.analysis_data else []
        
        # 목록에 보여줄 간단 요약 (결함 개수만 표시)
        defect_count = len(parsed_data) if isinstance(parsed_data, list) else 0
        summary_text = f"탐지된 결함: {defect_count}개"

        history_data.append({
            "id": r.id,
            "image_url": r.original_image_url,
            "status": r.status,
            "summary": summary_text,
            "date": r.created_at.strftime("%Y-%m-%d %H:%M")
        })

    return jsonify({
        "result": "success",
        "message": "접속 성공" if not is_new else "새 작업 공간 생성됨",
        "project_id": project.id,
        "access_code": project.access_code,
        "history": history_data
    })


# 2. 분석 요청 (project_id 필수)
@app.route('/api/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({"result": "error", "message": "이미지 없음"}), 400
    
    project_id = request.form.get('project_id')
    if not project_id:
        return jsonify({"result": "error", "message": "프로젝트 ID 누락"}), 400

    file = request.files['image']
    filename = secure_filename(file.filename)
    
    try:
        s3.upload_fileobj(file, S3_BUCKET_NAME, filename, ExtraArgs={'ACL': 'public-read', 'ContentType': file.content_type})
    except Exception as e:
        return jsonify({"result": "error", "message": str(e)}), 500

    image_url = f"https://{S3_BUCKET_NAME}.s3.{S3_REGION}.amazonaws.com/{filename}"
    
    new_analysis = AnalysisResult(
        original_image_url=image_url, 
        status='processing',
        project_id=project_id
    )
    db.session.add(new_analysis)
    db.session.commit()

    return jsonify({"result": "success", "analysis_id": new_analysis.id})


# 3. 결과 조회 (단순 AI 분석 결과 반환)
@app.route('/api/result/<int:analysis_id>', methods=['GET'])
def get_result(analysis_id):
    result = db.session.get(AnalysisResult, analysis_id)

    if not result:
        return jsonify({"result": "error", "message": "데이터 없음"}), 404

    if result.status == 'completed':
        return jsonify({
            "analysis_id": result.id, 
            "status": "completed", 
            "original_image_url": result.original_image_url, 
            "details": json.loads(result.analysis_data)
        })
    
    try:
        print(f"AI 분석 시작... (ID: {analysis_id})")
        
        # [수정] 복잡한 등급 로직 제거 -> YOLO 결과 그대로 저장
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
        print(f"오류: {e}")
        return jsonify({"status": "processing", "error": str(e)})


# 4. PDF 보고서 생성 (기본 버전)
@app.route('/api/report/<int:analysis_id>', methods=['GET'])
def get_report(analysis_id):
    result = db.session.get(AnalysisResult, analysis_id)
    if not result or result.status != 'completed':
        return jsonify({"error": "준비 안됨"}), 400

    try:
        # 리스트 형태의 분석 데이터 로드
        analysis_details = json.loads(result.analysis_data)
        
        pdf = FPDF()
        pdf.add_page()
        pdf.add_font('Nanum', '', 'NanumGothic.ttf', uni=True)
        
        # 제목
        pdf.set_font('Nanum', '', 20)
        pdf.cell(0, 15, f'모빌리티 표면 분석 보고서', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
        
        pdf.set_font('Nanum', '', 12)
        pdf.cell(0, 10, f"프로젝트: {result.project.access_code} / 날짜: {result.created_at.strftime('%Y-%m-%d')}", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
        pdf.ln(10)

        # 이미지
        response_img = requests.get(result.original_image_url)
        image_stream = io.BytesIO(response_img.content)
        pdf.image(image_stream, x=30, y=None, w=150)
        pdf.ln(10)

        # 결과 목록 (등급/권장조치 제거됨)
        pdf.set_font('Nanum', '', 16)
        pdf.cell(0, 10, '분석 결과 상세', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        
        pdf.set_font('Nanum', '', 12)
        
        if not analysis_details:
            pdf.cell(0, 8, '탐지된 흠집이 없습니다.', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        else:
            # 헤더
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
    #db.drop_all() 
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True)