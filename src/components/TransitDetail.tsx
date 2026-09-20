import type { TransitPlan, TransitSegment } from '../types';
import { formatDistance, formatDuration, formatFare, formatTime, VEHICLE_ICON } from '../lib/format';
import { Badges } from './TransitResultList';

interface Props {
  plan: TransitPlan;
  fromName: string;
  toName: string;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  onShowMap?: () => void;
}

export function TransitDetail({ plan, fromName, toName, onToggleFavorite, isFavorite, onShowMap }: Props) {
  const transit = plan.segments.filter((s): s is TransitSegment => s.kind === 'transit');
  return (
    <div className="card">
      <div className="plan-head">
        <Badges badges={plan.badges} />
        <span className="plan-times">
          {formatTime(plan.departureTime)} → {formatTime(plan.arrivalTime)}
        </span>
        <span className="plan-duration">({formatDuration(plan.durationSec)})</span>
      </div>
      <div className="plan-meta">
        <span>
          運賃 <strong>{plan.fare ? formatFare(plan.fare.value, plan.fare.currency) : '運賃情報なし'}</strong>
        </span>
        <span>
          乗換 <strong>{plan.transfers}回</strong>
        </span>
        <span>徒歩 {formatDuration(plan.walkSec)}</span>
      </div>
      <div className="row" style={{ margin: '10px 0' }}>
        {onToggleFavorite && (
          <button type="button" className="btn small" onClick={onToggleFavorite}>
            {isFavorite ? '★ 登録済み' : '☆ お気に入り'}
          </button>
        )}
        {onShowMap && (
          <button type="button" className="btn small" onClick={onShowMap}>
            🗺️ 地図で見る
          </button>
        )}
      </div>
      <ol className="timeline">
        <li className="tl-stop">
          <span className="time">{formatTime(plan.departureTime)}</span>
          <span className="marker" />
          <span className="name">{fromName}</span>
        </li>
        {plan.segments.map((s, i) => {
          if (s.kind === 'walk') {
            return (
              <li key={i} className="tl-seg walk">
                <span className="dur">{formatDuration(s.durationSec)}</span>
                <span className="bar" />
                <div className="body">
                  🚶 徒歩 {formatDistance(s.distanceM)}
                  {s.instruction && s.instruction !== '徒歩' && <div className="sub">{s.instruction}</div>}
                </div>
              </li>
            );
          }
          const color = s.lineColor ?? '#0b57d0';
          const idx = transit.indexOf(s);
          const prev = idx > 0 ? transit[idx - 1] : undefined;
          return (
            <li key={i} style={{ display: 'contents' }}>
              <div className="tl-stop">
                <span className="time">{formatTime(s.departureTime)}</span>
                <span className="marker" style={{ borderColor: color }} />
                <span className="name">
                  {s.departureStop}
                  {prev && prev.arrivalStop === s.departureStop && (
                    <span className="sub" style={{ fontWeight: 400, fontSize: 12, marginLeft: 6, color: 'var(--color-text-muted)' }}>
                      乗換
                    </span>
                  )}
                </span>
              </div>
              <div className="tl-seg" style={{ ['--seg-color' as string]: color }}>
                <span className="dur">{formatDuration(s.durationSec)}</span>
                <span className="bar" />
                <div className="body">
                  <span className="line-name" style={{ color: s.lineTextColor ?? '#fff' }}>
                    {VEHICLE_ICON[s.vehicle]} {s.lineName}
                  </span>
                  <div className="sub">
                    {s.headsign && <>{s.headsign} 行</>}
                    {s.numStops > 0 && <> ・ {s.numStops}駅</>}
                    {s.agency && <> ・ {s.agency}</>}
                  </div>
                </div>
              </div>
              <div className="tl-stop">
                <span className="time">{formatTime(s.arrivalTime)}</span>
                <span className="marker" style={{ borderColor: color }} />
                <span className="name">{s.arrivalStop}</span>
              </div>
            </li>
          );
        })}
        <li className="tl-stop">
          <span className="time">{formatTime(plan.arrivalTime)}</span>
          <span className="marker" style={{ borderColor: 'var(--color-accent)', background: 'var(--color-accent)' }} />
          <span className="name">{toName}</span>
        </li>
      </ol>
    </div>
  );
}
