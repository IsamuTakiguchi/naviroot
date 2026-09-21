import { Icon } from './Icon';

/**
 * 経路検索中の待ち画面。線路の上を電車が走り、下に結果と同じ形のスケルトンを出す。
 * 待ち時間そのものは変わらないが、何が出てくるのかが分かるようにする。
 */
export function TransitLoading({ rows = 3, label = '経路を検索しています…' }: { rows?: number; label?: string }) {
  return (
    <div className="nt-loading" role="status" aria-live="polite">
      <div className="nt-track" aria-hidden>
        <span className="nt-track-line" />
        <span className="nt-train">
          <Icon name="train" size={22} />
        </span>
      </div>
      <div className="nt-loading-label">{label}</div>
      <ol className="nt-list" aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="nt-item" style={{ ['--row-delay' as string]: `${i * 90}ms` }}>
            <div className="nt-row nt-skeleton">
              <span className="nt-no sk" />
              <span className="nt-body">
                <span className="sk-bar w-60" />
                <span className="sk-bar w-40" />
                <span className="sk-bar w-30" />
              </span>
              <span className="badges">
                <span className="sk-badge" />
                <span className="sk-badge" />
                <span className="sk-badge" />
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
