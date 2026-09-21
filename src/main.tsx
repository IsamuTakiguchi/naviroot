import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { installMapsErrorCapture } from './lib/mapsErrors';
import { requestPersistentStorage } from './lib/storage';
import './styles/global.css';

// Google Maps の認証エラーを拾うため、Maps スクリプトの読み込み前に設定する
installMapsErrorCapture();
registerSW({ immediate: true });
// 端末に保存した API キー等が容量整理で消されにくいよう永続化を要求する（非対応環境では何もしない）
void requestPersistentStorage();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
