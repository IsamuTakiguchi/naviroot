import type { TransitVehicle } from '../types';
import type { JourneyLeg } from './journey';

/** コマの中に描く絵柄 */
export type TokenGlyph = 'walk' | 'train' | 'bus' | 'tram' | 'car' | 'bicycle';

const VEHICLE_GLYPH: Record<TransitVehicle, TokenGlyph> = {
  BUS: 'bus',
  RAIL: 'train',
  SUBWAY: 'train',
  TRAIN: 'train',
  TRAM: 'tram',
  OTHER: 'train',
};

export function glyphFor(leg: Pick<JourneyLeg, 'kind' | 'vehicle' | 'glyph'>): TokenGlyph {
  if (leg.glyph) return leg.glyph;
  if (leg.kind === 'walk') return 'walk';
  return leg.vehicle ? VEHICLE_GLYPH[leg.vehicle] : 'train';
}

/**
 * 絵柄の中身（24x24 の座標系）。step は 0/1 で、歩く足や車輪が交互に動く。
 * 線は currentColor 相当の色を直接指定する。
 */
function glyphBody(glyph: TokenGlyph, step: number, color: string): string {
  const s = (a: string, b: string) => (step === 0 ? a : b);
  switch (glyph) {
    case 'walk':
      // 頭・胴・腕・脚。脚と腕が交互に前後する
      return [
        `<circle cx="12" cy="5.4" r="2.5" fill="${color}"/>`,
        `<path d="M12 8.2v7" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/>`,
        `<path d="M12 10 ${s('l-3.4 2.2', 'l3.4 2.2')}" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>`,
        `<path d="M12 15 ${s('l-3.2 4.6', 'l3.2 4.6')}" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/>`,
        `<path d="M12 15 ${s('l3.2 4.6', 'l-3.2 4.6')}" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/>`,
      ].join('');
    case 'train':
      return [
        `<rect x="5" y="3.5" width="14" height="14" rx="4.5" fill="${color}"/>`,
        `<rect x="7.4" y="6.4" width="9.2" height="4.6" rx="1.6" fill="#fff"/>`,
        `<circle cx="9" cy="14" r="1.5" fill="#fff"/><circle cx="15" cy="14" r="1.5" fill="#fff"/>`,
        `<path d="M7 18.2 ${s('l-1.6 2.6', 'l-0.8 2.6')}M17 18.2 ${s('l1.6 2.6', 'l0.8 2.6')}" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`,
      ].join('');
    case 'tram':
      return [
        `<rect x="5.5" y="4" width="13" height="13" rx="3" fill="${color}"/>`,
        `<rect x="7.6" y="6.6" width="8.8" height="4" rx="1.2" fill="#fff"/>`,
        `<path d="M12 4V1.6" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>`,
        `<circle cx="9" cy="14" r="1.4" fill="#fff"/><circle cx="15" cy="14" r="1.4" fill="#fff"/>`,
        `<path d="M6 18h12" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity="${s('1', '0.45')}"/>`,
      ].join('');
    case 'bus':
      return [
        `<rect x="3.5" y="5" width="17" height="11.5" rx="3" fill="${color}"/>`,
        `<rect x="5.6" y="7.2" width="12.8" height="4.2" rx="1.4" fill="#fff"/>`,
        `<circle cx="8" cy="18" r="2" fill="${color}"/><circle cx="16" cy="18" r="2" fill="${color}"/>`,
        `<circle cx="8" cy="18" r="0.8" fill="#fff" opacity="${s('1', '0.4')}"/>`,
        `<circle cx="16" cy="18" r="0.8" fill="#fff" opacity="${s('0.4', '1')}"/>`,
      ].join('');
    case 'car':
      return [
        `<path d="M3.5 15v-2.4L6 8.2A2 2 0 0 1 7.8 7h8.4a2 2 0 0 1 1.8 1.2l2.5 4.4V15z" fill="${color}"/>`,
        `<path d="M7 9.2h10l1.5 3H5.5z" fill="#fff"/>`,
        `<circle cx="7.5" cy="16.6" r="2" fill="${color}"/><circle cx="16.5" cy="16.6" r="2" fill="${color}"/>`,
        `<circle cx="7.5" cy="16.6" r="0.8" fill="#fff" opacity="${s('1', '0.4')}"/>`,
        `<circle cx="16.5" cy="16.6" r="0.8" fill="#fff" opacity="${s('0.4', '1')}"/>`,
      ].join('');
    case 'bicycle':
      return [
        `<circle cx="6.5" cy="16" r="3.6" fill="none" stroke="${color}" stroke-width="1.8"/>`,
        `<circle cx="17.5" cy="16" r="3.6" fill="none" stroke="${color}" stroke-width="1.8"/>`,
        `<path d="M6.5 16 11 9h4l2.5 7M9.5 9h4" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
        `<circle cx="12" cy="15" r="1.2" fill="${color}" opacity="${s('1', '0.45')}"/>`,
      ].join('');
  }
}

/** コマの見た目（白い丸の台紙 + 色の縁 + 絵柄）。data URL を返す。 */
export function tokenSvg(glyph: TokenGlyph, color: string, step = 0): string {
  const body = glyphBody(glyph, step, color);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">`,
    `<ellipse cx="24" cy="42" rx="9" ry="3" fill="rgba(0,0,0,0.18)"/>`,
    `<circle cx="24" cy="22" r="15" fill="#fff" stroke="${color}" stroke-width="3"/>`,
    `<g transform="translate(12 10)">${body}</g>`,
    `</svg>`,
  ].join('');
}

export function tokenDataUrl(glyph: TokenGlyph, color: string, step = 0): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(tokenSvg(glyph, color, step))}`;
}

/** 足踏み・車輪の切り替え。歩きは速く、乗り物はゆっくり。 */
export function stepPhase(glyph: TokenGlyph, elapsed: number): number {
  const period = glyph === 'walk' ? 260 : 420;
  return Math.floor(elapsed / period) % 2;
}
