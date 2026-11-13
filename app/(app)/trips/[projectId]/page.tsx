import Link from 'next/link';
import { Suspense } from 'react';
import { getDb } from '@/db';
import { getCurrentMember } from '@/lib/auth/current-member';
import { getProject, getProjectMembers } from '@/lib/cairn/client';
import { canCreatePlan } from '@/lib/plans/permissions';
import { listPlansForProject } from '@/lib/plans/service';
import { formatTripDates } from '@/lib/trips/order';
import { CairnErrorBox, tryCairn } from '@/components/CairnErrorBox';

export default function TripPage(props: PageProps<'/trips/[projectId]'>) {
  return (
    <main className="flex flex-col gap-6">
      <Suspense fallback={<p className="text-sm text-gray-500">Cairn から山行を読み込み中…</p>}>
        <Trip params={props.params} />
      </Suspense>
    </main>
  );
}

async function Trip({ params }: { params: PageProps<'/trips/[projectId]'>['params'] }) {
  const { projectId } = await params;
  const me = await getCurrentMember();
  const result = await tryCairn(() => Promise.all([getProject(projectId), getProjectMembers(projectId)]));
  if (!result.ok) return <CairnErrorBox error={result.error} />;
  const [project, projectMembers] = result.value;
  const plans = await listPlansForProject(await getDb(), projectId);
  const canCreate = canCreatePlan(me, new Set(projectMembers.items.map((m) => m.userId)));

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{project.title}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {formatTripDates(project)}
          {project.location && ` ・ ${project.location}`}
        </p>
        <p className="mt-1 text-sm text-gray-600">メンバー: {projectMembers.items.map((m) => m.name).join('、')}</p>
      </div>

      {canCreate ? (
        <Link
          href={`/trips/${projectId}/plan`}
          className="rounded-lg bg-blue-600 px-4 py-3 text-center font-bold text-white hover:bg-blue-700"
        >
          配車をつくる
        </Link>
      ) : (
        <p className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-600">
          配車をつくれるのは、この山行のメンバーと配車係です。
        </p>
      )}

      <section>
        <h2 className="mb-2 text-lg font-bold text-gray-800">この山行のプラン</h2>
        {plans.length === 0 ? (
          <p className="text-sm text-gray-500">まだプランはありません。</p>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            {plans.map((p, i) => (
              <li key={p.id} className="border-b border-gray-100 last:border-b-0">
                <Link href={`/plans/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                  <span>
                    <span className="block font-bold text-gray-800">
                      目的地: {p.destinationLabel}
                      {i === 0 && <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">最新</span>}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {p.participants.length}人・車{p.result.vehiclePlans.length}台
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-gray-500">
                    {p.createdAt.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
