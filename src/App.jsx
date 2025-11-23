import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

// ⭐️ Fix: import 경로에 .jsx 확장자를 명시하여 빌드 오류 해결
import Header from './components/Header.jsx';
import LandingPage from './pages/LandingPage.jsx';
import UploadPage from './pages/UploadPage.jsx';
import AnalysisPage from './pages/AnalysisPage.jsx';

const BASE_URL = 'http://127.0.0.1:5000'; 

function AppContent() {
    const navigate = useNavigate();
    
    // 초기 상태 정의
    const [projectData, setProjectData] = useState({ id: null, history: [] });
    const [projectInternalId, setProjectInternalId] = useState(null); 
    
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

    // 데이터 정제 함수
    const normalizeHistory = (historyList) => {
        if (!Array.isArray(historyList)) return [];
        return historyList
            .filter(item => item && (item.analysis_id || item.id)) 
            .map(item => ({
                ...item,
                analysis_id: item.analysis_id || item.id,
                timestamp: item.timestamp || new Date().toISOString()
            }));
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
            
            const validHistory = normalizeHistory(data.history);
            const sortedHistory = validHistory.sort((a, b) => 
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
                const cleanHistory = normalizeHistory(data.history);

                setProjectData({ id: code, history: cleanHistory }); 
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

    // 업로드 성공 시 즉시 히스토리에 추가하는 로직 유지
    const handleUploadSuccess = (file, url, resultData) => {
        setUploadedFileName(file.name);
        setUploadedImageUrl(url);
        setAnalysisResult(resultData); 

        // 1. 새 히스토리 항목 생성
        const newHistoryItem = {
            analysis_id: resultData.analysis_id || 'New',
            timestamp: new Date().toISOString(),
            original_image_url: url,
            status: 'completed'
        };

        // 2. 상태 업데이트 (기존 목록 앞에 추가)
        setProjectData(prev => {
            // 중복 추가 방지
            const exists = prev.history.some(h => h.analysis_id === newHistoryItem.analysis_id);
            if (exists) return prev;
            
            return {
                ...prev,
                history: [newHistoryItem, ...prev.history]
            };
        });

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