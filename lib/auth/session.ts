import "server-only";

import { cookies } from "next/headers";
import { isDevLoginEnabled, isProduction, readSessionSecret } from "./env";
import {
  LOGIN_TX_MAX_AGE_SECONDS,
  SESSION_MAX_AGE_SECONDS,
  openLoginTransaction,
  sealLoginTransaction,
  signSession,
  verifySession,
  type LoginTransaction,
  type SessionPayload,
} from "./tokens";

const SESSION_COOKIE = "haisha_session";
const LOGIN_TX_COOKIE = "haisha_login_tx";

function cookieOptions(maxAge: number, path = "/") {
  return {
    httpOnly: true,
    secure: isProduction(process.env),
    sameSite: "lax" as const,
    path,
    maxAge,
  };
}

export async function setSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload, readSessionSecret(process.env));
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(SESSION_MAX_AGE_SECONDS));
}

export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token, readSessionSecret(process.env), {
    devLoginEnabled: isDevLoginEnabled(process.env),
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** ログイン途中の state / nonce / code_verifier はコールバックのパスにだけ送る */
const LOGIN_TX_PATH = "/auth/callback";

export async function setLoginTransaction(tx: LoginTransaction): Promise<void> {
  const sealed = await sealLoginTransaction(tx, readSessionSecret(process.env));
  (await cookies()).set(LOGIN_TX_COOKIE, sealed, cookieOptions(LOGIN_TX_MAX_AGE_SECONDS, LOGIN_TX_PATH));
}

/** 取り出したら消す（使い回させない） */
export async function takeLoginTransaction(): Promise<LoginTransaction | null> {
  const store = await cookies();
  const sealed = store.get(LOGIN_TX_COOKIE)?.value;
  store.delete({ name: LOGIN_TX_COOKIE, path: LOGIN_TX_PATH });
  if (!sealed) return null;
  return openLoginTransaction(sealed, readSessionSecret(process.env));
}
