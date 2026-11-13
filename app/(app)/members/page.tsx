import Link from 'next/link';
import { Suspense } from 'react';
import { getDb } from '@/db';
import { getCurrentMember } from '@/lib/auth/current-member';
import { listAllWorkspaceMembers } from '@/lib/cairn/client';
import { listMembers } from '@/lib/members/service';
import { listAllOrigins } from '@/lib/origins/service';
import { CairnErrorBox, tryCairn } from '@/components/CairnErrorBox';
import { deleteOriginAction } from '../origin-actions';
import { setRoleAction } from './actions';
import { CsvImportForm } from './members-client';

export default function MembersPage() {
  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-800">部員の出発地</h1>
      <Suspense fallback={<p className="text-sm text-gray-500">Cairn から部員を読み込み中…</p>}>
        <Members />
      </Suspense>
    </main>
  );
}

async function Members() {
  const me = await getCurrentMember();
  if (me.role !== 'kakari') {
    return (
      <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        部員の出発地は、配車係だけが見られます。
      </p>
    );
  }
  const result = await tryCairn(() => listAllWorkspaceMembers());
  if (!result.ok) return <CairnErrorBox error={result.error} subject="部員の一覧" />;
  const db = await getDb();
  const rows = await listMembers(db, result.value);
  const origins = await listAllOrigins(db);
  const originById = new Map(origins.map((o) => [o.cairnUserId, o]));
  const activeIds = new Set(rows.map((r) => r.cairnUserId));
  // ワークスペースから外れた（退部した）部員の出発地。自動では消さず、ここで知らせる
  const orphans = origins.filter((o) => !activeIds.has(o.cairnUserId));
  const registered = rows.filter((r) => originById.has(r.cairnUserId)).length;

  return (
    <>
      <p className="text-sm text-gray-600">
        登録済み {registered} / {rows.length}人。住所は本人と配車係だけが見られます。
      </p>

      <ul className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {rows.map((r) => {
          const o = originById.get(r.cairnUserId);
          return (
            <li key={r.cairnUserId} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 last:border-b-0">
              <div className="min-w-0">
                <p className="font-bold text-gray-800">
                  {r.name}
                  {r.role === 'kakari' && <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">配車係</span>}
                  {r.attributes.length > 0 && <span className="ml-2 text-xs font-normal text-gray-500">{r.attributes.join('・')}</span>}
                </p>
                {o ? (
                  <p className="truncate text-xs text-gray-600">
                    {o.addressInput} ・ {o.canDrive ? `車あり（${o.vehicleCapacity}人）` : '車なし'}
                  </p>
                ) : (
                  <p className="text-xs text-red-700">未登録</p>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Link href={`/members/${r.cairnUserId}`} className="text-blue-600 underline">
                  {o ? '変更' : '入力'}
                </Link>
                {r.cairnUserId !== me.cairnUserId && (
                  <form action={setRoleAction}>
                    <input type="hidden" name="cairnUserId" value={r.cairnUserId} />
                    <input type="hidden" name="role" value={r.role === 'kakari' ? 'member' : 'kakari'} />
                    <button type="submit" className="text-gray-500 underline">
                      {r.role === 'kakari' ? '係を外す' : '係にする'}
                    </button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {orphans.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-1 font-bold text-amber-900">Cairn にいない人の出発地（{orphans.length}件）</h2>
          <p className="mb-2 text-sm text-amber-900">ワークスペースから外れた部員の出発地です。要らなければ消してください。</p>
          <ul className="flex flex-col gap-2">
            {orphans.map((o) => (
              <li key={o.cairnUserId} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-amber-900">{o.addressInput}</span>
                <form action={deleteOriginAction}>
                  <input type="hidden" name="cairnUserId" value={o.cairnUserId} />
                  <button type="submit" className="text-red-600 underline">
                    消す
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow-md">
        <h2 className="font-bold text-gray-800">CSV</h2>
        <a href="/members/export" className="text-sm text-blue-600 underline">
          登録済みの出発地を CSV に書き出す
        </a>
        <CsvImportForm />
      </section>
    </>
  );
}
