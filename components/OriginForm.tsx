'use client';

import { startTransition, useActionState, useState } from 'react';
import AutocompleteInput from '@/components/AutocompleteInput';
import { saveOriginAction, type OriginFormState } from '@/app/(app)/origin-actions';

export type OriginFormValues = {
  addressInput: string;
  canDrive: boolean;
  vehicleCapacity: number | null;
};

/** 出発地と車の既定値の入力。本人（/me）と配車係の代理入力で共通 */
export function OriginForm({ cairnUserId, initial }: { cairnUserId: string; initial: OriginFormValues | null }) {
  const [state, action, pending] = useActionState<OriginFormState, FormData>(saveOriginAction, { ok: false, message: null });
  const [address, setAddress] = useState(initial?.addressInput ?? '');
  const [canDrive, setCanDrive] = useState(initial?.canDrive ?? false);
  const [capacity, setCapacity] = useState(initial?.vehicleCapacity != null ? String(initial.vehicleCapacity) : '');

  return (
    // form の action に渡すと、送信後に React が入力を初期値へ戻す（失敗したときも）。
    // チェックと定員の欄が食い違わないよう、onSubmit から送り、入力はすべて state で持つ
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => action(formData));
      }}
      className="flex flex-col gap-4 rounded-lg bg-white p-4 shadow-md">
      <input type="hidden" name="cairnUserId" value={cairnUserId} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-gray-700">出発地の住所</span>
        <AutocompleteInput
          value={address}
          onChange={setAddress}
          onPlaceSelect={(_, addr) => setAddress(addr)}
          placeholder="例: 東京都新宿区西新宿1丁目"
          className="w-full rounded border border-gray-300 p-2"
        />
        <input type="hidden" name="addressInput" value={address} />
        <span className="text-xs text-gray-500">本人と配車係だけが見られます。プランには住所は出ません。</span>
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="canDrive" checked={canDrive} onChange={(e) => setCanDrive(e.target.checked)} />
          <span className="text-sm text-gray-700">車を出せる</span>
        </label>
        {canDrive && (
          <label className="flex items-center gap-2">
            <span className="text-sm text-gray-700">定員</span>
            <input
              type="number"
              name="vehicleCapacity"
              min={1}
              max={15}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="w-16 rounded border border-gray-300 p-1 text-center"
            />
            <span className="text-sm text-gray-500">人（運転する人を含む）</span>
          </label>
        )}
      </div>
      <p className="text-xs text-gray-500">山行ごとに「今回は車を出さない」などに変えられます。ここは普段の値です。</p>
      {state.message && (
        <p
          role={state.ok ? 'status' : 'alert'}
          className={`whitespace-pre-line rounded border p-3 text-sm ${state.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}
        >
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700 disabled:bg-blue-400"
      >
        {pending ? '保存中…' : '保存する'}
      </button>
    </form>
  );
}
