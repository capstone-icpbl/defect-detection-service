import React, { useState, useRef } from 'react';
import styles from '../pages/UploadPage.module.css';

// API Configuration (App.jsx와 동일하게 설정)
const BASE_URL = 'http://127.0.0.1:5000'; 

/**
 * Exponential backoff을 사용하여 API 호출을 시도하는 유틸리티 함수입니다.
 */
const makeApiCallWithRetry = async (url, options, maxRetries = 3) => {
    let lastError = null;
    for (let i = 0; i < maxRetries; i++) {
        // 지연 시간: 1s, 2s, 4s...
        const delay = Math.pow(2, i) * 1000; 
        if (i > 0) await new Promise(resolve => setTimeout(resolve, delay));

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                // HTTP 오류 응답을 처리
                const errorBody = await response.json().catch(() => ({ message: '알 수 없는 오류' }));
                throw new Error(`HTTP error! Status: ${response.status}. Detail: ${errorBody.message || JSON.stringify(errorBody)}`);
            }
            return await response.json();
        } catch (error) {
            lastError = error;
            // console.warn(`Attempt ${i + 1} failed for ${url}. Retrying in ${delay / 1000}s...`, error.message);
        }
    }
    // 최대 재시도 횟수 후에도 실패하면 오류를 throw
    throw new Error(`API call failed after ${maxRetries} attempts: ${lastError.message}`);
};


/**
 * 이미지 업로드 및 분석 요청을 처리하는 컴포넌트입니다.
 * @param {object} props
 * @param {string} props.projectId - /api/access에서 받은 프로젝트 ID
 * @param {function} props.fetchHistory - UploadPage에서 받은, 히스토리 목록을 갱신하는 함수 (추가됨)
 */
function ImageUploadArea({ projectId, fetchHistory }) { // <-- fetchHistory prop 추가
    const fileInputRef = useRef(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    // 드래그 중인 상태를 위한 State 추가
    const [isDragActive, setIsDragActive] = useState(false); 
    const [uploadStatus, setUploadStatus] = useState({ type: '', message: '' }); // success | error | empty

    // 파일 선택 핸들러 (Input 또는 Drop 이벤트에서 호출)
    const handleFileChange = (file) => {
        if (file && file.type.startsWith('image/')) {
            setSelectedFile(file);
            setUploadStatus({ type: '', message: '' }); // 새 파일 선택 시 상태 초기화
        } else {
             setUploadStatus({ type: 'error', message: '이미지 파일만 선택할 수 있습니다.' });
        }
    };

    // 숨겨진 파일 입력을 트리거
    const triggerFileSelect = () => {
        if (!isUploading && fileInputRef.current && !selectedFile) {
            fileInputRef.current.click();
        }
    };

    // --- 드래그 앤 드롭 핸들러 ---
    const handleDragEnter = (e) => { 
        e.preventDefault(); 
        setIsDragActive(true); 
    }; 
    const handleDragLeave = (e) => { 
        e.preventDefault(); 
        setIsDragActive(false); 
    }; 
    const handleDragOver = (e) => { 
        e.preventDefault(); 
    }; 
    const handleDrop = (e) => { 
        e.preventDefault(); 
        setIsDragActive(false); 
        const droppedFiles = e.dataTransfer.files;
        if (droppedFiles.length > 0) {
            // 드롭된 파일 중 첫 번째 파일만 처리
            handleFileChange(droppedFiles[0]); 
        }
    };
    // ----------------------------

    // 이미지 분석 요청 API 호출 (API Spec 2번: /api/predict)
    const handleUpload = async () => {
        if (!selectedFile) {
            setUploadStatus({ type: 'error', message: '먼저 분석할 이미지를 선택해 주세요.' });
            return;
        }
        if (!projectId) {
            setUploadStatus({ type: 'error', message: '오류: 프로젝트 ID가 누락되었습니다. 다시 접속해주세요.' });
            return;
        }

        setIsUploading(true);
        setUploadStatus({ type: 'empty', message: '이미지 업로드 및 분석을 요청 중입니다...' });

        const apiUrl = `${BASE_URL}/api/predict`;
        const formData = new FormData();
        formData.append('image', selectedFile);
        formData.append('project_id', projectId); // 필수: /api/access에서 받은 ID

        try {
            const response = await makeApiCallWithRetry(apiUrl, {
                method: 'POST',
                // Content-Type: 'multipart/form-data'는 FormData를 사용할 때 자동으로 설정됨
                body: formData, 
            });
            
            // makeApiCallWithRetry에서 response.ok 체크 및 에러 처리를 담당
            
            if (response.result === 'success') {
                // 성공 메시지 및 분석 ID 표시
                setUploadStatus({ 
                    type: 'success', 
                    message: `업로드 성공! 분석 ID: ${response.analysis_id}. 분석 결과는 잠시 후 히스토리에 반영됩니다.` 
                });
                setSelectedFile(null); // 파일 선택 초기화
                
                // --- 핵심 수정: 히스토리 새로고침 함수 호출 ---
                if (fetchHistory) {
                    fetchHistory(); 
                }
                // ----------------------------------------
                
            } else {
                 setUploadStatus({ type: 'error', message: `분석 요청 실패: ${response.message || '알 수 없는 응답'}` });
            }

        } catch (e) {
            console.error('Image Upload Error:', e);
            setUploadStatus({ type: 'error', message: `API 요청 중 오류 발생: ${e.message}` });
        } finally {
            setIsUploading(false);
        }
    };

    // 드래그 앤 드롭 및 클릭 영역의 내용
    const uploadAreaContent = (
        <>
            {/* 실제 파일 선택 input (숨겨져 있음) */}
            <input 
                type="file" 
                ref={fileInputRef} 
                className={styles.hiddenFileInput} 
                // handleFileChange는 이벤트 객체를 받아 처리
                onChange={(e) => handleFileChange(e.target.files[0])} 
                accept="image/*" // 이미지 파일만 허용
                disabled={isUploading}
            />
            {selectedFile ? (
                <>
                    <p className={styles.previewMsg}>파일이 선택되었습니다: {selectedFile.name}</p>
                    <p className={styles.previewDesc}>분석을 시작하려면 '업로드 및 분석' 버튼을 눌러주세요. (선택 취소하려면 다시 클릭)</p>
                </>
            ) : (
                <>
                    {/* 업로드 아이콘 */}
                    <svg className={styles.uploadSvgIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    <p className={styles.previewMsg}>이미지를 드래그하거나 클릭하여 파일을 선택하세요</p>
                    <p className={styles.previewDesc}>PNG, JPEG 등의 이미지 파일을 지원합니다. (드래그 앤 드롭 가능)</p>
                </>
            )}
            <div className={styles.integratedSearchInfo}>
                {/* 돋보기 아이콘 */}
                <svg className={styles.searchIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <span className={styles.searchText}>
                    현재 프로젝트 ID: {projectId || '로딩 중...'}
                </span>
            </div>
        </>
    );

    return (
        <section className={styles.uploadContainer}>
            <div 
                className={`${styles.uploadPreview} ${selectedFile || isDragActive ? styles.active : ''}`}
                // 파일이 선택되지 않았을 때만 클릭으로 파일 선택을 트리거
                onClick={() => { if (!selectedFile) triggerFileSelect(); else setSelectedFile(null); }} 
                // 드래그 앤 드롭 이벤트 추가
                onDragEnter={handleDragEnter} 
                onDragOver={handleDragOver} 
                onDragLeave={handleDragLeave} 
                onDrop={handleDrop} 
                role="button"
                tabIndex="0"
                aria-label="이미지 파일 선택 영역"
            >
                {uploadAreaContent}
            </div>

            <button 
                className={`${styles.uploadButton} ${isUploading ? styles.uploading : ''}`}
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
            >
                {isUploading ? '분석 요청 중...' : '업로드 및 분석 요청'}
            </button>
            
            {/* 상태 메시지 */}
            {uploadStatus.message && (
                <div className={`${styles.statusMessage} ${styles[uploadStatus.type]}`}>
                    {uploadStatus.message}
                </div>
            )}
        </section>
    );
}

export default ImageUploadArea;