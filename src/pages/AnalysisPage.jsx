import React from 'react';
import ProjectImage from '../components/ProjectImage'; 
// 분리된 전용 스타일 파일 import
import styles from './AnalysisPage.module.css'; 

// 1. [좌측] 이미지 뷰어 섹션
const ImageSection = ({ imageUrl, fileName }) => {
    return (
        <section className={styles.imageSection}>
            <div className={styles.imageCard}>
                <h3 className={styles.sectionTitle}>
                    🔍 분석 대상 이미지
                </h3>
                
                <div className={styles.imageWrapper}>
                    {imageUrl ? (
                        <img 
                            src={imageUrl} 
                            alt="Analysis Target" 
                            className={styles.analyzedImage}
                        />
                    ) : (
                        <span style={{ color: '#aaa' }}>이미지가 없습니다.</span>
                    )}
                </div>
                <p className={styles.fileName}>
                    파일명: {fileName || 'Unknown'}
                </p>
            </div>
        </section>
    );
};

// 2. [우측] 분류 섹션
const ClassificationSection = ({ analysisResult }) => {
    const details = analysisResult?.details || [
        { class: 'Scratch', confidence: 0.92, bbox: [] },
        { class: 'Dent', confidence: 0.88, bbox: [] }
    ];

    return (
        <section className={styles.classificationSection}>
            <div className={styles.classificationCard}>
                <h2 className={styles.sectionTitle}>
                    📊 흠집 유형 분류
                </h2>

                <p className={styles.classificationDesc}>
                    AI 모델이 이미지에서 감지한<br/>
                    결함의 종류와 신뢰도입니다.
                </p>

                <div className={styles.resultList}>
                    {details.map((item, idx) => (
                        <div key={idx} className={styles.resultItem}>
                            <div>
                                <span className={styles.classBadge}>
                                    {item.class}
                                </span>
                                <div className={styles.detectedLabel}>Detected</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div className={styles.confidenceValue}>
                                    {Math.round(item.confidence * 100)}%
                                </div>
                                <div className={styles.confidenceLabel}>신뢰도</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

// 3. [하단] 결과 및 PDF 변환 섹션
const ResultSection = ({ analysisResult }) => {
    return (
        <section className={styles.finalResultSection}>
            <div style={{ flex: 1 }}>
                <h2 className={styles.sectionTitle} style={{ marginBottom: '10px' }}>
                    ✅ 최종 분석 결과 요약
                </h2>
                <p className={styles.resultText}>
                    {analysisResult 
                        ? `분석 ID #${analysisResult.analysis_id}에 대한 처리가 완료되었습니다.` 
                        : "입력받은 이미지의 흠집 유형을 분석한 결과를 나타내는 공간입니다."}
                </p>
            </div>

            <button className={styles.pdfButton}>
                📄 PDF 리포트 변환
            </button>
        </section>
    );
};

// 메인 페이지 컴포넌트
function AnalysisPage({ projectData, imageUrl, fileName, analysisResult }) {
    const { id: projectId } = projectData;

    return (
        <main className={styles.pageContainer} role="main"> 
            
            {/* 1. 상단 프로젝트 배너 */}
            <div className={styles.projectNameSection}>
                <ProjectImage projectId={projectId} /> 
            </div>
            
            {/* 2. 메인 컨텐츠 영역 (좌우 2열 구조) */}
            <div className={styles.contentContainer}>
                <ImageSection imageUrl={imageUrl} fileName={fileName} />
                <ClassificationSection analysisResult={analysisResult} />
            </div>

            {/* 3. 하단 결과 섹션 */}
            <ResultSection analysisResult={analysisResult} />
        </main>
    );
}

export default AnalysisPage;