from app import app, db

# Flask 앱 컨텍스트 안에서 실행해야 함
with app.app_context():
    print("⚠️ 경고: 데이터베이스 초기화를 시작합니다.")
    print("모든 데이터가 영구적으로 삭제됩니다.")
    
    # 1. 모든 테이블 삭제 (Drop)
    db.drop_all()
    print("✅ 기존 테이블 삭제 완료")

    # 2. 모든 테이블 새로 생성 (Create)
    # app.py에 정의된 모델(Project, AnalysisResult) 구조대로 만들어짐
    db.create_all()
    print("✅ 새 테이블 생성 완료 (filename 컬럼 포함됨)")
    
    print("🎉 데이터베이스 초기화가 완료되었습니다!")