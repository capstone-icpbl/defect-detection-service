import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';

// 페이지 및 컴포넌트 import 
import Header from './components/Header'; 
import LandingPage from './pages/LandingPage';
import UploadPage from './pages/UploadPage';  

// 💡 ProjectImage와 ImageUploadArea를 UploadPage에서 import하므로, 
// 여기서는 UploadPage와 LandingPage만 필요합니다.

// 임시 데이터 구조 (실제 서버에서 받아온다고 가정)
const initialProjectData = {
    id: '3H-1234',
    history: [
        { analysis_id: 1, status: 'completed', timestamp: Date.now() - 3600000, result_summary: '초기 분석 완료', image_url: '/uploads/img1.jpg' },
        { analysis_id: 2, status: 'pending', timestamp: Date.now(), result_summary: '최신 분석 진행 중', image_url: '/uploads/img2.jpg' },
    ],
};

function RoutingApp() {
    // 💡 프로젝트 데이터와 히스토리를 상위 컴포넌트에서 관리
    const [projectData, setProjectData] = useState(initialProjectData);
    
    // 💡 히스토리를 서버에서 가져오는 가상 함수
    const fetchHistory = () => {
        console.log("Fetching history...");
        // 실제로는 axios 등으로 API 요청을 하고 setProjectData를 호출합니다.
    };

    return (
        <div>
        {/* 1. BrowserRouter: 라우팅을 활성화하는 최상위 컨텍스트 */}
            <Header />
            {/* 2. Routes: 경로와 컴포넌트를 매칭하는 컨테이너 */}
            <Routes>
                <Route path="/" element={<LandingPage />} /> 
                    <Route 
                        path="/upload" 
                        element={
                            <UploadPage 
                                projectData={projectData} 
                                fetchHistory={fetchHistory} 
                            />
                        } 
                    />
                    <Route path="*" element={<div>404 Not Found</div>} />
            </Routes>
        </div>
    );
}

// 이 컴포넌트가 App의 엔트리 포인트에서 렌더링되어야 합니다.
export default RoutingApp;