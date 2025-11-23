import React from 'react';
// Header, ProjectImage, ImageUploadArea를 불러옵니다.
// import Header from '../components/Header';
import ProjectImage from '../components/ProjectImage'; 
import ImageUploadArea from '../components/ImageUploadArea'; 
// 페이지의 전체 스타일을 불러옵니다.
import styles from './UploadPage.module.css'; 

/**
 * 히스토리 항목의 타임스탬프를 보기 좋은 형식으로 변환합니다.
 */
const formatHistoryDate = (timestamp) => {
    try {
        const date = new Date(timestamp);
        // 한국어 로케일로 날짜와 시간을 표시
        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    } catch (e) {
        return '날짜 정보 없음';
    }
};

/**
 * 히스토리 항목 하나를 렌더링하는 컴포넌트입니다.
 */
const HistoryItem = ({ item }) => {
    // API 명세에 따라 history 항목의 구조를 가정합니다.
    const { analysis_id, status, timestamp, result_summary, image_url } = item;

    // 상태에 따라 표시할 텍스트 결정
    let statusText = status;
    let statusStyle = {};
    if (status === 'completed') {
        statusText = '분석 완료';
        statusStyle = { color: '#4caf50' }; // 초록색
    } else if (status === 'pending') {
        statusText = '분석 진행 중';
        statusStyle = { color: '#ff9800' }; // 주황색
    } else if (status === 'error') {
        statusText = '오류 발생';
        statusStyle = { color: '#f44336' }; // 빨간색
    }

    // 서버 URL을 사용하여 이미지 URL 완성 (Base URL을 ImageUploadArea.jsx에서 가져와야 하지만, 임시로 여기서 정의)
    const BASE_URL = 'http://127.0.0.1:5000';
    const fullImageUrl = image_url ? `${BASE_URL}${image_url}` : 'https://placehold.co/100x70/E0E0E0/444444?text=No+Img';

    return (
        <li className={styles.historyItem}>
            {/* 썸네일 이미지 */}
            <img 
                src={fullImageUrl} 
                alt={`Analysis ${analysis_id} thumbnail`} 
                className={styles.historyImage}
                onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/100x70/E0E0E0/444444?text=No+Img'; }}
            />
            {/* 상세 내용 */}
            <div className={styles.historyDetails}>
                <p className={styles.historySummary}>
                    {result_summary || `분석 ID: ${analysis_id}`}
                </p>
                <p className={styles.historyDate}>
                    분석 요청: {formatHistoryDate(timestamp)}
                </p>
                <p className={styles.historyStatus} style={statusStyle}>
                    상태: {statusText}
                </p>
            </div>
        </li>
    );
};


/**
 * 프로젝트 히스토리와 이미지 업로드를 표시하는 메인 페이지입니다.
 * @param {object} props
 * @param {object} props.projectData - App.jsx에서 받은 프로젝트 데이터 (id, history 등)
 * @param {function} props.fetchHistory - 히스토리 목록을 서버에서 새로 가져오는 함수
 */
function UploadPage({ projectData, fetchHistory }) {
    const { id: projectId, history } = projectData;

    return (
        <main className={styles.uploadPage} role="main"> 
            {/* 2. 프로젝트 섹션 배치 (래퍼 + 통합 이미지) */}
            <div className={styles.projectNameSection}>
                {/* 프로젝트 ID를 ProjectImage에 전달하여 이름 등을 표시할 수 있도록 합니다. */}
                <ProjectImage projectId={projectId} /> 
            </div>
            
            {/* 3. 이미지 업로드 영역 배치 */}
            <ImageUploadArea 
                projectId={projectId}
                fetchHistory={fetchHistory} // 업로드 성공 시 히스토리 갱신을 위해 전달
            /> 

            {/* 4. 분석 히스토리 섹션 */}
            <section className={styles.historySection}>
                <h2 className={styles.historyTitle}>
                    분석 히스토리 ({history.length}건)
                </h2>
                
                {history.length === 0 ? (
                    <p className={styles.historyNoData}>아직 분석 히스토리가 없습니다. 이미지를 업로드하고 분석을 시작해 보세요!</p>
                ) : (
                    <ul className={styles.historyList}>
                        {/* 최신 항목이 위로 오도록 역순으로 매핑 */}
                        {[...history].reverse().map(item => (
                            <HistoryItem key={item.analysis_id} item={item} />
                        ))}
                    </ul>
                )}
            </section>
        </main>
    );
}

// App.jsx에서 가져갈 수 있도록 default export 합니다.
export default UploadPage;