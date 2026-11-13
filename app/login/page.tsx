import Link from 'next/link';
import { Suspense } from 'react';
import { INITIAL_ADMIN_ENV_KEY, isDevLoginEnabled, readInitialAdminIds, readOidcSettings } from '@/lib/auth/env';
import { loginErrorMessage } from '@/lib/auth/login-errors';

export default function LoginPage(props: PageProps<'/login'>) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-5 py-16">
      <div>
        <h1 className="text-4xl font-black text-gray-800">配車さん</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          山行の参加メンバーと出発地から、車ごとの乗車メンバーと集合地点を提案します。
        </p>
      </div>
      <Suspense fallback={null}>
        <LoginOptions searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginOptions({ searchParams }: { searchParams: PageProps<'/login'>['searchParams'] }) {
  const params = await searchParams;
  const errorCode = typeof params.error === 'string' ? params.error : undefined;
  const returnTo = typeof params.returnTo === 'string' ? params.returnTo : undefined;
  const error = loginErrorMessage(errorCode);
  const oidc = readOidcSettings(process.env);
  const devLogin = isDevLoginEnabled(process.env);
  const initialAdmins = readInitialAdminIds(process.env);

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          {error}
        </p>
      )}

      {oidc.ok ? (
        <a
          href={`/auth/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
          className="flex h-14 items-center justify-center rounded-lg bg-blue-600 text-base font-bold text-white hover:bg-blue-700"
        >
          Cairn でログイン
        </a>
      ) : (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-bold">Cairn でログインの設定がありません。</p>
          <p className="mt-1">不足している環境変数: {oidc.missing.join(', ')}</p>
        </div>
      )}

      {/* ログイン前の公開ページなので、設定値は出さず、どの変数が間違っているかだけ示す */}
      {!initialAdmins.ok && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-bold">最初の配車係の設定が正しくありません。</p>
          <p className="mt-1">
            環境変数 {INITIAL_ADMIN_ENV_KEY} には、メールアドレスではなく Cairn のユーザーID（UUID）を入れてください。
          </p>
        </div>
      )}

      {devLogin && (
        <Link
          href="/login/dev"
          className="flex h-12 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-sm font-bold text-gray-600"
        >
          開発用ログイン（部員を選ぶ）
        </Link>
      )}

      <Link href="/sample" className="text-center text-sm text-blue-600 underline">
        ログインせずにサンプルで試す
      </Link>
    </div>
  );
}
