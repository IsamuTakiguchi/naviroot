import { useNavigate } from 'react-router-dom';
import type { Favorite, HistoryItem, TravelMode } from '../types';
import { FavoriteList } from '../components/FavoriteList';
import { HistoryList } from '../components/HistoryList';
import { useFavorites } from '../hooks/useFavorites';
import { useHistory } from '../hooks/useHistory';
import { useSettings } from '../hooks/useSettings';
import { queryToParams } from '../lib/query';
import { MODE_LABEL } from '../lib/format';
import {
  apiKeySource,
  clearApiKey,
  clearNavitimeKey,
  getNavitimeKey,
  hasApiKey,
  NAVITIME_FREE_LIMIT,
  navitimeKeySource,
  readNavitimeUsage,
  saveNavitimeKey,
} from '../config';
import { KeyPersistNotice } from '../components/KeyPersistNotice';
import { ApiKeyForm } from '../components/ApiKeyForm';
import { validateNavitimeKey } from '../components/NavitimeKeyNotice';
import { useState } from 'react';
import { Icon } from '../components/Icon';
import { useTheme } from '../hooks/useTheme';
import { THEME_LABEL, THEME_MODES, type ThemeMode } from '../lib/theme';

export function MyPage() {
  const navigate = useNavigate();
  const favorites = useFavorites();
  const history = useHistory();
  const { settings, update } = useSettings();
  const theme = useTheme();
  const [editingKey, setEditingKey] = useState(false);
  const [editingNavitime, setEditingNavitime] = useState(false);
  const keySource = apiKeySource();
  const navitimeSource = navitimeKeySource();
  const hasNavitime = !!getNavitimeKey();
  // 端末保存のキーがある間は、消えないようにする手順を案内する
  const showPersist = keySource === 'stored' || navitimeSource === 'stored';
  const usage = readNavitimeUsage();

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
          <Icon name="clock" size={18} /> 駅の出発時刻を調べる
        </button>
      </div>

      <div className="section-title">設定</div>
      <div className="card">
        <div className="toggle">
          <span>テーマ</span>
          <span className="segmented theme-segmented">
            {THEME_MODES.map((m) => (
              <button
                key={m}
                type="button"
                className={theme.mode === m ? 'active' : ''}
                aria-pressed={theme.mode === m}
                onClick={() => theme.setMode(m)}
              >
                {m === 'light' && <Icon name="sun" size={15} />}
                {m === 'dark' && <Icon name="moon" size={15} />}
                {THEME_LABEL[m as ThemeMode]}
              </button>
            ))}
          </span>
        </div>
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
        <div className="toggle">
          <span>
            乗換案内で後続便を自動取得する
            <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)' }}>
              候補が少ないとき時刻をずらして再検索します（1 回の検索で NAVITIME API を最大 3 回消費）
            </span>
          </span>
          <input type="checkbox" checked={settings.autoFollowups} onChange={(e) => update({ autoFollowups: e.target.checked })} />
        </div>
        <div className="toggle" style={{ flexWrap: 'wrap', gap: 8 }}>
          <span>Google Maps API キー</span>
          <span className="row">
            <span style={{ color: hasApiKey() ? 'var(--color-success)' : 'var(--color-danger)', fontSize: 13 }}>
              {keySource === 'stored' ? '設定済み（この端末）' : keySource === 'env' ? '設定済み（ビルド時）' : '未設定'}
            </span>
            <button type="button" className="btn small" onClick={() => setEditingKey((v) => !v)}>
              {editingKey ? '閉じる' : hasApiKey() ? '変更' : '設定'}
            </button>
            {keySource === 'stored' && (
              <button
                type="button"
                className="btn small danger"
                onClick={() => {
                  if (window.confirm('この端末に保存した API キーを削除しますか？')) {
                    clearApiKey();
                    window.location.reload();
                  }
                }}
              >
                削除
              </button>
            )}
          </span>
        </div>
        {editingKey && (
          <div style={{ padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
            <ApiKeyForm compact />
          </div>
        )}
        <div className="toggle" style={{ borderBottom: 0, flexWrap: 'wrap', gap: 8 }}>
          <span>
            NAVITIME 乗換 API キー（RapidAPI）
            {hasNavitime && (
              <span style={{ display: 'block', fontSize: 12, color: usage.count >= NAVITIME_FREE_LIMIT * 0.9 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                今月の利用: {usage.count} / {NAVITIME_FREE_LIMIT} 回（この端末でのカウント）
              </span>
            )}
          </span>
          <span className="row">
            <span style={{ color: hasNavitime ? 'var(--color-success)' : 'var(--color-text-muted)', fontSize: 13 }}>
              {navitimeSource === 'stored' ? '設定済み（この端末）' : navitimeSource === 'env' ? '設定済み（ビルド時）' : '未設定（Google マップ等へ引き渡し）'}
            </span>
            <button type="button" className="btn small" onClick={() => setEditingNavitime((v) => !v)}>
              {editingNavitime ? '閉じる' : hasNavitime ? '変更' : '設定'}
            </button>
            {navitimeSource === 'stored' && (
              <button
                type="button"
                className="btn small danger"
                onClick={() => {
                  if (window.confirm('この端末に保存した NAVITIME API キーを削除しますか？')) {
                    clearNavitimeKey();
                    window.location.reload();
                  }
                }}
              >
                削除
              </button>
            )}
          </span>
        </div>
        {showPersist && (
          <div style={{ paddingTop: 12, borderTop: '1px solid var(--color-border)', marginTop: 10 }}>
            <KeyPersistNotice />
          </div>
        )}
        {editingNavitime && (
          <div style={{ paddingTop: 10 }}>
            <ApiKeyForm
              compact
              save={saveNavitimeKey}
              validate={validateNavitimeKey}
              placeholder="RapidAPI の X-RapidAPI-Key を貼り付け"
              ariaLabel="NAVITIME API キー"
            />
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
              RapidAPI で NAVITIME Route(totalnavi) の Basic プランを Subscribe したあと、右上の Apps → アプリ名 → Authorization タブの「Application Key」がキーです。詳しい手順は乗換案内タブで検索したときに表示されます。
            </p>
          </div>
        )}
      </div>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
        NAVIROOT v{__APP_VERSION__} ・ 地図・徒歩/車ルート・スポット: Google Maps Platform ・ 乗換案内: NAVITIME API
      </p>
    </div>
  );
}
