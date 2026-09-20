import type { CSSProperties, ReactNode } from 'react';

/**
 * アプリ内で使うピクトグラム（オリジナルの SVG）。
 * 乗り物は正面・側面のシルエット、UI アイコンは線画。すべて currentColor で描画する。
 */
export type IconName =
  | 'train'
  | 'subway'
  | 'bus'
  | 'tram'
  | 'express'
  | 'car'
  | 'bicycle'
  | 'walk'
  | 'map'
  | 'search'
  | 'star'
  | 'star-outline'
  | 'home'
  | 'work'
  | 'pin'
  | 'clock'
  | 'locate'
  | 'swap'
  | 'chevron-left'
  | 'chevron-right'
  | 'trash'
  | 'edit'
  | 'flag'
  | 'close'
  | 'route';

interface Def {
  /** 塗りつぶし系（fill=currentColor） */
  fill?: ReactNode;
  /** 線画系（stroke=currentColor） */
  stroke?: ReactNode;
}

const ICONS: Record<IconName, Def> = {
  // 電車（正面）
  train: {
    fill: (
      <>
        <path
          fillRule="evenodd"
          d="M6 2h12a4 4 0 0 1 4 4v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V6a4 4 0 0 1 4-4zm0 4v6h12V6H6zm1.5 8a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm9 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z"
        />
        <path d="M5 22l2.2-3h2l-1.6 3zM19 22l-2.2-3h-2l1.6 3z" />
      </>
    ),
  },
  // 地下鉄（丸みのある正面）
  subway: {
    fill: (
      <>
        <path
          fillRule="evenodd"
          d="M12 2c5.5 0 9 3.2 9 7.5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5C3 5.2 6.5 2 12 2zM6 8v5h12V8H6zm2 7.2a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zm8 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z"
        />
        <path d="M5 22l2.2-3h2l-1.6 3zM19 22l-2.2-3h-2l1.6 3z" />
      </>
    ),
  },
  // バス（正面）
  bus: {
    fill: (
      <path
        fillRule="evenodd"
        d="M5 2h14a3 3 0 0 1 3 3v12a2 2 0 0 1-2 2h-1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2H9v2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-2H4a2 2 0 0 1-2-2V5a3 3 0 0 1 3-3zm0 4v6h14V6H5zm2.5 8a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm9 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z"
      />
    ),
  },
  // 路面電車（パンタグラフ付き）
  tram: {
    fill: (
      <>
        <path d="M8.5 1h7l-2.2 2.5h-2.6z" />
        <path
          fillRule="evenodd"
          d="M6 4h12a3 3 0 0 1 3 3v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3zm0 3v5h12V7H6zm1.5 7.5a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zm9 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z"
        />
        <path d="M6 22l2-3h2l-1.5 3zM18 22l-2-3h-2l1.5 3z" />
      </>
    ),
  },
  // 新幹線・特急（側面のノーズ）
  express: {
    fill: (
      <>
        <path
          fillRule="evenodd"
          d="M2 16c0-5 3.5-9 9.5-9H17a5 5 0 0 1 5 5v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1zm10-6v3h2.5v-3H12zm4.5 0v3H19a3 3 0 0 0-2.5-3z"
        />
        <circle cx="7" cy="20" r="1.6" />
        <circle cx="17" cy="20" r="1.6" />
      </>
    ),
  },
  // 車（側面）
  car: {
    fill: (
      <path
        fillRule="evenodd"
        d="M5.5 8.2A2.5 2.5 0 0 1 7.9 6.5h8.2a2.5 2.5 0 0 1 2.4 1.7L20 13h.5A1.5 1.5 0 0 1 22 14.5V18a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1h-13v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3.5A1.5 1.5 0 0 1 3.5 13H4l1.5-4.8zM7.3 9l-1 3.5h11.4L16.7 9H7.3zM6 14a1.3 1.3 0 1 0 0 2.6A1.3 1.3 0 0 0 6 14zm12 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z"
      />
    ),
  },
  // 自転車
  bicycle: {
    stroke: (
      <>
        <circle cx="5.5" cy="16.5" r="3.5" />
        <circle cx="18.5" cy="16.5" r="3.5" />
        <path d="M5.5 16.5 9 9h5.5l4 7.5M9 9l4 7.5 2.5-6M12.5 6h2.5" />
      </>
    ),
  },
  // 歩く人
  walk: {
    fill: <circle cx="14" cy="3.6" r="2" />,
    stroke: <path d="M13.6 7.5 12.2 14M12.2 14l2.6 2.4.6 5M12.2 14 9.4 20.5M13.6 8l3 2.6M13.4 8l-2.8 2-1.4 3.4" />,
  },
  // 地図
  map: {
    stroke: <path d="M3 6.5 9 4l6 2.5 6-2.5v13l-6 2.5-6-2.5-6 2.5zM9 4v13.5M15 6.5V20" />,
  },
  search: {
    stroke: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 5 5" />
      </>
    ),
  },
  star: {
    fill: <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" />,
  },
  'star-outline': {
    stroke: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />,
  },
  home: {
    fill: <path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z" />,
  },
  work: {
    fill: (
      <path
        fillRule="evenodd"
        d="M9 3h6a1 1 0 0 1 1 1v2h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4V4a1 1 0 0 1 1-1zm1 3h4V5h-4v1zm-6 5v2h16v-2H4z"
      />
    ),
  },
  pin: {
    fill: (
      <path
        fillRule="evenodd"
        d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2z"
      />
    ),
  },
  clock: {
    stroke: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
  },
  locate: {
    stroke: (
      <>
        <circle cx="12" cy="12" r="6" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
      </>
    ),
    fill: <circle cx="12" cy="12" r="2" />,
  },
  swap: {
    stroke: <path d="M8 4v14M4.5 14.5 8 18l3.5-3.5M16 20V6M12.5 9.5 16 6l3.5 3.5" />,
  },
  'chevron-left': {
    stroke: <path d="M15 5l-7 7 7 7" />,
  },
  'chevron-right': {
    stroke: <path d="M9 5l7 7-7 7" />,
  },
  trash: {
    stroke: <path d="M4 7h16M9.5 7V4h5v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  },
  edit: {
    stroke: <path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4" />,
  },
  flag: {
    fill: <path d="M5 2.5h2V22H5zM7 3h8l1 2h4v10h-7l-1-2H7z" />,
  },
  close: {
    stroke: <path d="M6 6l12 12M18 6 6 18" />,
  },
  // 経路（点線で結ばれた 2 点）
  route: {
    stroke: (
      <>
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="18" r="2.5" />
        <path d="M6 8.5V12a2.5 2.5 0 0 0 2.5 2.5h7A2.5 2.5 0 0 1 18 17v-1.5" />
      </>
    ),
  },
};

interface Props {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export function Icon({ name, size = 18, className, style, title }: Props) {
  const def = ICONS[name];
  return (
    <svg
      className={`icon-svg${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      style={style}
    >
      {title && <title>{title}</title>}
      {def.fill && <g fill="currentColor">{def.fill}</g>}
      {def.stroke && (
        <g fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          {def.stroke}
        </g>
      )}
    </svg>
  );
}
