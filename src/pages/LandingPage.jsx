// src/pages/LandingPage.jsx

import React from 'react';
// Header, ProjectSection, ImageUploadArea를 불러옵니다.
import Header from '../components/Header.jsx';
import ProjectSection from '../components/ProjectSection.jsx';
import ImageUploadArea from '../components/ImageUploadArea.jsx';
// 페이지의 전체 스타일을 불러옵니다.
import styles from '../pages/LandingPage.module.css';

function LandingPage() {
  return (
    <>
      <main className={styles.landingPage} role="main">
        {/* 1. 상단바 배치 */}
        <Header />
        
        {/* 2. 프로젝트 제목 영역 배치 (CSS로 위치 조정됨) */}
        <ProjectSection />
        
        {/* 3. 방금 확정한 ImageUploadArea 컴포넌트 배치 */}
        <ImageUploadArea />
      </main>
    </>
  );
}

// App.jsx에서 가져갈 수 있도록 default export 합니다.
export default LandingPage;