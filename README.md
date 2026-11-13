# 配車さん（haisha-san）

山行に車で向かうときに、参加メンバーの出発地・車の定員・目的地から、車ごとの乗車メンバーと集合地点を提案する配車プランナーです。

[Cairn](https://oss-cairn.com) の外付けアプリとして動きます。Cairn でログインした部員だけが使え、Cairn の山行（プロジェクト）を選ぶと、参加メンバーと保存済みの出発地が入った状態から配車を組めます。設計は [docs/cairn-integration-design.md](docs/cairn-integration-design.md)。

## 画面

| 画面 | パス | 内容 |
|---|---|---|
| ログイン | `/login` | Cairn でログイン。開発用は `/login/dev` |
| ホーム | `/` | 山行の一覧（これから・実施中を近い順）、最近のプラン。出発地が未登録なら登録を促す |
| 自分の出発地 | `/me` | 住所・車を出せるか・定員（普段の値） |
| 山行 | `/trips/[projectId]` | 山行の情報と、この山行のプラン |
| 配車をつくる | `/trips/[projectId]/plan` | 山行のメンバーと場所が入った入力画面。参加者のチェック、今回だけの出発地・車・定員、同乗グループ、指定集合場所、自宅集合、Cairn にいない参加者の追加 |
| プラン | `/plans/[id]` | 保存したプラン。車ごとの乗車メンバー・集合地点・集合地点までの公共交通の経路。この URL を山行のチャンネルに貼る |
| 部員の出発地（配車係） | `/members`, `/members/[cairnUserId]` | 全部員の出発地の一覧・代理入力、CSV の取り込み・書き出し、配車係の付け外し、Cairn にいない人の出発地の削除 |
| サンプル | `/sample` | ログイン不要。内蔵の住所辞書と直線距離の概算だけで配車を試せる（保存・共有・外部への送信なし） |

## 主な機能

- 山行の「場所」（Cairn の `location` / `placeId`）を目的地の初期値にする。前回のプランがあればその目的地を優先する
- 山行のメンバー全員を参加者の初期値にし、行かない人はチェックを外す
- 出発地・運転できるか・定員は部員ごとに保存し、山行ごとに上書きできる（普段の値は変わらない）
- 一緒の車に乗りたいメンバーを同乗グループとして固定
- ドライバーごとに任意の集合場所、または出発地（自宅）を集合場所に指定
- 車なしメンバーを、定員を守りながら地理的に近いドライバーへ割り当て、車ごとに駅・駐車場などの集合地点を提案
- 最適化方針（バランス／集合のしやすさ重視／ドライバー負担重視）
- 席が足りない・車がないときは、公共交通で向かうメンバーとして案内
- プランは DB に保存し、ログインした部員だけが開ける URL で共有。共有テキストもコピーできる

## 技術スタック

| 役割 | 採用 |
|---|---|
| アプリ | Next.js（App Router）＋ React。Vercel にデプロイする想定 |
| DB | Neon（PostgreSQL）＋ Drizzle ORM。ローカルとテストは PGlite |
| 認証 | Cairn でログイン（OIDC、openid-client ＋ jose で ID トークンを検証）。セッションは配車さん自身の署名付き Cookie |
| 山行・部員 | Cairn のリモート MCP（配車係が発行した read の PAT） |
| 地図 | Google Maps Platform（Geocoding / Places / Routes）。サーバーからだけ呼ぶ |
| スタイル | Tailwind CSS |
| テスト | Vitest |
| パッケージ | pnpm |

Cairn との接続（ログイン・MCP・ローカル開発用の Cairn）は [Rack](https://github.com/keishingu/Rack) と同じ仕組みです。

## 開発

### ローカルだけで動かす（Neon・Cairn・Google Maps なし）

DB はファイルに保存する PGlite、Cairn は開発用の MCP サーバー（架空の部員・山行を返す）、地図は内蔵の住所辞書で代わりにできます。どれも本番では使えません。

```bash
pnpm install
cp .env.example .env.local
```

`.env.local` に次を入れます。

```dotenv
DATABASE_URL=pglite:./.pglite
HAISHA_SESSION_SECRET=（32文字以上の適当な文字列）
HAISHA_DEV_LOGIN=1
HAISHA_INITIAL_ADMIN_CAIRN_USER_IDS=00000000-0000-4000-8000-000000000001
CAIRN_MCP_URL=http://localhost:3999/mcp
CAIRN_PAT=dev
CAIRN_PAT_EXPIRES_AT=2027-11-01
HAISHA_APP_URL=http://localhost:3000
```

```bash
pnpm db:dev-migrate   # PGlite にテーブルを作る
pnpm dev:cairn        # 開発用の Cairn MCP（別のターミナルで）
pnpm dev              # /login/dev から部員を選んでログイン
```

`GOOGLE_MAPS_API_KEY` が空のとき、開発環境では内蔵の住所辞書（東京近郊の市区町村・主要駅・開発用の山行の場所）で住所を解決します。辞書にない住所は「特定できませんでした」と表示します。`.env` にキーがあっても、`.env.local` で空にするとそちらが優先されます。

`DEV_CAIRN_FAIL=unauthorized pnpm dev:cairn` で、Cairn の認証が切れたときの画面を確かめられます。PGlite のファイル（`.pglite`）は、開発サーバーが開いている間は他のプロセスから開かないでください。

### 本番相当（Neon・Cairn・Google Maps あり）

`.env.example` の変数をすべて埋めます。

- `CAIRN_OIDC_*`: その段階（ローカル・検証・本番）の Cairn に登録した OIDC クライアント。redirect_uri は `<HAISHA_APP_URL>/auth/callback`
- `CAIRN_MCP_URL` / `CAIRN_PAT`: 同じ段階の Cairn の MCP と、山岳部ワークスペースで発行した read の PAT。OIDC と MCP は同じ段階の Cairn に向ける（段階をまたぐとユーザーIDが一致しない）
- `GOOGLE_MAPS_API_KEY`: Geocoding API / Places API / Routes API を有効にしたサーバー用キー。本番で未設定だと配車・出発地の保存はエラーになる
- `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`（任意）: 住所サジェスト用。Maps JavaScript API と Places API に絞り、HTTP リファラー制限を付ける

```bash
pnpm db:migrate   # Neon にスキーマを適用
pnpm build && pnpm start
```

Vercel では `vercel-build` がビルドの前にマイグレーションを流します（本番と `develop` の Preview だけ）。

### コマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | 開発サーバー |
| `pnpm dev:cairn` | 開発用の Cairn MCP（`http://localhost:3999/mcp`） |
| `pnpm db:generate` | スキーマからマイグレーションを作る |
| `pnpm db:migrate` / `pnpm db:dev-migrate` | Neon / PGlite にマイグレーションを流す |
| `pnpm typecheck` | 型チェック |
| `pnpm test` | Vitest を1回実行 |
| `pnpm build` | プロダクションビルド |

## 出発地の CSV

配車係は `/members` から、出発地を CSV で取り込み・書き出しできます。

```csv
氏名,住所,運転,定員
山田 太郎,東京都中野区,はい,5
川口 花子,東京都三鷹市,いいえ,
```

- 氏名は Cairn の表示名で照合します（空白は無視）。見つからない名前・同名の部員・住所が空の行があれば、何も取り込まずに全部の問題を表示します
- 住所を特定できなかった人だけは取り込まずに知らせ、ほかの人は登録します
- 英語の列名（`name`, `address`, `driver`, `capacity`）にも対応しています

## プライバシー

- 出発地の住所と座標は DB に保存し、本人と配車係の画面にだけ出します
- 配車の計算はサーバーで行い、入力画面にも他の部員の住所は渡しません（「登録済み」「未登録」だけ）
- プランには氏名・集合地点・Google Maps のリンク・集合地点までの公共交通の経路（乗車駅→降車駅）を出します。住所の文字は出しません。同乗者のいない車のルートは目的地だけのリンクにします
- 「出発地（自宅）を集合場所にする」を選んだドライバーの出発地は、同乗者に集合場所の位置（地図）として見えます
- プランを開けるのは、Cairn でログインした部員（ワークスペースの active なメンバー）だけです
- 住所は Google Maps Platform へ送ります（住所の解決・集合地点の検索・移動時間）。サンプルモードでは外部へ送りません
- ブラウザのストレージ（LocalStorage など）には保存しません
- ワークスペースから外れた部員の出発地は自動では消さず、配車係の画面に「Cairn にいない人」として出します

## 構成

```text
app/
  (app)/                # ログイン後の画面（ホーム・出発地・山行・配車・プラン・部員）
  auth/                 # Cairn でログイン（OIDC）の開始・コールバック・ログアウト
  login/                # ログイン画面・開発用ログイン
  sample/               # サンプルモード（ログイン不要）
components/             # 出発地フォーム、住所サジェスト、Cairn のエラー表示
db/                     # Drizzle のスキーマと接続（Neon / PGlite）
drizzle/                # マイグレーション
lib/
  auth/                 # OIDC・セッション・部員の判定（Rack から移植）
  cairn/                # Cairn MCP クライアント（Rack から移植）
  origins/              # 出発地の保存・CSV 取り込み
  plans/                # 配車の入力・組み立て・保存・権限
  planner/              # 入力検証、割り当て、集合地点選択、最適化
  google-maps/          # 地図の機能（サーバーは Google、サンプルは内蔵辞書）とリンク生成
  members/              # 配車係の付け外し
  trips/                # 山行の並び・日程の表示
scripts/                # 開発用 Cairn MCP、マイグレーション
docs/                   # 設計書・要件定義・実装ガイド
```

割り当ては実用的な近似アルゴリズムです。厳密な最適解を保証するものではないため、実際の道路状況、停車可否、各メンバーの事情を確認したうえで利用してください。

要件定義と実装ガイド（Cairn 連携より前の版）は [docs/carpool-meeting-planner-requirements.md](docs/carpool-meeting-planner-requirements.md) と [docs/carpool-meeting-planner-implementation-guide.md](docs/carpool-meeting-planner-implementation-guide.md) にあります。
