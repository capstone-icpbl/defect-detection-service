import * as React from "react";
// 스타일 파일이 이제 같은 폴더에 있으므로 ./로 변경
import styles from "../pages/InputDesign.module.css";

function AnalysisResults({ result }) {
  const resultText = result?.details 
    ? `${result.details.length}개의 결함이 발견되었습니다.` 
    : "입력받은 이미지의 흠집 유형을 분석한 결과를 나타낼 수 있는 공간입니다.";

  return (
    <section className={styles.div25}>
      <header className={styles.div26}>
        <img
          src="https://api.builder.io/api/v1/image/assets/TEMP/b54611ce68293f9617bb8bbec86f1625546200ed?placeholderIfAbsent=true&apiKey=e87ffb571e3f4b0cb5af6d81c399946b"
          className={styles.img3}
          alt="Analysis icon"
        />
        <h2 className={styles.div27}>분석 결과</h2>
      </header>
      <p className={styles.div28}>
        {resultText}
      </p>
      <button className={styles.button2} aria-label="PDF로 변환">
        <span className={styles.pdf}>pdf 변환</span>
      </button>
    </section>
  );
}

export default AnalysisResults;