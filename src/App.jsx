import React, { useState } from 'react'; // ⭐️ 1. 외부에서 Header 컴포넌트 임포트
import Header from './components/Header'; // 경로는 프로젝트 구조에 맞게 조정하세요.
// ⭐️ 2. 라우팅을 위해 BrowserRouter 임포트
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';


// --- 기존 컴포넌트 임포트
import LandingPage from './pages/LandingPage';
import UploadPage from './pages/UploadPage';
import AnalysisPage from './pages/AnalysisPage';


// AppContent 컴포넌트: 라우팅 환경 내에서 상태 및 로직 관리
function AppContent() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // ⭐️ 2. projectData와 projectInternalId 상태 유지
    const [projectData, setProjectData] = useState({ id: null, history: [] });
    const [projectInternalId, setProjectInternalId] = useState(null); 
    
    const [uploadedImageUrl, setUploadedImageUrl] = useState(null); 
    const [uploadedFileName, setUploadedFileName] = useState(null); 
    
    // API URL 설정 (필요하다면 유지)
    const BASE_URL = 'http://127.0.0.1:5000'; 
    
    // ⭐️ 3. 실제 히스토리 불러오기 함수 정의 (UploadPage에 전달)
    // 이 함수는 서버에서 실제 히스토리 목록을 다시 가져와 projectData를 갱신합니다.
    const fetchHistory = async (internalId) => {
        if (!internalId) return;

        try {
            const response = await fetch(`${BASE_URL}/api/history?project_id=${internalId}`);
            if (!response.ok) throw new Error('히스토리 로딩 실패');
            
            const data = await response.json();
            
            if (data.result === 'success') {
                // 기존 projectData의 id는 유지하고 history만 업데이트
                setProjectData(prev => ({ ...prev, history: data.history || [] }));
            } else {
                 console.error("Failed to fetch history:", data.message);
            }
        } catch (e) {
            console.error('Error fetching history:', e);
        }
    };

    // 접속 코드 제출 핸들러 구현 (접속 성공 시 페이지 전환)
    const handleAccessSubmit = async (code) => {
        setIsLoading(true);
        setError(null);
        
        try {
            const apiUrl = `${BASE_URL}/api/access`;
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_code: code }), 
            });

            if (!response.ok) {
                 const errorBody = await response.json().catch(() => ({ message: '서버 오류' }));
                 throw new Error(`접속 실패: ${errorBody.message || '알 수 없는 오류'}`);
            }
            
            const data = await response.json();

            if (data.result === 'success') {
                console.log("Access successful! Project ID:", data.project_id);
                
                // ⭐️ 실제 서버에서 받은 데이터 사용
                setProjectData({ id: code, history: data.history || [] }); // 외부 ID는 입력 코드 사용
                setProjectInternalId(data.internal_id); // ⭐️ 서버가 준 숫자 ID 저장
                
                navigate('/upload');
            } else {
                throw new Error(data.message || '유효하지 않은 프로젝트 코드입니다.');
            }

        } catch (err) {
            console.error('접속 오류:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

// ⭐️ 5. UploadPage에 실제 fetchHistory 전달
  return (
    <div className="container">
      <Header />
      
      <Routes>
        <Route path="/upload" element={
            <UploadPage 
                projectData={projectData} 
                fetchHistory={() => fetchHistory(projectInternalId)} // ⭐️ 실제 함수 전달
                onUploadSuccess={handleUploadSuccess} 
                projectInternalId={projectInternalId}
            />
        } />
        {/* AnalysisPage에 업로드된 이미지 정보 전달 */}
        <Route path="/analysis" element={
            <AnalysisPage 
                projectData={projectData} 
                imageUrl={uploadedImageUrl}
                fileName={uploadedFileName}
            />
        } />
      </Routes>
    </div>
  );
}