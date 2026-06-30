// 共有URL(/s#...)をTinyURLで短縮するクライアントヘルパー。サーバー側 /api/shorten-url が検証・中継する。
export async function shortenShareUrl(url: string): Promise<string> {
  const res = await fetch('/api/shorten-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? '短縮URLの作成に失敗しました。');
  }
  return data.shortUrl as string;
}
