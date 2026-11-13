'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { buildTransitStationRouteUrl } from '@/lib/google-maps/links';
import { getGroupStyle, getGroupLabel } from '@/lib/ui/groupStyle';
import { usePlan } from '../PlanProvider';

function GroupBadge({ groupId }: { groupId: string }) {
  return (
    <span className={`ml-1 inline-block align-middle text-xs px-1.5 py-0.5 rounded border ${getGroupStyle(groupId).badgeClass}`}>
      {getGroupLabel(groupId)}
    </span>
  );
}

export default function SampleResultPage() {
  const router = useRouter();
  const { plan } = usePlan();

  // 直接アクセス/リロードで結果が無い場合は入力画面へ戻す（結果はメモリ保持のため）。
  useEffect(() => {
    if (!plan) router.replace('/sample');
  }, [plan, router]);

  if (!plan) return null;

  const { planResult, resultMembers, destinationLabel, shareText } = plan;

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(`${label}をコピーしました`);
    } catch {
      alert('コピーに失敗しました。手動で選択してコピーしてください。');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">配車結果（サンプル）</h1>
          <button onClick={() => router.back()} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
            入力に戻る
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <span className="font-medium">目的地:</span> {destinationLabel}
        </div>

        {planResult.warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">注意事項</h3>
            <ul className="list-disc list-inside text-yellow-700">
              {planResult.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {planResult.vehiclePlans.map((vp, index) => {
          const driver = resultMembers.find((m) => m.id === vp.driverId);
          const passengers = vp.passengerIds.map((pid) => resultMembers.find((m) => m.id === pid));
          return (
            <div key={index} className="bg-white rounded-lg shadow-md p-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                車{index + 1}: {driver?.name}さんの車
              </h3>
              <div className="mb-2">
                <span className="font-medium">乗車:</span>{' '}
                {[driver, ...passengers].map((m, i) => (
                  <span key={m?.id ?? i}>
                    {i > 0 && ', '}
                    {m?.name}
                    {m?.groupId && <GroupBadge groupId={m.groupId} />}
                  </span>
                ))}
              </div>
              <div className="mb-2">
                <span className="font-medium">集合地点:</span>{' '}
                {vp.meetingPoint ? vp.meetingPoint.name : '同乗者なし（自宅から目的地へ直行）'}
              </div>
              <div className="mb-2">
                <span className="font-medium">移動時間:</span> 約{vp.driveDurationMinutes}分
              </div>
              {vp.meetingPoint && (
                <div className="mb-2">
                  <span className="font-medium">遠回り時間:</span> +{vp.driverDetourMinutes}分
                </div>
              )}
              {vp.passengerAccess.length > 0 && (
                <div className="mb-2">
                  <span className="font-medium">車なしメンバーの集合:</span>
                  <ul className="ml-4 mt-1">
                    {vp.passengerAccess.map((pa) => {
                      const member = resultMembers.find((m) => m.id === pa.memberId);
                      const transitRoute = pa.transitRoute && pa.transitRoute.length > 0 ? pa.transitRoute : undefined;
                      const routeLabel = transitRoute
                        ?.map((s) => `${s.departureStop}${s.line ? `(${s.line})` : ''}→${s.arrivalStop}`)
                        .join(' / ');
                      const firstStep = transitRoute?.[0];
                      const lastStep = transitRoute?.[transitRoute.length - 1];
                      return (
                        <li key={pa.memberId} className="text-sm text-gray-600">
                          {member?.name}:{' '}
                          {routeLabel && firstStep && lastStep ? (
                            <a
                              href={buildTransitStationRouteUrl(firstStep.departureStop, lastStep.arrivalStop)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline"
                            >
                              {routeLabel}
                            </a>
                          ) : (
                            <>公共交通機関で{vp.meetingPoint?.name}へ</>
                          )}
                          （約{pa.durationMinutes}分）
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              <a
                href={vp.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                {vp.meetingPoint ? '集合地点→目的地のルートをGoogle Mapsで開く' : '目的地へのルートをGoogle Mapsで開く'}
              </a>
            </div>
          );
        })}

        {planResult.transitOnlyPlans.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">公共交通で目的地へ向かうメンバー</h3>
            {planResult.transitOnlyPlans.map((top, index) => {
              const member = resultMembers.find((m) => m.id === top.memberId);
              return (
                <div key={index} className="mb-2 last:mb-0">
                  <div className="font-medium">
                    {member?.name}
                    {member?.groupId && <GroupBadge groupId={member.groupId} />}
                  </div>
                  <div className="text-sm text-gray-500">
                    理由: {top.reason === 'seat_shortage' ? '席不足' : top.reason === 'no_vehicle' ? '車なし' : '手動指定'}
                  </div>
                  <a
                    href={top.destinationMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline text-sm"
                  >
                    目的地へのルートをGoogle Mapsで開く
                  </a>
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">共有テキスト</h3>
          <textarea value={shareText} readOnly rows={10} className="w-full p-2 border border-gray-300 rounded bg-gray-50 text-sm font-mono" />
          <button
            onClick={() => handleCopy(shareText, '共有テキスト')}
            className="mt-2 px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
          >
            テキストをコピー
          </button>
        </div>

      </div>
    </div>
  );
}
