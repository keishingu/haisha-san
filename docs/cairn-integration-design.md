# Cairn 連携（外付けアプリ化）設計

作成日: 2026-11-13
ステータス: 第1版を実装済み（2026-11-13、ブランチ claude/cairn-integration）。残る論点は §9

配車さんを、Rack と同じ「Cairn の外付けアプリ」にする。Cairn でログインした部員だけが使い、山行（Cairn のプロジェクト）を選ぶと参加メンバーと保存済みの住所・車の情報が入った状態から配車を組める。

## 1. 決まっていること（2026-11-13）

| 論点 | 決定 |
|---|---|
| 汎用モード | 残さない。実データを扱う画面は **Cairn 専用**（ログイン必須） |
| サンプルモード | **残す**。ログインなしで、内蔵のサンプルデータと住所辞書だけで配車を試せる（Google Maps API も DB も使わない。保存・共有はしない）。Cairn が止まっているときの動作確認にも使う |
| 住所の保存 | 部員ごとに配車さんの DB に保存する |
| 運転・定員 | 部員ごとに**既定値**を保存し、**山行ごとに上書き**できる（「今回は車を出せない」など） |
| 住所の登録・変更 | **本人と係**。係は CSV で一括取り込みもできる |
| 共有 | プランを DB に保存し、**ログインした部員だけが開ける URL** で共有する。URL のハッシュに中身を入れる今の方式（`/s`）はやめる |
| 目的地 | 山行の「場所」（Cairn の `projects.location` と Google の `placeId`。MCP の `list_projects` / `get_project` で取れる）を初期値にする。場所が無い山行は入力。同じ山行で前に作ったプランがあればその目的地を優先する |
| 参加者 | 山行のメンバー（`get_project_members`）全員を初期値にし、行かない人はチェックを外す |
| 公共交通の経路 | ログインした部員だけが見るので、各メンバーの**出発地から集合地点までの公共交通の経路（乗車駅→降車駅）をプランに表示する**（今の共有 URL では伏せている） |
| パッケージ | Rack に合わせて **pnpm** に移す |
| 退部した部員 | 自動では消さない。係の部員一覧に「Cairn にいない」と出し、係が消す |

## 2. Rack と同じにするところ

Rack（`Developments-private/Rack`）の仕組みをそのまま使う。実装もできるだけ Rack から持ってくる。

- **ログイン**: 「Cairn でログイン」（Cairn の OIDC、issuer は `<Cairn>/oidc`）。openid-client でコード交換し、ID トークンの署名・iss・aud・nonce は jose で検証する（Rack の `src/lib/auth/id-token.ts`）。セッションは配車さん自身の署名付き Cookie。アクセストークン・リフレッシュトークンは保存しない
- **部員の照合**: `sub` = Cairn のユーザーID = MCP の `list_members` の `userId`
- **山行・部員の読み取り**: Cairn のリモート MCP を、係が発行した read の PAT で読む（`list_projects` / `get_project_members` / `list_members`）。1リクエスト1接続、成功結果だけ60秒メモリに持つ（Rack の `src/lib/cairn/client.ts`）
- **Cairn が読めないとき**: 空の一覧や古い値で代わりにしない。「Cairn から山行を取得できません」と表示する
- **DB**: Neon（PostgreSQL）＋ Drizzle。ローカルとテストは PGlite
- **ローカル開発**: PGlite と開発用の Cairn MCP（架空の部員・山行を返す。Rack の `scripts/dev-cairn-mcp.mjs`）と `/login/dev`
- **環境**: ローカル・検証・本番で、同じ段階の Cairn に向ける（Rack の `docs/environments.md` と同じ表を作る）。ドメインは `haisha.oss-cairn.com` などを想定
- **係**: 配車さんの DB の `members.role = 'kakari'`。最初の係は環境変数（Rack の `RACK_INITIAL_ADMIN_CAIRN_USER_IDS` と同じ形）で指定する

## 3. 画面

| 画面 | パス | 内容 |
|---|---|---|
| ログイン | `/login` | Cairn でログイン。開発用は `/login/dev`。「サンプルで試す」から `/sample` へ |
| サンプル | `/sample` | ログイン不要。内蔵のサンプルデータで配車を試す（保存・共有なし） |
| ホーム | `/` | 自分が入っている山行（開始日が近い順）と、自分のプラン。住所が未登録なら登録を促す |
| 自分の出発地 | `/me` | 住所・運転できるか・定員（既定値） |
| 配車をつくる | `/trips/[projectId]/plan` | 山行の参加メンバーと場所が入った状態の入力画面（今の `app/page.tsx` を土台にする）。目的地、参加者のチェック、山行ごとの上書き、同乗グループ、指定集合場所、Cairn にいない参加者の追加 |
| プラン | `/plans/[id]` | 保存したプランの結果（今の `app/result/page.tsx` ＋ `/s` の表示）。各メンバーの集合地点までの公共交通の経路も出す。この URL を山行のチャンネルに貼る |
| 部員の住所（係） | `/members` | 全部員の住所・車の情報の一覧と代理入力、CSV 取り込み・書き出し、係の付け外し |

## 4. データモデル（案）

```ts
members {                 // ログインしたことがある部員、または係が登録した部員
  id
  cairnUserId   text unique      // ID トークンの sub
  displayName   text             // Cairn の表示名の写し（表示用。正は Cairn）
  email         text null
  role          'member' | 'kakari'
  createdAt, updatedAt
}

member_origins {          // 部員ごとの出発地と車の既定値（1部員1行）
  memberId      → members unique
  addressInput  text
  lat, lng      double null      // 住所解決の結果を持ち、毎回の Geocoding を減らす
  geocodedAt    timestamptz null // addressInput を変えたら null に戻して解き直す
  canDrive      boolean
  vehicleCapacity integer null   // ドライバー本人を含む定員
  updatedBy     → members        // 本人か係か
  updatedAt
}

plans {                   // 保存した配車プラン
  id            uuid             // URL に出る。推測されにくい値
  cairnProjectId text            // 山行
  title         text
  destinationInput text, destinationLat, destinationLng
  input         jsonb            // 計算に使った入力（上書き・追加参加者・同乗グループ・指定集合場所・方針）
  result        jsonb            // PlanResult
  notes         text null        // 幹事メモ
  createdBy     → members
  createdAt, updatedAt
}
```

- 山行ごとの上書き（今回は運転しない、定員を変える、住所を変える）は `plans.input` に入れ、`member_origins` は書き換えない
- Cairn にいない参加者（OB・ゲストなど）は `plans.input` にだけ入れ、`members` には作らない
- 同じ山行に何度でもプランを作れる（最新を山行の画面で目立たせる）

## 5. 権限

| 操作 | 誰が |
|---|---|
| 自分の出発地の登録・変更 | 本人 |
| 他の部員の出発地の閲覧・変更、CSV の取り込み・書き出し | 係 |
| 山行のプランを作る | その山行のメンバー（`get_project_members`）と係 |
| プランを開く | ログインした部員（Cairn のワークスペースのメンバー） |
| プランの変更・削除 | 作った人、その山行のリーダー、係 |

- 部員かどうかは Cairn の `list_members` で判定する（ワークスペースを離れた人はログインできても入れない）
- 判定は画面・Server Action・Route Handler で `getCurrentMember()` / `requireKakari()` を通す（Rack と同じ）

## 6. 住所の扱い

- 住所そのもの（番地まで入った文字列と緯度経度）は、**本人と係以外の画面には出さない**。配車の計算はサーバーで行う
- プランには、氏名・集合地点・Google Maps のリンクに加えて、各メンバーの**集合地点までの公共交通の経路**（乗車駅→降車駅、所要時間）を出す。最寄り駅は分かるが、見るのはログインした部員だけなので許容する（2026-11-13 決定）
- ただし「自宅を集合場所にする」を選んだドライバーの自宅は、同乗者に集合場所として見える（今と同じ）。入力画面でその旨を示す
- 入力画面（`/trips/[projectId]/plan`）でも、他の部員の住所そのものは出さず「登録済み」「未登録」だけを出す。未登録の部員はその場で住所を入れられるが、それは `plans.input` にだけ入り、本人の既定値にはならない
- ブラウザの LocalStorage などには今までどおり保存しない
- 退部（ワークスペースから外れた）部員の出発地は、係が `/members` から消せる。自動では消さない（§9）

## 7. 今のコードからの変更

| 今 | これから |
|---|---|
| ログインなし | `/sample` 以外はログイン必須。`/sample` は今の入力→結果の流れ（`PlanProvider`、内蔵辞書、直線距離の概算）をそのまま使い、本番でも開ける |
| `PlanProvider`（ブラウザのメモリ）で入力→結果を受け渡し | プランを DB に保存し `/plans/[id]` で表示。リロードしても消えない |
| `/s#...`（lz-string で圧縮した共有 URL） | 廃止。`lib/share-url` は共有テキスト（`shareText.ts`）だけ残す |
| 共有 URL では公共交通の詳細経路（`transitRoute`）を伏せる | プランの画面に出す |
| 目的地を毎回入力 | 山行の場所（`placeId` があれば Places で座標を取る）を初期値にする |
| 入力画面で名前・住所を手入力、CSV 読み込み | 山行の参加メンバーと保存済みの住所が入る。CSV は係の `/members` へ移す |
| 計算はクライアントから Route Handler を呼んで組み立て | 住所をクライアントに渡さないため、計算（`lib/planner/buildPlan.ts`）はサーバーで行う |
| npm | pnpm |

`lib/planner`（割り当て・集合地点・最適化）と `lib/google-maps` はそのまま使う。

## 8. Cairn 側で必要な作業

- 各段階（ローカル・検証・本番）の Cairn に OIDC クライアントを登録する（機密クライアント、redirect_uri は `<配車さん>/auth/callback`）。Cairn の運営者がスクリプトで行う
- 山岳部ワークスペースで、係が read スコープの PAT を発行する
- Cairn 本体のコード変更は要らない見込み（Rack と同じ口を使うため）

## 9. 未決事項

1. **山行の場所と車の目的地のずれ**: 山行の場所は山頂（例「穂高岳」）のことが多く、車で向かう先（登山口の駐車場）とは違う。上高地のようにマイカーで入れない所もある。今は山行の場所を初期値にして入力で直す前提。将来、山行ごとに「車の目的地」を覚えるかは使ってみて決める
2. **チャンネルへの投稿**: 今回は URL を手で貼る。MCP の `post_message` は人の代理での投稿なので、自動投稿は Cairn の外部アプリ公開（Bot トークン）を待つ
3. **リポジトリの運用**: このリポジトリをそのまま作り替えるか。Rack と同じく `develop` → `main` の運用にするか
