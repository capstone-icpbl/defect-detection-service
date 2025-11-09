// src/main.jsx (일반적인 Vite React 설정)
import React from 'react';
import ReactDOM from 'react-dom/client';

// 🌟 App 컴포넌트를 올바른 경로에서 불러오는지 확인
import App from './App.jsx';
// 🌟 전역 CSS 파일이 여기서 import되어야 합니다.
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 🌟 App 컴포넌트가 렌더링되는지 확인 */}
   <App />
  </React.StrictMode>,
);