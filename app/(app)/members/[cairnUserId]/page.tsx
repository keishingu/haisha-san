import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getDb } from '@/db';
import { getCurrentMember } from '@/lib/auth/current-member';
import { listAllWorkspaceMembers } from '@/lib/cairn/client';
import { getOrigin } from '@/lib/origins/service';
import { CairnErrorBox, tryCairn } from '@/components/CairnErrorBox';
import { OriginForm } from '@/components/OriginForm';

export default function MemberOriginPage(props: PageProps<'/members/[cairnUserId]'>) {
  return (
    <main className="flex flex-col gap-4">
      <Link href="/members" className="text-sm text-blue-600 underline">
        ← 部員の出発地
      </Link>
      <Suspense fallback={<p className="text-sm text-gray-500">読み込み中…</p>}>
        <Edit params={props.params} />
      </Suspense>
    </main>
  );
}

async function Edit({ params }: { params: PageProps<'/members/[cairnUserId]'>['params'] }) {
  const { cairnUserId } = await params;
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
  const member = result.value.find((m) => m.userId === cairnUserId && m.membershipStatus === 'active');
  if (!member) notFound();
  const origin = await getOrigin(await getDb(), cairnUserId);
  return (
    <>
      <h1 className="text-2xl font-bold text-gray-800">{member.name}さんの出発地</h1>
      <OriginForm
        cairnUserId={cairnUserId}
        initial={origin && { addressInput: origin.addressInput, canDrive: origin.canDrive, vehicleCapacity: origin.vehicleCapacity }}
      />
    </>
  );
}
