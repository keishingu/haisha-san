'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Member } from '@/lib/types';
import { getSampleMembers, getSampleDestination } from '@/lib/planner/sampleData';
import { validateInputs, ValidationResult } from '@/lib/planner/validation';
import { buildPlan } from '@/lib/planner/buildPlan';
import { OptimizationMode, DEFAULT_OPTIMIZATION_MODE, OPTIMIZATION_OPTIONS } from '@/lib/planner/optimization';
import { generateShareText } from '@/lib/share-url/shareText';
import { getApiStatus } from '@/lib/google-maps/client';
import { buildAddressBookCsv, parseAddressBookCsv, AddressBookParseError } from '@/lib/io/addressBook';
import { usePlan } from './PlanProvider';
import AutocompleteInput from '@/components/AutocompleteInput';

export default function HomePage() {
  const router = useRouter();
  const { members, setMembers, destination, setDestination, setPlan } = usePlan();
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [mode, setMode] = useState<'live' | 'sample' | 'unknown'>('unknown');
  const [optimizationMode, setOptimizationMode] = useState<OptimizationMode>(DEFAULT_OPTIMIZATION_MODE);
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

  // 住所録（メンバーの氏名・住所）をユーザー自身の端末上にCSVファイルとして書き出す。サーバーには送信しない。
  // 目的地は住所録に含めない。
  const handleExport = () => {
    const data = buildAddressBookCsv(members);
    // Excel等で文字化けしないようUTF-8 BOMを付与する。
    const blob = new Blob(['﻿', data], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `haisha-san-住所録-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (file: File) => {
    setImportError(null);
    // 住所録（メンバー一覧）のみ上書きする。目的地は変更しない。
    if (members.length > 0 && !window.confirm('現在のメンバー一覧を読み込んだCSVで上書きします。よろしいですか？')) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const importedMembers = parseAddressBookCsv(String(reader.result));
        setMembers(importedMembers);
        setCalcError(null);
        setValidationResult(null);
      } catch (e) {
        setImportError(e instanceof AddressBookParseError ? e.message : 'ファイルの読み込みに失敗しました。');
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
      const { result, resolvedMembers, destinationLocation } = await buildPlan(members, destination, optimizationMode);
      setPlan({
        planResult: result,
        // 氏名のみを結果表示用に保持。住所/緯度経度・指定集合場所の住所/座標は保持しない。
        // （集合地点は planResult 側に必要な分だけ含まれる。）
        resultMembers: resolvedMembers.map((m) => ({
          ...m,
          addressInput: '',
          location: undefined,
          meetingPointInput: undefined,
          meetingPointLocation: undefined,
        })),
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
        <h1 className="text-2xl font-bold text-gray-800 mb-6">配車プランナー</h1>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 text-sm">
            住所・氏名・目的地は保存しません（ブラウザ内だけで処理）。住所は検索・所要時間の計算のためGoogle Maps Platformへ送信されます。CSV書き出しはお使いの端末に保存され、サーバーには送信されません。
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
            CSVに書き出す
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
          >
            CSVから読み込む
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
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
          <h2 className="text-lg font-semibold text-gray-700 mb-4">メンバー</h2>

          {members.map((member, index) => (
            <div key={member.id} className="border border-gray-200 rounded p-3 mb-3 last:mb-0">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-gray-700">メンバー{index + 1}</span>
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
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">同乗グループ:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={member.groupId || ''}
                    onChange={(e) => updateMember(member.id, { groupId: e.target.value.trim() || undefined })}
                    placeholder="番号"
                    className="w-16 p-1 border border-gray-300 rounded text-center"
                  />
                  <span className="text-sm text-gray-500">同じ番号は同じ車</span>
                </div>
              </div>
              {member.isDriver && (
                <div className="mt-2">
                  <label className="block text-sm text-gray-700 mb-1">
                    指定集合場所（任意・自宅と別の集合場所を指定する場合）
                  </label>
                  <AutocompleteInput
                    value={member.meetingPointInput || ''}
                    onChange={(val) =>
                      updateMember(member.id, {
                        meetingPointInput: val || undefined,
                        meetingPointLocation: undefined,
                      })
                    }
                    onPlaceSelect={(location, addr) =>
                      updateMember(member.id, { meetingPointInput: addr, meetingPointLocation: location })
                    }
                    placeholder="例: 新宿駅西口"
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>
              )}
            </div>
          ))}

          {members.length === 0 && <p className="text-gray-500 text-center py-4">メンバーを追加してください</p>}

          <button
            onClick={addMember}
            className="mt-3 w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
          >
            メンバー追加
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">最適化の方針</h2>
          <div className="flex flex-col gap-2">
            {OPTIMIZATION_OPTIONS.map((opt) => (
              <label
                key={opt.mode}
                className={`flex items-start gap-2 p-2 rounded border cursor-pointer ${
                  optimizationMode === opt.mode ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name="optimizationMode"
                  value={opt.mode}
                  checked={optimizationMode === opt.mode}
                  onChange={() => setOptimizationMode(opt.mode)}
                  className="mt-1"
                />
                <span>
                  <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                  <span className="block text-xs text-gray-500">{opt.description}</span>
                </span>
              </label>
            ))}
          </div>
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
