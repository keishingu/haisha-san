'use client';

import { useActionState } from 'react';
import { importOriginsAction, type ImportState } from './actions';

export function CsvImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importOriginsAction, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <p className="text-xs text-gray-500">
        1行目に「氏名」「住所」（任意で「運転」「定員」）の列を入れてください。氏名は Cairn の表示名と同じにします（空白は無視します）。
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="file" name="file" accept=".csv,text/csv" className="text-sm" />
        <button type="submit" disabled={pending} className="rounded bg-gray-600 px-3 py-1.5 text-sm text-white hover:bg-gray-700 disabled:opacity-50">
          {pending ? '取り込み中…' : 'CSV から取り込む'}
        </button>
      </div>
      {state && (
        <div
          role={state.ok ? 'status' : 'alert'}
          className={`rounded border p-3 text-sm ${state.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}
        >
          {state.messages.map((m, i) => (
            <p key={i}>{m}</p>
          ))}
        </div>
      )}
    </form>
  );
}
