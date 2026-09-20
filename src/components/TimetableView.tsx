import type { TimetableEntry } from '../types';
import { formatDuration, formatTime, VEHICLE_ICON } from '../lib/format';
import { Icon } from './Icon';

export function TimetableView({ entries }: { entries: TimetableEntry[] }) {
  if (entries.length === 0) return <div className="empty">出発便が見つかりませんでした。</div>;
  return (
    <ul className="tt-list">
      {entries.map((e, i) => (
        <li key={i}>
          <span className="dep">{formatTime(e.departureTime)}</span>
          <div>
            <div className="line">
              <span className="swatch" style={{ background: e.lineColor ?? undefined }} />
              <Icon name={VEHICLE_ICON[e.vehicle]} size={16} /> {e.lineShortName ?? e.lineName}
              {e.headsign && <span style={{ fontWeight: 400 }}> {e.headsign} 行</span>}
            </div>
            <div className="sub">
              {e.departureStop} 発{e.transfers > 0 ? ` ・ 乗換 ${e.transfers}回` : ' ・ 直通'}
              {e.numStops > 0 && ` ・ ${e.numStops}駅`}
            </div>
          </div>
          <div className="arr">
            {formatTime(e.arrivalTime)} 着
            <br />
            {formatDuration(e.durationSec)}
          </div>
        </li>
      ))}
    </ul>
  );
}
