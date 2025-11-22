import React, { useState, useCallback, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import UploadPage from './pages/UploadPage';

// API Configuration
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
            // console.warn(`Attempt ${i + 1} failed for ${url}. Retrying in ${delay / 1000}s...`, error.message); // 콘솔 로깅은 실제 앱에서는 주석 처리
        }
    }
    // 최대 재시도 횟수 후에도 실패하면 오류를 throw
    throw new Error(`API call failed after ${maxRetries} attempts: ${lastError.message}`);
};


// 메인 애플리케이션 컴포넌트 (라우팅 및 전역 상태 관리)
function App() {
    // 'landing' 또는 'upload' 페이지 상태
    const [currentPage, setCurrentPage] = useState('landing'); 
    
    // 프로젝트 정보 (API 응답에서 받은 데이터)
    const [projectData, setProjectData] = useState({
        id: null,
        accessCode: null,
        history: [], // 분석 히스토리 목록
    });

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    /**
     * 프로젝트 히스토리를 서버에서 새로 가져와 상태를 업데이트합니다.
     */
    const fetchHistory = useCallback(async () => {
        const { id: projectId, accessCode } = projectData;

        // 프로젝트 ID가 없으면 호출하지 않음
        if (!projectId || !accessCode) return; 

        // 히스토리 로딩 상태를 설정할 수 있지만, 여기서는 UI 깜빡임을 줄이기 위해 생략합니다.
        
        const apiUrl = `${BASE_URL}/api/history`;
        const requestBody = { project_id: projectId, access_code: accessCode };

        try {
            const response = await makeApiCallWithRetry(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            if (response.result === 'success') {
                setProjectData(prev => ({
                    ...prev,
                    history: response.history || [], // 새로운 히스토리로 업데이트
                }));
            } else {
                console.error("Failed to fetch history:", response.message);
                // 히스토리 로딩 오류는 치명적이지 않으므로, 에러 상태는 설정하지 않습니다.
            }
        } catch (e) {
            console.error('API History Fetch Error:', e);
        }
    }, [projectData]); // projectData의 id, accessCode가 변경될 때만 fetchHistory 함수가 갱신됨

    /**
     * 접속 코드를 사용하여 백엔드에 로그인(접속) 요청을 보냅니다.
     */
    const handleAccessSubmit = useCallback(async (accessCode) => {
        setIsLoading(true);
        setError(null);

        const apiUrl = `${BASE_URL}/api/access`;
        const requestBody = { access_code: accessCode };

        try {
            const response = await makeApiCallWithRetry(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            if (response.result === 'success') {
                const newProjectData = {
                    id: response.project_id,
                    accessCode: response.access_code,
                    history: response.history || [],
                };
                
                setProjectData(newProjectData);
                // API 명세에 따라 project_id와 access_code를 LocalStorage에 저장
                localStorage.setItem('project_id', response.project_id); 
                localStorage.setItem('access_code', response.access_code);
                
                // 성공적으로 접속했으므로 페이지 이동
                setCurrentPage('upload');
            } else {
                // 서버에서 'success'가 아닌 다른 결과를 반환했을 경우
                setError(`접속 실패: ${response.message || '알 수 없는 오류가 발생했습니다.'}`);
                // 자동 접속 실패 시 LocalStorage 정리
                localStorage.removeItem('project_id');
                localStorage.removeItem('access_code');
            }
        } catch (e) {
            console.error('API Access Error:', e);
            setError(`서버 접속 오류: ${e.message}. BASE_URL(${BASE_URL})을 확인하세요.`);
            // 자동 접속 실패 시 LocalStorage 정리
            localStorage.removeItem('project_id');
            localStorage.removeItem('access_code');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // --- 앱 초기 로드 시 자동 접속 처리 ---
    useEffect(() => {
        const storedProjectId = localStorage.getItem('project_id');
        const storedAccessCode = localStorage.getItem('access_code');
        
        // LocalStorage에 값이 모두 존재하면 자동 접속 시도 (accessCode를 사용)
        if (storedProjectId && storedAccessCode && currentPage === 'landing') {
            console.log("Attempting auto-login...");
            // handleAccessSubmit은 access_code만 필요하지만, 자동 접속 시도를 명시적으로 표시하기 위해
            // 새로운 함수를 만들지 않고, accessCode를 사용하여 접속을 시도합니다.
            handleAccessSubmit(storedAccessCode); 
        }
    }, [handleAccessSubmit, currentPage]); // handleAccessSubmit이 변경될 때 (최초 로드 시) 실행

    // 페이지 라우팅 렌더링
    const renderPage = () => {
        if (currentPage === 'landing') {
            return (
                <LandingPage 
                    onAccessSubmit={handleAccessSubmit} 
                    isLoading={isLoading}
                    error={error}
                />
            );
        }
        
        if (currentPage === 'upload') {
            // projectData와 히스토리 갱신 함수를 UploadPage로 전달합니다.
            return (
                <UploadPage 
                    projectData={projectData} 
                    fetchHistory={fetchHistory} // 새로 추가된 히스토리 갱신 함수
                />
            );
        }

        return <div>페이지를 찾을 수 없습니다.</div>;
    };

    return (
        <div style={{minHeight: '100vh', display: 'flex', flexDirection: 'column'}}>
            {renderPage()}
        </div>
    );
}

export default App;