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

# --- DB 테이블 모델 ---
class AnalysisResult(db.Model):
    __tablename__ = 'analysis_results'
    id = db.Column(db.Integer, primary_key=True)
    original_image_url = db.Column(db.String(255), nullable=False)
    result_image_url = db.Column(db.String(255), nullable=True)
    analysis_data = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(50), nullable=False, default='processing')
    created_at = db.Column(db.DateTime, server_default=db.func.now())


# API
@app.route('/')
def index():
    return "백엔드 API 서버 (AI 연동됨)"

@app.route('/api/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({"result": "error", "message": "이미지 파일이 없습니다."}), 400
    
    file = request.files['image']
    
    if file.filename == '':
        return jsonify({"result": "error", "message": "파일이 선택되지 않았습니다."}), 400

    filename = secure_filename(file.filename)
    try:
        s3.upload_fileobj(file, S3_BUCKET_NAME, filename, ExtraArgs={'ACL': 'public-read', 'ContentType': file.content_type})
    except Exception as e:
        return jsonify({"result": "error", "message": str(e)}), 500

    image_url = f"https://{S3_BUCKET_NAME}.s3.{S3_REGION}.amazonaws.com/{filename}"
    
    new_analysis = AnalysisResult(original_image_url=image_url, status='processing')
    db.session.add(new_analysis)
    db.session.commit()

    print(f"새 분석 요청(이미지: {image_url})이 DB에 저장됨 (ID: {new_analysis.id})")

    return jsonify({"result": "success", "message": "분석 요청이 성공적으로 접수되었습니다. 결과를 확인해주세요.", "analysis_id": new_analysis.id})

# AI를 실행하는 로직
@app.route('/api/result/<int:analysis_id>', methods=['GET'])
def get_result(analysis_id):
    result = AnalysisResult.query.get(analysis_id)

    if result is None:
        return jsonify({"result": "error", "message": "해당 ID의 분석 결과를 찾을 수 없습니다."}), 404

    # 1. 이미 분석 완료된 거면 DB에 저장된거 바로 줌
    if result.status == 'completed':
        return jsonify({"analysis_id": result.id, "status": result.status, "original_image_url": result.original_image_url, "details": result.analysis_data})
    
    # 2. 아직 처리중이면 AI를 실행함
    try:
        print(f"AI 분석 시작... (ID: {analysis_id})")
        
        # inference.py의 함수를 호출해서 결과를 받아옴
        real_analysis_json = inference.run_inference(result.original_image_url)
        
        print(f"AI 분석 완료: {real_analysis_json}")

        # 결과를 DB에 저장하고 상태를 완료로 바꿈
        result.analysis_data = real_analysis_json
        result.status = 'completed'
        db.session.commit()

        return jsonify({"analysis_id": result.id, "status": result.status, "original_image_url": result.original_image_url, "details": result.analysis_data})

    except Exception as e:
        print(f"AI 실행 중 오류 발생: {e}")
        # 오류 나면 일단 계속 로딩중인 척 하거나 에러 메시지 반환
        return jsonify({"status": "processing", "error": str(e)})

# --- PDF 보고서 생성 및 다운로드 API ---
@app.route('/api/report/<int:analysis_id>', methods=['GET'])
def get_report(analysis_id):
    result = db.session.get(AnalysisResult, analysis_id)

    if result is None:
        return jsonify({"result": "error", "message": "해당 ID의 분석 결과를 찾을 수 없습니다."}), 404
        
    if result.status != 'completed':
        return jsonify({"result": "error", "message": "분석이 아직 완료되지 않았습니다."}), 400

    try:
        pdf = FPDF()
        pdf.add_page()
        
        pdf.add_font('Nanum', '', 'NanumGothic.ttf', uni=True)
        
        pdf.set_font('Nanum', '', 24)
        pdf.cell(0, 20, f'AI 흠집 탐지 분석 보고서 (ID: {result.id})', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
        
        response_img = requests.get(result.original_image_url)
        image_stream = io.BytesIO(response_img.content)
        
        pdf.image(image_stream, x=30, y=40, w=150)
        pdf.ln(120)

        pdf.set_font('Nanum', '', 16)
        pdf.cell(0, 10, '분석 결과', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_font('Nanum', '', 12)
        
        analysis_details = json.loads(result.analysis_data)
        
        # AI 결과가 리스트 형태([{},{}])로 오므로 반복문으로 출력
        if isinstance(analysis_details, list):
            if not analysis_details:
                pdf.cell(0, 8, '탐지된 흠집이 없습니다.', new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            else:
                for i, item in enumerate(analysis_details):
                    text = f"{i+1}. 종류: {item.get('class')} / 확률: {item.get('confidence')}"
                    pdf.cell(0, 8, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        else:
             for key, value in analysis_details.items():
                pdf.cell(0, 8, f'- {key}: {value}', new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        pdf_output = bytes(pdf.output())
        
        return Response(
            pdf_output,
            mimetype='application/pdf',
            headers={'Content-Disposition': f'attachment;filename=report_{analysis_id}.pdf'}
        )

    except Exception as e:
        print(f"!!!! PDF 생성 실제 오류: {e} !!!!")
        return jsonify({"result": "error", "message": f"PDF 생성 중 오류 발생: {str(e)}"}), 500

# --- 앱 실행 코드 ---
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True)