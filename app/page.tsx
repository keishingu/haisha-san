'use client';

import { useState, useEffect } from 'react';
import { Member, Destination, PlanResult, SharePlanPayload } from '@/lib/types';
import { getSampleMembers, getSampleDestination } from '@/lib/planner/sampleData';
import { validateInputs, ValidationResult } from '@/lib/planner/validation';
import { buildPlan } from '@/lib/planner/buildPlan';
import { buildShareUrl } from '@/lib/share-url/shareUrl';
import { buildSharePayload } from '@/lib/share-url/payload';
import { generateShareText } from '@/lib/share-url/shareText';
import { getApiStatus } from '@/lib/google-maps/client';
import AutocompleteInput from '@/components/AutocompleteInput';

type Page = 'input' | 'result';

export default function HomePage() {
  const [page, setPage] = useState<Page>('input');
  const [members, setMembers] = useState<Member[]>([]);
  const [destination, setDestination] = useState<Destination>({ addressInput: '' });
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  // 結果表示専用に氏名を保持する（解決済み住所は保持しない）
  const [resultMembers, setResultMembers] = useState<Member[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [shareWarning, setShareWarning] = useState<string | undefined>(undefined);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareText, setShareText] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [mode, setMode] = useState<'live' | 'sample' | 'unknown'>('unknown');

  useEffect(() => {
    getApiStatus().then(({ live }) => setMode(live ? 'live' : 'sample'));
  }, []);

  const updateMember = (id: string, patch: Partial<Member>) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const removeMember = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const addMember = () => {
    setMembers((prev) => [
      ...prev,
      { id: Date.now().toString(), name: '', addressInput: '', isDriver: false },
    ]);
  };

  const loadSampleData = () => {
    setMembers(getSampleMembers());
    setDestination(getSampleDestination());
    setCalcError(null);
    setValidationResult(null);
  };

  const handleCalculate = async () => {
    setCalcError(null);
    const validation = validateInputs(members, destination);
    setValidationResult(validation);
    if (!validation.isValid) return;

    setCalculating(true);
    try {
      const { result, resolvedMembers } = await buildPlan(members, destination);
      setPlanResult(result);
      // 氏名のみを結果表示用に保持。住所/緯度経度は保持しない。
      setResultMembers(resolvedMembers.map((m) => ({ ...m, addressInput: '', location: undefined })));
      setShareText(generateShareText(resolvedMembers, destination.addressInput, result));
      setShareUrl('');
      setNotes('');
      setPage('result');
    } catch (e) {
      setCalcError(e instanceof Error ? e.message : '計算中にエラーが発生しました。');
    } finally {
      setCalculating(false);
    }
  };

  const handleGenerateShareUrl = () => {
    if (!planResult) return;
    const payload: SharePlanPayload = buildSharePayload(
      resultMembers,
      destination.addressInput,
      planResult,
      notes
    );
    const created = buildShareUrl(payload);
    setShareUrl(created.shareUrl);
    setShareWarning(created.warning);
    setShowShareModal(true);
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(`${label}をコピーしました`);
    } catch {
      alert('コピーに失敗しました。手動で選択してコピーしてください。');
    }
  };

  const handleBackToInput = () => {
    setPage('input');
    setPlanResult(null);
    setValidationResult(null);
    setCalcError(null);
    setShowShareModal(false);
    setShareUrl('');
  };

  // ───────────── 結果画面 ─────────────
  if (page === 'result' && planResult) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">配車結果</h1>
            <button onClick={handleBackToInput} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
              入力に戻る
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <span className="font-medium">目的地:</span> {destination.addressInput}
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
                  <span className="font-medium">乗車:</span> {[driver?.name, ...passengers.map((p) => p?.name)].join(', ')}
                </div>
                <div className="mb-2">
                  <span className="font-medium">集合地点:</span> {vp.meetingPoint.name}
                </div>
                <div className="mb-2">
                  <span className="font-medium">移動時間:</span> 約{vp.driveDurationMinutes}分
                </div>
                <div className="mb-2">
                  <span className="font-medium">遠回り時間:</span> +{vp.driverDetourMinutes}分
                </div>
                {vp.passengerAccess.length > 0 && (
                  <div className="mb-2">
                    <span className="font-medium">車なしメンバーの集合:</span>
                    <ul className="ml-4 mt-1">
                      {vp.passengerAccess.map((pa) => {
                        const member = resultMembers.find((m) => m.id === pa.memberId);
                        return (
                          <li key={pa.memberId} className="text-sm text-gray-600">
                            {member?.name}: 公共交通機関で{vp.meetingPoint.name}へ（約{pa.durationMinutes}分）
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
                  集合地点→目的地のルートをGoogle Mapsで開く
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
                    <div className="font-medium">{member?.name}</div>
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
                  ※ URLを知っている人は閲覧できます。短縮URLサービスを使う場合、共有データはそのサービスにも渡ります。
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

  // ───────────── 入力画面 ─────────────
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">配車さん</h1>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 text-sm">
            入力内容（住所・氏名・目的地）はこのブラウザ画面内でのみ使用され、保存されません。
            住所は候補検索と移動時間計算のため、配車さんのAPIを経由してGoogle Maps Platformへ送信されます。配車さんは住所を保存しません。
          </p>
          {mode === 'sample' && (
            <p className="text-amber-700 text-sm mt-2 font-medium">
              ※ サンプルモードで動作中です（サーバー用APIキー未設定）。サンプルデータの住所辞書で割り当てロジックを確認できます。
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">目的地</h2>
          <AutocompleteInput
            value={destination.addressInput}
            onChange={(val) => setDestination({ addressInput: val, location: undefined })}
            onPlaceSelect={(location, addr) => setDestination({ addressInput: addr, location })}
            placeholder="例: 河口湖キャンプ場"
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-700">メンバー</h2>
            <button onClick={addMember} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm">
              メンバー追加
            </button>
          </div>

          {members.map((member) => (
            <div key={member.id} className="border border-gray-200 rounded p-3 mb-3 last:mb-0">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-gray-700">メンバー</span>
                <button onClick={() => removeMember(member.id)} className="text-red-600 hover:text-red-800 text-sm">
                  削除
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={member.name}
                  onChange={(e) => updateMember(member.id, { name: e.target.value })}
                  placeholder="名前"
                  className="p-2 border border-gray-300 rounded"
                />
                <AutocompleteInput
                  value={member.addressInput}
                  onChange={(val) => updateMember(member.id, { addressInput: val, location: undefined })}
                  onPlaceSelect={(location, addr) => updateMember(member.id, { addressInput: addr, location })}
                  placeholder="例: 東京都新宿区"
                  className="p-2 border border-gray-300 rounded"
                />
              </div>
              <div className="mt-2 flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={member.isDriver}
                    onChange={(e) => updateMember(member.id, { isDriver: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">車あり</span>
                </label>
                {member.isDriver && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">定員:</span>
                    <input
                      type="number"
                      min="1"
                      value={member.vehicleCapacity || ''}
                      onChange={(e) => updateMember(member.id, { vehicleCapacity: parseInt(e.target.value) || undefined })}
                      className="w-16 p-1 border border-gray-300 rounded text-center"
                    />
                    <span className="text-sm text-gray-500">人（含むドライバー）</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {members.length === 0 && <p className="text-gray-500 text-center py-4">メンバーを追加してください</p>}
        </div>

        <div className="mb-4">
          <button onClick={loadSampleData} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm">
            サンプルデータを読み込む
          </button>
        </div>

        {validationResult && (
          <div className="mb-4">
            {validationResult.errors.map((e, i) => (
              <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
                <p className="text-red-800 text-sm">{e}</p>
              </div>
            ))}
            {validationResult.warnings.map((w, i) => (
              <div key={i} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-2">
                <p className="text-yellow-800 text-sm">{w}</p>
              </div>
            ))}
          </div>
        )}

        {calcError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-red-800 text-sm whitespace-pre-line">{calcError}</p>
          </div>
        )}

        <button
          onClick={handleCalculate}
          disabled={calculating}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:bg-blue-400 disabled:cursor-not-allowed"
        >
          {calculating ? '計算中...' : '計算する'}
        </button>
      </div>
    </div>
  );
}
