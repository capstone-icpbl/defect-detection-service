// src/main.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
// BrowserRouter import가 여기에 없어야 합니다!

import App from './App.jsx'; 
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* BrowserRouter는 App.jsx 안에 있으므로 여기서는 App만 렌더링합니다. */}
    <App /> 
  </React.StrictMode>,
);