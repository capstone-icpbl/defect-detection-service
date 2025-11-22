"use client";
import React from 'react';
import styles from '../pages/LandingPage.module.css';

function Header() {
  return (
  <header className={styles.header}>
    <h2 className={styles.logoTitle}>
      IC-PBL Capstone Design 3H
      </h2>
      <nav className={styles.navigation} role="navigation" aria-label="Main navigation">
        {/* 현재 위치 표시 (You're here!) */}
        <span className={styles.currentLocation} aria-current="page">
          You're here!
        </span>
        {/* 프로젝트 이름 표시 (#projectname) */}
        <span className={styles.projectName}>
          #projectname
        </span>
        {/* 프로젝트 추가 버튼 */}
        <button className={styles.addProjectButton} type="button">
          <span className={styles.buttonText}>
            프로젝트 추가
          </span>
        </button>
      </nav>
    </header>
    );
}

export default Header;