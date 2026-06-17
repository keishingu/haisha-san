# 配車さん 実装ガイド

## 1. 実装方針

「配車さん」は、車なしメンバーが公共交通機関または徒歩で中間集合地点へ向かい、車ありメンバーが集合地点で同乗者を乗せて目的地へ向かう前提で実装する。

MVPでは厳密な数理最適化よりも、説明しやすく、幹事が納得して手動調整できる結果を優先する。

## 2. 推奨構成

### 2.1 フロントエンド

- Vite + React + TypeScript
- 状態管理はReact stateまたはZustand
- CSSは通常のCSS Modules、Tailwind、または既存の好みでよい
- 住所・氏名・目的地はLocalStorageへ保存しない
- 計算中の入力データはブラウザ内で完結する
- 共有URL発行時もDBやサーバー保存は使わない
- 共有表示に必要な最小限の結果データをURLフラグメントへ圧縮して埋め込む

### 2.2 DB不要の共有URL

MVPの共有URLは、`/s#<encoded-payload>` のようにURLフラグメントへ共有用データを入れる。

特徴:

- DB、ストレージ、共有用APIが不要
- `#` 以降は通常HTTPリクエストとしてサーバーへ送信されない
- 共有URLだけで別端末でも閲覧できる
- URLを知っている人は閲覧できる
- URLが長くなりすぎると一部アプリで共有しにくい

実装方針:

- `SharePlanPayload`をJSON化する
- JSONを圧縮する
- base64urlエンコードする
- `/s#${encodedPayload}` を共有URLとして生成する
- 共有ページは `location.hash` から復元する

### 2.3 外部API

Google Maps Platformを使う。

- Geocoding APIまたはPlaces Autocomplete
  - 入力住所や地点名を緯度経度へ変換する
- Places API
  - 集合地点候補を探す
  - 初期候補は駅、駐車場、コンビニ
- Routes APIまたはDistance Matrix API
  - 車移動時間を取得する
  - 可能なら公共交通機関の所要時間も取得する
- Maps JavaScript API
  - 地図表示
  - 集合地点とルートの可視化

## 3. プライバシー設計

### 3.1 保存しない情報

以下はLocalStorage、SessionStorage、IndexedDB、URLクエリへ保存しない。

- 住所
- 緯度経度
- Google Maps APIから得た住所解決結果

以下は共有URL発行時を含め、サーバーへ保存しない。

- メンバー名
- 目的地名または目的地の表示ラベル
- 車ごとの割り当て結果

### 3.2 保存してよい情報

通常利用中は、個人情報を含まないUI設定のみ保存を許可する。

- 最後に選んだ最適化モード
- 集合地点候補種別
- テーマや表示設定

ただしMVPでは入力復元用の保存機能を入れなくてもよい。

共有URL発行時は、ユーザーが確認して同意した場合のみ、以下をURLフラグメントへ含めてよい。

- 目的地名または目的地の表示ラベル
- 車ごとのドライバー名
- 車ごとの同乗者名
- 車ごとの集合地点名
- 集合地点のGoogle Mapsリンク
- 集合地点から目的地へのGoogle Mapsリンク
- 幹事が入力したメモ
- 共有データの作成日時

共有URL発行時でも、以下はURLへ含めない。

- メンバーの出発地住所
- メンバーの自宅緯度経度
- 住所解決結果の詳細
- 公共交通の詳細経路

### 3.3 実装上の注意

- `localStorage.setItem`を使う場合は保存対象を明示的に限定する
- フォーム入力をURLに反映しない
- 共有URL発行前に、URLに含まれる内容と含まれない内容を確認モーダルで表示する
- 共有ページは閲覧専用にする
- 共有URLはフラグメント内に共有データを含むため、短縮URLサービスへ通す場合は短縮URLサービス側にデータが渡る点を注意表示する
- 共有URLは削除できない。削除や有効期限が必要な場合は保存型共有URLへ拡張する
- エラー送信やアクセス解析を導入する場合、住所・氏名を送信しない

## 4. 主要データモデル

```ts
type MemberId = string;
type VehicleId = string;

type LatLng = {
  lat: number;
  lng: number;
};

type Member = {
  id: MemberId;
  name: string;
  addressInput: string;
  location?: LatLng;
  isDriver: boolean;
  vehicleCapacity?: number; // ドライバー本人を含む総定員
};

type Destination = {
  addressInput: string;
  location?: LatLng;
};

type MeetingCandidate = {
  id: string;
  name: string;
  address: string;
  location: LatLng;
  placeType: "station" | "parking" | "convenience_store" | "custom";
};

type VehiclePlan = {
  vehicleId: VehicleId;
  driverId: MemberId;
  passengerIds: MemberId[];
  meetingPoint: MeetingCandidate;
  driveDurationMinutes: number;
  driverDetourMinutes: number;
  passengerAccess: PassengerAccess[];
  googleMapsUrl: string;
};

type PassengerAccess = {
  memberId: MemberId;
  mode: "transit" | "walking" | "unknown";
  durationMinutes?: number;
};

type PlanResult = {
  vehiclePlans: VehiclePlan[];
  transitOnlyPlans: TransitOnlyPlan[];
  warnings: string[];
};

type TransitOnlyPlan = {
  memberId: MemberId;
  destinationMapsUrl: string;
  durationMinutes?: number;
  reason: "seat_shortage" | "no_vehicle" | "manual";
};

type SharePlanPayload = {
  title: string;
  destinationLabel: string;
  vehiclePlans: SharedVehiclePlan[];
  transitOnlyPlans: SharedTransitOnlyPlan[];
  notes?: string;
  createdAt?: string;
};

type SharedVehiclePlan = {
  driverName: string;
  passengerNames: string[];
  meetingPointName: string;
  meetingPointMapsUrl: string;
  destinationMapsUrl: string;
  driveDurationText?: string;
};

type SharedTransitOnlyPlan = {
  memberName: string;
  destinationMapsUrl: string;
  durationText?: string;
  reasonText: string;
};

type CreatedSharePlan = {
  shareUrl: string;
  byteLength: number;
  warning?: string;
};
```

## 5. 画面構成

### 5.1 入力画面

コンポーネント案:

- `DestinationInput`
- `MemberList`
- `MemberRow`
- `OptimizationSettings`
- `PrivacyNotice`
- `CalculateButton`

入力画面では、住所が保存されないことを短く表示する。

表示例:

```text
入力内容はこのブラウザ画面内でのみ使用され、保存されません。
住所は候補検索と移動時間計算のためGoogle Maps Platformへ送信されます。
```

### 5.2 結果画面

コンポーネント案:

- `PlanSummary`
- `VehiclePlanCard`
- `MeetingPointMap`
- `ManualAssignmentEditor`
- `ShareTextPanel`
- `ShareUrlDialog`
- `WarningList`

車ごとに「誰がどこに集合し、そこからどの車で目的地へ向かうか」を表示する。

## 6. 計算フロー

### 6.1 全体フロー

```text
入力バリデーション
  ↓
住所/目的地のジオコーディング
  ↓
総定員チェック
  ↓
ドライバー候補と車なしメンバーに分割
  ↓
集合地点候補を生成
  ↓
候補ごとのスコア計算
  ↓
車ごとの割り当てを作成
  ↓
未乗車メンバーを公共交通組へ割り当て
  ↓
Google Mapsリンク生成
  ↓
結果表示
```

### 6.2 入力バリデーション

必須チェック:

- 目的地が入力されている
- メンバーが2人以上いる
- 各メンバーに名前と住所がある
- 車ありメンバーの定員が1以上である

警告として扱うチェック:

- 車ありメンバーがいない
- 全車の定員合計が全メンバー数未満である

注意:

- 定員はドライバー本人を含む
- 車なしメンバー数だけでなく、全員数で総定員を判定する
- 総定員不足や車なしの場合でも計算は止めず、乗車できないメンバーを公共交通組にする

## 7. 集合地点候補の作り方

### 7.1 候補中心点

車なしメンバー全員、または割り当て候補グループの重心を求める。

```ts
function averageLocation(locations: LatLng[]): LatLng {
  return {
    lat: locations.reduce((sum, p) => sum + p.lat, 0) / locations.length,
    lng: locations.reduce((sum, p) => sum + p.lng, 0) / locations.length,
  };
}
```

### 7.2 Places検索

中心点の周辺で集合候補を検索する。

初期検索半径:

- 都市部: 1kmから3km
- 郊外: 3kmから8km

候補種別:

- 駅: `train_station`, `transit_station`
- 駐車場: `parking`
- コンビニ: keyword検索
- 任意キーワード: ユーザー入力

### 7.3 候補数

MVPでは候補を取りすぎない。

- グループごとに最大10候補
- API料金とレスポンス速度を優先する

## 8. スコアリング

### 8.1 評価指標

各「ドライバー、同乗候補、集合地点」の組み合わせに対してスコアを計算する。

低いスコアほどよい。

```text
score =
  driverDetourMinutes * 3
  + averagePassengerAccessMinutes * 2
  + maxPassengerAccessMinutes * 1
  + destinationBacktrackPenalty * 2
  + capacityPenalty
```

### 8.2 指標の意味

- `driverDetourMinutes`
  - ドライバーが自宅から目的地へ直行した場合と比べた追加時間
- `averagePassengerAccessMinutes`
  - 車なしメンバーが集合地点へ向かう平均時間
- `maxPassengerAccessMinutes`
  - 一番つらい車なしメンバーの集合地点までの時間
- `destinationBacktrackPenalty`
  - 目的地と逆方向へ戻るような集合地点への罰則
- `capacityPenalty`
  - 定員超過は実質選択不可にする

### 8.3 初期値

MVPの初期値:

- ドライバー遠回りは重め
- 公共交通アクセスも重視
- 車両台数削減は任意モードで加点/減点する

## 9. 割り当てアルゴリズム

### 9.1 MVPの近似手順

1. ドライバーごとの空席数を計算する
2. 車なしメンバーを目的地またはドライバーとの地理的近さでクラスタリングする
3. 各クラスタについて集合地点候補を作る
4. ドライバーとクラスタの組み合わせスコアを計算する
5. スコアが低い順に割り当てる
6. 定員に収まらないクラスタは分割する
7. 未割り当てが残る場合は、1人単位で再割り当てする
8. それでも席が足りないメンバーは公共交通組へ入れる
9. 車ありメンバーがいない場合は、全員を公共交通組へ入れる

### 9.2 実装しやすい初期版

最初はクラスタリングを単純化してよい。

1. 車なしメンバーを1人ずつ扱う
2. 各メンバーについて最もスコアが低いドライバーに仮割り当てする
3. ドライバーごとのメンバー群が決まった後、集合地点を再計算する
4. 集合地点込みのスコアが悪い場合のみ入れ替えを試す
5. 空席がなく割り当てできないメンバーは公共交通組にする

この方法は最適ではないが、少人数のMVPでは十分に使える。

### 9.3 席不足時の優先順位

席が足りない場合は、車に乗る優先度を以下で決める。

1. 目的地まで公共交通で行きづらい人
2. 集合地点まで公共交通で行きづらい人
3. ドライバーの遠回りが少ない人
4. 幹事が手動で優先指定した人

MVPでは1から3をスコアで扱い、最終判断は手動調整で上書きできるようにする。

## 10. Google Mapsリンク生成

### 10.1 車ルートリンク

集合地点から目的地へ向かうリンクを生成する。

```ts
function buildGoogleMapsDirectionsUrl(origin: LatLng, destination: LatLng): string {
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "driving",
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
```

### 10.2 メンバー向け集合リンク

各車なしメンバーには、自宅から集合地点までのリンクを生成する。

```ts
function buildTransitToMeetingUrl(origin: LatLng, meetingPoint: LatLng): string {
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${meetingPoint.lat},${meetingPoint.lng}`,
    travelmode: "transit",
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
```

## 11. 手動調整

### 11.1 必須操作

- メンバーを別の車へ移動する
- 集合地点候補を別候補へ変更する
- 再計算する

### 11.2 バリデーション

- 移動後に定員超過した場合は保存しない、または警告して未確定状態にする
- 集合地点を変更した場合は、その車のルート時間だけ再取得する

## 12. 共有テキスト生成

共有テキストと共有URLには個人住所を含めない。

含める情報:

- 目的地名
- 車ごとのメンバー名
- 集合地点名
- 集合地点のGoogle Mapsリンク
- 集合地点から目的地へのGoogle Mapsリンク
- 注意事項

含めない情報:

- 各メンバーの住所
- 緯度経度
- APIレスポンスの詳細

## 13. 共有URL生成

### 13.1 共有前確認

共有URL発行ボタンを押したら、URLに含める内容の確認モーダルを表示する。

表示する内容:

- 共有URLに含まれる情報
  - 目的地の表示名
  - ドライバー名
  - 同乗者名
  - 集合地点名
  - Google Mapsリンク
  - メモ
- 共有URLに含まれない情報
  - 出発地住所
  - 自宅緯度経度
  - 住所検索の詳細結果
  - 公共交通の詳細経路

ユーザーが同意した場合のみ、共有URLを生成する。

### 13.2 URLペイロード

```ts
type CreateSharePlanResponse = {
  shareUrl: string;
  byteLength: number;
  warning?: string;
};
```

### 13.3 エンコード手順

実装候補:

- JSON.stringify
- Compression Streams API、または `lz-string`
- base64url

```ts
function buildShareUrl(payload: SharePlanPayload): CreatedSharePlan {
  const json = JSON.stringify(payload);
  const compressed = compressToEncodedURIComponent(json);
  const shareUrl = `${location.origin}/s#${compressed}`;

  return {
    shareUrl,
    byteLength: new Blob([shareUrl]).size,
    warning:
      shareUrl.length > 1800
        ? "共有URLが長いため、一部のアプリでは送信できない可能性があります。"
        : undefined,
  };
}
```

`compressToEncodedURIComponent`は `lz-string` を使う場合の例。依存を増やしたくない場合は、圧縮なしのbase64urlから始めてもよい。

### 13.4 共有ページ

共有ページは `/s#<encoded-payload>` のようなURLにする。

ページ表示時に `location.hash` から共有データを復元する。

```ts
function parseSharePayload(): SharePlanPayload | null {
  const encoded = location.hash.replace(/^#/, "");
  if (!encoded) return null;

  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    return JSON.parse(json) as SharePlanPayload;
  } catch {
    return null;
  }
}
```

表示する内容:

- 目的地
- 車ごとのドライバー
- 車ごとの同乗者
- 集合地点
- 集合地点をGoogle Mapsで開くリンク
- 集合地点から目的地へ向かうGoogle Mapsリンク
- 幹事メモ

表示しない内容:

- 入力された住所
- 自宅位置
- 再計算ボタン
- 編集UI

### 13.5 URL長の扱い

URLフラグメント方式はDB不要だが、URLが長くなる。

MVPでは以下の制限を設ける。

- 共有対象は結果データだけにする
- 住所、緯度経度、公共交通詳細は含めない
- URL長が1800文字を超えたら警告する
- URL長が3000文字を超えたら、共有テキストコピーを推奨する

保存型共有URLが必要になるのは、参加人数が多い、メモが長い、URL短縮や有効期限が必要になった場合に限る。

## 14. エラーハンドリング

### 14.1 住所解決失敗

対象メンバー名を表示し、住所の修正を促す。

```text
鈴木さんの住所を特定できませんでした。市区町村や番地を追加してください。
```

### 14.2 総定員不足

```text
全員を乗せるにはあと2席足りません。
乗車できないメンバーは、目的地まで公共交通機関で向かう案として表示します。
```

計算は止めない。

### 14.3 APIエラー

```text
Google Mapsから移動時間を取得できませんでした。時間をおいて再試行してください。
```

概算結果を出す場合は、必ず「概算」であることを表示する。

## 15. テスト観点

### 15.1 単体テスト

- 総定員チェック
- ドライバー/車なしメンバー分割
- 席不足時の公共交通組生成
- Google Mapsリンク生成
- スコア計算
- 定員超過時の割り当て拒否
- 共有テキストに住所が含まれないこと
- 共有URL用ペイロードに住所と緯度経度が含まれないこと

### 15.2 結合テスト

- サンプルデータから結果が生成される
- 車が1台だけでも動く
- 車なしメンバーが0人でも動く
- 総定員不足でも計算を続行し、公共交通組を表示する
- 車ありメンバーが0人でも全員を公共交通組として表示する
- 住所解決失敗時に該当入力へ戻れる
- 共有URLを発行して閲覧専用ページを表示できる
- 共有ページに誰がどこに集まり、誰の車で向かうかが表示される
- 共有ページに公共交通組が表示される

### 15.3 プライバシーテスト

- LocalStorageに住所・氏名・目的地が保存されない
- SessionStorageに住所・氏名・目的地が保存されない
- URLに住所・氏名・目的地が含まれない
- 共有テキストに住所が含まれない
- 共有URLフラグメントに出発地住所と自宅緯度経度が含まれない
- 共有URLフラグメントから共有ページを復元できる

## 16. 実装順序

### Step 1: 静的UI

- メンバー入力
- 目的地入力
- 車あり/なし
- 定員
- 結果カード
- 共有テキスト欄
- 共有URL確認モーダル
- 共有閲覧ページ

### Step 2: ダミーデータ計算

- 緯度経度入りのサンプルデータを用意
- APIなしで割り当てロジックを動かす
- Google Mapsリンク生成を確認

### Step 3: Google Maps接続

- Places AutocompleteまたはGeocodingを接続
- Distance MatrixまたはRoutes APIを接続
- Places APIで集合候補を取得

### Step 4: 結果調整

- 手動で別車両へ移動
- 集合地点候補の切り替え
- 再計算

### Step 5: 仕上げ

- 共有テキストの整形
- 共有閲覧ページ
- 共有URLエンコード/デコード
- スマホ表示の調整
- プライバシーテスト
- APIエラー表示

## 17. MVPで割り切ること

- 最適解でなくてもよい
- 公共交通の完全な乗換案内はGoogle Mapsリンクへ任せる
- 到着時刻の厳密調整はしない
- 入力復元はしない
- 料金精算はしない
- 共有ページは閲覧専用にする

## 18. 将来拡張

- OR-Toolsによる厳密な制約付き最適化
- 到着時刻指定
- 高速道路利用の有無
- 公共交通の終電・始発考慮
- 徒歩距離上限
- 荷物量やチャイルドシートなどの制約
- パスワード付き共有URL
- 共有URLの編集権限
- 幹事以外のメンバーによる回答フォーム
