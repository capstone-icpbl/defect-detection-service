import React, { useState } from 'react'; // ⭐️ 1. 외부에서 Header 컴포넌트 임포트
import Header from './components/Header'; // 경로는 프로젝트 구조에 맞게 조정하세요.
// ⭐️ 2. 라우팅을 위해 BrowserRouter 임포트
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';


// --- 기존 컴포넌트 임포트
import LandingPage from './pages/LandingPage';
import UploadPage from './pages/UploadPage';

// 💡 UploadPage에 전달할 목업(Mock-up) 프로젝트 데이터
const MOCK_PROJECT_DATA = {
    id: 'ABCDEFGHIJ',
    history: [
        { analysis_id: 'ANA001', status: 'completed', timestamp: 1732387200000, result_summary: '우측 앞 범퍼 미세 흠집 감지', image_url: '/images/mock_car_1.jpg' },
        { analysis_id: 'ANA002', status: 'pending', timestamp: 1732386000000, result_summary: '분석 요청 접수됨', image_url: '/images/mock_car_2.jpg' },
        { analysis_id: 'ANA003', status: 'error', timestamp: 1732385000000, result_summary: '이미지 파일 손상', image_url: '/images/mock_car_3.jpg' },
    ]
};

// 💡 목업 히스토리 갱신 함수
const mockFetchHistory = () => {
    console.log("History refresh requested.");
};

// ⭐️ AppContent 컴포넌트: 라우팅 환경 내에서 상태 및 로직 관리
function AppContent() {
    const navigate = useNavigate(); // 라우팅을 위한 훅
    
    // 상태 관리
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [projectData, setProjectData] = useState(MOCK_PROJECT_DATA);

    // ⭐️ 접속 코드 제출 핸들러 구현 (접속 성공 시 페이지 전환)
    const handleAccessSubmit = async (code) => {
        setIsLoading(true);
        setError(null);
        
        // 2초 딜레이를 통해 API 호출을 시뮬레이션
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            // 💡 실제로는 여기서 서버 API를 호출하여 코드를 검증해야 합니다.
            // 개발 편의를 위해 'FAIL' 코드는 실패, 그 외는 성공으로 임시 설정합니다.
            if (code.toUpperCase() === 'FAIL') {
                throw new Error('유효하지 않은 접속 코드입니다. 다시 확인해 주세요.');
            }
            
            console.log("Access successful! Navigating to Upload Page.");
            
            // 1. 성공 시 프로젝트 데이터를 설정합니다. (현재는 목업 데이터 사용)
            setProjectData(MOCK_PROJECT_DATA); 
            
            // 2. UploadPage로 페이지 전환 (라우팅)
            navigate('/upload');

        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

  return (
    <div className="container">
      {/* Header는 모든 경로에 공통적으로 표시됩니다. */}
      <Header />
      
      <Routes>
        {/* 1. 랜딩 페이지 (접속 코드 입력) */}
        <Route path="/" element={
            <LandingPage 
                onAccessSubmit={handleAccessSubmit} 
                isLoading={isLoading} 
                error={error}
            />
        } />
        {/* 2. 업로드 페이지 (접속 성공 시 전환되는 경로) */}
        <Route path="/upload" element={
            <UploadPage 
                projectData={projectData} 
                fetchHistory={mockFetchHistory} 
            />
        } />
      </Routes>
    </div>
  );
}

// ⭐️ App 컴포넌트: 최상위에서 BrowserRouter로 감싸 라우팅 환경 제공
export default function App() {
    return (
        <Router>
            <AppContent />
        </Router>
    );
}
