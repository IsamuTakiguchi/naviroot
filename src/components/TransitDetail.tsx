import type { TransitPlan } from '../types';
import { formatDistance, formatDuration, formatFare, formatTime, VEHICLE_ICON } from '../lib/format';
import { Badges } from './TransitResultList';
import { Icon } from './Icon';
import { downloadIcs } from '../lib/ics';
import { buildTimelineRows } from '../lib/timeline';

interface Props {
  plan: TransitPlan;
  fromName: string;
  toName: string;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  onShowMap?: () => void;
  /** ルートタブ用。省略するとタブを表示しない */
  plans?: TransitPlan[];
  onSelectPlan?: (plan: TransitPlan) => void;
  /** 駅の時刻表を開く */
  onOpenTimetable?: (fromStop: string, toStop: string) => void;
}

export function TransitDetail({
  plan,
  fromName,
  toName,
  onToggleFavorite,
  isFavorite,
  onShowMap,
  plans,
  onSelectPlan,
  onOpenTimetable,
}: Props) {
  const rows = buildTimelineRows(plan, fromName, toName);

  return (
    <div className="card nt-detail">
      {plans && plans.length > 1 && onSelectPlan && (
        <div className="nt-tabs" role="tablist" aria-label="ルート">
          {plans.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={p.id === plan.id}
              className={`nt-tab ${p.id === plan.id ? 'active' : ''}`}
              onClick={() => onSelectPlan(p)}
            >
              ルート{i + 1}
            </button>
          ))}
        </div>
      )}

      <div className="nt-detail-head">
        <div className="nt-detail-times">
          {formatTime(plan.departureTime)} <span className="arrow">→</span> {formatTime(plan.arrivalTime)}
          <span className="nt-dur">（{formatDuration(plan.durationSec)}）</span>
        </div>
        <div className="nt-detail-meta">
          <span>乗換{plan.transfers}回</span>
          <span className="fare">{plan.fare ? formatFare(plan.fare.value, plan.fare.currency) : '運賃情報なし'}</span>
          {plan.walkSec > 0 && <span>徒歩 {formatDuration(plan.walkSec)}</span>}
          <Badges badges={plan.badges} />
        </div>
      </div>

      <div className="row wrap nt-actions">
        {onShowMap && (
          <button type="button" className="btn small" onClick={onShowMap}>
            <Icon name="map" size={16} /> 地図で見る
          </button>
        )}
        {onToggleFavorite && (
          <button type="button" className="btn small" onClick={onToggleFavorite}>
            {isFavorite ? <Icon name="star" size={16} /> : <Icon name="star-outline" size={16} />}
            {isFavorite ? '登録済み' : 'お気に入り'}
          </button>
        )}
        <button type="button" className="btn small" onClick={() => window.print()}>
          <Icon name="print" size={16} /> ルート印刷
        </button>
        <button type="button" className="btn small" onClick={() => downloadIcs(plan, fromName, toName)}>
          <Icon name="calendar" size={16} /> カレンダー
        </button>
      </div>

      <div className="nt-timeline">
        {rows.map((row, i) => {
          if (row.kind === 'point') {
            return (
              <div key={i} className={`nt-point ${row.terminal ?? ''}`}>
                <div className="nt-point-time">
                  {row.arrive && (
                    <div>
                      <span className="t">{formatTime(row.arrive)}</span> <span className="lbl">着</span>
                    </div>
                  )}
                  {row.depart && (
                    <div>
                      <span className="t">{formatTime(row.depart)}</span> <span className="lbl">発</span>
                    </div>
                  )}
                </div>
                <div className="nt-point-dot" aria-hidden>
                  <span />
                </div>
                <div className="nt-point-name">
                  <span className="name">{row.name}</span>
                  {onOpenTimetable && row.depart && row.nextStop && (
                    <button type="button" className="nt-tt" onClick={() => onOpenTimetable(row.name, row.nextStop!)}>
                      <Icon name="clock" size={13} /> 時刻表
                    </button>
                  )}
                </div>
              </div>
            );
          }

          if (row.kind === 'walk') {
            return (
              <div key={i} className="nt-move walk">
                <div className="nt-move-icon">
                  <Icon name="walk" size={20} />
                </div>
                <div className="nt-move-bar" aria-hidden />
                <div className="nt-move-body">
                  <div className="nt-move-title">徒歩</div>
                  <div className="nt-move-sub">
                    {formatDuration(row.segment.durationSec)}　{formatDistance(row.segment.distanceM)}
                  </div>
                </div>
              </div>
            );
          }

          const s = row.segment;
          const color = s.lineColor ?? 'var(--accent)';
          return (
            <div key={i} className="nt-move transit" style={{ ['--seg-color' as string]: color }}>
              <div className="nt-move-icon">
                <Icon name={VEHICLE_ICON[s.vehicle]} size={20} />
                {s.numStops > 0 && <span className="nt-stops">{s.numStops}駅</span>}
              </div>
              <div className="nt-move-bar" aria-hidden />
              <div className="nt-move-body">
                <div className="nt-move-title">
                  {s.lineName}
                  {s.headsign && <span className="head"> {s.headsign} 行</span>}
                </div>
                <div className="nt-move-sub">
                  {formatDuration(s.durationSec)}
                  {s.agency && <>　{s.agency}</>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
