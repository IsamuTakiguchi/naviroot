import type { TransitPlan, PlanBadge, PlanSegment } from '../types';
import { formatDuration, formatFare, formatTime, VEHICLE_ICON } from '../lib/format';
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

interface Props {
  plans: TransitPlan[];
  selectedId?: string;
  onSelect: (plan: TransitPlan) => void;
}

export function TransitResultList({ plans, selectedId, onSelect }: Props) {
  return (
    <ol className="nt-list">
      {plans.map((p, i) => {
        const icons = segmentIcons(p.segments);
        return (
          <li key={p.id} className="nt-item" style={{ ['--i' as string]: i, ['--row-delay' as string]: `${i * 70}ms` }}>
            <button
              type="button"
              className={`nt-row ${selectedId === p.id ? 'selected' : ''}`}
              onClick={() => onSelect(p)}
              aria-current={selectedId === p.id}
            >
              <span className="nt-no">{i + 1}</span>
              <span className="nt-body">
                <span className="nt-times">
                  {formatTime(p.departureTime)} <span className="arrow">→</span> {formatTime(p.arrivalTime)}
                  <span className="nt-dur">（{formatDuration(p.durationSec)}）</span>
                </span>
                <span className="nt-meta">
                  乗換{p.transfers}回{p.fare && <> 　{formatFare(p.fare.value, p.fare.currency)}</>}
                  {p.surcharge ? <span className="nt-paid">有料</span> : null}
                </span>
                <span className="nt-icons">
                  {icons.map((ic, j) => (
                    <span key={j} className="nt-icon">
                      {j > 0 && <span className="sep" aria-hidden />}
                      <Icon name={ic} size={17} />
                    </span>
                  ))}
                </span>
              </span>
              <Badges badges={p.badges} showAll />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
