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

    // ⭐️ [NEW] 상태 초기화 및 홈으로 이동 (로그아웃/처음으로)
    const handleReset = () => {
        console.log("Session Reset: 모든 상태를 초기화하고 홈으로 이동합니다.");
        
        // 모든 State를 초기값으로 리셋
        setProjectData({ id: null, history: [] });
        setProjectInternalId(null);
        setUploadedImageUrl(null);
        setUploadedFileName(null);
        setAnalysisResult(null);
        setError(null);
        setIsLoading(false);

        // 랜딩 페이지로 이동
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

    const handleUploadSuccess = (file, url, resultData) => {
        setUploadedFileName(file.name);
        setUploadedImageUrl(url);
        setAnalysisResult(resultData);
        navigate('/analysis'); 
    };

    // 🛠️ [DEBUG] 분석 페이지 강제 이동 함수
    const debugMoveToAnalysis = () => {
        console.log("🛠️ 디버그: 분석 페이지로 강제 이동");
        setProjectData({ id: 'DEBUG_MODE', history: [] });
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
        <div className="app-container">
            {/* ⭐️ Header에 projectId와 onReset 함수 전달 */}
            <Header 
                projectId={projectData.id} 
                onReset={handleReset} 
            />

            <button 
                onClick={debugMoveToAnalysis}
                style={{
                    position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999,
                    padding: '12px 24px', backgroundColor: '#e11d48', color: 'white',
                    border: 'none', borderRadius: '50px', fontWeight: 'bold',
                    boxShadow: '0 4px 15px rgba(225, 29, 72, 0.4)', cursor: 'pointer',
                    fontSize: '14px'
                }}
            >
                🚀 분석 페이지 바로가기
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