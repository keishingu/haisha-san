import "server-only";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { members } from "@/db/schema";
import { listAllWorkspaceMembers } from "@/lib/cairn/client";
import { CairnError } from "@/lib/cairn/errors";
import { findActiveWorkspaceMember, type MemberRole } from "./membership";
import { REQUEST_PATH_HEADER, loginUrlFor } from "./return-to";
import { readSession } from "./session";

export type CurrentMember = {
  cairnUserId: string;
  role: MemberRole;
  via: "oidc" | "dev";
};

/**
 * ログイン中の部員（Data Access Layer）。画面・Server Action・Route Handler はここを通す。
 * セッションが無い・不正・部員の行が無ければログイン画面へ。
 * セッションは14日もつので、ワークスペースから外れた部員がその間に住所やプランを見られないよう、
 * リクエストごとに Cairn の active なメンバーかを確かめる（list_members は60秒キャッシュ）。
 * 確かめられないときも通さない。
 */
export const getCurrentMember = cache(async (): Promise<CurrentMember> => {
  const session = await readSession();
  // ログイン後に、開こうとした画面（共有されたプランなど）へ戻す
  if (!session) redirect(loginUrlFor((await headers()).get(REQUEST_PATH_HEADER)));
  const db = await getDb();
  const [row] = await db
    .select({ role: members.role })
    .from(members)
    .where(eq(members.cairnUserId, session.sub));
  if (!row) redirect(loginUrlFor((await headers()).get(REQUEST_PATH_HEADER)));

  let workspaceMembers;
  try {
    workspaceMembers = await listAllWorkspaceMembers();
  } catch (error) {
    if (error instanceof CairnError) {
      console.error("[getCurrentMember] Cairn で部員を確かめられません", error);
      redirect("/login?error=cairn_unavailable");
    }
    throw error;
  }
  if (!findActiveWorkspaceMember(workspaceMembers, session.sub)) redirect("/login?error=not_member");

  return { cairnUserId: session.sub, role: row.role, via: session.via };
});

/** 配車係だけの画面・操作で使う */
export async function requireKakari(): Promise<CurrentMember> {
  const member = await getCurrentMember();
  if (member.role !== "kakari") {
    throw new ForbiddenError("配車係だけが使える機能です");
  }
  return member;
}

/** 権限が無い操作。画面ではこのメッセージをそのまま出す */
export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** 表示名・アイコンは Cairn から取る。取れなければ CairnError を投げる（代替しない） */
export async function getMemberProfile(cairnUserId: string) {
  const all = await listAllWorkspaceMembers();
  const found = all.find((m) => m.userId === cairnUserId);
  return found ? { name: found.name, avatarUrl: found.avatarUrl ?? null } : null;
}
