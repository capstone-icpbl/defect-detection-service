import React, { useState, useRef } from 'react';
import styles from '../pages/LandingPage.module.css'; 

const UploadIcon = () => (
  <svg className={styles.uploadSvgIcon} x="0px" y="0px" viewBox="0 0 24 24">
    <path fill="transparent" d="M0,0h24v24H0V0z" />
    <path fill="#000"
      d="M20.5,5.2l-1.4-1.7C18.9,3.2,18.5,3,18,3H6C5.5,3,5.1,3.2,4.8,3.5L3.5,5.2
      C3.2,5.6,3,6,3,6.5V19 c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V6.5
      C21,6,20.8,5.6,20.5,5.2z M12,17.5L6.5,12H10v-2h4v2h3.5L12,17.5z
      M5.1,5l0.8-1h12l0.9,1H5.1z"/>
  </svg>
);

function ImageUploadArea() {

  const [isActive, setIsActive] = useState(false);

  // ✅ 추가: 분석 ID 및 상태/결과 보관
  const [analysisId, setAnalysisId] = useState(null);
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);

  const fileInputRef = useRef(null);


  /* ✅✅✅ API 요청 함수 추가 ✅✅✅*/
  const uploadImage = async (file) => {
    const formData = new FormData();
    formData.append("image", file); // ✅ API 명세서 준수: key = "image"

    try {
      setStatus("uploading");

      const response = await fetch("http://127.0.0.1:5000/api/predict", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      
      if (data.analysis_id) {
        setAnalysisId(data.analysis_id);
        setStatus("processing");
        pollResult(data.analysis_id);
      }
    } catch (err) {
      console.error("Upload error: ", err);
      setStatus("error");
    }
  };


  /* ✅✅✅ 결과 Polling 추가 ✅✅✅*/
  const pollResult = async (id) => {
    const response = await fetch(`http://127.0.0.1:5000/api/result/${id}`);
    const data = await response.json();

    if (data.status === "processing") {
      setTimeout(() => pollResult(id), 2000);
    } 
    else if (data.status === "completed") {
      setStatus("completed");
      setResult(JSON.parse(data.details)); // ✅ 문자열 JSON → 객체 변환
    }
  };


  // ✅ 파일 드래그 처리
  const handleDragEnter = (e) => { e.preventDefault(); setIsActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsActive(false); };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsActive(false);

    if (e.dataTransfer.files.length > 0) {
      uploadImage(e.dataTransfer.files[0]); // ✅ API 연결됨
    }
  };

  // ✅ 파일 선택 처리
  const handleFileSelect = (e) => {
    if (e.target.files.length > 0) {
      uploadImage(e.target.files[0]); // ✅ API 연결됨
    }
  };


  return (
    <label
      className={`${styles.uploadPreview} ${isActive ? styles.active : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      aria-label="클릭 혹은 파일을 이곳에 드롭하세요."
    >

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className={styles.hiddenFileInput}
      />

      <UploadIcon />
      <p className={styles.previewMsg}>
        {status === "uploading"
          ? "업로드 중..."
          : status === "processing"
            ? "분석 진행중..."
            : "클릭 혹은 파일을 이곳에 드롭하세요."}
      </p>

      <p className={styles.previewDesc}>
        파일당 최대 3MB
      </p>

      {/* ✅ 완료 시 PDF 다운로드 버튼 표시 */}
      {status === "completed" && (
        <button
          className={styles.actionButton}
          onClick={() => window.open(`http://127.0.0.1:5000/api/report/${analysisId}`)}
        >
          분석 보고서 다운로드
        </button>
      )}

      {/* ✅ 결과가 있으면 표시 (원하면 예쁘게 바꿀 수 있음) */}
      {result && (
        <p style={{ marginTop: "10px", color: "green" }}>
          ✅ 분석 완료 : {result.type} ({(result.confidence * 100).toFixed(1)}%)
        </p>
      )}

    </label>
  );
}

export default ImageUploadArea;
