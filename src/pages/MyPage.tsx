import { useNavigate } from 'react-router-dom';
import type { Favorite, HistoryItem, TravelMode } from '../types';
import { FavoriteList } from '../components/FavoriteList';
import { HistoryList } from '../components/HistoryList';
import { useFavorites } from '../hooks/useFavorites';
import { useHistory } from '../hooks/useHistory';
import { useSettings } from '../hooks/useSettings';
import { queryToParams } from '../lib/query';
import { MODE_LABEL } from '../lib/format';
import { hasApiKey } from '../config';

export function MyPage() {
  const navigate = useNavigate();
  const favorites = useFavorites();
  const history = useHistory();
  const { settings, update } = useSettings();

  const openFavorite = (f: Favorite) => {
    if (f.kind === 'route') {
      navigate({
        pathname: f.mode === 'TRANSIT' ? '/' : '/map',
        search: queryToParams({ from: f.from, to: f.to, mode: f.mode, timeType: 'departure' }).toString(),
      });
    } else {
      navigate({ pathname: '/search', search: queryToParams({ to: f.place }).toString() });
    }
  };

  const goTo = (f: Favorite) => {
    if (f.kind !== 'place') return;
    navigate({ pathname: '/', search: queryToParams({ to: f.place, mode: 'TRANSIT', timeType: 'departure' }).toString() });
  };

  const openHistory = (h: HistoryItem) => {
    navigate({
      pathname: h.mode === 'TRANSIT' ? '/' : '/map',
      search: queryToParams({ from: h.from, to: h.to, mode: h.mode, timeType: 'departure' }).toString(),
    });
  };

  return (
    <div className="page">
      <div className="section-title">お気に入り</div>
      <div className="card">
        <FavoriteList favorites={favorites.favorites} onOpen={openFavorite} onGoTo={goTo} onRemove={favorites.remove} />
      </div>

      <div className="section-title">検索履歴</div>
      <div className="card">
        <HistoryList history={history.history} onOpen={openHistory} onRemove={history.remove} onClear={history.clear} />
      </div>

      <div className="section-title">時刻表</div>
      <div className="card">
        <button type="button" className="btn block" onClick={() => navigate('/timetable')}>
          🕒 駅の出発時刻を調べる
        </button>
      </div>

      <div className="section-title">設定</div>
      <div className="card">
        <div className="toggle">
          <span>地図ルートの既定の移動手段</span>
          <select value={settings.defaultMode} onChange={(e) => update({ defaultMode: e.target.value as TravelMode })}>
            {(['WALKING', 'DRIVING', 'BICYCLING'] as TravelMode[]).map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="toggle">
          <span>検索履歴を保存する</span>
          <input type="checkbox" checked={settings.saveHistory} onChange={(e) => update({ saveHistory: e.target.checked })} />
        </div>
        <div className="toggle" style={{ borderBottom: 0 }}>
          <span>Google Maps API キー</span>
          <span style={{ color: hasApiKey() ? 'var(--color-success)' : 'var(--color-danger)', fontSize: 13 }}>
            {hasApiKey() ? '設定済み' : '未設定'}
          </span>
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
        naviroot v{__APP_VERSION__} ・ 地図・経路データ: Google Maps Platform
      </p>
    </div>
  );
}
