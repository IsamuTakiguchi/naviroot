import type { MapRoute } from '../types';
import { formatDistance, formatDuration, MODE_ICON, MODE_LABEL } from '../lib/format';
import { Icon } from './Icon';

const MANEUVER_ICON: Record<string, string> = {
  'turn-left': '↰',
  'turn-right': '↱',
  'turn-slight-left': '↖',
  'turn-slight-right': '↗',
  'turn-sharp-left': '↰',
  'turn-sharp-right': '↱',
  'uturn-left': '↩',
  'uturn-right': '↪',
  straight: '↑',
  merge: '⤵',
  'ramp-left': '↖',
  'ramp-right': '↗',
  'fork-left': '↖',
  'fork-right': '↗',
  'roundabout-left': '↻',
  'roundabout-right': '↺',
};

interface Props {
  route: MapRoute;
  expanded: boolean;
  onToggle: () => void;
}

export function RouteSummary({ route, expanded, onToggle }: Props) {
  return (
    <div>
      <div className="row">
        <div className="summary-big">
          <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>
            <Icon name={MODE_ICON[route.mode]} size={26} />
          </span>
          <span className="dur">{formatDuration(route.durationSec)}</span>
          <span className="dist">{formatDistance(route.distanceM)}</span>
        </div>
        <span className="spacer" />
        <button type="button" className="btn small ghost" onClick={onToggle}>
          {expanded ? '閉じる' : '道順を見る'}
        </button>
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
        {MODE_LABEL[route.mode]}
        {route.summary && ` ・ ${route.summary} 経由`}
      </div>
      {expanded && (
        <ol className="steps">
          {route.steps.map((s, i) => (
            <li key={i}>
              <span>{MANEUVER_ICON[s.maneuver ?? ''] ?? '•'}</span>
              <span>{s.instruction}</span>
              <span className="meta">
                {formatDistance(s.distanceM)}
                <br />
                {formatDuration(s.durationSec)}
              </span>
            </li>
          ))}
          <li>
            <span>
              <Icon name="flag" size={16} />
            </span>
            <span>{route.endAddress || '目的地に到着'}</span>
            <span />
          </li>
        </ol>
      )}
    </div>
  );
}
