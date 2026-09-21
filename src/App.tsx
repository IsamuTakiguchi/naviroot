import { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { APIProvider } from '@vis.gl/react-google-maps';
import { BottomNav } from './components/BottomNav';
import { ApiKeyNotice } from './components/ApiKeyNotice';
import { TransitPage } from './pages/TransitPage';
import { MapRoutePage } from './pages/MapRoutePage';
import { SearchPage } from './pages/SearchPage';
import { TimetablePage } from './pages/TimetablePage';
import { MyPage } from './pages/MyPage';
import { getApiKey, hasApiKey } from './config';
import { useOnline } from './hooks/useOnline';
import { useTheme } from './hooks/useTheme';
import { nextTheme } from './lib/theme';
import { Icon } from './components/Icon';
import { explainMapsError, getLastMapsErrorCode, MAPS_AUTH_ERROR_EVENT, type MapsAuthErrorDetail } from './lib/mapsErrors';

const TITLES: Record<string, string> = {
  '/': '乗換案内',
  '/map': '地図・経路検索',
  '/search': 'スポット検索',
  '/timetable': '時刻表',
  '/my': 'マイページ',
};

const FULL_HEIGHT = new Set(['/map', '/search']);

const MapsErrorContext = createContext<string | undefined>(undefined);

/** Google Maps の認証エラー（課金・リファラー制限など）を日本語で説明するバナー */
function MapsAuthErrorBanner() {
  const navigate = useNavigate();
  const [code, setCode] = useState<string | undefined>(() => getLastMapsErrorCode());
  useEffect(() => {
    const handler = (e: Event) => setCode((e as CustomEvent<MapsAuthErrorDetail>).detail.code);
    window.addEventListener(MAPS_AUTH_ERROR_EVENT, handler);
    return () => window.removeEventListener(MAPS_AUTH_ERROR_EVENT, handler);
  }, []);
  if (!code) return null;
  const { title, fix } = explainMapsError(code);
  const referrer = `${window.location.origin}/*`;
  return (
    <div className="alert error" style={{ margin: '8px 16px' }} role="alert">
      <div style={{ fontWeight: 700 }}>Google Maps の認証エラー: {title}</div>
      <div style={{ marginTop: 4 }}>{fix}</div>
      <div style={{ marginTop: 6, fontSize: 13 }}>
        エラーコード: <code>{code}</code>
        <br />
        ウェブサイトの制限に登録する URL: <code>{referrer}</code>
      </div>
      <div className="row wrap" style={{ marginTop: 8 }}>
        <button type="button" className="btn small" onClick={() => navigate('/my')}>
          API キーを変更
        </button>
        <a
          className="btn small"
          href={`https://developers.google.com/maps/documentation/javascript/error-messages#${code
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .toLowerCase()}`}
          target="_blank"
          rel="noreferrer"
        >
          Google の説明を見る
        </a>
        <button type="button" className="btn small" onClick={() => window.location.reload()}>
          再読み込み
        </button>
      </div>
    </div>
  );
}

function Shell() {
  const location = useLocation();
  const online = useOnline();
  const mapsError = useContext(MapsErrorContext);
  const theme = useTheme();
  const title = TITLES[location.pathname] ?? 'naviroot';
  const needsKey = !hasApiKey() && location.pathname !== '/my';
  const fullHeight = FULL_HEIGHT.has(location.pathname) && !needsKey;

  return (
    <div className="app">
      <header className="app-header">
        <h1>{title}</h1>
        <button
          type="button"
          className="icon-btn theme-toggle"
          onClick={() => theme.setMode(nextTheme(theme.mode, theme.resolved === 'dark'))}
          title={theme.resolved === 'dark' ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え'}
          aria-label={theme.resolved === 'dark' ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え'}
        >
          <Icon name={theme.resolved === 'dark' ? 'sun' : 'moon'} size={20} />
        </button>
        <span className="brand">naviroot</span>
      </header>
      {!online && <div className="offline-banner">オフラインです。お気に入り・履歴は閲覧できます。</div>}
      {mapsError && !needsKey && (
        <div className="alert error" style={{ margin: '8px 16px' }}>
          {mapsError}
        </div>
      )}
      {!needsKey && <MapsAuthErrorBanner />}
      <main className={`app-main ${fullHeight ? 'no-scroll' : ''}`}>
        {needsKey ? (
          <ApiKeyNotice />
        ) : (
          <Routes>
            <Route path="/" element={<TransitPage />} />
            <Route path="/map" element={<MapRoutePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/timetable" element={<TimetablePage />} />
            <Route path="/my" element={<MyPage />} />
            <Route path="*" element={<TransitPage />} />
          </Routes>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  const [mapsError, setMapsError] = useState<string | undefined>();
  const content = (
    <MapsErrorContext.Provider value={mapsError}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Shell />
      </BrowserRouter>
    </MapsErrorContext.Provider>
  );
  if (!hasApiKey()) return content;
  return (
    <APIProvider
      apiKey={getApiKey()}
      language="ja"
      region="JP"
      libraries={['places', 'routes', 'geocoding']}
      onLoad={() => setMapsError(undefined)}
      onError={() =>
        setMapsError(
          'Google Maps を読み込めませんでした。API キーが正しいか、Maps JavaScript API が有効か、ネットワーク接続を確認してください。',
        )
      }
    >
      {content}
    </APIProvider>
  );
}
