// src/components/HistoryList.jsx
import React from 'react';
import styles from '../pages/UploadPage.module.css'; // 스타일 재사용

const HistoryList = ({ history }) => {
    // 날짜 포맷팅 함수
    const formatDate = (timestamp) => {
        if (!timestamp) return '-';
        return new Date(timestamp).toLocaleString();
    };

    return (
        <div className={styles.historySection}>
            <h3 className={styles.historyTitle} style={{ marginBottom: '20px' }}>
                📜 최근 분석 이력
            </h3>
            
            {(!history || history.length === 0) ? (
                <p style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
                    아직 분석 기록이 없습니다.
                </p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {history.map((item, idx) => (
                        <div key={idx} style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            padding: '15px', 
                            border: '1px solid #eee', 
                            borderRadius: '8px',
                            backgroundColor: '#f8f9fa'
                        }}>
                            {/* 썸네일 (서버에서 URL을 준다고 가정, 없으면 플레이스홀더) */}
                            <div style={{ 
                                width: '60px', 
                                height: '60px', 
                                borderRadius: '4px', 
                                overflow: 'hidden', 
                                backgroundColor: '#ddd',
                                marginRight: '15px',
                                flexShrink: 0
                            }}>
                                {item.original_image_url ? (
                                    <img src={item.original_image_url} alt="thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <span style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', fontSize: '20px' }}>📷</span>
                                )}
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '4px' }}>
                                    분석 ID #{item.analysis_id || 'Unknown'}
                                </div>
                                <div style={{ fontSize: '12px', color: '#666' }}>
                                    {formatDate(item.timestamp)}
                                </div>
                            </div>

                            {/* 상태 뱃지 (예시) */}
                            <div style={{ 
                                padding: '6px 12px', 
                                borderRadius: '20px', 
                                fontSize: '12px', 
                                fontWeight: 'bold',
                                backgroundColor: '#e8f5e9',
                                color: '#2e7d32'
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