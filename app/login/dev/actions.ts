"use server";

import { redirect } from "next/navigation";
import { isDevLoginEnabled } from "@/lib/auth/env";
import { completeLogin } from "@/lib/auth/login";
import { safeReturnTo } from "@/lib/auth/tokens";

/** 開発用ログイン。HAISHA_DEV_LOGIN=1 かつ本番でないときだけ動く */
export async function devLogin(formData: FormData) {
  if (!isDevLoginEnabled(process.env)) {
    throw new Error("開発用ログインは無効です");
  }
  const sub = formData.get("sub");
  if (typeof sub !== "string" || sub === "") {
    throw new Error("部員が選ばれていません");
  }
  // 本番と同じく、Cairn のワークスペースの active なメンバーかを確かめる
  const result = await completeLogin({ sub, email: null, via: "dev" });
  if (!result.ok) redirect(`/login?error=${result.error}`);
  const returnTo = formData.get("returnTo");
  redirect(safeReturnTo(typeof returnTo === "string" ? returnTo : null));
}
