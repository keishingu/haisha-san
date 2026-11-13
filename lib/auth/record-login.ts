import { and, eq } from "drizzle-orm";
import { members } from "@/db/schema";
import type { Executor } from "@/db/types";
import type { MemberRole } from "./membership";

/**
 * ログインした部員の行を書く。
 * 既存の行の役割は、ログインの途中で読んだ値で上書きしない（読んだあとに配車係が付け外しをしていると、その変更を消してしまうため）。
 * - 新しい行: 計算した役割で作る
 * - 既存の行: メールアドレスと最終ログインだけを更新する
 * - 配車係が1人もいないときの復旧（環境変数の人を配車係に戻す）だけは、部員 → 配車係の条件付き更新で行う
 */
export async function recordLogin(
  db: Executor,
  input: { sub: string; role: MemberRole; existingRole: MemberRole | null; email: string | null; now: Date },
): Promise<void> {
  await db
    .insert(members)
    .values({ cairnUserId: input.sub, role: input.role, email: input.email, lastLoginAt: input.now })
    .onConflictDoUpdate({
      target: members.cairnUserId,
      set: { email: input.email, lastLoginAt: input.now },
    });
  if (input.role === "kakari" && input.existingRole === "member") {
    await db
      .update(members)
      .set({ role: "kakari" })
      .where(and(eq(members.cairnUserId, input.sub), eq(members.role, "member")));
  }
}
