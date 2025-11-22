import React from 'react';
// 이미지 스타일은 LandingPage.module.css에 정의된 공통 클래스(heroImage)를 사용합니다.
import styles from '../pages/LandingPage.module.css'; 

/**
 * 모든 페이지에서 재사용되는 핵심 프로젝트 이미지 배너 컴포넌트입니다.
 * 이 컴포넌트는 오직 'heroImage' 클래스를 가진 <img> 요소만 반환합니다.
 */
function ProjectImage() {
  return (
    <img
      src="https://api.builder.io/api/v1/image/assets/TEMP/fc710615700f19e40057502cf463e3d7d6056d93?placeholderIfAbsent=true&apiKey=e87ffb571e3f4b0cb5af6d81c399946b"
      alt="Hero or Project illustration banner"
      className={styles.heroImage}
      onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/600x337/cccccc/333333?text=Design+Illustration"; }}
    />
  );
}

export default ProjectImage;