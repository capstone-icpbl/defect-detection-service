import React, { useState } from 'react';
import ProjectImage from '../components/ProjectImage';
import styles from './UploadPage.module.css';

const UploadPage = ({ projectData, fetchHistory, onUploadSuccess, projectInternalId }) => {
    const { id: projectCode, history } = projectData;
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
            const formData = new FormData();
            formData.append('image', selectedFile);
            formData.append('project_id', projectInternalId);

            const res = await fetch('/api/predict', { method: 'POST', body: formData });
            const data = await res.json();
            
            if (onUploadSuccess) onUploadSuccess(selectedFile, data.image_url || preview, data);
            if (fetchHistory) fetchHistory();
        } catch (err) {
            console.error(err);
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
                
                {/* div의 onClick 제거, input이 전체를 덮음 */}
                <div style={{ width: '100%', padding: '40px', border: '2px dashed #cbd5e1', borderRadius: '12px', position: 'relative', marginBottom: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
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
                    {isUploading ? '분석 중...' : '분석 시작'}
                </button>
            </div>
        </div>
    );
};

export default UploadPage;