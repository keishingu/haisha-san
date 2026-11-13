import Link from 'next/link';
import { Suspense } from 'react';
import { getCurrentMember } from '@/lib/auth/current-member';

/** ログイン後の画面。上にナビゲーションを置く */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-16 pt-4">
      <Suspense fallback={<div className="h-10" />}>
        <Nav />
      </Suspense>
      {children}
    </div>
  );
}

async function Nav() {
  const member = await getCurrentMember();
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-200 pb-3 text-sm">
      <Link href="/" className="text-lg font-black text-gray-800">
        配車さん
      </Link>
      <Link href="/me" className="text-gray-600 hover:text-gray-900">
        自分の出発地
      </Link>
      {member.role === 'kakari' && (
        <Link href="/members" className="text-gray-600 hover:text-gray-900">
          部員の出発地
        </Link>
      )}
      <form action="/auth/logout" method="post" className="ml-auto">
        <button type="submit" className="text-gray-500 hover:text-gray-800">
          ログアウト
        </button>
      </form>
    </nav>
  );
}
