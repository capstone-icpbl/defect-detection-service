import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

// 컴포넌트 Import
import Header from './components/Header';
import LandingPage from './pages/LandingPage';
import UploadPage from './pages/UploadPage';
import AnalysisPage from './pages/AnalysisPage';

// API 설정
const BASE_URL = 'http://127.0.0.1:5000'; 

function AppContent() {
    const navigate = useNavigate();
    
    // ==============================
    // 1. STATE MANAGEMENT
    // ==============================
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // 프로젝트 데이터
    const [projectData, setProjectData] = useState({ id: null, history: [] });
    const [projectInternalId, setProjectInternalId] = useState(null); 
    
    // 분석 데이터
    const [uploadedImageUrl, setUploadedImageUrl] = useState(null); 
    const [uploadedFileName, setUploadedFileName] = useState(null); 
    const [analysisResult, setAnalysisResult] = useState(null); 

    // ==============================
    // 2. HANDLERS
    // ==============================

    // 상태 초기화 및 홈으로 이동 (로그아웃/처음으로)
    const handleReset = () => {
        console.log("Session Reset: 모든 상태를 초기화하고 홈으로 이동합니다.");
        setProjectData({ id: null, history: [] });
        setProjectInternalId(null);
        setUploadedImageUrl(null);
        setUploadedFileName(null);
        setAnalysisResult(null);
        setError(null);
        setIsLoading(false);
        navigate('/');
    };

    // 히스토리 조회
    const fetchHistory = async (internalId) => {
        if (!internalId) return;
        try {
            const response = await fetch(`${BASE_URL}/history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_id: internalId })
            });
            const data = await response.json();
            if (data.history) {
                setProjectData(prev => ({ ...prev, history: data.history }));
            }
        } catch (e) {
            console.error('Error fetching history:', e);
        }
    };

    // 로그인 로직
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

    // 업로드 성공 시 처리
    const handleUploadSuccess = (file, url, resultData) => {
        setUploadedFileName(file.name);
        setUploadedImageUrl(url);
        setAnalysisResult(resultData);
        navigate('/analysis'); 
    };

    return (
        <div className="app-container">
            {/* Header에 projectId와 onReset 함수 전달 */}
            <Header 
                projectId={projectData.id} 
                onReset={handleReset} 
            />

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
                        projectInternalId={projectInternalId} 
                    />
                } />
                <Route path="/analysis" element={
                    <AnalysisPage 
                        projectData={projectData} 
                        imageUrl={uploadedImageUrl}
                        fileName={uploadedFileName}
                        analysisResult={analysisResult}
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