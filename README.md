# naviroot 乗換・経路案内 PWA

NAVITIME 風の経路検索アプリです。Google Maps Platform を使い、以下の機能をブラウザ（PWA）で提供します。

- **乗換案内**: 電車・バスの経路候補を複数表示。所要時間・運賃・乗換回数、「早」「安」「楽」バッジ、出発／到着／始発／終電の指定、路線ごとのタイムライン表示、地図表示
- **地図・経路検索**: 徒歩・車・自転車のルートを地図に描画し、距離・所要時間・道順を表示
- **スポット検索**: 駅名・住所・スポット名のオートコンプリート検索、地図タップで場所選択、現在地表示、「ここへ行く」「ここから出発」
- **時刻表**: 出発駅から到着駅への直近の出発便一覧
- **お気に入り・履歴**: 自宅・職場・スポット・ルートの保存、検索履歴からの再検索（端末内の localStorage に保存）
- **PWA**: ホーム画面に追加してアプリのように利用可能。オフライン時もお気に入り・履歴は閲覧可能

## 最短の使い方（インストール不要）

このリポジトリは push のたびに GitHub Actions が自動でビルドし、GitHub Pages に公開します。

1. **公開 URL を開く**: `https://isamutakiguchi.github.io/naviroot/`
   - 初回のみ: GitHub Free の個人アカウントでは **非公開リポジトリで GitHub Pages が使えません**。リポジトリの Settings → General → Danger Zone → **Change visibility → Public** にすると、次回の Actions 実行から公開されます（コードに秘密情報は含まれていません。API キーは端末内にのみ保存されます）。GitHub Pro 以上なら非公開のままでも公開できます。
   - Actions の結果は [Actions タブ](https://github.com/IsamuTakiguchi/naviroot/actions) で確認できます。
2. **API キーを貼り付ける**: 初回起動時の画面の手順（約 5 分）に沿って Google Maps API キーを取得し、入力欄に貼り付けて「保存して開始」を押します。キーはその端末のブラウザにだけ保存されます。
3. **ホーム画面に追加**: iPhone は共有ボタン →「ホーム画面に追加」、Android はブラウザメニュー →「アプリをインストール」。

## API キーの取得手順

1. [Google Cloud Console でプロジェクトを作成](https://console.cloud.google.com/projectcreate)（初回は請求先アカウントの登録が必要。毎月 $200 分の無料枠あり）
2. 次の 3 つの API を有効化: [Maps JavaScript API](https://console.cloud.google.com/apis/library/maps-backend.googleapis.com) / [Places API](https://console.cloud.google.com/apis/library/places-backend.googleapis.com) / [Directions API](https://console.cloud.google.com/apis/library/directions-backend.googleapis.com)
3. [認証情報](https://console.cloud.google.com/apis/credentials) →「認証情報を作成」→「API キー」
4. （推奨）キーの「アプリケーションの制限」を「ウェブサイト」にし、`https://isamutakiguchi.github.io/*` のみ許可する

キーの変更・削除は、アプリの「マイページ → 設定 → Google Maps API キー」から行えます。

## 開発者向け: ローカルで動かす

```bash
npm install
cp .env.example .env   # VITE_GOOGLE_MAPS_API_KEY を記入（アプリ内で貼り付ける場合は不要）
npm run dev            # 開発サーバー http://localhost:5173
npm run build          # 型チェック + 本番ビルド（dist/）
npm run preview        # ビルド結果をローカル確認
npm run test           # ユニットテスト
```

サブパスで配信する場合は `VITE_BASE_PATH=/naviroot/ npm run build` のように base を指定します（GitHub Actions では自動設定）。

## PWA として使う

GitHub Pages（HTTPS）で公開された URL をスマホのブラウザで開くと「ホーム画面に追加」できます。
Service Worker はアプリ本体をキャッシュしますが、Google Maps の地図・API レスポンスは規約に従いキャッシュしません。

## 注意事項

- Google Maps Platform は従量課金です。**時刻表機能は 1 回の表示で Directions API を最大 6 回呼び出します**（`src/config.ts` の `TIMETABLE_MAX_QUERIES` で変更可能）。
- 自転車ルートは日本国内では Google が未対応の地域が多く、その場合は徒歩ルートへの切替を案内します。
- 運賃は Google が経路に運賃情報を返した場合のみ表示されます。
- 時刻表は駅単体の時刻表ではなく、「出発駅→到着駅」の経路検索結果を出発時刻順に並べたものです。

## 構成

```
src/
├── App.tsx            画面シェル（ヘッダー・下部タブ・ルーティング・APIProvider）
├── config.ts          APIキー（端末保存 / ビルド時環境変数）、既定の地図中心、各種上限
├── types.ts           Place / RouteQuery / TransitPlan などの型
├── lib/
│   ├── directions.ts  DirectionsService の Promise 化・リクエスト生成・エラー日本語化
│   ├── transit.ts     DirectionsResult → 乗換案内プラン（区間分解・バッジ付与）
│   ├── timetable.ts   出発時刻一覧の収集ロジック
│   ├── query.ts       検索条件と URL クエリの相互変換
│   ├── format.ts      所要時間・運賃・距離・時刻の整形
│   └── storage.ts     localStorage ラッパー
├── hooks/             位置情報・お気に入り・履歴・設定・オンライン状態・経路検索
├── components/        入力フォーム・地図・結果一覧・詳細タイムライン・時刻表など
└── pages/             乗換案内 / 地図・経路 / スポット検索 / 時刻表 / マイページ
.github/workflows/deploy.yml   テスト → ビルド → GitHub Pages へ自動デプロイ
```
