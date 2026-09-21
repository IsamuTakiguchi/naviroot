import { GITHUB_ACTIONS_URL, GITHUB_SECRETS_URL } from '../config';

/**
 * 端末に保存した API キーはホーム画面アプリの削除・追加し直しや容量整理で消えることがある。
 * GitHub Secrets に登録してビルド時に組み込む手順を案内する。
 */
export function KeyPersistNotice({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="alert info" style={{ fontSize: 13, marginBottom: 0 }}>
        ホーム画面のアプリを削除して追加し直すと、端末に保存したキーは消えます。消えないようにするには、マイページの「キーを更新後も保持する」の手順で GitHub
        に登録してください。
      </p>
    );
  }
  return (
    <div className="key-persist">
      <div style={{ fontWeight: 700 }}>キーを更新後も保持する（推奨）</div>
      <p style={{ margin: '4px 0 6px', fontSize: 13, color: 'var(--color-text-muted)' }}>
        端末に保存したキーは、ホーム画面のアプリを削除して追加し直したときや、端末の容量整理で消えることがあります。GitHub
        のリポジトリに登録しておくと、公開時にアプリへ組み込まれるため、更新・再インストール後も入力し直す必要がなくなります。
      </p>
      <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
        <li>
          <a href={GITHUB_SECRETS_URL} target="_blank" rel="noreferrer">
            リポジトリの Settings → Secrets and variables → Actions
          </a>{' '}
          を開き、「New repository secret」を押します。
        </li>
        <li>
          Name に <code>VITE_GOOGLE_MAPS_API_KEY</code>、Secret に Google Maps の API キーを入れて保存します。同様に <code>VITE_NAVITIME_API_KEY</code>{' '}
          に NAVITIME（RapidAPI）のキーを登録します。
        </li>
        <li>
          <a href={GITHUB_ACTIONS_URL} target="_blank" rel="noreferrer">
            Actions の「Build and deploy to GitHub Pages」
          </a>{' '}
          で「Run workflow」を押します。数分後にアプリを開き直すと、マイページに「設定済み（ビルド時）」と表示されます。
        </li>
      </ol>
      <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
        公開サイトのプログラムにキーが含まれるため、Google 側は「ウェブサイトの制限」でこのアプリの URL だけを許可しておいてください（RapidAPI 側は Basic
        プランの無料上限で保護されます）。
      </p>
    </div>
  );
}
