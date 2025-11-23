import React from 'react';
// 스타일 파일이 이제 같은 폴더에 있으므로 ./로 변경
import styles from "./InputDesign.module.css";

function ImageSearch({ imageUrl }) {
  return (
    <div className={styles.div10}>
      <div className={styles.div11}>
        <div className={styles.div12}>
          <img
            src="https://api.builder.io/api/v1/image/assets/TEMP/5063065a7f920f1882a173426e95383506456012?placeholderIfAbsent=true&apiKey=e87ffb571e3f4b0cb5af6d81c399946b"
            className={styles.img}
            alt="Search icon"
          />
          <div className={styles.search}>Image View</div>
        </div>
        <img
          src="https://api.builder.io/api/v1/image/assets/TEMP/9c55138148b5258e803c73919e883833b3a7d76a?placeholderIfAbsent=true&apiKey=e87ffb571e3f4b0cb5af6d81c399946b"
          className={styles.img2}
          alt="Settings"
        />
      </div>
      
      {imageUrl ? (
          <div className={styles.div13} style={{ padding: '0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img 
                src={imageUrl} 
                alt="Analyzed target" 
                style={{ width: '100%', height: 'auto', objectFit: 'contain' }} 
            />
          </div>
      ) : (
          <div className={styles.div13}>
            <div className={styles.div14}>
               이미지가 없습니다.
            </div>
          </div>
      )}
    </div>
  );
}

export default ImageSearch;