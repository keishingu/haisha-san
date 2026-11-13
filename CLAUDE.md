# 配車さん — 開発メモ（AI エージェント向け）

山行の配車プランナー。Cairn の外付けアプリ。概要・画面・開発手順は README.md、設計の判断は docs/cairn-integration-design.md を正とする。ここには README に書かない注意点だけを書く。

## Rack との関係

- Cairn との接続（`lib/auth/*`、`lib/cairn/*`、`db/index.ts`、`scripts/dev-cairn-mcp.mjs` など）は Rack（`Developments-private/Rack`）から移植した。名前（`RACK_*` → `HAISHA_*`、装備係 → 配車係）以外はできるだけ Rack と同じに保ち、Rack 側で直した不具合はこちらにも持ってくる
- ID トークンの署名・iss・aud・nonce の検証（`lib/auth/id-token.ts`）を外さない。アクセストークン・リフレッシュトークンは保存しない
- Cairn の取得に失敗したら、空の一覧や古い値で代替しない。`CairnErrorBox` で「Cairn から〜を取得できません」を出す

## 住所の扱い

- 住所の文字列と座標は `member_origins` にだけ持つ。本人と配車係の画面以外に出さない
- 配車の計算はサーバー（`lib/plans/service.ts` の `createPlan`）で行う。入力画面のクライアントへ他の部員の住所を渡さない（`hasOrigin` だけ）
- プランに保存する前に `sanitizePlanResult` を通す。直行の車のルート URL（自宅の座標が入る）を目的地だけの URL にする
- 自宅集合は `meetingAtHome` で表し、表示名は「◯◯さんの自宅」。住所の文字を集合地点名にしない
- 集合地点までの公共交通の経路（乗車駅→降車駅）はプランに出してよい（2026-11-13 決定。ログインした部員だけが見るため）

## 地図

- Google Maps Platform はサーバーからだけ呼ぶ（`lib/google-maps/server.ts`）。ブラウザから叩ける Google のプロキシ（旧 `/api/*`）は作らない（認証なしで API の枠を使われるため）
- 計算は `MapsGateway`（`lib/google-maps/gateway.ts`）を受け取る。サーバーは `createServerGateway()`、サンプルモードは `sampleGateway`
- 本番で `GOOGLE_MAPS_API_KEY` が無ければエラーにする。内蔵の住所辞書へ代替するのは開発環境とサンプルモードだけ
- 移動時間・公共交通の経路が取れなかったときは概算で続けるが、`warnings` に入れてプランに表示する（黙って代替しない）

## サンプルモード

- `/sample` はログイン不要で、本番でも開ける。内蔵の住所辞書・直線距離の概算だけを使い、DB・Google（住所サジェストを含む）へは何も送らない
- 入力と結果は `app/sample/PlanProvider.tsx`（React のメモリ）だけに持つ

## 実装の約束ごと

- 画面・Server Action・Route Handler で部員が要るときは `getCurrentMember()` を通す。配車係だけの画面は役割を見てメッセージを出す（例外で落とさない）
- 利用者に見せてよいエラーは `DomainError`（`lib/errors.ts`）で投げ、Server Action で文言を返して画面に出す
- サービス層の関数は DB を引数で受け取る（本番は Neon、テストは PGlite の `createTestDb()`）
- DB や jose を使うテストは先頭に `// @vitest-environment node` を付ける（既定は jsdom。jsdom では jose の鍵の型判定が通らない）
- `<head>` の中で `{value && ...}` に空文字が入ると空のテキストノードになり、ハイドレーションが壊れる。真偽値にしてから使う
