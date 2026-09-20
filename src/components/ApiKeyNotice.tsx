export function ApiKeyNotice() {
  return (
    <div className="setup">
      <div className="card">
        <h2>Google Maps API キーが設定されていません</h2>
        <p>
          このアプリは Google Maps Platform を利用します。以下の手順で API キーを設定してから再起動してください。
        </p>
        <ol>
          <li>
            <a href="https://console.cloud.google.com/google/maps-apis" target="_blank" rel="noreferrer">
              Google Cloud Console
            </a>
            でプロジェクトを作成し、請求先アカウントを紐付けます（月 $200 分の無料枠あり）。
          </li>
          <li>
            次の API を有効化します: <strong>Maps JavaScript API</strong>、<strong>Places API</strong>、
            <strong>Directions API</strong>。
          </li>
          <li>API キーを作成し、「HTTP リファラー」でこのアプリの URL に制限することを推奨します。</li>
          <li>
            プロジェクト直下に <code>.env</code> を作り、キーを記入します。
            <pre>VITE_GOOGLE_MAPS_API_KEY=ここにキーを貼り付け</pre>
          </li>
          <li>
            開発サーバー（<code>npm run dev</code>）を再起動、または再ビルドします。
          </li>
        </ol>
        <p className="alert info">
          お気に入り・履歴などの機能はキーが無くても利用できますが、地図・経路検索・スポット検索には API キーが必要です。
        </p>
      </div>
    </div>
  );
}
