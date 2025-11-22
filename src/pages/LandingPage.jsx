import React, { useState, useRef } from 'react';
import styles from './LandingPage.module.css';

// 재사용 가능한 컴포넌트들을 import 합니다.
import Header from '../components/Header';
import ProjectImage from '../components/ProjectImage'; // 통합된 이미지 컴포넌트 사용


/**
 * 접속 코드 입력 및 제출을 처리하는 컴포넌트입니다.
 * @param {object} props
 * @param {function} props.onAccessSubmit - 접속 코드를 제출하는 함수
 * @param {boolean} props.isLoading - API 호출 중인지 여부
 * @param {string | null} props.error - 발생한 에러 메시지
 */
function CodeInput({ onAccessSubmit, isLoading, error }) {
    const [accessCode, setAccessCode] = useState('');
    const inputRef = useRef(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        // 입력된 코드는 대문자로 변환하여 서버로 전송합니다.
        const code = accessCode.trim().toUpperCase();
        if (code) {
            onAccessSubmit(code);
        }
    };

    const isCodeValid = accessCode.trim().length > 0 && !isLoading;

    return (
        <form className={styles.inputForm} onSubmit={handleSubmit}>
            <section className={styles.inputSection} aria-labelledby="code-input-title">
                {/* textarea 대신 input type="text"를 사용하여 단일 코드 입력을 받습니다.
                  maxLength를 10으로 설정하여 코드 길이를 제한합니다.
                */}
                <input 
                    type="text"
                    ref={inputRef}
                    className={styles.inputArea}
                    placeholder="여기에 접속 코드를 입력하세요 (예: ABCDEFGHIJ)"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    maxLength={10} 
                    aria-label="프로젝트 접속 코드 입력"
                    disabled={isLoading}
                />
            </section>
            
            {/* 접속 버튼 */}
            <button
                type="submit"
                className={`${styles.accessButton} ${isLoading ? styles.loading : ''}`}
                disabled={!isCodeValid}
            >
                {isLoading ? '접속 중...' : '프로젝트 접속'}
            </button>
            
            {/* 에러 메시지 표시 */}
            {error && (
                <div className={styles.errorMessage} role="alert">
                    {error}
                </div>
            )}
        </form>
    );
}


/**
 * 랜딩 페이지 컴포넌트 (프로젝트 접속 코드 입력)
 * @param {object} props
 * @param {function} props.onAccessSubmit - App.jsx에서 받은 접속 제출 핸들러
 * @param {boolean} props.isLoading - App.jsx에서 받은 로딩 상태
 * @param {string | null} props.error - App.jsx에서 받은 에러 메시지
 */
function LandingPage({ onAccessSubmit, isLoading, error }) {
    return (
        <div className={styles.container}>
            {/* 1. Header 컴포넌트 */}
            <Header /> 
            
            {/* 2. Main Content 영역 (래퍼) */}
            <div className={styles.mainContent}>
                {/* FIX: 새로운 래퍼 div로 ProjectImage를 감싸서 배경색과 크기를 제어합니다. */}
                <div className={styles.heroImageWrapper}> 
                    <ProjectImage />
                </div>
                
                {/* 제목 */}
                <h4 className={styles.pageTitle}>프로젝트 코드를 입력하세요</h4>
            </div>

            {/* 3. CodeInput 컴포넌트 (접속 폼) */}
            <CodeInput 
                onAccessSubmit={onAccessSubmit}
                isLoading={isLoading}
                error={error}
            />
        </div>
    );
}

export default LandingPage;