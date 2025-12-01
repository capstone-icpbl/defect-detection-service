import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../pages/UploadPage.module.css';

const BASE_URL = 'http://52.78.156.240:5000';

const makeApiCallWithRetry = async (url, options, maxRetries = 3) => {
    let lastError = null;
    for (let i = 0; i < maxRetries; i++) {
        const delay = Math.pow(2, i) * 1000;
        if (i > 0) await new Promise(resolve => setTimeout(resolve, delay));
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({ message: '알 수 없는 오류' }));
                throw new Error(errorBody.message || `HTTP error! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            lastError = error;
            console.warn(`API retry ${i+1}/${maxRetries} failed:`, error);
        }
    }
    throw lastError;
};

function ImageUploadArea({ projectId, fetchHistory, onUploadSuccess }) {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragActive, setIsDragActive] = useState(false);
    const [uploadStatus, setUploadStatus] = useState({ type: '', message: '' });

    const handleFileChange = (file) => {
        if (file && file.type.startsWith('image/')) {
            setSelectedFile(file);
            setUploadStatus({ type: '', message: '' });
        } else {
            setUploadStatus({ type: 'error', message: '이미지 파일만 선택 가능합니다.' });
        }
    };

    const triggerFileSelect = () => {
        if (!isUploading && fileInputRef.current && !selectedFile) {
            fileInputRef.current.click();
        }
    };

    // 드래그 앤 드롭 핸들러
    const handleDragEnter = (e) => { e.preventDefault(); setIsDragActive(true); };
    const handleDragLeave = (e) => { e.preventDefault(); setIsDragActive(false); };
    const handleDragOver = (e) => { e.preventDefault(); };
    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragActive(false);
        if (e.dataTransfer.files.length > 0) handleFileChange(e.dataTransfer.files[0]);
    };

    // ⭐️ 핵심 로직: 2단계 API 호출 (업로드 -> 결과조회)
    const handleUpload = async () => {
        if (!selectedFile) return;
        if (!projectId) {
            setUploadStatus({ type: 'error', message: '프로젝트 ID 오류. 다시 로그인해주세요.' });
            return;
        }

        setIsUploading(true);
        setUploadStatus({ type: 'empty' }); // 분석 중입니다.. 없앰

        try {
            // Step 1: 이미지 업로드 (/predict)
            const formData = new FormData();
            formData.append('image', selectedFile);
            formData.append('project_id', projectId);

            const uploadResponse = await makeApiCallWithRetry(`${BASE_URL}/predict`, {
                method: 'POST',
                body: formData,
            });

            if (uploadResponse.result === 'success') {
                const analysisId = uploadResponse.analysis_id;
                
                // Step 2: 결과 상세 조회 (/result/<id>)
                const resultResponse = await makeApiCallWithRetry(`${BASE_URL}/result/${analysisId}`, {
                    method: 'GET'
                });

                setUploadStatus({ 
                    type: 'success' 
                });

                if (fetchHistory) fetchHistory();

                if (onUploadSuccess) {
                    onUploadSuccess(
                        selectedFile, 
                        resultResponse.original_image_url || uploadResponse.image_url, 
                        resultResponse // bbox 정보 포함
                    );
                } else {
                    navigate('/analysis');
                }
                setSelectedFile(null);
            } else {
                throw new Error(uploadResponse.message || '업로드 실패');
            }
        } catch (e) {
            console.error('Upload Error:', e);
            setUploadStatus({ type: 'error', message: `오류 발생: ${e.message}` });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <section className={styles.uploadContainer} style={{ marginTop: 0, marginBottom: '20px' }}>
            <div 
                className={`${styles.uploadPreview} ${selectedFile || isDragActive ? styles.active : ''}`}
                onClick={() => { if (!selectedFile) triggerFileSelect(); else setSelectedFile(null); }} 
                onDragEnter={handleDragEnter} 
                onDragOver={handleDragOver} 
                onDragLeave={handleDragLeave} 
                onDrop={handleDrop}
                style={{ cursor: isUploading ? 'wait' : 'pointer' }}
            >
                {/* ⭐️ Fix: input을 완벽히 숨김 */}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    onChange={(e) => handleFileChange(e.target.files[0])} 
                    accept="image/*" 
                    disabled={isUploading}
                />
                
                {selectedFile ? (
                    <>
                        <p className={styles.previewMsg}>선택된 파일: {selectedFile.name}</p>
                        <p className={styles.previewDesc}>클릭하여 취소하거나 아래 버튼을 눌러 분석하세요.</p>
                    </>
                ) : (
                    <>
                        {isUploading ? (
                            <div className={styles.loadingIndicator}>분석 진행 중...</div>
                        ) : (
                            <>
                                <svg className={styles.uploadSvgIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="17 8 12 3 7 8"></polyline>
                                    <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                                <p className={styles.previewMsg}>이미지를 드래그하거나 클릭하여 업로드</p>
                                <p className={styles.previewDesc}>PNG, JPEG 지원</p>
                            </>
                        )}
                    </>
                )}
            </div>

            <button 
                className={`${styles.uploadButton} ${isUploading ? styles.uploading : ''}`}
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
            >
                {isUploading ? 'AI 분석 중...' : '분석 시작'}
            </button>
            
            {uploadStatus.message && (
                <div 
                    className={`${styles.statusMessage}`} 
                    style={{ 
                        color: uploadStatus.type === 'error' ? '#721c24' : '#155724',
                        backgroundColor: uploadStatus.type === 'error' ? '#f8d7da' : '#d4edda',
                        border: `1px solid ${uploadStatus.type === 'error' ? '#f5c6cb' : '#c3e6cb'}`
                    }}
                >
                    {uploadStatus.message}
                </div>
            )}
        </section>
    );
}

export default ImageUploadArea;