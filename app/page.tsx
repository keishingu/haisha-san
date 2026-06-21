'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Member } from '@/lib/types';
import { getSampleMembers, getSampleDestination } from '@/lib/planner/sampleData';
import { validateInputs, ValidationResult } from '@/lib/planner/validation';
import { buildPlan } from '@/lib/planner/buildPlan';
import { generateShareText } from '@/lib/share-url/shareText';
import { getApiStatus } from '@/lib/google-maps/client';
import { buildPlanFile, parsePlanFile, serializePlanFile, PlanFileParseError } from '@/lib/io/planFile';
import { usePlan } from './PlanProvider';
import AutocompleteInput from '@/components/AutocompleteInput';

export default function HomePage() {
  const router = useRouter();
  const { members, setMembers, destination, setDestination, setPlan } = usePlan();
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [mode, setMode] = useState<'live' | 'sample' | 'unknown'>('unknown');
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    // 入力済みのときは誤クリックでの消失を防ぐため確認する。
    const hasInput = destination.addressInput.trim() !== '' || members.length > 0;
    if (hasInput && !window.confirm('現在の入力内容をサンプルデータで上書きします。よろしいですか？')) {
      return;
    }
    setMembers(getSampleMembers());
    setDestination(getSampleDestination());
    setCalcError(null);
    setValidationResult(null);
  };

  // 入力内容（住所含む）をユーザー自身の端末上にJSONファイルとして書き出す。サーバーには送信しない。
  const handleExport = () => {
    const data = serializePlanFile(buildPlanFile(members, destination));
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `haisha-san-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (file: File) => {
    setImportError(null);
    const hasInput = destination.addressInput.trim() !== '' || members.length > 0;
    if (hasInput && !window.confirm('現在の入力内容を読み込んだファイルで上書きします。よろしいですか？')) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = parsePlanFile(String(reader.result));
        setMembers(data.members);
        setDestination(data.destination);
        setCalcError(null);
        setValidationResult(null);
      } catch (e) {
        setImportError(e instanceof PlanFileParseError ? e.message : 'ファイルの読み込みに失敗しました。');
      }
    };
    reader.onerror = () => setImportError('ファイルの読み込みに失敗しました。');
    reader.readAsText(file);
  };

  const handleCalculate = async () => {
    setCalcError(null);
    const validation = validateInputs(members, destination);
    setValidationResult(validation);
    if (!validation.isValid) return;

    setCalculating(true);
    try {
      const { result, resolvedMembers, destinationLocation } = await buildPlan(members, destination);
      setPlan({
        planResult: result,
        // 氏名のみを結果表示用に保持。住所/緯度経度は保持しない。
        resultMembers: resolvedMembers.map((m) => ({ ...m, addressInput: '', location: undefined })),
        destinationLabel: destination.addressInput,
        destinationLocation,
        shareText: generateShareText(resolvedMembers, destination.addressInput, result),
      });
      router.push('/result');
    } catch (e) {
      setCalcError(e instanceof Error ? e.message : '計算中にエラーが発生しました。');
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">配車さん</h1>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 text-sm">
            入力内容（住所・氏名・目的地）はこのブラウザ画面内でのみ使用され、保存されません。
            住所は候補検索と移動時間計算のため、配車さんのAPIを経由してGoogle Maps Platformへ送信されます。配車さんは住所を保存しません。
            「ファイルに書き出す」を使うと入力内容をお使いの端末上にファイルとして保存できます（配車さんのサーバーには送信されません）。ファイルの保管は自己責任で行ってください。
          </p>
          {mode === 'sample' && (
            <p className="text-amber-700 text-sm mt-2 font-medium">
              ※ サンプルモードで動作中です（サーバー用APIキー未設定）。サンプルデータの住所辞書で割り当てロジックを確認できます。
            </p>
          )}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={loadSampleData} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm">
            サンプルデータを読み込む
          </button>
          <button onClick={handleExport} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm">
            ファイルに書き出す
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
          >
            ファイルから読み込む
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = '';
            }}
          />
        </div>

        {importError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-red-800 text-sm">{importError}</p>
          </div>
        )}

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
