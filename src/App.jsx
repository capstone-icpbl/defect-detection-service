import React, { useState } from 'react';
import Header from './components/Header';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

// 페이지 컴포넌트
import LandingPage from './pages/LandingPage';
import UploadPage from './pages/UploadPage';
import AnalysisPage from './pages/AnalysisPage';

// API 설정
const BASE_URL = '/api'; // Proxy 설정 가정 (또는 http://127.0.0.1:5000)

function AppContent() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // 상태 관리
    const [projectData, setProjectData] = useState({ id: null, history: [] });
    const [projectInternalId, setProjectInternalId] = useState(null); // ★ Integer ID
    
    const [uploadedImageUrl, setUploadedImageUrl] = useState(null); 
    const [uploadedFileName, setUploadedFileName] = useState(null); 

    // [FIX 1] 히스토리 조회: GET -> POST 변경 (명세 v2.1 준수)
    const fetchHistory = async (internalId) => {
        if (!internalId) return;

        try {
            const response = await fetch(`${BASE_URL}/history`, {
                method: 'POST', // ★ GET에서 POST로 변경
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_id: internalId }) // ★ Body에 ID 전달
            });
            
            if (!response.ok) throw new Error('히스토리 로딩 실패');
            
            const data = await response.json();
            
            // 데이터 구조 확인 및 적용
            if (data.history) {
                setProjectData(prev => ({ ...prev, history: data.history }));
            }
        } catch (e) {
            console.error('Error fetching history:', e);
        }
    };

    // [FIX 2] 로그인 로직: 변수명 매핑 수정 (internal_id -> project_id)
    const handleAccessSubmit = async (code) => {
        setIsLoading(true);
        setError(null);
        
        try {
            const response = await fetch(`${BASE_URL}/access`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ access_code: code }), // 명세에 맞게 키 이름 확인 필요 (access_code vs project_code)
            });

            const data = await response.json();

            if (data.result === 'success') {
                console.log("Access successful! Real ID:", data.project_id);
                
                // ★ 서버가 주는 키는 'project_id' 입니다. (internal_id 아님)
                const realId = data.project_id; 

                setProjectData({ id: code, history: data.history || [] }); 
                setProjectInternalId(realId); // ★ 올바른 Integer ID 저장
                
                navigate('/upload');
            } else {
                throw new Error(data.message || '접속 실패');
            }

        } catch (err) {
            console.error('접속 오류:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUploadSuccess = (file, url) => {
        setUploadedFileName(file.name);
        setUploadedImageUrl(url);
        // 분석 페이지로 이동하지 않고 UploadPage에 머물거나, 필요 시 이동
        // navigate('/analysis'); 
    };

    return (
        <div className="app-container">
            <Header />
            <Routes>
                <Route path="/" element={
                    <LandingPage 
                        onAccessSubmit={handleAccessSubmit} 
                        isLoading={isLoading} 
                        error={error} 
                    />
                } />
                <Route path="/upload" element={
                    <UploadPage 
                        projectData={projectData} 
                        fetchHistory={() => fetchHistory(projectInternalId)}
                        onUploadSuccess={handleUploadSuccess}
                        projectInternalId={projectInternalId} // ★ 중요: Integer ID 전달
                    />
                } />
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

export default function App() {
    return (
        <Router>
            <AppContent />
        </Router>
    );
}