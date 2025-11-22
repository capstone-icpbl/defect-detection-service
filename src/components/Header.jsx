import React from 'react';
import styles from './Header.module.css';

const Header = () => {
  
  const handleProjectTitleClick = () => {
    console.log("Navigating to Home/Landing Page via Project Title");
  };
  
  const handleAddProject = () => {
    console.log("Add Project Button Clicked");
  };

  return (
    <header className={styles.header}>
      <h1 className={styles.projectTitle}>
        IC-PBL Capstone Design 3H
      </h1>      
      {/* 2. 네비게이션 섹션 */}
      <nav className={styles.navigation}>
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