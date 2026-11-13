'use client';

import { useState, useTransition } from 'react';
import AutocompleteInput from '@/components/AutocompleteInput';
import { DEFAULT_OPTIMIZATION_MODE, OPTIMIZATION_OPTIONS, type OptimizationMode } from '@/lib/planner/optimization';
import type { PlanFormInput } from '@/lib/plans/input';
import { GROUP_OPTIONS, getGroupStyle } from '@/lib/ui/groupStyle';
import { createPlanAction } from './actions';

/** 山行のメンバー。住所は持たない（登録済みかどうかだけ） */
export type InitialParticipant = {
  cairnUserId: string;
  name: string;
  roleName: string | null;
  hasOrigin: boolean;
  canDrive: boolean;
  vehicleCapacity: number | null;
};

type Common = {
  canDrive: boolean;
  vehicleCapacity: number | null;
  groupId?: string;
  meetingPointInput: string;
  meetingAtHome: boolean;
};

type MemberRow = Common & {
  kind: 'member';
  cairnUserId: string;
  name: string;
  roleName: string | null;
  hasOrigin: boolean;
  included: boolean;
  /** 今回だけ別の出発地から出る */
  addressOverride: string;
};

type GuestRow = Common & { kind: 'guest'; id: string; name: string; addressInput: string };

type Row = MemberRow | GuestRow;

const rowKey = (r: Row) => (r.kind === 'member' ? r.cairnUserId : r.id);

export function PlanForm({
  projectId,
  initialDestination,
  destinationHint,
  participants,
}: {
  projectId: string;
  initialDestination: string;
  destinationHint: string | null;
  participants: InitialParticipant[];
}) {
  const [destination, setDestination] = useState(initialDestination);
  const [mode, setMode] = useState<OptimizationMode>(DEFAULT_OPTIMIZATION_MODE);
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>(() =>
    participants.map((p) => ({
      kind: 'member',
      cairnUserId: p.cairnUserId,
      name: p.name,
      roleName: p.roleName,
      hasOrigin: p.hasOrigin,
      included: true,
      addressOverride: '',
      canDrive: p.canDrive,
      vehicleCapacity: p.vehicleCapacity,
      meetingPointInput: '',
      meetingAtHome: false,
    })),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (key: string, patch: Partial<MemberRow> | Partial<GuestRow>) =>
    setRows((prev) => prev.map((r) => (rowKey(r) === key ? ({ ...r, ...patch } as Row) : r)));

  const addGuest = () =>
    setRows((prev) => [
      ...prev,
      {
        kind: 'guest',
        id: `guest-${crypto.randomUUID()}`,
        name: '',
        addressInput: '',
        canDrive: false,
        vehicleCapacity: null,
        meetingPointInput: '',
        meetingAtHome: false,
      },
    ]);

  const included = rows.filter((r) => r.kind === 'guest' || r.included);
  const seats = included.filter((r) => r.canDrive).reduce((s, r) => s + (r.vehicleCapacity ?? 0), 0);
  const missingOrigin = rows.filter((r) => r.kind === 'member' && r.included && !r.hasOrigin && !r.addressOverride.trim());

  const customGroupIds = Array.from(
    new Set(rows.map((r) => r.groupId).filter((g): g is string => !!g && !GROUP_OPTIONS.includes(g))),
  ).sort();

  const submit = () => {
    setError(null);
    const input: PlanFormInput = {
      projectId,
      destinationInput: destination,
      optimizationMode: mode,
      notes,
      participants: rows.map((r) => {
        const common = {
          canDrive: r.canDrive,
          vehicleCapacity: r.canDrive ? r.vehicleCapacity : null,
          groupId: r.groupId,
          meetingPointInput: r.canDrive && !r.meetingAtHome ? r.meetingPointInput : undefined,
          meetingAtHome: r.canDrive && r.meetingAtHome,
        };
        return r.kind === 'member'
          ? { kind: 'member', cairnUserId: r.cairnUserId, included: r.included, addressOverride: r.addressOverride, ...common }
          : { kind: 'guest', id: r.id, name: r.name, addressInput: r.addressInput, ...common };
      }),
    };
    startTransition(async () => {
      const result = await createPlanAction(input);
      // 成功したらプランの画面へ移るので、戻ってくるのは失敗したときだけ
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg bg-white p-4 shadow-md">
        <h2 className="mb-2 text-lg font-semibold text-gray-700">目的地</h2>
        <AutocompleteInput
          value={destination}
          onChange={setDestination}
          onPlaceSelect={(_, addr) => setDestination(addr)}
          placeholder="例: 大倉バス停駐車場"
          className="w-full rounded border border-gray-300 p-2"
        />
        {destinationHint && <p className="mt-1 text-xs text-gray-500">{destinationHint}</p>}
      </section>

      <section className="rounded-lg bg-white p-4 shadow-md">
        <h2 className="mb-1 text-lg font-semibold text-gray-700">参加者</h2>
        <p className="mb-3 text-xs text-gray-500">
          行かない人はチェックを外してください。車・定員はこの配車だけの値で、普段の値は変わりません。
        </p>
        {rows.map((r) => {
          const key = rowKey(r);
          const active = r.kind === 'guest' || r.included;
          return (
            <div key={key} className={`mb-3 rounded border p-3 last:mb-0 ${active ? 'border-gray-200' : 'border-gray-100 opacity-50'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {r.kind === 'member' ? (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={r.included} onChange={(e) => update(key, { included: e.target.checked })} />
                    <span className="font-medium text-gray-800">{r.name}</span>
                    {r.roleName && <span className="text-xs text-gray-500">{r.roleName}</span>}
                  </label>
                ) : (
                  <input
                    type="text"
                    value={r.name}
                    onChange={(e) => update(key, { name: e.target.value })}
                    placeholder="名前（Cairn にいない参加者）"
                    className="rounded border border-gray-300 p-1.5"
                  />
                )}
                {r.kind === 'member' ? (
                  <span className={`text-xs ${r.hasOrigin ? 'text-green-700' : 'text-red-700'}`}>
                    {r.hasOrigin ? '出発地 登録済み' : '出発地 未登録'}
                  </span>
                ) : (
                  <button type="button" onClick={() => setRows((prev) => prev.filter((x) => rowKey(x) !== key))} className="text-sm text-red-600">
                    削除
                  </button>
                )}
              </div>

              {active && (
                <>
                  <div className="mt-2">
                    {r.kind === 'member' ? (
                      <AutocompleteInput
                        value={r.addressOverride}
                        onChange={(v) => update(key, { addressOverride: v })}
                        onPlaceSelect={(_, addr) => update(key, { addressOverride: addr })}
                        placeholder={r.hasOrigin ? '今回だけ別の場所から出るときの出発地（任意）' : '今回の出発地（必須）'}
                        className="w-full rounded border border-gray-300 p-2 text-sm"
                      />
                    ) : (
                      <AutocompleteInput
                        value={r.addressInput}
                        onChange={(v) => update(key, { addressInput: v })}
                        onPlaceSelect={(_, addr) => update(key, { addressInput: addr })}
                        placeholder="出発地（例: 東京都中野区）"
                        className="w-full rounded border border-gray-300 p-2 text-sm"
                      />
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={r.canDrive} onChange={(e) => update(key, { canDrive: e.target.checked })} />
                      <span className="text-sm text-gray-700">車を出す</span>
                    </label>
                    {r.canDrive && (
                      <label className="flex items-center gap-2">
                        <span className="text-sm text-gray-700">定員</span>
                        <input
                          type="number"
                          min={1}
                          max={15}
                          value={r.vehicleCapacity ?? ''}
                          onChange={(e) => update(key, { vehicleCapacity: e.target.value === '' ? null : Number(e.target.value) })}
                          className="w-16 rounded border border-gray-300 p-1 text-center"
                        />
                        <span className="text-sm text-gray-500">人</span>
                      </label>
                    )}
                    <label className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">同乗グループ</span>
                      {r.groupId && <span className={`inline-block h-3 w-3 rounded-full ${getGroupStyle(r.groupId).dotClass}`} />}
                      <select
                        value={r.groupId ?? ''}
                        onChange={(e) => update(key, { groupId: e.target.value || undefined })}
                        className="rounded border border-gray-300 p-1 text-sm"
                      >
                        <option value="">なし</option>
                        {[...GROUP_OPTIONS, ...customGroupIds].map((g) => (
                          <option key={g} value={g}>
                            グループ{g}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {r.canDrive && (
                    <div className="mt-2">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={r.meetingAtHome} onChange={(e) => update(key, { meetingAtHome: e.target.checked })} />
                        <span className="text-sm text-gray-700">出発地（自宅）を集合場所にする</span>
                      </label>
                      {r.meetingAtHome ? (
                        <p className="mt-1 text-xs text-amber-700">同乗者には、集合場所として出発地の位置（地図）が見えます。住所の文字は出ません。</p>
                      ) : (
                        <AutocompleteInput
                          value={r.meetingPointInput}
                          onChange={(v) => update(key, { meetingPointInput: v })}
                          onPlaceSelect={(_, addr) => update(key, { meetingPointInput: addr })}
                          placeholder="指定集合場所（任意。例: 新宿駅西口）"
                          className="mt-1 w-full rounded border border-gray-300 p-2 text-sm"
                        />
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
        <button type="button" onClick={addGuest} className="mt-2 w-full rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700">
          Cairn にいない参加者を追加
        </button>
      </section>

      <section className="rounded-lg bg-white p-4 shadow-md">
        <h2 className="mb-2 text-lg font-semibold text-gray-700">最適化の方針</h2>
        <div className="flex flex-col gap-2">
          {OPTIMIZATION_OPTIONS.map((opt) => (
            <label
              key={opt.mode}
              className={`flex cursor-pointer items-start gap-2 rounded border p-2 ${mode === opt.mode ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}
            >
              <input type="radio" name="mode" checked={mode === opt.mode} onChange={() => setMode(opt.mode)} className="mt-1" />
              <span>
                <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                <span className="block text-xs text-gray-500">{opt.description}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg bg-white p-4 shadow-md">
        <h2 className="mb-2 text-lg font-semibold text-gray-700">幹事メモ（任意）</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="例: 到着時間を揃えるため、車1は10分遅く出発でOK"
          className="w-full rounded border border-gray-300 p-2 text-sm"
        />
      </section>

      <div className="text-sm text-gray-600">
        参加 {included.length}人 ・ 席 {seats}席
        {seats < included.length && included.some((r) => r.canDrive) && (
          <span className="ml-2 text-amber-700">席が{included.length - seats}席足りません（足りない人は公共交通で向かう案になります）</span>
        )}
      </div>

      {missingOrigin.length > 0 && (
        <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          出発地が未登録の人がいます: {missingOrigin.map((r) => r.name).join('、')}。今回の出発地を入れるか、チェックを外してください。
        </p>
      )}

      {error && (
        <p role="alert" className="whitespace-pre-line rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending || missingOrigin.length > 0}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
      >
        {pending ? '計算中…' : '計算して保存する'}
      </button>
    </div>
  );
}
