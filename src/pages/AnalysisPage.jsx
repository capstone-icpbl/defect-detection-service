import React, { useState } from 'react';
import ProjectImage from '../components/ProjectImage';
import ImageUploadArea from '../components/ImageUploadArea';
import HistoryList from '../components/HistoryList';
import styles from './AnalysisPage.module.css';

const BASE_URL = 'http://127.0.0.1:5000';

// 1. [좌측] 이미지 뷰어 섹션 (SVG 오버레이 기능 포함)
const ImageSection = ({ imageUrl, fileName, analysisResult }) => {
    const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
    const detections = analysisResult?.details || [];

    const handleImageLoad = (e) => {
        setImgSize({
            w: e.target.naturalWidth,
            h: e.target.naturalHeight
        });
    };

    return (
        <section className={styles.imageSection}>
            <div className={styles.imageCard}>
                <h3 className={styles.sectionTitle}>🔍 분석 대상 이미지</h3>
                
                <div className={styles.imageWrapper}>
                    {imageUrl ? (
                        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <img 
                                src={imageUrl} 
                                onLoad={handleImageLoad}
                                alt="Analysis Target" 
                                className={styles.analyzedImage}
                            />
                            
                            {/* 바운딩 박스 그리기 (SVG Overlay - 스타일 변경 없이 기본 기능 유지) */}
                            {imgSize.w > 0 && (
                                <svg 
                                    viewBox={`0 0 ${imgSize.w} ${imgSize.h}`} 
                                    style={{ 
                                        position: 'absolute', 
                                        top: 0, 
                                        left: 0, 
                                        width: '100%', 
                                        height: '100%', 
                                        pointerEvents: 'none' 
                                    }}
                                >
                                    {detections.map((det, idx) => {
                                        const [x1, y1, x2, y2] = det.bbox;
                                        const width = x2 - x1;
                                        const height = y2 - y1;
                                        return (
                                            <g key={idx}>
                                                <rect 
                                                    x={x1} y={y1} width={width} height={height} 
                                                    fill="none" 
                                                    stroke="red" 
                                                    strokeWidth={Math.max(2, imgSize.w / 300)} 
                                                />
                                                <text 
                                                    x={x1} 
                                                    y={y1 > 20 ? y1 - 5 : y1 + 15} 
                                                    fill="red" 
                                                    fontSize={Math.max(12, imgSize.w / 50)} 
                                                    fontWeight="bold"
                                                    style={{ textShadow: '1px 1px 0 #fff' }}
                                                >
                                                    {det.class} ({Math.round(det.confidence * 100)}%)
                                                </text>
                                            </g>
                                        );
                                    })}
                                </svg>
                            )}
                        </div>
                    ) : (
                        <span style={{ color: '#aaa' }}>이미지가 없습니다.</span>
                    )}
                </div>
                <p className={styles.fileName}>파일명: {fileName || 'Unknown'}</p>
            </div>
        </section>
    );
};

// 2. [우측] 분류 섹션
const ClassificationSection = ({ analysisResult }) => {
    const details = analysisResult?.details || [];

    return (
        <section className={styles.classificationSection}>
            <div className={styles.classificationCard}>
                <h2 className={styles.sectionTitle}>📊 흠집 유형 분류</h2>

                <div className={styles.resultList}>
                    {details.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px 0', color: '#888' }}>
                            <p>탐지된 흠집이 없습니다.</p>
                            <p style={{ fontSize: '12px', marginTop: '5px' }}>표면 상태가 양호합니다.</p>
                        </div>
                    ) : (
                        details.map((item, idx) => (
                            <div key={idx} className={styles.resultItem}>
                                <div>
                                    <span className={styles.classBadge}>
                                        {item.class}
                                    </span>
                                    <div className={styles.detectedLabel}>
                                        좌표: [{item.bbox[0]}, {item.bbox[1]}]
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div className={styles.confidenceValue}>
                                        {Math.round(item.confidence * 100)}%
                                    </div>
                                    <div className={styles.confidenceLabel}>신뢰도</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </section>
    );
};

// 3. [하단] 결과 섹션 (PDF 다운로드 기능)
const ResultSection = ({ analysisResult }) => {
    const count = analysisResult?.details?.length || 0;
    const analysisId = analysisResult?.analysis_id;

    // PDF 다운로드 핸들러
    const handleDownloadPdf = () => {
        if (!analysisId) {
            alert("분석 결과 ID가 없습니다.");
            return;
        }
        // 백엔드 엔드포인트를 호출하여 새 창에서 PDF 열기
        const pdfUrl = `${BASE_URL}/report/${analysisId}`;
        window.open(pdfUrl, '_blank');
    };

    return (
        <section className={styles.finalResultSection}>
            <div style={{ flex: 1, minWidth: '200px' }}>
                <h2 className={styles.sectionTitle} style={{ marginBottom: '10px' }}>
                    ✅ 최종 분석 결과 요약
                </h2>
                <p className={styles.resultText}>
                    {analysisResult 
                        ? `분석 ID #${analysisId} 완료 - 총 ${count}개의 결함이 발견되었습니다.` 
                        : "데이터를 불러오는 중입니다..."}
                </p>
            </div>

            <button 
                className={styles.pdfButton} 
                onClick={handleDownloadPdf}
                disabled={!analysisResult}
            >
                📄 PDF 리포트 변환
            </button>
        </section>
    );
};

// 메인 페이지 컴포넌트
function AnalysisPage({ projectData, imageUrl, fileName, analysisResult, fetchHistory, onUploadSuccess, projectInternalId }) {
    const { id: projectId, history } = projectData;

    return (
        <main className={styles.pageContainer}>
            
            {/* 1. 상단 프로젝트 배너 */}
            <div className={styles.projectNameSection}>
                <ProjectImage projectId={projectId} /> 
            </div>

            {/* 2. 상단 업로드 영역 (ImageUploadArea 재사용) */}
            <div style={{ marginTop: '30px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                <ImageUploadArea 
                    projectId={projectInternalId}
                    fetchHistory={fetchHistory}
                    onUploadSuccess={onUploadSuccess}
                />
            </div>
            
            {/* 3. 메인 컨텐츠 영역 (좌우 2열 구조) */}
            <div className={styles.contentContainer}>
                <ImageSection imageUrl={imageUrl} fileName={fileName} analysisResult={analysisResult} />
                <ClassificationSection analysisResult={analysisResult} />
            </div>

            {/* 4. 하단 결과 요약 및 PDF 버튼 */}
            <ResultSection analysisResult={analysisResult} />
            
            {/* 5. 최하단 히스토리 목록 */}
            <div style={{ width: '90%', maxWidth: '800px', marginTop: '40px' }}>
                <HistoryList history={history} />
            </div>
                

            {/* 모바일 대응 스타일 */}
            <style>{`
                @media (max-width: 900px) {
                    div[style*="flex-direction: row"] {
                        flex-direction: column !important;
                    }
                }
            `}</style>
        </main>
    );
}

export default AnalysisPage;