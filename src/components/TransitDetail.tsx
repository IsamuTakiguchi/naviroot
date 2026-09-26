import { useState, type ReactNode } from 'react';
import type { Place, TransitPlan } from '../types';
import { formatDateLong, formatDistance, formatDuration, formatTime, formatYen, VEHICLE_ICON } from '../lib/format';
import { Badges } from './TransitResultList';
import { Icon } from './Icon';
import { downloadIcs } from '../lib/ics';
import { buildTimelineRows } from '../lib/timeline';
import { googleMapsPlaceUrl } from '../lib/externalLinks';
import { planShareText, shareText } from '../lib/share';
import type { SlideDirection } from '../lib/followups';

interface Props {
  plan: TransitPlan;
  fromName: string;
  toName: string;
  /** 目的地（「目的地周辺の地図をみる」用） */
  destination?: Place;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  onShowMap?: () => void;
  /** 地図（「地図」を押したときに操作列の下に出す） */
  mapPanel?: ReactNode;
  /** ルートタブ・見出しの番号用。省略するとタブを表示しない */
  plans?: TransitPlan[];
  onSelectPlan?: (plan: TransitPlan) => void;
  /** 駅の時刻表を開く */
  onOpenTimetable?: (fromStop: string, toStop: string) => void;
  /** 「‹ 検索結果」 */
  onBack?: () => void;
  /** 「再検索」 */
  onReSearch?: () => void;
  /** 「前の便」「次の便」。指定しない方向のボタンは出さない */
  onSlide?: (direction: SlideDirection) => void;
  slideDirections?: SlideDirection[];
}

export function TransitDetail({
  plan,
  fromName,
  toName,
  destination,
  onToggleFavorite,
  isFavorite,
  onShowMap,
  mapPanel,
  plans,
  onSelectPlan,
  onOpenTimetable,
  onBack,
  onReSearch,
  onSlide,
  slideDirections = ['prev', 'next'],
}: Props) {
  const rows = buildTimelineRows(plan, fromName, toName);
  const index = plans ? plans.findIndex((p) => p.id === plan.id) : -1;
  const [shareNote, setShareNote] = useState<string>();

  const share = async () => {
    const r = await shareText('NAVIROOT 乗換案内', planShareText(plan, fromName, toName), window.location.href);
    setShareNote(r === 'copied' ? '経路をコピーしました' : r === 'failed' ? '共有できませんでした' : undefined);
  };

  return (
    <>
      {(onBack || onReSearch) && (
        <div className="nv-bar">
          {onBack ? (
            <button type="button" className="nv-bar-link" onClick={onBack}>
              <Icon name="chevron-left" size={22} /> 検索結果
            </button>
          ) : (
            <span />
          )}
          <div className="nv-bar-title">
            {index >= 0 && <div className="nv-bar-route">ルート{index + 1}</div>}
            <div className="nv-bar-times">
              {formatTime(plan.departureTime)} ⇒ {formatTime(plan.arrivalTime)}
            </div>
          </div>
          {onReSearch ? (
            <button type="button" className="nv-bar-link end" onClick={onReSearch}>
              再検索
            </button>
          ) : (
            <span />
          )}
        </div>
      )}

      <div className="card nt-detail nv-detail">
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

        {/* 要約: 「40分 680円 乗換0回」「9月23日(水) 32.8km」 */}
        <div className="nv-summary">
          <div className="nv-sum-main">
            <div className="nv-sum-line">
              <span>{formatDuration(plan.durationSec)}</span>
              {plan.fare && <span className="nv-fare">{formatYen(plan.fare.value)}</span>}
              <span>乗換{plan.transfers}回</span>
            </div>
            <div className="nv-sum-sub">
              {formatDateLong(plan.departureTime)}
              {plan.distanceM ? ` ${formatDistance(plan.distanceM)}` : ''}
              {plan.walkSec > 0 && <span className="nv-sum-walk">徒歩 {formatDuration(plan.walkSec)}</span>}
            </div>
            {plan.fare && plan.surcharge ? (
              <div className="nv-fare-breakdown">
                運賃 {formatYen(plan.fare.value - plan.surcharge)} ＋ {plan.surchargeLabel ?? '特急料金'} {formatYen(plan.surcharge)}
              </div>
            ) : null}
          </div>
          <div className="nv-sum-side">
            <Badges badges={plan.badges} />
            {onToggleFavorite && (
              <button
                type="button"
                className={`nv-memo ${isFavorite ? 'on' : ''}`}
                onClick={onToggleFavorite}
                aria-pressed={isFavorite}
              >
                <Icon name={isFavorite ? 'star' : 'star-outline'} size={24} />
                <span>ルートメモ</span>
              </button>
            )}
          </div>
        </div>

        {/* 操作アイコン列 */}
        <div className="nv-actions">
          {onShowMap && (
            <button type="button" onClick={onShowMap}>
              <Icon name="map" size={24} />
              <span>地図</span>
            </button>
          )}
          <button type="button" onClick={() => window.print()}>
            <Icon name="print" size={24} />
            <span>印刷</span>
          </button>
          <button type="button" onClick={() => downloadIcs(plan, fromName, toName)}>
            <Icon name="calendar" size={24} />
            <span>カレンダー</span>
          </button>
          <button type="button" onClick={() => void share()}>
            <Icon name="share" size={24} />
            <span>共有</span>
          </button>
        </div>
        {shareNote && <div className="nv-note">{shareNote}</div>}
        {mapPanel}

        {/* タイムライン */}
        <div className="nv-timeline">
          {rows.map((row, i) => {
            if (row.kind === 'point') {
              return (
                <div key={i} className={`nv-pt ${row.terminal ?? ''}`} style={{ ['--i' as string]: i }}>
                  <div className="nv-pt-time">
                    {row.arrive && (
                      <div className={row.depart ? 'arr sub' : 'arr'}>
                        <span className="t">{formatTime(row.arrive)}</span>
                        <span className="k">着</span>
                      </div>
                    )}
                    {row.depart && (
                      <div className="dep">
                        <span className="t">{formatTime(row.depart)}</span>
                        <span className="k">発</span>
                      </div>
                    )}
                  </div>
                  <div className="nv-pt-name">{row.name}</div>
                  {onOpenTimetable && row.depart && row.nextStop ? (
                    <button type="button" className="nv-tt" onClick={() => onOpenTimetable(row.name, row.nextStop!)}>
                      <Icon name="clock" size={22} />
                      <span>時刻表</span>
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              );
            }

            if (row.kind === 'walk') {
              return (
                <div key={i} className="nv-walk" style={{ ['--i' as string]: i }}>
                  <div className="nv-side">
                    <Icon name="walk" size={20} />
                  </div>
                  <div className="nv-walk-bar" aria-hidden />
                  <div className="nv-walk-body">
                    徒歩 {formatDuration(row.segment.durationSec)}
                    {row.segment.distanceM > 0 && <span className="dist">（{formatDistance(row.segment.distanceM)}）</span>}
                  </div>
                </div>
              );
            }

            const s = row.segment;
            const color = s.lineColor ?? 'var(--accent)';
            return (
              <div key={i} className="nv-ride" style={{ ['--seg-color' as string]: color, ['--i' as string]: i }}>
                <div className="nv-side">
                  {s.numStops > 0 && <div className="nv-stops">{s.numStops}駅</div>}
                  <div>{formatDuration(s.durationSec)}</div>
                  {s.distanceM ? <div>{formatDistance(s.distanceM)}</div> : null}
                </div>
                <div className="nv-ride-bar" aria-hidden />
                <div className="nv-ride-body">
                  <div className="nv-ride-line">
                    <span className="nv-line-mark" aria-hidden>
                      <Icon name={VEHICLE_ICON[s.vehicle]} size={16} />
                    </span>
                    <span>{s.lineName}</span>
                  </div>
                  {s.headsign && <div className="nv-ride-head">{s.headsign}行</div>}
                  {s.agency && <div className="nv-ride-sub">{s.agency}</div>}
                </div>
                {s.fare || s.surcharge ? (
                  <div className="nv-ride-fare">
                    {s.fare && <div>{formatYen(s.fare.value - (s.surcharge ?? 0))}</div>}
                    {s.surcharge ? (
                      <div className="nv-ride-surcharge">
                        {s.surchargeLabel ?? '特急料金'} {formatYen(s.surcharge)}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {plan.fareUnits && (
          <details className="nv-fare-raw">
            <summary>料金データを表示</summary>
            <div>
              経路全体: {Object.entries(plan.fareUnits).map(([k, v]) => `${k}=${v}`).join(' ')}
              {plan.segments
                .filter((x) => x.kind === 'transit' && x.fareUnits)
                .map((x, i) =>
                  x.kind === 'transit' ? (
                    <div key={i}>
                      {x.lineName}: {Object.entries(x.fareUnits ?? {}).map(([k, v]) => `${k}=${v}`).join(' ')}
                      {x.fareDetail?.length
                        ? ` | 特別料金: ${x.fareDetail.map((d) => `${d.name ?? d.id ?? '?'}=${d.fare ?? '?'}${d.default ? '(適用)' : ''}`).join(' ')}`
                        : ''}
                    </div>
                  ) : null,
                )}
            </div>
          </details>
        )}
        {destination && (
          <a className="nv-dest-map" href={googleMapsPlaceUrl(destination)} target="_blank" rel="noreferrer">
            <Icon name="pin" size={22} />
            <span>目的地周辺の地図をみる</span>
            <Icon name="external" size={20} />
          </a>
        )}

        {onSlide && slideDirections.length > 0 && (
          <div className="nv-slide">
            {slideDirections.includes('prev') && (
              <button type="button" onClick={() => onSlide('prev')}>
                前の便
              </button>
            )}
            {slideDirections.includes('next') && (
              <button type="button" onClick={() => onSlide('next')}>
                次の便
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
