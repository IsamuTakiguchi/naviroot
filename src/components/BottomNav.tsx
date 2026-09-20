import { NavLink } from 'react-router-dom';

const ITEMS = [
  { to: '/', icon: '🚃', label: '乗換案内' },
  { to: '/map', icon: '🗺️', label: '地図・経路' },
  { to: '/search', icon: '🔍', label: 'スポット' },
  { to: '/my', icon: '⭐', label: 'マイページ' },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="メインナビゲーション">
      {ITEMS.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="icon" aria-hidden>
            {it.icon}
          </span>
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}
