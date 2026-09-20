import { createContext, useContext, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { APIProvider } from '@vis.gl/react-google-maps';
import { BottomNav } from './components/BottomNav';
import { ApiKeyNotice } from './components/ApiKeyNotice';
import { TransitPage } from './pages/TransitPage';
import { MapRoutePage } from './pages/MapRoutePage';
import { SearchPage } from './pages/SearchPage';
import { TimetablePage } from './pages/TimetablePage';
import { MyPage } from './pages/MyPage';
import { GOOGLE_MAPS_API_KEY, hasApiKey } from './config';
import { useOnline } from './hooks/useOnline';

const TITLES: Record<string, string> = {
  '/': '乗換案内',
  '/map': '地図・経路検索',
  '/search': 'スポット検索',
  '/timetable': '時刻表',
  '/my': 'マイページ',
};

const FULL_HEIGHT = new Set(['/map', '/search']);

const MapsErrorContext = createContext<string | undefined>(undefined);

function Shell() {
  const location = useLocation();
  const online = useOnline();
  const mapsError = useContext(MapsErrorContext);
  const title = TITLES[location.pathname] ?? 'naviroot';
  const needsKey = !hasApiKey() && location.pathname !== '/my';
  const fullHeight = FULL_HEIGHT.has(location.pathname) && !needsKey;

  return (
    <div className="app">
      <header className="app-header">
        <h1>{title}</h1>
        <span className="brand">naviroot</span>
      </header>
      {!online && <div className="offline-banner">オフラインです。お気に入り・履歴は閲覧できます。</div>}
      {mapsError && !needsKey && (
        <div className="alert error" style={{ margin: '8px 16px' }}>
          {mapsError}
        </div>
      )}
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
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </MapsErrorContext.Provider>
  );
  if (!hasApiKey()) return content;
  return (
    <APIProvider
      apiKey={GOOGLE_MAPS_API_KEY}
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
