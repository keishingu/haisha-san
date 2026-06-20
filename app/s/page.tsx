'use client';

import { useEffect, useState } from 'react';
import { SharePlanPayload } from '@/lib/types';
import { parseSharePayload } from '@/lib/share-url/shareUrl';

type State =
  | { status: 'loading' }
  | { status: 'ok'; payload: SharePlanPayload }
  | { status: 'error' };

export default function SharePage() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    const restore = () => {
      const payload = parseSharePayload(window.location.hash);
      if (payload && Array.isArray(payload.vehiclePlans) && Array.isArray(payload.transitOnlyPlans)) {
        setState({ status: 'ok', payload });
      } else {
        setState({ status: 'error' });
      }
    };
    restore();
    window.addEventListener('hashchange', restore);
    return () => window.removeEventListener('hashchange', restore);
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-bold text-red-800 mb-2">共有データを読み込めませんでした</h1>
            <p className="text-red-700 text-sm">
              共有URLが壊れているか、対応していない形式の可能性があります。共有元にもう一度URLを発行してもらってください。
            </p>
            <a href="/" className="inline-block mt-4 text-blue-600 underline text-sm">
              配車さんのトップへ
            </a>
          </div>
        </div>
      </div>
    );
  }

  const { payload } = state;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">{payload.title || '配車さん - 配車計画'}</h1>

        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">目的地</h2>
          <p className="text-gray-600">{payload.destinationLabel}</p>
        </div>

        {payload.vehiclePlans.map((vp, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md p-4 mb-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              車{index + 1}: {vp.driverName}さんの車
            </h3>
            <div className="mb-2">
              <span className="font-medium">乗車:</span> {[vp.driverName, ...vp.passengerNames].join(', ')}
            </div>
            <div className="mb-2">
              <span className="font-medium">集合地点:</span>{' '}
              {vp.meetingPointName ?? '同乗者なし（自宅から目的地へ直行）'}
            </div>
            {vp.driveDurationText && (
              <div className="mb-2">
                <span className="font-medium">移動時間:</span> {vp.driveDurationText}
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              {vp.meetingPointMapsUrl && (
                <a href={vp.meetingPointMapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline text-sm">
                  集合地点をGoogle Mapsで開く
                </a>
              )}
              <a href={vp.destinationMapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline text-sm">
                {vp.meetingPointName ? '集合地点→目的地のルートを開く' : '目的地へのルートを開く'}
              </a>
            </div>
          </div>
        ))}

        {payload.transitOnlyPlans.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">公共交通で目的地へ向かうメンバー</h3>
            {payload.transitOnlyPlans.map((top, index) => (
              <div key={index} className="mb-2 last:mb-0">
                <div className="font-medium">{top.memberName}</div>
                <div className="text-sm text-gray-500">理由: {top.reasonText}</div>
                <a href={top.destinationMapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline text-sm">
                  目的地へのルートをGoogle Mapsで開く
                </a>
              </div>
            ))}
          </div>
        )}

        {payload.notes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">幹事メモ</h3>
            <p className="text-yellow-700 whitespace-pre-line">{payload.notes}</p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">
            ※ このページは閲覧専用です。入力や再計算はできません。出発地住所や自宅の位置情報は含まれていません。
          </p>
        </div>
      </div>
    </div>
  );
}
