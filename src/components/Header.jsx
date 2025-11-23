import React from 'react';
// CSS 모듈 import
import styles from './Header.module.css';

const Header = ({ projectId, onReset }) => {
  
  // 초기화 및 홈 이동 핸들러
  const handleHomeClick = () => {
    if (onReset) {
      onReset(); 
    } else {
      window.location.href = '/'; 
    }
  };

  return (
    <header className={styles.header}>
      {/* 왼쪽: 로고 (아이콘 제거됨) */}
      <div 
        onClick={handleHomeClick}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
      >
        <h2 className={styles.projectTitle}>
          IC-PBL Capstone 3H
        </h2>
      </div>

      {/* 오른쪽: 네비게이션 */}
      <nav className={styles.navigation}>
        <span className={styles.currentLocation}>
          You're here!
        </span>
        
        {/* 접속 코드 표시 */}
        <span className={`${styles.projectTag} ${projectId ? styles.connected : styles.disconnected}`}>
          {projectId ? `#${projectId}` : '#Not_Connected'}
        </span>

        <button 
            className={styles.addProjectButton}
            onClick={handleHomeClick}
        >
          프로젝트 추가
        </button>
      </nav>
    </header>
  );
};

export default Header;