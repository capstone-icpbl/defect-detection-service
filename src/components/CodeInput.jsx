import React, { useState } from 'react';
import styles from '../pages/LandingPage.module.css';

/**
 * 접속 코드 입력 및 제출을 처리하는 컴포넌트입니다.
 * @param {object} props
 * @param {function} props.onAccessSubmit - 접속 코드를 인수로 받아 API를 호출하는 함수
 * @param {boolean} props.isLoading - 로딩 상태
 * @param {string} props.error - API 오류 메시지
 */
function CodeInput({ onAccessSubmit, isLoading, error }) {
  const [accessCode, setAccessCode] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (accessCode.trim() && !isLoading) {
      // 대문자로 변환하여 API에 전달 (API 명세의 예시를 참고)
      onAccessSubmit(accessCode.trim().toUpperCase()); 
    }
  };

  return (
    <section className={styles.inputSection} aria-labelledby="code-input-title">
      <form onSubmit={handleSubmit} className={styles.inputForm}>
        <textarea
          className={styles.inputArea}
          placeholder="여기에 접속 코드를 입력하세요 (예: ROBOTDETECT)" 
          role="textbox"
          aria-label="접속 코드를 입력하세요"
          tabIndex="0"
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value)}
          disabled={isLoading}
        />
        <button 
          type="submit" 
          className={styles.submitButton}
          disabled={isLoading || !accessCode.trim()}
        >
          {isLoading ? '접속 중...' : '프로젝트 접속'}
        </button>
      </form>
      
      {/* 로딩 및 오류 메시지 표시 */}
      {isLoading && <div className={styles.loadingIndicator}>서버에 접속 중입니다. 잠시만 기다려주세요...</div>}
      {error && <div className={styles.errorMessage}>{error}</div>}
    </section>
  );
}

export default CodeInput;