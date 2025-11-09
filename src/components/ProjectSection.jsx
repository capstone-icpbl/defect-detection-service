import React from 'react';
import styles from '../pages/LandingPage.module.css';

function ProjectSection() {
  return (
    <section
      className={styles.projectNameSection}
      role="banner"
      aria-label="Project name section"
    >
      <p className={styles.projectNameText}>
        프로젝트 이름
      </p>
    </section>
  );
}

export default ProjectSection;
