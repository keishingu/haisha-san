import { CairnError, PAT_REISSUE_GUIDE, cairnErrorMessage } from '@/lib/cairn/errors';

/** Cairn から取得できなかったときの表示。空の一覧などで代替しない */
export function CairnErrorBox({ error, subject }: { error: CairnError; subject?: string }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <p className="font-bold">{cairnErrorMessage(error, subject)}</p>
      <p className="mt-1 break-all">{error.message}</p>
      {error.needsPatReissue && <p className="mt-2">{PAT_REISSUE_GUIDE}</p>}
    </div>
  );
}

/** Cairn の呼び出しを包み、CairnError だけを値として返す（それ以外は投げ直す） */
export async function tryCairn<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: CairnError }> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    if (error instanceof CairnError) return { ok: false, error };
    throw error;
  }
}
