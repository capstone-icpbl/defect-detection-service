import React from 'react';
import ProjectImage from '../components/ProjectImage'; 
// UploadPage와 동일한 스타일 사용
import styles from './UploadPage.module.css'; 

/**
 * 업로드된 이미지를 표시하는 컴포넌트입니다.
 * ImageUploadArea 대신 사용됩니다.
 */
const UploadedImageViewer = ({ imageUrl, fileName }) => {
    return (
        // UploadPage의 .uploadContainer 스타일을 재활용
        <section className={styles.uploadContainer} style={{ marginTop: '150px' }}> 
            <div className={styles.uploadPreview} style={{ border: 'none', padding: '0', backgroundColor: 'transparent' }}>
                <h3 className={styles.previewMsg} style={{ marginBottom: '15px' }}>
                    분석 이미지: {fileName || '이미지 없음'}
                </h3>
                {imageUrl ? (
                    <img 
                        src={imageUrl} 
                        alt={fileName || "Uploaded image for analysis"} 
                        // ⭐️ UploadArea의 너비를 활용한 이미지 스타일
                        style={{ maxWidth: '100%', maxHeight: '450px', objectFit: 'contain', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)' }}
                    />
                ) : (
                    <div style={{ height: '300px', width: '100%', backgroundColor: '#eee', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '8px' }}>
                        <p className={styles.previewDesc}>업로드된 이미지를 불러올 수 없습니다.</p>
                    </div>
                )}
            </div>

            {/* 임시 분석 버튼 (나중에 상세 분석 결과 영역으로 대체) */}
            <button className={styles.uploadButton} disabled style={{ marginTop: '20px', maxWidth: '300px' }}>
                분석 작업 완료됨 (Analysis Placeholder)
            </button>
        </section>
    );
};

/**
 * 이미지 분석 페이지의 메인 레이아웃입니다.
 */
function AnalysisPage({ projectData, imageUrl, fileName }) {
    const { id: projectId, history } = projectData;

    // UploadPage의 레이아웃을 복사합니다.
    return (
        <main className={styles.uploadPage} role="main"> 
            
            {/* 1. 프로젝트 섹션 (ProjectImage) - UploadPage와 동일한 위치 */}
            <div className={styles.projectNameSection}>
                <ProjectImage projectId={projectId} /> 
            </div>
            
            {/* 2. 이미지 표시 영역 (UploadArea 대체) */}
            <UploadedImageViewer imageUrl={imageUrl} fileName={fileName} />
            
            {/* 3. 분석 히스토리 섹션 - UploadPage와 동일하게 유지 */}
            <section className={styles.historySection} style={{ marginTop: '50px' }}>
                <h2 className={styles.historyTitle}>
                    분석 히스토리 ({history.length}건)
                </h2>
                {/* ... (히스토리 항목 렌더링 로직은 생략) ... */}
                <p>여기에 분석 결과 상세 내용이나 히스토리 목록이 표시될 예정입니다.</p>
            </section>
        </main>
    );
}

export default AnalysisPage;