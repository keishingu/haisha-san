'use client';

import { useActionState, useState } from 'react';
import { deletePlanAction } from './actions';

/** URL と共有テキストのコピー */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [message, setMessage] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text.startsWith('/') ? `${window.location.origin}${text}` : text);
            setMessage('コピーしました');
          } catch {
            setMessage('コピーできませんでした。手で選んでコピーしてください');
          }
        }}
        className="rounded bg-gray-600 px-3 py-1 text-sm text-white hover:bg-gray-700"
      >
        {label}
      </button>
      {message && <span className="text-xs text-gray-500">{message}</span>}
    </span>
  );
}

export function DeletePlanButton({ planId }: { planId: string }) {
  const [error, action, pending] = useActionState(deletePlanAction, null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm('このプランを消します。元に戻せません。よろしいですか？')) e.preventDefault();
      }}
      className="flex flex-col items-end gap-2"
    >
      <input type="hidden" name="planId" value={planId} />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className="text-sm text-red-600 underline disabled:opacity-50">
        {pending ? '削除中…' : 'このプランを消す'}
      </button>
    </form>
  );
}
