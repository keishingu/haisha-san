import { NextResponse, type NextRequest } from "next/server";
import { clearSession } from "@/lib/auth/session";

/** 配車さんのセッションだけを消す（Cairn からはログアウトしない） */
export async function POST(request: NextRequest) {
  await clearSession();
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin), 303);
}
