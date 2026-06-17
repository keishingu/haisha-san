import { useState } from 'react';
import { Member, Destination, PlanResult, SharePlanPayload, LatLng } from './types';
import { getSampleMembers, getSampleDestination } from './utils/sampleData';
import { validateInputs } from './utils/validation';
import { calculateAssignment } from './utils/assignment';
import { buildShareUrl, parseSharePayload } from './utils/shareUrl';
import { generateShareText } from './utils/shareText';
import { isApiKeyConfigured, geocodeAddress, searchMeetingCandidates } from './utils/googleMapsApi';
import AutocompleteInput from './components/AutocompleteInput';
import './index.css';

type Page = 'input' | 'result' | 'share';

function App() {
  const isSharePage = window.location.pathname === '/s' && window.location.hash;
  const initialSharePayload = isSharePage ? parseSharePayload() : null;

  const [page, setPage] = useState<Page>(initialSharePayload ? 'share' : 'input');
  const [members, setMembers] = useState<Member[]>([]);
  const [destination, setDestination] = useState<Destination>({ addressInput: '' });
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [validationResult, setValidationResult] = useState<ReturnType<typeof validateInputs> | null>(null);
  const [sharePayload, setSharePayload] = useState<SharePlanPayload | null>(initialSharePayload);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareText, setShareText] = useState<string>('');
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  const updateMember = (id: string, patch: Partial<Member>) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  };

  const removeMember = (id: string) => {
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  const loadSampleData = () => {
    setMembers(getSampleMembers());
    setDestination(getSampleDestination());
  };

  const handleCalculate = async () => {
    setCalcError(null);
    const validation = validateInputs(members, destination);
    setValidationResult(validation);
    if (!validation.isValid) return;

    if (!isApiKeyConfigured()) {
      setCalcError('Google Maps APIキーが設定されていません。\n.env に VITE_GOOGLE_MAPS_API_KEY を設定してください。');
      return;
    }

    setCalculating(true);
    try {
      // 目的地のジオコーディング（autocompleteで既に取得済みならスキップ可能）
      let destLocation: LatLng;
      if (destination.location) {
        destLocation = destination.location;
      } else {
        const destResult = await geocodeAddress(destination.addressInput);
        destLocation = destResult.location;
      }

      // メンバーのジオコーディング
      const memberLocations = new Map<string, LatLng>();
      const geocodeErrors: string[] = [];
      for (const m of members) {
        if (m.location) {
          memberLocations.set(m.id, m.location);
        } else {
          try {
            const result = await geocodeAddress(m.addressInput);
            memberLocations.set(m.id, result.location);
          } catch (e) {
            geocodeErrors.push(e instanceof Error ? e.message : `${m.name}の住所を特定できませんでした。`);
          }
        }
      }
      if (geocodeErrors.length > 0) {
        setCalcError(geocodeErrors.join('\n'));
        setCalculating(false);
        return;
      }

      // 集合地点候補の検索
      const nonDriverLocs = members.filter(m => !m.isDriver && memberLocations.has(m.id)).map(m => memberLocations.get(m.id)!);
      const searchCenter = nonDriverLocs.length > 0
        ? { lat: nonDriverLocs.reduce((s, p) => s + p.lat, 0) / nonDriverLocs.length, lng: nonDriverLocs.reduce((s, p) => s + p.lng, 0) / nonDriverLocs.length }
        : destLocation;

      const meetingCandidates = await searchMeetingCandidates(searchCenter);
      if (meetingCandidates.length === 0) {
        setCalcError('集合地点候補が見つかりませんでした。メンバーの住所を確認してください。');
        setCalculating(false);
        return;
      }

      const membersWithLocations = members.map(m => ({
        ...m,
        location: memberLocations.get(m.id)!,
      }));

      const result = await calculateAssignment(membersWithLocations, destLocation, meetingCandidates, true);
      setPlanResult(result);
      setShareText(generateShareText(membersWithLocations, destination.addressInput, result));
      setPage('result');
    } catch (e) {
      setCalcError(e instanceof Error ? e.message : '計算中にエラーが発生しました。');
    } finally {
      setCalculating(false);
    }
  };

  const handleGenerateShareUrl = () => {
    if (!planResult) return;

    const payload: SharePlanPayload = {
      title: '配車さん - 配車計画',
      destinationLabel: destination.addressInput,
      vehiclePlans: planResult.vehiclePlans.map(vp => {
        const driver = members.find(m => m.id === vp.driverId);
        const passengers = vp.passengerIds.map(pid => members.find(m => m.id === pid));
        return {
          driverName: driver?.name || '不明',
          passengerNames: passengers.map(p => p?.name || '不明'),
          meetingPointName: vp.meetingPoint.name,
          meetingPointMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${vp.meetingPoint.location.lat},${vp.meetingPoint.location.lng}`,
          destinationMapsUrl: vp.googleMapsUrl,
          driveDurationText: `${vp.driveDurationMinutes}分`,
        };
      }),
      transitOnlyPlans: planResult.transitOnlyPlans.map(top => {
        const member = members.find(m => m.id === top.memberId);
        return {
          memberName: member?.name || '不明',
          destinationMapsUrl: top.destinationMapsUrl,
          reasonText: top.reason === 'seat_shortage' ? '席不足' : '車なし',
        };
      }),
      createdAt: new Date().toISOString(),
    };

    const result = buildShareUrl(payload);
    setSharePayload(payload);
    setShareUrl(result.shareUrl);
    setShowShareModal(true);
  };

  const handleCopyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    alert('共有URLをコピーしました');
  };

  const handleBackToInput = () => {
    setPage('input');
    setPlanResult(null);
    setValidationResult(null);
    setCalcError(null);
  };

  if (page === 'share' && sharePayload) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">{sharePayload.title}</h1>
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">目的地</h2>
            <p className="text-gray-600">{sharePayload.destinationLabel}</p>
          </div>

          {sharePayload.vehiclePlans.map((vp, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md p-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">車{index + 1}: {vp.driverName}さんの車</h3>
              <div className="mb-2"><span className="font-medium">乗車:</span> {[vp.driverName, ...vp.passengerNames].join(', ')}</div>
              <div className="mb-2"><span className="font-medium">集合地点:</span> {vp.meetingPointName}</div>
              <div className="mb-2"><span className="font-medium">移動時間:</span> {vp.driveDurationText}</div>
              <div className="flex flex-wrap gap-2">
                <a href={vp.meetingPointMapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline text-sm">集合地点をGoogle Mapsで開く</a>
                <a href={vp.destinationMapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline text-sm">目的地へのルートを開く</a>
              </div>
            </div>
          ))}

          {sharePayload.transitOnlyPlans.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">公共交通で目的地へ向かうメンバー</h3>
              {sharePayload.transitOnlyPlans.map((top, index) => (
                <div key={index} className="mb-2 last:mb-0">
                  <div className="font-medium">{top.memberName}</div>
                  <div className="text-sm text-gray-500">理由: {top.reasonText}</div>
                  <a href={top.destinationMapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline text-sm">目的地をGoogle Mapsで開く</a>
                </div>
              ))}
            </div>
          )}

          {sharePayload.notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">メモ</h3>
              <p className="text-yellow-700">{sharePayload.notes}</p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">※ このページは閲覧専用です。入力や再計算はできません。</p>
          </div>
        </div>
      </div>
    );
  }

  if (page === 'result' && planResult) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">配車結果</h1>
            <button onClick={handleBackToInput} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">入力に戻る</button>
          </div>

          {planResult.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">注意事項</h3>
              <ul className="list-disc list-inside text-yellow-700">
                {planResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {planResult.vehiclePlans.map((vp, index) => {
            const driver = members.find(m => m.id === vp.driverId);
            const passengers = vp.passengerIds.map(pid => members.find(m => m.id === pid));
            return (
              <div key={index} className="bg-white rounded-lg shadow-md p-4 mb-4">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">車{index + 1}: {driver?.name}さんの車</h3>
                <div className="mb-2"><span className="font-medium">乗車:</span> {[driver?.name, ...passengers.map(p => p?.name)].join(', ')}</div>
                <div className="mb-2"><span className="font-medium">集合地点:</span> {vp.meetingPoint.name}</div>
                <div className="mb-2"><span className="font-medium">移動時間:</span> 約{vp.driveDurationMinutes}分</div>
                <div className="mb-2"><span className="font-medium">遠回り時間:</span> +{vp.driverDetourMinutes}分</div>
                <div className="mb-2">
                  <span className="font-medium">車なしメンバーの集合:</span>
                  <ul className="ml-4 mt-1">
                    {vp.passengerAccess.map(pa => {
                      const member = members.find(m => m.id === pa.memberId);
                      return <li key={pa.memberId} className="text-sm text-gray-600">{member?.name}: 公共交通機関で{vp.meetingPoint.name}へ（約{pa.durationMinutes}分）</li>;
                    })}
                  </ul>
                </div>
                <a href={vp.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Google Mapsでルートを開く</a>
              </div>
            );
          })}

          {planResult.transitOnlyPlans.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-4 mb-4">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">公共交通で目的地へ向かうメンバー</h3>
              {planResult.transitOnlyPlans.map((top, index) => {
                const member = members.find(m => m.id === top.memberId);
                return (
                  <div key={index} className="mb-2 last:mb-0">
                    <div className="font-medium">{member?.name}</div>
                    <div className="text-sm text-gray-500">理由: {top.reason === 'seat_shortage' ? '席不足' : '車なし'}</div>
                    <a href={top.destinationMapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline text-sm">目的地をGoogle Mapsで開く</a>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">共有テキスト</h3>
            <textarea value={shareText} readOnly rows={10} className="w-full p-2 border border-gray-300 rounded bg-gray-50 text-sm font-mono" />
            <button onClick={() => { navigator.clipboard.writeText(shareText); alert('共有テキストをコピーしました'); }} className="mt-2 px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm">テキストをコピー</button>
          </div>

          <div className="flex gap-2">
            <button onClick={handleGenerateShareUrl} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">共有URLを発行</button>
          </div>

          {showShareModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-bold mb-4">共有URLの内容確認</h3>
                <div className="mb-4">
                  <h4 className="font-semibold text-green-700 mb-2">含まれる情報:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600">
                    <li>目的地の表示名</li><li>ドライバー名</li><li>同乗者名</li><li>集合地点名</li><li>Google Mapsリンク</li>
                  </ul>
                </div>
                <div className="mb-4">
                  <h4 className="font-semibold text-red-700 mb-2">含まれない情報:</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600">
                    <li>出発地住所</li><li>自宅緯度経度</li><li>住所検索の詳細結果</li><li>公共交通の詳細経路</li>
                  </ul>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">共有URL:</label>
                  <div className="flex gap-2">
                    <input type="text" value={shareUrl} readOnly className="flex-1 p-2 border border-gray-300 rounded text-sm bg-gray-50" />
                    <button onClick={handleCopyShareUrl} className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm">コピー</button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setShowShareModal(false)} className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">閉じる</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">配車さん</h1>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 text-sm">
            入力内容はこのブラウザ画面内でのみ使用され、保存されません。
            住所は候補検索と移動時間計算のためGoogle Maps Platformへ送信されます。
          </p>
          {!isApiKeyConfigured() && (
            <p className="text-red-700 text-sm mt-2 font-medium">
              ※ Google Maps APIキーが未設定です。計算を実行するには .env に VITE_GOOGLE_MAPS_API_KEY を設定してください。
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
            <button
              onClick={() => setMembers([...members, { id: Date.now().toString(), name: '', addressInput: '', isDriver: false }])}
              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              メンバー追加
            </button>
          </div>

          {members.map((member) => (
            <div key={member.id} className="border border-gray-200 rounded p-3 mb-3 last:mb-0">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-gray-700">メンバー</span>
                <button onClick={() => removeMember(member.id)} className="text-red-600 hover:text-red-800 text-sm">削除</button>
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
                  onChange={(val) => updateMember(member.id, { addressInput: val })}
                  onPlaceSelect={(location, addr) => updateMember(member.id, { addressInput: addr, location })}
                  placeholder="例: 東京都新宿区西新宿1丁目"
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
          <button onClick={loadSampleData} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm">サンプルデータを読み込む</button>
        </div>

        {validationResult && (
          <div className="mb-4">
            {validationResult.errors.map((e, i) => <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2"><p className="text-red-800 text-sm">{e}</p></div>)}
            {validationResult.warnings.map((w, i) => <div key={i} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-2"><p className="text-yellow-800 text-sm">{w}</p></div>)}
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

export default App;
