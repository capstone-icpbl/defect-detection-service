import React, { useState } from 'react';
import ProjectImage from '../components/ProjectImage';
import styles from './UploadPage.module.css';

// 백엔드 주소 (api 프리픽스 제거)
const BASE_URL = 'http://127.0.0.1:5000';

const UploadPage = ({ projectData, fetchHistory, onUploadSuccess, projectInternalId }) => {
    const { id: projectCode } = projectData;
    const [selectedFile, setSelectedFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFile = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            setPreview(URL.createObjectURL(file));
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || !projectInternalId) return;
        setIsUploading(true);
        
        try {
            // 1. 이미지 업로드 요청 (/predict)
            const formData = new FormData();
            formData.append('image', selectedFile);
            formData.append('project_id', projectInternalId);

            const uploadRes = await fetch(`${BASE_URL}/predict`, { 
                method: 'POST', 
                body: formData 
            });

            if (!uploadRes.ok) throw new Error(`업로드 실패: ${uploadRes.status}`);
            const uploadData = await uploadRes.json();
            const analysisId = uploadData.analysis_id;

            // 2. 결과 데이터 조회 요청 (/result/<id>) -> 여기서 실제 AI 추론 실행
            const resultRes = await fetch(`${BASE_URL}/result/${analysisId}`);
            if (!resultRes.ok) throw new Error('결과 조회 실패');
            
            const resultData = await resultRes.json();
            
            // 3. 성공 처리 및 페이지 이동
            if (onUploadSuccess) {
                // S3 URL이 있으면 사용, 없으면 로컬 프리뷰 사용
                const finalImageUrl = resultData.original_image_url || preview;
                onUploadSuccess(selectedFile, finalImageUrl, resultData);
            }
            
            if (fetchHistory) fetchHistory();

        } catch (err) {
            console.error("프로세스 에러:", err);
            alert(`오류가 발생했습니다: ${err.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className={styles.uploadPage}>
            <div className={styles.projectNameSection}>
                <ProjectImage projectId={projectCode} />
            </div>
            
            <div className={styles.uploadPreview} style={{ maxWidth: '800px', marginTop: '30px' }}>
                <h3 className={styles.historyTitle}>새 분석 요청</h3>
                
                {/* [수정] div onClick 제거, input이 전체 영역 커버 */}
                <div style={{ width: '100%', padding: '40px', border: '2px dashed #cbd5e1', borderRadius: '12px', position: 'relative', marginBottom: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px', backgroundColor: '#f8fafc' }}>
                    {preview ? (
                        <img src={preview} alt="Preview" style={{ maxHeight: '200px', maxWidth: '100%', objectFit: 'contain' }} />
                    ) : (
                        <div style={{ textAlign: 'center', color: '#64748b' }}>
                            <p style={{ fontSize: '24px', marginBottom: '8px' }}>📷</p>
                            <p>이미지를 클릭하여 선택하세요</p>
                        </div>
                    )}
                    <input 
                        type="file" 
                        onChange={handleFile} 
                        accept="image/*" 
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} 
                    />
                </div>

                <button className={styles.uploadButton} onClick={handleUpload} disabled={!selectedFile || isUploading}>
                    {isUploading ? '분석 중... (AI 연산 중)' : '분석 시작'}
                </button>
            </div>
        </div>
    );
};

export default UploadPage;