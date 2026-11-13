import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getDb } from '@/db';
import type { PlanParticipant } from '@/db/schema';
import { getCurrentMember } from '@/lib/auth/current-member';
import { getProjectMembers } from '@/lib/cairn/client';
import { CairnError } from '@/lib/cairn/errors';
import { buildMeetingPointUrl, buildTransitStationRouteUrl } from '@/lib/google-maps/links';
import { OPTIMIZATION_OPTIONS } from '@/lib/planner/optimization';
import { canDeletePlan } from '@/lib/plans/permissions';
import { getPlan } from '@/lib/plans/service';
import { generateShareText } from '@/lib/share-url/shareText';
import type { Member } from '@/lib/types';
import { getGroupLabel, getGroupStyle } from '@/lib/ui/groupStyle';
import { CopyButton, DeletePlanButton } from './plan-client';

export default function PlanPage(props: PageProps<'/plans/[id]'>) {
  return (
    <main className="flex flex-col gap-4">
      <Suspense fallback={<p className="text-sm text-gray-500">読み込み中…</p>}>
        <PlanView params={props.params} />
      </Suspense>
    </main>
  );
}

function GroupBadge({ groupId }: { groupId: string }) {
  return (
    <span className={`ml-1 inline-block rounded border px-1.5 py-0.5 align-middle text-xs ${getGroupStyle(groupId).badgeClass}`}>
      {getGroupLabel(groupId)}
    </span>
  );
}

/** 表示と共有テキスト用の名前の一覧（住所は持たない） */
function toDisplayMembers(participants: PlanParticipant[]): Member[] {
  return participants.map((p) => ({ id: p.id, name: p.name, addressInput: '', isDriver: false, groupId: p.groupId }));
}

async function PlanView({ params }: { params: PageProps<'/plans/[id]'>['params'] }) {
  const { id } = await params;
  const me = await getCurrentMember();
  const plan = await getPlan(await getDb(), id);
  if (!plan) notFound();

  const members = toDisplayMembers(plan.participants);
  const byId = new Map(members.map((m) => [m.id, m]));
  const result = plan.result;
  const shareText = generateShareText(members, plan.destinationLabel, result) + (plan.notes ? `\n\n幹事メモ: ${plan.notes}` : '');
  const modeLabel = OPTIMIZATION_OPTIONS.find((o) => o.mode === plan.optimizationMode)?.label ?? plan.optimizationMode;

  // 削除ボタンは、消せる人にだけ出す。リーダーかどうかは Cairn に確かめ、取れなければ（作った人・配車係でない限り）出さない
  let leaderIds = new Set<string>();
  if (me.role !== 'kakari' && plan.createdById !== me.cairnUserId) {
    try {
      const pm = await getProjectMembers(plan.cairnProjectId);
      leaderIds = new Set(pm.items.filter((m) => m.role === 'leader').map((m) => m.userId));
    } catch (error) {
      if (!(error instanceof CairnError)) throw error;
    }
  }
  const canDelete = canDeletePlan(me, plan, leaderIds);
  const creator = byId.get(plan.createdById)?.name;

  return (
    <>
      <div>
        <Link href={`/trips/${plan.cairnProjectId}`} className="text-sm text-blue-600 underline">
          ← {plan.projectTitle}
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-800">配車プラン</h1>
        <p className="mt-1 text-sm text-gray-600">
          目的地: {plan.destinationLabel} ・ 方針: {modeLabel}
        </p>
        <p className="text-xs text-gray-500">
          {plan.createdAt.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'medium', timeStyle: 'short' })} 作成
          {creator && `（${creator}）`}
        </p>
      </div>

      {plan.notes && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <h2 className="mb-1 font-semibold text-yellow-800">幹事メモ</h2>
          <p className="whitespace-pre-line text-yellow-800">{plan.notes}</p>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <h2 className="mb-1 font-semibold text-yellow-800">注意事項</h2>
          <ul className="list-inside list-disc text-sm text-yellow-800">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {result.vehiclePlans.map((vp, index) => {
        const driver = byId.get(vp.driverId);
        const riders = [driver, ...vp.passengerIds.map((pid) => byId.get(pid))];
        return (
          <section key={vp.vehicleId} className="rounded-lg bg-white p-4 shadow-md">
            <h2 className="mb-2 text-lg font-semibold text-gray-700">
              車{index + 1}: {driver?.name}さんの車
            </h2>
            <p className="mb-1">
              <span className="font-medium">乗車:</span>{' '}
              {riders.map((m, i) => (
                <span key={m?.id ?? i}>
                  {i > 0 && '、'}
                  {m?.name}
                  {m?.groupId && <GroupBadge groupId={m.groupId} />}
                </span>
              ))}
            </p>
            <p className="mb-1">
              <span className="font-medium">集合地点:</span>{' '}
              {vp.meetingPoint ? (
                <a href={buildMeetingPointUrl(vp.meetingPoint.location)} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                  {vp.meetingPoint.name}
                </a>
              ) : (
                '同乗者なし（出発地から目的地へ直行）'
              )}
            </p>
            <p className="mb-1">
              <span className="font-medium">移動時間:</span> 約{vp.driveDurationMinutes}分
              {vp.meetingPoint && <span className="text-sm text-gray-500">（遠回り +{vp.driverDetourMinutes}分）</span>}
            </p>
            {vp.passengerAccess.length > 0 && (
              <div className="mb-2">
                <span className="font-medium">集合地点までの行き方:</span>
                <ul className="ml-4 mt-1">
                  {vp.passengerAccess.map((pa) => {
                    const route = pa.transitRoute && pa.transitRoute.length > 0 ? pa.transitRoute : undefined;
                    const label = route?.map((s) => `${s.departureStop}${s.line ? `（${s.line}）` : ''}→${s.arrivalStop}`).join(' / ');
                    return (
                      <li key={pa.memberId} className="text-sm text-gray-700">
                        {byId.get(pa.memberId)?.name}:{' '}
                        {route && label ? (
                          <a
                            href={buildTransitStationRouteUrl(route[0].departureStop, route[route.length - 1].arrivalStop)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline"
                          >
                            {label}
                          </a>
                        ) : (
                          <>公共交通機関で{vp.meetingPoint?.name}へ</>
                        )}
                        {pa.durationMinutes != null && `（約${pa.durationMinutes}分）`}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <a href={vp.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">
              {vp.meetingPoint ? '集合地点→目的地のルートを Google Maps で開く' : '目的地を Google Maps で開く'}
            </a>
          </section>
        );
      })}

      {result.transitOnlyPlans.length > 0 && (
        <section className="rounded-lg bg-white p-4 shadow-md">
          <h2 className="mb-2 text-lg font-semibold text-gray-700">公共交通で目的地へ向かうメンバー</h2>
          {result.transitOnlyPlans.map((top) => {
            const m = byId.get(top.memberId);
            return (
              <div key={top.memberId} className="mb-2 last:mb-0">
                <div className="font-medium">
                  {m?.name}
                  {m?.groupId && <GroupBadge groupId={m.groupId} />}
                </div>
                <div className="text-sm text-gray-500">
                  理由: {top.reason === 'seat_shortage' ? '席不足' : top.reason === 'no_vehicle' ? '車なし' : '手動指定'}
                </div>
                <a href={top.destinationMapsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">
                  目的地を Google Maps で開く
                </a>
              </div>
            );
          })}
        </section>
      )}

      <section className="rounded-lg bg-white p-4 shadow-md">
        <h2 className="mb-2 text-lg font-semibold text-gray-700">共有</h2>
        <p className="mb-2 text-sm text-gray-600">このページの URL を山行のチャンネルに貼ってください。開けるのは Cairn でログインした部員だけです。</p>
        <div className="mb-3 flex flex-wrap gap-3">
          <CopyButton text={`/plans/${plan.id}`} label="URL をコピー" />
          <CopyButton text={shareText} label="共有テキストをコピー" />
        </div>
        <textarea value={shareText} readOnly rows={8} className="w-full rounded border border-gray-300 bg-gray-50 p-2 font-mono text-xs" />
      </section>

      {canDelete && <DeletePlanButton planId={plan.id} />}
    </>
  );
}
