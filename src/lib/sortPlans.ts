import type { TransitPlan } from '../types';

/** NAVITIME の検索結果タブ */
export type PlanSort = 'recommended' | 'fastest' | 'cheapest' | 'fewest';

export const PLAN_SORTS: { key: PlanSort; label: string }[] = [
  { key: 'recommended', label: 'おすすめ' },
  { key: 'fastest', label: '時間短い' },
  { key: 'cheapest', label: '運賃安い' },
  { key: 'fewest', label: '乗換少ない' },
];

const dep = (p: TransitPlan) => p.departureTime.getTime();
const fare = (p: TransitPlan) => p.fare?.value ?? Number.POSITIVE_INFINITY;

/** 取得済みの候補を並べ替える（API は呼ばない）。おすすめは出発時刻順。 */
export function sortPlans(plans: TransitPlan[], sort: PlanSort): TransitPlan[] {
  const out = [...plans];
  switch (sort) {
    case 'fastest':
      out.sort((a, b) => a.durationSec - b.durationSec || dep(a) - dep(b));
      break;
    case 'cheapest':
      out.sort((a, b) => fare(a) - fare(b) || a.durationSec - b.durationSec || dep(a) - dep(b));
      break;
    case 'fewest':
      out.sort((a, b) => a.transfers - b.transfers || a.walkSec - b.walkSec || a.durationSec - b.durationSec || dep(a) - dep(b));
      break;
    default:
      out.sort((a, b) => dep(a) - dep(b) || a.durationSec - b.durationSec);
  }
  return out;
}
