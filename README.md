# naviroot 乗換・経路案内 PWA

NAVITIME 風の経路検索アプリです。Google Maps Platform を使い、以下の機能をブラウザ（PWA）で提供します。

- **乗換案内**: 電車・バスの経路候補を複数表示。所要時間・運賃・乗換回数、「早」「安」「楽」バッジ、出発／到着／始発／終電の指定、路線ごとのタイムライン表示、地図表示
- **地図・経路検索**: 徒歩・車・自転車のルートを地図に描画し、距離・所要時間・道順を表示
- **スポット検索**: 駅名・住所・スポット名のオートコンプリート検索、地図タップで場所選択、現在地表示、「ここへ行く」「ここから出発」
- **時刻表**: 出発駅から到着駅への直近の出発便一覧
- **お気に入り・履歴**: 自宅・職場・スポット・ルートの保存、検索履歴からの再検索（端末内の localStorage に保存）
- **PWA**: ホーム画面に追加してアプリのように利用可能。オフライン時もお気に入り・履歴は閲覧可能

## セットアップ

### 1. Google Maps API キーを用意する

1. [Google Cloud Console](https://console.cloud.google.com/google/maps-apis) でプロジェクトを作成し、請求先アカウントを紐付けます（月 $200 分の無料枠があります）。
2. 次の API を有効化します。
   - Maps JavaScript API
   - Places API
   - Directions API
3. API キーを作成します。公開する場合は「HTTP リファラー」でアプリの URL に制限してください。

### 2. 環境変数を設定する

```bash
cp .env.example .env
# .env を開いてキーを記入
VITE_GOOGLE_MAPS_API_KEY=取得したキー
```

`VITE_GOOGLE_MAPS_MAP_ID` は任意です（Cloud Console で作成した Map ID を指定するとスタイル付き地図になります）。

### 3. 起動する

```bash
npm install
npm run dev        # 開発サーバー http://localhost:5173
npm run build      # 型チェック + 本番ビルド（dist/）
npm run preview    # ビルド結果をローカル確認
npm run test       # ユニットテスト
```

キーが未設定の場合は、アプリ起動時に設定手順の案内画面が表示されます。

## PWA として使う

`npm run build` の成果物（`dist/`）を HTTPS で配信すると、スマホのブラウザで「ホーム画面に追加」できます。
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
├── config.ts          APIキー、既定の地図中心、各種上限
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
```
