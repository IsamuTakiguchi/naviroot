import type { TransitPlan, PlanBadge } from '../types';
import { formatDuration, formatFare, formatTime, VEHICLE_ICON } from '../lib/format';

const BADGE_LABEL: Record<PlanBadge, string> = { fastest: '早', cheapest: '安', easiest: '楽' };

export function Badges({ badges }: { badges: PlanBadge[] }) {
  if (badges.length === 0) return null;
  return (
    <span className="badges">
      {badges.map((b) => (
        <span key={b} className={`badge ${b}`} title={{ fastest: '最短時間', cheapest: '最安', easiest: '乗換最少' }[b]}>
          {BADGE_LABEL[b]}
        </span>
      ))}
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
    <div className="plan-list">
      {plans.map((p, i) => (
        <button
          key={p.id}
          type="button"
          className={`plan-card ${selectedId === p.id ? 'selected' : ''}`}
          onClick={() => onSelect(p)}
        >
          <div className="plan-head">
            <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{i + 1}</span>
            <Badges badges={p.badges} />
            <span className="plan-times">
              {formatTime(p.departureTime)} → {formatTime(p.arrivalTime)}
            </span>
            <span className="plan-duration">({formatDuration(p.durationSec)})</span>
          </div>
          <div className="plan-meta">
            <span>
              運賃 <strong>{p.fare ? formatFare(p.fare.value, p.fare.currency) : '—'}</strong>
            </span>
            <span>
              乗換 <strong>{p.transfers}回</strong>
            </span>
            {p.walkSec > 0 && <span>徒歩 {formatDuration(p.walkSec)}</span>}
          </div>
          <div className="plan-lines">
            {p.segments.map((s, j) =>
              s.kind === 'walk' ? (
                <span key={j} className="line-pill walk">
                  🚶 {formatDuration(s.durationSec)}
                </span>
              ) : (
                <span key={j} className="line-pill" style={{ borderLeftColor: s.lineColor ?? undefined }}>
                  {VEHICLE_ICON[s.vehicle]} {s.lineShortName ?? s.lineName}
                </span>
              ),
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
