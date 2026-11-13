import Link from 'next/link';
import { Suspense } from 'react';
import { getDb } from '@/db';
import { getCurrentMember } from '@/lib/auth/current-member';
import { getProject, getProjectMembers } from '@/lib/cairn/client';
import { getOrigins } from '@/lib/origins/service';
import { canCreatePlan } from '@/lib/plans/permissions';
import { listPlansForProject } from '@/lib/plans/service';
import { CairnErrorBox, tryCairn } from '@/components/CairnErrorBox';
import { PlanForm, type InitialParticipant } from './plan-form';

export default function PlanFormPage(props: PageProps<'/trips/[projectId]/plan'>) {
  return (
    <main className="flex flex-col gap-4">
      <Suspense fallback={<p className="text-sm text-gray-500">Cairn から山行を読み込み中…</p>}>
        <Form params={props.params} />
      </Suspense>
    </main>
  );
}

async function Form({ params }: { params: PageProps<'/trips/[projectId]/plan'>['params'] }) {
  const { projectId } = await params;
  const me = await getCurrentMember();
  const result = await tryCairn(() => Promise.all([getProject(projectId), getProjectMembers(projectId)]));
  if (!result.ok) return <CairnErrorBox error={result.error} />;
  const [project, projectMembers] = result.value;

  if (!canCreatePlan(me, new Set(projectMembers.items.map((m) => m.userId)))) {
    return (
      <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        配車をつくれるのは、この山行のメンバーと配車係です。
      </p>
    );
  }

  const db = await getDb();
  const origins = await getOrigins(db, projectMembers.items.map((m) => m.userId));
  const [latest] = await listPlansForProject(db, projectId);

  // 住所はブラウザへ渡さない。登録済みかどうかと車の既定値だけを渡す
  const participants: InitialParticipant[] = projectMembers.items.map((m) => {
    const origin = origins.get(m.userId);
    return {
      cairnUserId: m.userId,
      name: m.name,
      roleName: m.roleName ?? null,
      hasOrigin: !!origin,
      canDrive: origin?.canDrive ?? false,
      vehicleCapacity: origin?.vehicleCapacity ?? null,
    };
  });

  return (
    <>
      <div>
        <Link href={`/trips/${projectId}`} className="text-sm text-blue-600 underline">
          ← {project.title}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-800">配車をつくる</h1>
      </div>
      <PlanForm
        projectId={projectId}
        initialDestination={latest?.destinationLabel ?? project.location ?? ''}
        destinationHint={
          latest
            ? '前回のプランの目的地を入れています。'
            : project.location
              ? 'Cairn の山行の「場所」を入れています。山頂などのときは、車で向かう登山口や駐車場に直してください。'
              : null
        }
        participants={participants}
      />
    </>
  );
}
