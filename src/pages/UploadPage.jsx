import React from 'react';
import ProjectImage from '../components/ProjectImage';
import ImageUploadArea from '../components/ImageUploadArea'; // 공통 컴포넌트 사용
import HistoryList from '../components/HistoryList';         // 히스토리 컴포넌트 추가
import styles from './UploadPage.module.css';

const UploadPage = ({ projectData, fetchHistory, onUploadSuccess, projectInternalId }) => {
    const { id: projectCode, history } = projectData;

    return (
        <div className={styles.uploadPage}>
            {/* 1. 상단 프로젝트 배너 */}
            <div className={styles.projectNameSection}>
                <ProjectImage projectId={projectCode} />
            </div>
            
            {/* 2. 이미지 업로드 영역 (공통 컴포넌트로 교체하여 로직 통일) */}
            <div style={{ marginTop: '30px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                <ImageUploadArea 
                    projectId={projectInternalId}
                    fetchHistory={fetchHistory}
                    onUploadSuccess={onUploadSuccess}
                />
            </div>

            {/* 3. 하단 히스토리 목록 */}
            <div style={{ width: '90%', maxWidth: '800px', marginTop: '40px' }}>
                <HistoryList history={history} onSelectHistory={onSelectHistory} />
            </div>
        </div>
    );
};

export default UploadPage;