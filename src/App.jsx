import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

import Header from './components/Header';
import LandingPage from './pages/LandingPage';
import UploadPage from './pages/UploadPage';
import AnalysisPage from './pages/AnalysisPage';

const BASE_URL = 'http://127.0.0.1:5000'; 

function AppContent() {
    const navigate = useNavigate();
    
    // [Fix 2] 초기 상태는 비어있어야 함 (가짜 데이터 제거)
    const [projectData, setProjectData] = useState({ id: null, history: [] });
    const [projectInternalId, setProjectInternalId] = useState(null); 
    
    // 분석 결과 데이터
    const [uploadedImageUrl, setUploadedImageUrl] = useState(null); 
    const [uploadedFileName, setUploadedFileName] = useState(null); 
    const [analysisResult, setAnalysisResult] = useState(null); 
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleReset = () => {
        setProjectData({ id: null, history: [] });
        setProjectInternalId(null);
        setUploadedImageUrl(null);
        setUploadedFileName(null);
        setAnalysisResult(null);
        setError(null);
        setIsLoading(false);
        navigate('/');
    };

    const fetchHistory = async (internalId) => {
        const targetId = internalId || projectInternalId;
        if (!targetId) return;
        try {
            const response = await fetch(`${BASE_URL}/history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_id: targetId })
            });
            const data = await response.json();
            // 데이터가 없으면 빈 배열 사용
            const historyList = data.history || [];
            
            // 최신순 정렬
            const sortedHistory = historyList.sort((a, b) => 
                new Date(b.timestamp) - new Date(a.timestamp)
            );
            setProjectData(prev => ({ ...prev, history: sortedHistory }));
        } catch (e) {
            console.error('Error fetching history:', e);
        }
    };

    const handleAccessSubmit = async (code) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${BASE_URL}/access`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ access_code: code }), 
            });
            const data = await response.json();

            if (data.result === 'success') {
                const realId = data.project_id; 
                // 로그인 직후에는 히스토리가 비어있거나 서버에서 준 값이어야 함
                setProjectData({ id: code, history: data.history || [] }); 
                setProjectInternalId(realId); 
                navigate('/upload');
            } else {
                throw new Error(data.message || '접속 실패');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // [Fix 3] resultData(bbox 정보 포함)를 받아서 저장
    const handleUploadSuccess = (file, url, resultData) => {
        setUploadedFileName(file.name);
        setUploadedImageUrl(url);
        // 여기서 resultData가 undefined면 박스가 안 그려짐. ImageUploadArea 수정으로 해결됨.
        setAnalysisResult(resultData); 
        navigate('/analysis'); 
    };

    return (
        <div className="app-container">
            <Header projectId={projectData.id} onReset={handleReset} />
            <Routes>
                <Route path="/" element={
                    <LandingPage onAccessSubmit={handleAccessSubmit} isLoading={isLoading} error={error} />
                } />
                <Route path="/upload" element={
                    <UploadPage 
                        projectData={projectData} 
                        fetchHistory={() => fetchHistory(projectInternalId)}
                        onUploadSuccess={handleUploadSuccess}
                        projectInternalId={projectInternalId} 
                    />
                } />
                <Route path="/analysis" element={
                    <AnalysisPage 
                        projectData={projectData} 
                        imageUrl={uploadedImageUrl}
                        fileName={uploadedFileName}
                        analysisResult={analysisResult}
                        fetchHistory={() => fetchHistory(projectInternalId)}
                        onUploadSuccess={handleUploadSuccess}
                        projectInternalId={projectInternalId}
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