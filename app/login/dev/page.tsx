import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { isDevLoginEnabled } from '@/lib/auth/env';
import { listAllWorkspaceMembers } from '@/lib/cairn/client';
import { CairnError, PAT_REISSUE_GUIDE, cairnErrorMessage } from '@/lib/cairn/errors';
import { devLogin } from './actions';

export default function DevLoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 py-12">
      <div>
        <p className="font-mono text-xs font-semibold tracking-widest text-gray-500">DEV ONLY</p>
        <h1 className="mt-1 text-2xl font-black text-gray-800">開発用ログイン</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">ローカル開発用の入口です。本番では使えません。</p>
      </div>
      <Suspense fallback={<p className="text-sm text-gray-500">Cairn から部員を読み込み中…</p>}>
        <MemberPicker />
      </Suspense>
    </main>
  );
}

async function MemberPicker() {
  await connection();
  if (!isDevLoginEnabled(process.env)) notFound();

  let members;
  try {
    members = (await listAllWorkspaceMembers()).filter((m) => m.membershipStatus === 'active');
  } catch (error) {
    if (!(error instanceof CairnError)) throw error;
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <p className="font-bold">{cairnErrorMessage(error, '部員の一覧')}</p>
        <p className="mt-1 break-all">{error.message}</p>
        {error.needsPatReissue && <p className="mt-2">{PAT_REISSUE_GUIDE}</p>}
      </div>
    );
  }

  return (
    <ul className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
      {members.map((m) => (
        <li key={m.userId} className="border-b border-gray-100 last:border-b-0">
          <form action={devLogin}>
            <input type="hidden" name="sub" value={m.userId} />
            <button type="submit" className="flex w-full items-center justify-between px-4 py-3 text-left">
              <span className="font-bold">{m.name}</span>
              <span className="text-xs text-gray-500">{m.profileAttributes.map((a) => a.name).join('・')}</span>
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
