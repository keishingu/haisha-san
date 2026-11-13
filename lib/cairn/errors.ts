/**
 * Cairn から取得できなかったときのエラー。
 * 画面ではこのエラーを代替値で埋めず、そのまま表示する。
 */
export type CairnErrorKind =
  /** CAIRN_PAT などの環境変数が無い */
  | "not_configured"
  /** 401 / 403。PAT の期限切れ・取り消し・発行者の退部など */
  | "unauthorized"
  /** 通信できない・Cairn 側のエラー */
  | "unavailable"
  /** 返り値の形が想定と違う */
  | "invalid_response";

export class CairnError extends Error {
  readonly kind: CairnErrorKind;

  constructor(kind: CairnErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CairnError";
    this.kind = kind;
  }

  /** 配車係に PAT の再発行を案内すべきか */
  get needsPatReissue(): boolean {
    return this.kind === "unauthorized" || this.kind === "not_configured";
  }
}

/** 画面に出す文言。部員向けの共通文言に、原因を短く添える */
export function cairnErrorMessage(error: CairnError, subject = "山行"): string {
  const head = `Cairnから${subject}を取得できません`;
  switch (error.kind) {
    case "not_configured":
      return `${head}（Cairn との接続が設定されていません）`;
    case "unauthorized":
      return `${head}（Cairn の認証に失敗しました）`;
    case "unavailable":
      return `${head}（Cairn に接続できません）`;
    case "invalid_response":
      return `${head}（Cairn の応答を読み取れません）`;
  }
}

export const PAT_REISSUE_GUIDE =
  "配車係の方へ: Cairn の個人アクセストークン（PAT）を read スコープで再発行し、Vercel の環境変数 CAIRN_PAT と CAIRN_PAT_EXPIRES_AT を更新してください。";
