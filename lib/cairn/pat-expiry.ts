/** PAT の期限の何日前から配車係に再発行を案内するか */
export const PAT_NOTICE_DAYS = 30;

export type PatExpiryStatus =
  | { kind: "ok"; expiresAt: Date; daysLeft: number }
  | { kind: "expiring"; expiresAt: Date; daysLeft: number }
  | { kind: "expired"; expiresAt: Date }
  /** CAIRN_PAT_EXPIRES_AT が無い・読めない。期限を管理できていないので案内を出す */
  | { kind: "unknown"; reason: string };

export function patExpiryStatus(
  expiresAtRaw: string | undefined,
  now: Date,
): PatExpiryStatus {
  if (!expiresAtRaw) {
    return { kind: "unknown", reason: "環境変数 CAIRN_PAT_EXPIRES_AT が設定されていません" };
  }
  const expiresAt = new Date(expiresAtRaw);
  if (Number.isNaN(expiresAt.getTime())) {
    return {
      kind: "unknown",
      reason: `CAIRN_PAT_EXPIRES_AT（${expiresAtRaw}）を日付として読めません`,
    };
  }
  const msLeft = expiresAt.getTime() - now.getTime();
  if (msLeft <= 0) return { kind: "expired", expiresAt };
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  if (daysLeft <= PAT_NOTICE_DAYS) return { kind: "expiring", expiresAt, daysLeft };
  return { kind: "ok", expiresAt, daysLeft };
}
