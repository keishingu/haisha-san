import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { members } from "@/db/schema";
import { listAllWorkspaceMembers } from "@/lib/cairn/client";
import { CairnError } from "@/lib/cairn/errors";
import { INITIAL_ADMIN_ENV_KEY, readInitialAdminIds } from "./env";
import type { LoginErrorCode } from "./login-errors";
import { countActiveKakari, findActiveWorkspaceMember, roleOnLogin } from "./membership";
import { setSession } from "./session";

export type LoginResult = { ok: true } | { ok: false; error: LoginErrorCode; cause?: unknown };

/**
 * Cairn の ID（OIDC の sub、または開発用ログインで選んだ部員）でログインを完了する。
 * ログインのたびに CAIRN_PAT で list_members を呼び、ワークスペースの active なメンバーかを確かめる。
 * 確かめられないときは入れない。
 */
export async function completeLogin(input: {
  sub: string;
  email: string | null;
  via: "oidc" | "dev";
}): Promise<LoginResult> {
  let workspaceMembers;
  try {
    workspaceMembers = await listAllWorkspaceMembers();
  } catch (cause) {
    if (cause instanceof CairnError) {
      console.error("[login] Cairn で部員を確かめられません", cause);
      return { ok: false, error: "cairn_unavailable", cause };
    }
    throw cause;
  }
  if (!findActiveWorkspaceMember(workspaceMembers, input.sub)) {
    return { ok: false, error: "not_member" };
  }

  const db = await getDb();
  const [existing] = await db
    .select({ role: members.role, email: members.email })
    .from(members)
    .where(eq(members.cairnUserId, input.sub));
  const kakariRows = await db
    .select({ cairnUserId: members.cairnUserId })
    .from(members)
    .where(eq(members.role, "kakari"));
  const kakariCount = countActiveKakari(
    kakariRows.map((r) => r.cairnUserId),
    workspaceMembers,
  );

  // 設定が間違っていても、有効な項目は使い、既存の部員はそのまま入れる（設定の打ち間違いで全員を締め出さない）。
  // ただし配車係が1人もいないときは、設定の間違いが原因で誰も配車係になれない可能性が高いので、
  // 黙って部員として入れず、ログインのエラーで知らせる
  const initialAdmins = readInitialAdminIds(process.env);
  if (!initialAdmins.ok && kakariCount === 0) {
    console.error(`[login] ${INITIAL_ADMIN_ENV_KEY} に UUID ではない項目があります（${initialAdmins.invalid.length} 件）`);
    return { ok: false, error: "initial_admin_invalid" };
  }

  const role = roleOnLogin({
    sub: input.sub,
    existingRole: existing?.role ?? null,
    initialAdminIds: initialAdmins.ids,
    kakariCount,
  });
  const now = new Date();
  // 開発用ログインではメールアドレスが分からないので、既存の値を消さない
  const email = input.email ?? existing?.email ?? null;

  await db
    .insert(members)
    .values({ cairnUserId: input.sub, role, email, lastLoginAt: now })
    .onConflictDoUpdate({
      target: members.cairnUserId,
      set: { role, email, lastLoginAt: now },
    });

  await setSession({ sub: input.sub, via: input.via });
  return { ok: true };
}
