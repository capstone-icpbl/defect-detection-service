import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

import Header from './components/Header.jsx';
import LandingPage from './pages/LandingPage.jsx';
import UploadPage from './pages/UploadPage.jsx';
import AnalysisPage from './pages/AnalysisPage.jsx';

const BASE_URL = 'http://127.0.0.1:5000'; 

function AppContent() {
    const navigate = useNavigate();
    
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

    const normalizeHistory = (historyList) => {
        if (!Array.isArray(historyList)) return [];
        return historyList
            .filter(item => item && (item.analysis_id || item.id)) 
            .map(item => ({
                ...item,
                analysis_id: item.analysis_id || item.id,
                // filename이 없는 경우 대비
                filename: item.filename || `Analysis #${item.analysis_id || item.id}`,
                timestamp: item.timestamp || item.date || new Date().toISOString()
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

    const handleUploadSuccess = (file, url, resultData) => {
        setUploadedFileName(file.name);
        setUploadedImageUrl(url);
        setAnalysisResult(resultData); 

        const newHistoryItem = {
            analysis_id: resultData.analysis_id || 'New',
            // ⭐️ [추가] 파일명 저장
            filename: file.name,
            timestamp: new Date().toISOString(),
            original_image_url: url,
            status: 'completed'
        };

        setProjectData(prev => {
            const exists = prev.history.some(h => h.analysis_id === newHistoryItem.analysis_id);
            if (exists) return prev;
            return { ...prev, history: [newHistoryItem, ...prev.history] };
        });

        navigate('/analysis'); 
    };

    // ⭐️ [신규 기능] 히스토리 클릭 시 분석 결과 복원
    const handleHistorySelect = async (item) => {
        // 이미지가 없거나 처리중이면 무시
        if (!item.analysis_id || item.status === 'processing') {
            alert("분석이 완료되지 않았거나 데이터가 없습니다.");
            return;
        }

        setIsLoading(true);
        try {
            // 상세 결과 조회 (/result/<id>)
            const response = await fetch(`${BASE_URL}/result/${item.analysis_id}`);
            const data = await response.json();

            if (data) {
                // 상태 복원
                setUploadedImageUrl(data.original_image_url);
                setUploadedFileName(data.filename || item.filename || "Restored Image");
                setAnalysisResult(data);
                
                // 페이지 이동
                navigate('/analysis');
                
                // 스크롤 최상단으로 이동
                window.scrollTo(0, 0);
            }
        } catch (e) {
            console.error("복원 실패:", e);
            alert("분석 결과를 불러오는데 실패했습니다.");
        } finally {
            setIsLoading(false);
        }
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
                        // ⭐️ 히스토리 선택 핸들러 전달
                        onSelectHistory={handleHistorySelect}
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
                        // ⭐️ 히스토리 선택 핸들러 전달
                        onSelectHistory={handleHistorySelect}
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