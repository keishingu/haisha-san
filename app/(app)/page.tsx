import Link from 'next/link';
import { Suspense } from 'react';
import { getDb } from '@/db';
import { getCurrentMember } from '@/lib/auth/current-member';
import { listProjects } from '@/lib/cairn/client';
import { getOrigin } from '@/lib/origins/service';
import { listRecentPlans } from '@/lib/plans/service';
import { formatTripDates, orderTrips, todayInJapan } from '@/lib/trips/order';
import { CairnErrorBox, tryCairn } from '@/components/CairnErrorBox';

export default function HomePage() {
  return (
    <main className="flex flex-col gap-6">
      <Suspense fallback={null}>
        <OriginNotice />
      </Suspense>
      <section>
        <h2 className="mb-2 text-lg font-bold text-gray-800">山行</h2>
        <Suspense fallback={<p className="text-sm text-gray-500">Cairn から山行を読み込み中…</p>}>
          <Trips />
        </Suspense>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-bold text-gray-800">最近のプラン</h2>
        <Suspense fallback={<p className="text-sm text-gray-500">読み込み中…</p>}>
          <RecentPlans />
        </Suspense>
      </section>
    </main>
  );
}

async function OriginNotice() {
  const me = await getCurrentMember();
  const origin = await getOrigin(await getDb(), me.cairnUserId);
  if (origin) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      出発地がまだ登録されていません。{' '}
      <Link href="/me" className="font-bold underline">
        自分の出発地を登録する
      </Link>
    </div>
  );
}

async function Trips() {
  await getCurrentMember();
  const result = await tryCairn(() => listProjects());
  if (!result.ok) return <CairnErrorBox error={result.error} />;
  const trips = orderTrips(result.value, todayInJapan()).slice(0, 30);
  if (trips.length === 0) return <p className="text-sm text-gray-500">山行がありません。</p>;
  return (
    <ul className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      {trips.map((t) => (
        <li key={t.id} className="border-b border-gray-100 last:border-b-0">
          <Link href={`/trips/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
            <span>
              <span className="block font-bold text-gray-800">{t.title}</span>
              {t.location && <span className="block text-xs text-gray-500">{t.location}</span>}
            </span>
            <span className="shrink-0 font-mono text-xs text-gray-500">{formatTripDates(t)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function RecentPlans() {
  await getCurrentMember();
  const plans = await listRecentPlans(await getDb(), 10);
  if (plans.length === 0) return <p className="text-sm text-gray-500">まだプランはありません。</p>;
  return (
    <ul className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      {plans.map((p) => (
        <li key={p.id} className="border-b border-gray-100 last:border-b-0">
          <Link href={`/plans/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
            <span>
              <span className="block font-bold text-gray-800">{p.projectTitle}</span>
              <span className="block text-xs text-gray-500">目的地: {p.destinationLabel}</span>
            </span>
            <span className="shrink-0 font-mono text-xs text-gray-500">{p.createdAt.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
