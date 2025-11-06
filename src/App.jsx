// src/App.jsx

import React from 'react';
import LandingPage from './pages/LandingPage.jsx'; 

function App() {
  return (
    // 전체 페이지의 컨테이너 역할을 합니다.
    <div className="app-container">
      <LandingPage />
    </div>
  );
}

export default App;