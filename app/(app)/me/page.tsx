import { Suspense } from 'react';
import { getDb } from '@/db';
import { getCurrentMember } from '@/lib/auth/current-member';
import { getOrigin } from '@/lib/origins/service';
import { OriginForm } from '@/components/OriginForm';
import { deleteOriginAction } from '../origin-actions';

export default function MePage() {
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-gray-800">自分の出発地</h1>
      <Suspense fallback={<p className="text-sm text-gray-500">読み込み中…</p>}>
        <MyOrigin />
      </Suspense>
    </main>
  );
}

async function MyOrigin() {
  const me = await getCurrentMember();
  const origin = await getOrigin(await getDb(), me.cairnUserId);
  return (
    <>
      <OriginForm
        cairnUserId={me.cairnUserId}
        initial={origin && { addressInput: origin.addressInput, canDrive: origin.canDrive, vehicleCapacity: origin.vehicleCapacity }}
      />
      {origin && (
        <form action={deleteOriginAction} className="text-right">
          <input type="hidden" name="cairnUserId" value={me.cairnUserId} />
          <button type="submit" className="text-sm text-red-600 underline">
            登録した出発地を消す
          </button>
        </form>
      )}
    </>
  );
}
