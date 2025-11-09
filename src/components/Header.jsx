"use client";
import React from 'react';
import styles from '../pages/LandingPage.module.css';

function Header() {
  return (
    <header className={styles.header}>
      <h1 className={styles.logoTitle}>
        IC-PBL Capstone Design 3H
      </h1>
      <nav className={styles.navigation} role="navigation" aria-label="Main navigation">
        <a href="#" className={styles.navItem} role="menuitem">
          페이지
        </a>
        <a href="#" className={styles.navItem} role="menuitem">
          페이지
        </a>
        <a href="#" className={styles.navItem} role="menuitem">
          페이지
        </a>
        <button
          className={styles.actionButton}
          type="button"
          aria-label="Action button"
        >
          <span className={styles.buttonText}>
            버튼
          </span>
        </button>
      </nav>
      <button
        className={styles.mobileMenuIcon}
        type="button"
        aria-label="Open mobile menu"
        aria-expanded="false"
      >
        ☰
      </button>
    </header>
  );
}

export default Header;
