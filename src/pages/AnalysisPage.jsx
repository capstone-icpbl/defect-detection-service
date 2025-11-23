import React, { useState } from 'react';
import ProjectImage from '../components/ProjectImage'; 
import styles from './UploadPage.module.css'; 

const AnalysisPage = ({ projectData, imageUrl, fileName, analysisResult }) => {
    const { id: projectId } = projectData;
    const detections = analysisResult?.details || [];
    const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

    const handleImageLoad = (e) => {
        setImgSize({ w: e.target.naturalWidth, h: e.target.naturalHeight });
    };

    return (
        <main className={styles.uploadPage} role="main"> 
            <div className={styles.projectNameSection}>
                <ProjectImage projectId={projectId} /> 
            </div>
            
            <div style={{ width: '90%', maxWidth: '800px', marginTop: '30px' }}>
                {/* 이미지 및 바운딩 박스 뷰어 */}
                <div className={styles.uploadPreview} style={{ border: 'none', padding: '0', backgroundColor: 'transparent' }}>
                    <h3 className={styles.historyTitle} style={{ marginBottom: '15px' }}>
                        🔍 분석 결과: {fileName || 'Unknown'}
                    </h3>
                    
                    <div style={{ position: 'relative', width: '100%', backgroundColor: '#fff', padding: '10px', borderRadius: '12px', border: '1px solid #eee' }}>
                        {imageUrl ? (
                            <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                                <img 
                                    src={imageUrl} 
                                    alt="Analyzed" 
                                    onLoad={handleImageLoad}
                                    style={{ width: '100%', maxHeight: '500px', objectFit: 'contain', borderRadius: '8px', display: 'block' }} 
                                />
                                {/* SVG Overlay for Bounding Boxes */}
                                {imgSize.w > 0 && (
                                    <svg viewBox={`0 0 ${imgSize.w} ${imgSize.h}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                                        {detections.map((det, idx) => {
                                            const [x1, y1, x2, y2] = det.bbox;
                                            return (
                                                <g key={idx}>
                                                    <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} fill="none" stroke="red" strokeWidth={Math.max(2, imgSize.w / 300)} />
                                                    <text x={x1} y={y1 > 20 ? y1 - 5 : y1 + 20} fill="red" fontSize={Math.max(14, imgSize.w / 40)} fontWeight="bold" style={{ textShadow: '1px 1px 0 #fff' }}>
                                                        {det.class} ({Math.round(det.confidence * 100)}%)
                                                    </text>
                                                </g>
                                            );
                                        })}
                                    </svg>
                                )}
                            </div>
                        ) : (
                            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>이미지가 없습니다.</div>
                        )}
                    </div>
                </div>

                {/* 분석 결과 리스트 */}
                <section className={styles.historySection} style={{ marginTop: '30px' }}>
                    <h2 className={styles.historyTitle}>📊 상세 리포트</h2>
                    {detections.length > 0 ? (
                        <ul style={{ listStyle: 'none', padding: 0, marginTop: '15px' }}>
                            {detections.map((item, idx) => (
                                <li key={idx} style={{ padding: '12px', marginBottom: '8px', backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>⚠️ <b>{item.class}</b></span>
                                    <span style={{ color: '#666' }}>신뢰도: {Math.round(item.confidence * 100)}%</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p style={{ textAlign: 'center', color: '#888', padding: '20px' }}>탐지된 결함이 없습니다.</p>
                    )}
                </section>
            </div>
        </main>
    );
}

export default AnalysisPage;