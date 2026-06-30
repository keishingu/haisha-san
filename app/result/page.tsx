'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SharePlanPayload } from '@/lib/types';
import { buildShareUrl } from '@/lib/share-url/shareUrl';
import { buildSharePayload } from '@/lib/share-url/payload';
import { createShortLink } from '@/lib/short-link/client';
import { SHORT_LINK_TTL_DAYS } from '@/lib/short-link/constants';
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

export default function ResultPage() {
  const router = useRouter();
  const { plan } = usePlan();

  const [shareUrl, setShareUrl] = useState<string>('');
  const [shareWarning, setShareWarning] = useState<string | undefined>(undefined);
  const [showShareModal, setShowShareModal] = useState(false);
  const [notes, setNotes] = useState<string>('');
  const [shortUrl, setShortUrl] = useState<string>('');
  const [shortUrlTtlDays, setShortUrlTtlDays] = useState<number | undefined>(undefined);
  const [isShortening, setIsShortening] = useState(false);
  const [shortenError, setShortenError] = useState<string | undefined>(undefined);

  // 直接アクセス/リロードで結果が無い場合は入力画面へ戻す（結果はメモリ保持のため）。
  useEffect(() => {
    if (!plan) router.replace('/');
  }, [plan, router]);

  if (!plan) return null;

  const { planResult, resultMembers, destinationLabel, destinationLocation, shareText } = plan;

  const handleGenerateShareUrl = () => {
    const payload: SharePlanPayload = buildSharePayload(resultMembers, destinationLabel, planResult, destinationLocation, notes);
    const created = buildShareUrl(payload);
    setShareUrl(created.shareUrl);
    setShareWarning(created.warning);
    setShortUrl('');
    setShortUrlTtlDays(undefined);
    setShortenError(undefined);
    setShowShareModal(true);
  };

  const handleShortenUrl = async () => {
    setIsShortening(true);
    setShortenError(undefined);
    try {
      const result = await createShortLink(shareUrl);
      setShortUrl(result.shortUrl);
      setShortUrlTtlDays(result.ttlDays);
    } catch (e) {
      setShortenError(e instanceof Error ? e.message : '短縮URLの作成に失敗しました。');
    } finally {
      setIsShortening(false);
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-800">配車結果</h1>
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
          <h3 className="text-lg font-semibold text-gray-700 mb-2">幹事メモ（任意・共有URLに含まれます）</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="例: 到着時間を揃えるため、車1は10分遅く出発でOK"
            className="w-full p-2 border border-gray-300 rounded text-sm"
          />
        </div>

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

        <div className="flex gap-2">
          <button onClick={handleGenerateShareUrl} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            共有URLを発行
          </button>
        </div>

        {showShareModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4">共有URLの内容確認</h3>
              <div className="mb-4">
                <h4 className="font-semibold text-green-700 mb-2">含まれる情報:</h4>
                <ul className="list-disc list-inside text-sm text-gray-600">
                  <li>目的地の表示名</li>
                  <li>ドライバー名</li>
                  <li>同乗者名</li>
                  <li>集合地点名</li>
                  <li>Google Mapsリンク</li>
                  <li>幹事メモ</li>
                </ul>
              </div>
              <div className="mb-4">
                <h4 className="font-semibold text-red-700 mb-2">含まれない情報:</h4>
                <ul className="list-disc list-inside text-sm text-gray-600">
                  <li>出発地住所</li>
                  <li>自宅緯度経度</li>
                  <li>住所検索の詳細結果</li>
                  <li>公共交通の詳細経路</li>
                </ul>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                ※ URLを知っている人は閲覧できます。共有URL自体に有効期限はありません。
              </p>
              {shareWarning && <p className="text-sm text-orange-700 mb-3">{shareWarning}</p>}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">共有URL:</label>
                <div className="flex gap-2">
                  <input type="text" value={shareUrl} readOnly className="flex-1 p-2 border border-gray-300 rounded text-sm bg-gray-50" />
                  <button onClick={() => handleCopy(shareUrl, '共有URL')} className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm">
                    コピー
                  </button>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">短縮URL（{SHORT_LINK_TTL_DAYS}日で自動失効）:</label>
                <p className="text-xs text-gray-500 mb-1">
                  ※ TinyURLのような外部の短縮URLサービスは使いません。共有データはこのアプリが管理するRedis（Upstash）に{SHORT_LINK_TTL_DAYS}日間だけ一時保存され、期限が切れるとリンクは無効になります。
                </p>
                {shortUrl ? (
                  <div className="flex gap-2">
                    <input type="text" value={shortUrl} readOnly className="flex-1 p-2 border border-gray-300 rounded text-sm bg-gray-50" />
                    <button onClick={() => handleCopy(shortUrl, '短縮URL')} className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm">
                      コピー
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleShortenUrl}
                    disabled={isShortening}
                    className="px-3 py-2 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 text-sm disabled:opacity-50"
                  >
                    {isShortening ? '作成中...' : '短縮URLを作成'}
                  </button>
                )}
                {shortUrlTtlDays !== undefined && (
                  <p className="text-xs text-gray-500 mt-1">この短縮URLは発行から{shortUrlTtlDays}日後に自動的に無効になります。</p>
                )}
                {shortenError && <p className="text-sm text-red-700 mt-1">{shortenError}</p>}
              </div>
              <div className="flex justify-between">
                <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 text-blue-600 underline text-sm self-center">
                  共有ページを開く
                </a>
                <button onClick={() => setShowShareModal(false)} className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
