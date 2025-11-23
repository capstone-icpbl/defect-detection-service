import * as React from "react";
import styles from "../pages/InputDesign.module.css";

function ClassificationSection() {
  return (
    <section className={styles.div15}>
      <h2 className={styles.div16}>흠집 유형 분류</h2>
      <div className={styles.div17}>
        <div className={styles.div18}>
          <div className={styles.column3}>
            <div className={styles.div19} role="img" aria-label="흠집 분류 설명">
              <p>
                입력받은 이미지에 <br />
                존재하는 흠집의 종류를
                <br />
                보여주는 이미지를 <br />
                불러옵니다.
              </p>
            </div>
          </div>
          <div className={styles.column4}>
            <div className={styles.div20} role="img" aria-label="분류 결과 이미지 1" />
          </div>
        </div>
      </div>
      <div className={styles.div21}>
        <div className={styles.div22}>
          <div className={styles.column5}>
            <div className={styles.div23} role="img" aria-label="분류 결과 이미지 2" />
          </div>
          <div className={styles.column6}>
            <div className={styles.div24} role="img" aria-label="분류 결과 이미지 3" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default ClassificationSection;