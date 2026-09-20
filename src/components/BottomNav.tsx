import { NavLink } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

const ITEMS: { to: string; icon: IconName; label: string }[] = [
  { to: '/', icon: 'train', label: '乗換案内' },
  { to: '/map', icon: 'map', label: '地図・経路' },
  { to: '/search', icon: 'search', label: 'スポット' },
  { to: '/my', icon: 'star', label: 'マイページ' },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="メインナビゲーション">
      <div className="nav-brand" aria-hidden>
        <span className="logo">
          <Icon name="pin" size={20} />
        </span>
        naviroot
      </div>
      {ITEMS.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon name={it.icon} size={24} className="icon" />
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}
