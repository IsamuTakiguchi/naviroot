import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { installMapsErrorCapture } from './lib/mapsErrors';
import './styles/global.css';

// Google Maps の認証エラーを拾うため、Maps スクリプトの読み込み前に設定する
installMapsErrorCapture();
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
