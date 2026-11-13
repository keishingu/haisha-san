/**
 * 認証まわりの環境変数の読み取り。純粋関数にして、テストと起動時チェックの両方から使う。
 * next.config.ts からも import するので、Next.js やサーバー専用モジュールに依存しない。
 */

export type Env = Readonly<Record<string, string | undefined>>;

/** 本番か。NODE_ENV=production（next build / next start）または Vercel の Production 環境 */
export function isProduction(env: Env): boolean {
  return env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
}

function devLoginRequested(env: Env): boolean {
  return env.HAISHA_DEV_LOGIN === "1";
}

export const DEV_LOGIN_IN_PRODUCTION_MESSAGE =
  "HAISHA_DEV_LOGIN=1 は本番では使えません。開発用ログインで本番に入れる状態を防ぐため、起動を止めます。環境変数 HAISHA_DEV_LOGIN を外してください。";

/** 本番で開発用ログインが有効になっていたら投げる。起動時（instrumentation / next.config）に呼ぶ */
export function assertDevLoginNotInProduction(env: Env): void {
  if (devLoginRequested(env) && isProduction(env)) {
    throw new Error(DEV_LOGIN_IN_PRODUCTION_MESSAGE);
  }
}

/** 開発用ログインを使えるか。本番で有効になっていれば（起動時チェックをすり抜けても）ここでも投げる */
export function isDevLoginEnabled(env: Env): boolean {
  assertDevLoginNotInProduction(env);
  return devLoginRequested(env);
}

export type OidcSettings =
  | {
      ok: true;
      issuer: string;
      clientId: string;
      clientSecret: string;
      /** 配車さんの公開 URL の origin（HAISHA_APP_URL） */
      appOrigin: string;
      /** Cairn に登録したコールバック URL。HAISHA_APP_URL から作る */
      redirectUri: string;
    }
  | { ok: false; missing: string[] };

const OIDC_KEYS = ["CAIRN_OIDC_ISSUER", "CAIRN_OIDC_CLIENT_ID", "CAIRN_OIDC_CLIENT_SECRET", "HAISHA_APP_URL"] as const;

export const CALLBACK_PATH = "/auth/callback";

/** HAISHA_APP_URL を origin にする。http(s) の URL でなければ null */
function parseAppOrigin(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url.origin;
}

/**
 * Cairn でログイン（OIDC）の設定。足りなければ不足している変数名を返す（開発用ログインに代替しない）。
 * Cairn は redirect_uri を登録と完全一致で比べるので、コールバック URL はリクエストの Host ではなく
 * HAISHA_APP_URL から作る（Vercel の Preview や別名ドメインから入っても、登録した URL に揃える）
 */
export function readOidcSettings(env: Env): OidcSettings {
  const missing: string[] = OIDC_KEYS.filter((k) => !env[k]);
  const appOrigin = env.HAISHA_APP_URL ? parseAppOrigin(env.HAISHA_APP_URL) : null;
  if (env.HAISHA_APP_URL && !appOrigin) missing.push("HAISHA_APP_URL（http(s) の URL にしてください）");
  if (missing.length > 0 || !appOrigin) return { ok: false, missing };
  return {
    ok: true,
    // 末尾のスラッシュは iss の比較で不一致になるので落とす
    issuer: env.CAIRN_OIDC_ISSUER!.replace(/\/+$/, ""),
    clientId: env.CAIRN_OIDC_CLIENT_ID!,
    clientSecret: env.CAIRN_OIDC_CLIENT_SECRET!,
    appOrigin,
    redirectUri: `${appOrigin}${CALLBACK_PATH}`,
  };
}

export const INITIAL_ADMIN_ENV_KEY = "HAISHA_INITIAL_ADMIN_CAIRN_USER_IDS";

// Cairn のユーザーID（list_members の userId）は UUID。バージョン桁までは見ない（開発用の 0000…0001 も通す）
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type InitialAdminSettings =
  | { ok: true; ids: ReadonlySet<string> }
  /** UUID ではない項目（メールアドレスを入れた間違いなど）。有効な項目は ids に残す */
  | { ok: false; invalid: string[]; ids: ReadonlySet<string> };

/**
 * 最初の配車係の Cairn ユーザーID（カンマ区切り）。UUID でない項目があれば invalid に入れて返す。
 * 未設定・空は有効（空の集合）。間違った値を黙って無視しない（誰も一致せず、理由が分からなくなるため）
 */
export function readInitialAdminIds(env: Env): InitialAdminSettings {
  const entries = (env[INITIAL_ADMIN_ENV_KEY] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ids = new Set(entries.filter((e) => UUID_PATTERN.test(e)));
  const invalid = entries.filter((e) => !UUID_PATTERN.test(e));
  return invalid.length > 0 ? { ok: false, invalid, ids } : { ok: true, ids };
}

const MIN_SECRET_LENGTH = 32;

/** セッション Cookie の署名鍵。無い・短いときは投げる（既定値で代替しない） */
export function readSessionSecret(env: Env): Uint8Array {
  const secret = env.HAISHA_SESSION_SECRET;
  if (!secret) {
    throw new Error("環境変数 HAISHA_SESSION_SECRET が設定されていません");
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`HAISHA_SESSION_SECRET は ${MIN_SECRET_LENGTH} 文字以上にしてください`);
  }
  return new TextEncoder().encode(secret);
}
