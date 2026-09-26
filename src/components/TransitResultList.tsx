import type { TransitPlan, PlanBadge, PlanSegment } from '../types';
import { formatDuration, formatTime, formatYen, VEHICLE_ICON } from '../lib/format';
import { Icon, type IconName } from './Icon';

const BADGE_LABEL: Record<PlanBadge, string> = { fastest: '早', cheapest: '安', easiest: '楽' };
const BADGE_TITLE: Record<PlanBadge, string> = { fastest: '最短時間', cheapest: '最安', easiest: '乗換最少' };
const ALL_BADGES: PlanBadge[] = ['fastest', 'cheapest', 'easiest'];

/** 「早」「安」「楽」。showAll では 3 つ並べ、該当するものだけ色を付ける（NAVITIME 風） */
export function Badges({ badges, showAll }: { badges: PlanBadge[]; showAll?: boolean }) {
  const list = showAll ? ALL_BADGES : badges;
  if (list.length === 0) return null;
  return (
    <span className="badges">
      {list.map((b, i) => (
        <span
          key={b}
          className={`badge ${b} ${badges.includes(b) ? 'on' : 'off'}`}
          title={BADGE_TITLE[b]}
          style={{ ['--bi' as string]: i }}
        >
          {BADGE_LABEL[b]}
        </span>
      ))}
    </span>
  );
}

/** 区間から乗り物アイコンの並びを作る（連続する同じ手段はまとめる） */
export function segmentIcons(segments: PlanSegment[]): IconName[] {
  const out: IconName[] = [];
  for (const s of segments) {
    const name: IconName = s.kind === 'walk' ? 'walk' : VEHICLE_ICON[s.vehicle];
    if (out[out.length - 1] !== name) out.push(name);
  }
  return out;
}

/** 「発 -[A]- 着」のように、乗る路線を路線色のチップで並べる（NAVITIME 風） */
function LineChips({ plan }: { plan: TransitPlan }) {
  const rides = plan.segments.filter((s) => s.kind === 'transit');
  return (
    <span className="nv-chips" aria-hidden>
      <span className="nv-chip end">発</span>
      {rides.map((s, i) =>
        s.kind === 'transit' ? (
          <span key={i} className="nv-chip-wrap">
            <span className="nv-dash" />
            <span className="nv-chip line" style={{ background: s.lineColor ?? 'var(--accent)' }} title={s.lineName}>
              <Icon name={VEHICLE_ICON[s.vehicle]} size={14} />
            </span>
            {s.surcharge ? <span className="nv-chip-paid">有料</span> : null}
          </span>
        ) : null,
      )}
      <span className="nv-dash" />
      <span className="nv-chip end">着</span>
    </span>
  );
}

interface Props {
  plans: TransitPlan[];
  selectedId?: string;
  onSelect: (plan: TransitPlan) => void;
}

export function TransitResultList({ plans, selectedId, onSelect }: Props) {
  return (
    <ol className="nv-list">
      {plans.map((p, i) => (
        <li key={p.id} className="nt-item" style={{ ['--i' as string]: i, ['--row-delay' as string]: `${i * 70}ms` }}>
          <button
            type="button"
            className={`nv-row ${selectedId === p.id ? 'selected' : ''}`}
            onClick={() => onSelect(p)}
            aria-current={selectedId === p.id}
          >
            <span className="nv-row-main">
              <span className="nv-row-times">
                {formatTime(p.departureTime)} <span className="arrow">⇒</span> {formatTime(p.arrivalTime)}
              </span>
              <span className="nv-row-meta">
                {formatDuration(p.durationSec)}
                {p.fare && <> {formatYen(p.fare.value)}</>} 乗換{p.transfers}回
              </span>
              <LineChips plan={p} />
            </span>
            <span className="nv-row-side">
              <Badges badges={p.badges} />
              <Icon name="chevron-right" size={22} className="nv-row-chev" />
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
