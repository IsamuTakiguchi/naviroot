import type { Place, TimeType } from '../types';
import { googleMapsTransitUrl, yahooTransitUrl } from '../lib/externalLinks';

interface Props {
  from: Place;
  to: Place;
  time?: string;
  timeType?: TimeType;
}

/** 外部の乗換案内サービスに条件を引き渡すボタン群 */
export function ExternalTransitLinks({ from, to, time, timeType }: Props) {
  return (
    <div className="row wrap" style={{ marginTop: 8 }}>
      <a className="btn small" href={googleMapsTransitUrl(from, to)} target="_blank" rel="noreferrer">
        🗺️ Google マップで乗換案内を開く
      </a>
      <a className="btn small" href={yahooTransitUrl(from, to, time, timeType)} target="_blank" rel="noreferrer">
        🚃 Yahoo!乗換案内で開く
      </a>
    </div>
  );
}
