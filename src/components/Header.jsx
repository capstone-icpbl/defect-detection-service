import React from 'react';
import { useNavigate } from 'react-router-dom'; // 💡 import 유지
import styles from './Header.module.css';

const Header = () => {
  const navigate = useNavigate(); // 💡 훅 사용
  
  const handleProjectTitleClick = () => {
    console.log("Navigating to Home/Landing Page via Project Title");
  };
  
  const handleAddProject = () => {
    console.log("Add Project Button Clicked");
  };

  // 💡 임시 버튼 클릭 핸들러 정의 (실제 라우팅 로직을 넣을 곳)
  const handleTestButtonClick = () => {
        console.log("Navigating to Upload Page (Temporary)");
        navigate('/upload'); // 💡 '/upload' 경로로 이동
  };

  return (
    <header className={styles.header}>
      <h1 className={styles.projectTitle}>
        IC-PBL Capstone Design 3H
      </h1>      
      {/* 2. 네비게이션 섹션 */}
      <nav className={styles.navigation}>
        <button className={styles.addTestButton} onClick={handleTestButtonClick}>
          <span className={styles.buttonText}>
            임시이동
          </span>

        </button>
         <span className={styles.currentLocation} aria-current="page">
          You're here!
        </span>

        <span className={styles.projectName}>
          #projectname
        </span>

        {/* 새 프로젝트 추가 버튼 */}
        <button className={styles.addProjectButton} onClick={handleAddProject}>
          <span className={styles.buttonText}>
            프로젝트 추가
          </span>
        </button>
      </nav>
    </header>
  );
};

export default Header;