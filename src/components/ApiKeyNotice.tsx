import { ApiKeyForm } from './ApiKeyForm';

const CONSOLE = 'https://console.cloud.google.com';

export function ApiKeyNotice() {
  return (
    <div className="setup">
      <div className="card">
        <h2>はじめに: Google Maps API キーを設定</h2>
        <p style={{ marginTop: 0 }}>
          取得した API キーを下に貼り付けて「保存して開始」を押すと、すぐに使えます。キーはこの端末のブラウザ内にだけ保存されます。
        </p>
        <ApiKeyForm />
      </div>

      <div className="card">
        <h2>API キーの取得手順（約 5 分）</h2>
        <ol>
          <li>
            <a href={`${CONSOLE}/billing/projects`} target="_blank" rel="noreferrer">
              課金が有効なプロジェクト
            </a>
            を使います。Google Cloud Console 右上のプロジェクト選択で、すでに課金が有効なプロジェクトを選んでください。無い場合のみ{' '}
            <a href={`${CONSOLE}/projectcreate`} target="_blank" rel="noreferrer">
              プロジェクトを作成
            </a>
            して請求先アカウントを登録します（毎月 $200 分の無料枠内なら請求されません）。
            <div className="alert warn" style={{ marginTop: 6 }}>
              「課金を有効にできるプロジェクトの上限に達しています」と表示された場合は、新規作成ではなく既存の課金有効プロジェクトを選ぶか、「お支払い →
              マイプロジェクト」で不要なプロジェクトの課金を無効化して枠を空けてください。
            </div>
          </li>
          <li>
            次の 3 つの API を有効化します。リンク先で「有効にする」を押してください。
            <ul>
              <li>
                <a href={`${CONSOLE}/apis/library/maps-backend.googleapis.com`} target="_blank" rel="noreferrer">
                  Maps JavaScript API
                </a>
              </li>
              <li>
                <a href={`${CONSOLE}/apis/library/places-backend.googleapis.com`} target="_blank" rel="noreferrer">
                  Places API
                </a>
              </li>
              <li>
                <a href={`${CONSOLE}/apis/library/directions-backend.googleapis.com`} target="_blank" rel="noreferrer">
                  Directions API
                </a>
              </li>
            </ul>
          </li>
          <li>
            <a href={`${CONSOLE}/apis/credentials`} target="_blank" rel="noreferrer">
              認証情報
            </a>
            で「認証情報を作成」→「API キー」を選ぶと、キーが表示されます。それをコピーして上の欄に貼り付けます。
          </li>
          <li>
            （推奨）作成したキーの「アプリケーションの制限」を「ウェブサイト」にし、このアプリの URL（例:{' '}
            <code>{window.location.origin}/*</code>）だけを許可すると、他人に使われるのを防げます。
          </li>
        </ol>
        <p className="alert info">
          お気に入り・履歴はキーが無くても利用できますが、地図・経路検索・スポット検索には API キーが必要です。
        </p>
      </div>
    </div>
  );
}
