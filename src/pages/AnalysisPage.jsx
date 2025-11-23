import React, { useState, useRef } from 'react';
import ProjectImage from '../components/ProjectImage'; 
// 기존 스타일(UploadPage)을 재사용하여 디자인 통일성 유지
import styles from './UploadPage.module.css'; 

// 1. [좌측] 이미지 뷰어 섹션 (바운딩 박스 기능 포함)
const ImageSection = ({ imageUrl, fileName, analysisResult }) => {
    const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
    const detections = analysisResult?.details || [];

    // 이미지 로드 시 원본 크기 저장 (SVG 좌표 매핑용)
    const handleImageLoad = (e) => {
        setImgSize({
            w: e.target.naturalWidth,
            h: e.target.naturalHeight
        });
    };

    return (
        <section style={{ flex: 2, display: 'flex', flexDirection: 'column', minWidth: '300px' }}>
            <div className={styles.uploadPreview} style={{ 
                border: 'none', padding: '20px', backgroundColor: '#fff',
                height: '100%', justifyContent: 'flex-start', cursor: 'default' 
            }}>
                <h3 className={styles.historyTitle} style={{ alignSelf: 'flex-start', fontSize: '18px', marginBottom: '20px' }}>
                    🔍 분석 대상 이미지
                </h3>
                
                {/* 이미지 영역 */}
                <div style={{ 
                    width: '100%', 
                    minHeight: '300px', 
                    backgroundColor: '#f8f9fa', 
                    borderRadius: '8px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    border: '1px solid #eee', 
                    overflow: 'hidden',
                    position: 'relative'
                }}>
                    {imageUrl ? (
                        <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                            <img 
                                src={imageUrl} 
                                onLoad={handleImageLoad}
                                alt="Analysis Target" 
                                style={{ 
                                    maxWidth: '100%', 
                                    maxHeight: '500px', 
                                    objectFit: 'contain',
                                    display: 'block'
                                }} 
                            />
                            
                            {/* 바운딩 박스 그리기 (SVG Overlay) */}
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
                <p style={{ marginTop: '15px', color: '#666', fontSize: '14px' }}>
                    파일명: {fileName || 'Unknown'}
                </p>
            </div>
        </section>
    );
};

// 2. [우측] 분류 섹션 (실제 AI 데이터 연동)
const ClassificationSection = ({ analysisResult }) => {
    // 백엔드 데이터가 없으면 빈 배열 처리
    const details = analysisResult?.details || [];

    return (
        <section style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: '280px' }}>
            <div className={styles.historySection} style={{ 
                margin: 0, 
                width: '100%', 
                height: '100%', 
                maxWidth: 'none',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <h2 className={styles.historyTitle} style={{ fontSize: '18px', marginBottom: '20px' }}>
                    📊 흠집 유형 분류
                </h2>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '500px' }}>
                    {details.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px 0', color: '#888' }}>
                            <p>탐지된 흠집이 없습니다.</p>
                            <p style={{ fontSize: '12px', marginTop: '5px' }}>표면 상태가 양호합니다.</p>
                        </div>
                    ) : (
                        details.map((item, idx) => (
                            <div key={idx} style={{ 
                                padding: '15px', 
                                backgroundColor: '#f8f9fa', 
                                borderRadius: '12px',
                                border: '1px solid #e9ecef',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <span style={{ 
                                        display: 'inline-block', 
                                        padding: '4px 8px', 
                                        backgroundColor: '#fff0f0', 
                                        color: '#d63384', 
                                        borderRadius: '6px', 
                                        fontWeight: 'bold', 
                                        fontSize: '12px',
                                        marginBottom: '4px',
                                        textTransform: 'uppercase'
                                    }}>
                                        {item.class}
                                    </span>
                                    <div style={{ fontSize: '12px', color: '#888' }}>
                                        좌표: [{item.bbox[0]}, {item.bbox[1]}]
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
                                        {Math.round(item.confidence * 100)}%
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#aaa' }}>신뢰도</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </section>
    );
};

// 3. [하단] 결과 섹션
const ResultSection = ({ analysisResult }) => {
    const count = analysisResult?.details?.length || 0;

    return (
        <section className={styles.historySection} style={{ 
            width: '100%', 
            maxWidth: '1200px', 
            marginTop: '30px', 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '30px',
            flexWrap: 'wrap',
            gap: '20px'
        }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
                <h2 className={styles.historyTitle} style={{ marginBottom: '10px' }}>
                    ✅ 최종 분석 결과 요약
                </h2>
                <p style={{ color: '#666', fontSize: '16px' }}>
                    {analysisResult 
                        ? `분석 ID #${analysisResult.analysis_id} 완료 - 총 ${count}개의 결함이 발견되었습니다.` 
                        : "분석 데이터를 불러오는 중입니다..."}
                </p>
            </div>

            <button 
                className={styles.uploadButton} 
                style={{ width: 'auto', padding: '12px 30px', fontSize: '16px' }}
                onClick={() => alert('PDF 다운로드 기능은 추후 지원됩니다.')}
            >
                📄 PDF 리포트 변환
            </button>
        </section>
    );
};

// 메인 페이지 컴포넌트
function AnalysisPage({ projectData, imageUrl, fileName, analysisResult }) {
    const { id: projectId } = projectData;

    return (
        <main className={styles.uploadPage} role="main" style={{ alignItems: 'center', paddingBottom: '100px' }}> 
            
            {/* 1. 상단 프로젝트 배너 */}
            <div className={styles.projectNameSection}>
                <ProjectImage projectId={projectId} /> 
            </div>
            
            {/* 2. 메인 컨텐츠 영역 (좌우 2열 구조) */}
            <div style={{ 
                display: 'flex', 
                flexDirection: 'row', 
                gap: '30px', 
                width: '90%', 
                maxWidth: '1200px', 
                marginTop: '30px',
                flexWrap: 'wrap' // 모바일 대응
            }}>
                {/* analysisResult를 전달하여 바운딩 박스 그림 */}
                <ImageSection imageUrl={imageUrl} fileName={fileName} analysisResult={analysisResult} />
                <ClassificationSection analysisResult={analysisResult} />
            </div>

            {/* 3. 하단 결과 섹션 */}
            <ResultSection analysisResult={analysisResult} />

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