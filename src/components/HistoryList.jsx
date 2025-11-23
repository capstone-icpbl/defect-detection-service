import React from 'react';
// 스타일 파일 경로 재확인: src/components -> src/pages/UploadPage.module.css
import styles from '../pages/UploadPage.module.css';

const HistoryList = ({ history }) => {
    // 1. 배열 안전성 확보
    const rawHistory = Array.isArray(history) ? history : [];

    // 2. 강력 필터링: analysis_id가 있는 항목만 표시
    const validHistory = rawHistory.filter(item => item.analysis_id);

    const formatDate = (timestamp) => {
        if (!timestamp) return '-';
        return new Date(timestamp).toLocaleString();
    };

    return (
        <div className={styles.historySection} style={{ marginTop: '20px', width: '100%' }}>
            <h3 className={styles.historyTitle} style={{ marginBottom: '20px' }}>
                📜 최근 분석 이력
            </h3>
            
            {validHistory.length === 0 ? (
                <div style={{ 
                    padding: '40px', 
                    textAlign: 'center', 
                    color: '#888', 
                    backgroundColor: '#f8f9fa', 
                    borderRadius: '8px',
                    border: '1px dashed #ccc'
                }}>
                    <p style={{ fontSize: '16px', marginBottom: '8px' }}>아직 분석 기록이 없습니다.</p>
                    <p style={{ fontSize: '14px' }}>이미지를 업로드하여 첫 번째 분석을 시작해보세요!</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {validHistory.map((item, idx) => (
                        <div 
                            key={idx} 
                            // ⭐️ 클릭 이벤트 강화 (버블링 방지 및 전달)
                            onClick={(e) => {
                                e.stopPropagation(); 
                                if (onSelectHistory) onSelectHistory(item);
                            }}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                padding: '15px', 
                                border: '1px solid #eee', 
                                borderRadius: '8px',
                                backgroundColor: '#fff',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                                cursor: 'pointer',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                // ⭐️ 가려짐 방지를 위한 스타일
                                position: 'relative',
                                zIndex: 10,
                                userSelect: 'none'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                                e.currentTarget.style.borderColor = '#007bff';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.03)';
                                e.currentTarget.style.borderColor = '#eee';
                            }}
                        >
                            {/* 1. 실제 이미지 썸네일 표시 */}
                            <div style={{ 
                                width: '60px', 
                                height: '60px', 
                                borderRadius: '6px', 
                                overflow: 'hidden', 
                                backgroundColor: '#f0f0f0',
                                marginRight: '15px',
                                flexShrink: 0,
                                border: '1px solid #ddd',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {item.image_url || item.original_image_url ? (
                                    <img 
                                        src={item.image_url || item.original_image_url} 
                                        alt="thumbnail" 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                    />
                                ) : (
                                    <span style={{ fontSize: '20px' }}>🖼️</span>
                                )}
                            </div>

                            <div style={{ flex: 1 }}>
                                {/* 2. 분석 ID 대신 파일명 표시 (없으면 ID를 백업으로 표시) */}
                                <div style={{ 
                                    fontWeight: 'bold', 
                                    fontSize: '16px', 
                                    marginBottom: '4px', 
                                    color: '#333' 
                                }}>
                                    {item.filename || `분석 ID #${item.analysis_id || item.id}`}
                                </div>
                                <div style={{ fontSize: '12px', color: '#666' }}>
                                    {formatDate(item.timestamp || item.date)}
                                </div>
                            </div>
                            <div style={{ 
                                padding: '6px 12px', 
                                borderRadius: '20px', 
                                fontSize: '12px', 
                                fontWeight: 'bold',
                                backgroundColor: '#e8f5e9',
                                color: '#2e7d32',
                                whiteSpace: 'nowrap'
                            }}>
                                완료됨
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default HistoryList;