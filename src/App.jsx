import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

// 컴포넌트 Import
import Header from './components/Header';
import LandingPage from './pages/LandingPage';
import UploadPage from './pages/UploadPage';
import AnalysisPage from './pages/AnalysisPage';

// API 설정
const BASE_URL = '/api'; 

function AppContent() {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // 상태 관리
    const [projectData, setProjectData] = useState({ id: null, history: [] });
    const [projectInternalId, setProjectInternalId] = useState(null); 
    
    const [uploadedImageUrl, setUploadedImageUrl] = useState(null); 
    const [uploadedFileName, setUploadedFileName] = useState(null); 
    const [analysisResult, setAnalysisResult] = useState(null); // 분석 결과 상태 추가

    // [FIX 1] 히스토리 조회: GET -> POST 변경
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

    // [FIX 2] 로그인 로직
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

    const handleUploadSuccess = (file, url, resultData) => {
        setUploadedFileName(file.name);
        setUploadedImageUrl(url);
        setAnalysisResult(resultData); // 결과 데이터 저장
        navigate('/analysis'); 
    };

    // 🛠️ [DEBUG] 분석 페이지 강제 이동 함수
    const debugMoveToAnalysis = () => {
        console.log("🛠️ 디버그: 분석 페이지로 강제 이동");
        
        // 1. 더미 프로젝트 데이터 생성
        setProjectData({
            id: 'DEBUG_MODE',
            history: []
        });

        // 2. 더미 이미지 & 분석 결과 생성
        setUploadedFileName('debug_sample_car.jpg');
        setUploadedImageUrl('https://placehold.co/800x600/2563eb/white?text=Debug+Car+Image');
        setAnalysisResult({
            analysis_id: 999,
            status: 'completed',
            details: [
                { class: 'Scratch', confidence: 0.95, bbox: [100, 100, 200, 200] },
                { class: 'Dent', confidence: 0.82, bbox: [300, 300, 400, 400] }
            ]
        });

        navigate('/analysis');
    };

    return (
        <div className="app-container font-sans text-slate-900 bg-slate-50 min-h-screen">
            <Header />

            {/* 🛠️ 디버그 버튼 (우측 하단) */}
            <button 
                onClick={debugMoveToAnalysis}
                style={{
                    position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999,
                    padding: '12px 24px', backgroundColor: '#e11d48', color: 'white',
                    border: 'none', borderRadius: '50px', fontWeight: 'bold',
                    boxShadow: '0 4px 15px rgba(225, 29, 72, 0.4)', cursor: 'pointer',
                    fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px'
                }}
            >
                🚀 분석 페이지 바로가기 (CSS작업용)
            </button>

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