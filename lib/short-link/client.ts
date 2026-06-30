export type CreatedShortLink = {
  shortUrl: string;
  ttlDays: number;
};

// 共有URL(/s#...)から期限付き短縮URLを発行するクライアントヘルパー。
export async function createShortLink(shareUrl: string): Promise<CreatedShortLink> {
  const hash = shareUrl.split('#')[1] ?? '';
  const res = await fetch('/api/short-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hash }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? '短縮URLの作成に失敗しました。');
  }
  return { shortUrl: data.shortUrl as string, ttlDays: data.ttlDays as number };
}
