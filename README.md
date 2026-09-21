# NAVIROOT 乗換・経路案内 PWA

NAVITIME 風の経路検索アプリです。地図・徒歩／車ルート・スポット検索に Google Maps Platform、乗換案内に NAVITIME API（RapidAPI）を使い、以下の機能をブラウザ（PWA）で提供します。

- **乗換案内**: 電車・バスの経路候補を複数表示。所要時間・運賃（IC）・乗換回数、「早」「安」「楽」バッジ、出発／到着／始発／終電の指定、路線ごとのタイムライン表示、地図表示。NAVITIME API キーが無い場合は Google マップ・Yahoo!乗換案内に検索条件を引き渡す
- **地図・経路検索**: 徒歩・車・自転車のルートを地図に描画し、距離・所要時間・道順を表示
- **スポット検索**: 駅名・住所・スポット名のオートコンプリート検索、地図タップで場所選択、現在地表示、「ここへ行く」「ここから出発」
- **時刻表**: 出発駅から到着駅への直近の出発便一覧
- **お気に入り・履歴**: 自宅・職場・スポット・ルートの保存、検索履歴からの再検索（端末内の localStorage に保存）
- **PWA**: ホーム画面に追加してアプリのように利用可能。オフライン時もお気に入り・履歴は閲覧可能

## 最短の使い方（インストール不要）

このリポジトリは push のたびに GitHub Actions が自動でビルドし、GitHub Pages に公開します。

1. **公開 URL を開く**: `https://isamutakiguchi.github.io/naviroot/`
   - **初回のみ、GitHub の設定を 1 回だけ行います**（Actions からは変更できないため）:
     1. GitHub Free の個人アカウントの場合: [Settings → General](https://github.com/IsamuTakiguchi/naviroot/settings) の Danger Zone → **Change visibility → Public**（非公開リポジトリでは Pages が使えません。コードに秘密情報は含まれず、API キーは端末内にのみ保存されます。GitHub Pro 以上なら不要）
     2. [Settings → Pages](https://github.com/IsamuTakiguchi/naviroot/settings/pages) の Build and deployment → **Source を「GitHub Actions」** にする
     3. [Actions タブ](https://github.com/IsamuTakiguchi/naviroot/actions) で最新の実行を開き **Re-run jobs**（または何か push する）
   - 以後は push のたびに自動で公開されます。
2. **API キーを貼り付ける**: 初回起動時の画面の手順（約 5 分）に沿って Google Maps API キーを取得し、入力欄に貼り付けて「保存して開始」を押します。キーはその端末のブラウザにだけ保存されます。
3. **ホーム画面に追加**: iPhone は共有ボタン →「ホーム画面に追加」、Android はブラウザメニュー →「アプリをインストール」。

## API キーの取得手順

1. [課金が有効なプロジェクト](https://console.cloud.google.com/billing/projects)を使います。Console 右上のプロジェクト選択で、すでに課金が有効なプロジェクトを選んでください。無い場合のみ[プロジェクトを作成](https://console.cloud.google.com/projectcreate)して請求先アカウントを登録します（毎月 $200 分の無料枠あり）
   - 「課金を有効にできるプロジェクトの上限に達しています」と表示された場合は、新規作成ではなく既存の課金有効プロジェクトを選ぶか、「お支払い → マイプロジェクト」で不要なプロジェクトの課金を無効化して枠を空けてください
2. 次の 3 つの API を有効化: [Maps JavaScript API](https://console.cloud.google.com/apis/library/maps-backend.googleapis.com) / [Places API (New)](https://console.cloud.google.com/apis/library/places.googleapis.com) / [Routes API](https://console.cloud.google.com/apis/library/routes.googleapis.com)
   - 任意: [Geocoding API](https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com)（地図をタップした地点の住所表示に使用。未有効なら座標を表示）
   - 旧 Places API / Directions API（Legacy）は 2025 年 3 月以降の新規プロジェクトでは有効化できないため、このアプリは新しい Places API (New) と Routes API を使います
3. [認証情報](https://console.cloud.google.com/apis/credentials) →「認証情報を作成」→「API キー」
4. （推奨）キーの「アプリケーションの制限」を「ウェブサイト」にし、`https://isamutakiguchi.github.io/*` のみ許可する。「API の制限」を付ける場合は上の 3 つ（＋Geocoding API）を許可する

キーの変更・削除は、アプリの「マイページ → 設定 → Google Maps API キー」から行えます。

## 乗換案内（NAVITIME API）の設定

Google の公式 FAQ にあるとおり、**Routes API は日本の交通事業者の乗換案内に対応していません**（「インド国鉄と日本を除くすべての Google 乗換パートナーに対応」）。そのため乗換案内には NAVITIME の API を使います。

1. [RapidAPI の NAVITIME Route(totalnavi)](https://rapidapi.com/navitimejapan-navitimejapan/api/navitime-route-totalnavi) を開き、Sign Up でアカウントを作成（無料）
2. Pricing タブで **Basic（$0、月 500 リクエスト、50 リクエスト/分）** を Subscribe
3. 画面右上の [Apps](https://rapidapi.com/developer/apps) → 自動作成されたアプリ（default-application_…）→ **Authorization** タブの **Application Key**（英数字約 50 文字）をコピーし、アプリの「マイページ → 設定 → NAVITIME 乗換 API キー」または乗換案内タブの案内欄に貼り付け（Endpoints タブでコード例を生成した場合も同じキーが `x-rapidapi-key` に入ります）

キーが無い場合、または無料枠を超えて 429 が返った場合は、乗換案内タブに「Google マップで乗換案内を開く」「Yahoo!乗換案内で開く」ボタンを表示して検索条件を引き渡します。今月の利用回数はマイページに表示されます（端末内のカウント）。時刻表機能は 1 回の表示で最大 6 リクエストを消費します。

## 「このページでは Google マップが正しく読み込まれませんでした」と出たら

Google Maps が API キーを拒否したときの標準ダイアログです。アプリの画面上部にエラーコードと原因・対処を表示します。よくある原因:

| エラーコード | 原因 | 対処 |
|---|---|---|
| BillingNotEnabledMapError | キーのプロジェクトで課金が有効でない | 課金が有効なプロジェクトでキーを作り直す |
| RefererNotAllowedMapError | キーの「ウェブサイトの制限」にこの URL が無い | `https://isamutakiguchi.github.io/*` を追加する |
| ApiNotActivatedMapError | Maps JavaScript API が未有効 | API ライブラリで有効にする |
| ApiTargetBlockedMapError | キーの「API の制限」で許可されていない | Maps JavaScript API / Places API (New) / Routes API を許可する |
| InvalidKeyMapError | キーが間違っている | コンソールのキーをコピーし直す |

経路検索だけ失敗する場合は Routes API、候補が出ない場合は Places API (New) の有効化を確認してください。
検索エラーの文言の下にある「詳細」を開くと Google からの生のエラーが表示されます。`PERMISSION_DENIED` や `has not been used` / `disabled` を含む場合は、キーのプロジェクトで [Routes API](https://console.cloud.google.com/apis/library/routes.googleapis.com) が未有効です。

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

- Google Maps Platform は従量課金です（Routes API の徒歩／車ルート・Places API (New) の詳細取得は各 SKU ごとに月 10,000 回程度の無料枠あり）。
- NAVITIME API（RapidAPI Basic）は月 500 リクエストまで無料。**時刻表機能は 1 回の表示で最大 6 回呼び出します**（`src/config.ts` の `TIMETABLE_MAX_QUERIES` で変更可能）。
- 自転車ルートは日本国内では Google が未対応の地域が多く、その場合は徒歩ルートへの切替を案内します。
- 運賃は NAVITIME が返す IC カード運賃（無ければきっぷ運賃）を表示します。
- 時刻表は駅単体の時刻表ではなく、「出発駅→到着駅」の経路検索結果を出発時刻順に並べたものです。

## 構成

```
src/
├── App.tsx            画面シェル（ヘッダー・下部タブ・ルーティング・APIProvider）
├── config.ts          APIキー（端末保存 / ビルド時環境変数）、既定の地図中心、各種上限
├── types.ts           Place / RouteQuery / TransitPlan などの型
├── lib/
│   ├── directions.ts  Routes API（Route.computeRoutes）のリクエスト生成・エラー日本語化（徒歩・車・自転車）
│   ├── navitime.ts    NAVITIME Route(totalnavi) API クライアントと乗換案内プランへの変換
│   ├── externalLinks.ts Google マップ / Yahoo!乗換案内への引き渡し URL
│   ├── places.ts      自由入力の地点を Places API (New) で座標に解決
│   ├── transit.ts     乗換案内プランの共通処理（徒歩区間の結合・「早」「安」「楽」バッジ）
│   ├── mapsErrors.ts  Google Maps 認証エラー（課金・リファラー等）の捕捉と日本語説明
│   ├── timetable.ts   出発時刻一覧の収集ロジック
│   ├── query.ts       検索条件と URL クエリの相互変換
│   ├── format.ts      所要時間・運賃・距離・時刻の整形
│   └── storage.ts     localStorage ラッパー
├── hooks/             位置情報・お気に入り・履歴・設定・オンライン状態・経路検索
├── components/        入力フォーム・地図・結果一覧・詳細タイムライン・時刻表など
└── pages/             乗換案内 / 地図・経路 / スポット検索 / 時刻表 / マイページ
.github/workflows/deploy.yml   テスト → ビルド → GitHub Pages へ自動デプロイ
```
