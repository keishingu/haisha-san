// Upstash Redis REST APIへの薄いラッパー。SDK追加を避け、既存の他APIルートと同じくfetchで直接叩く。
export function isShortLinkConfigured(): boolean {
  return !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
}

async function redisCommand<T>(args: (string | number)[]): Promise<T> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN が設定されていません。');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    throw new Error(`Redisコマンドに失敗しました（status: ${res.status}）`);
  }
  const data = (await res.json()) as { result: T; error?: string };
  if (data.error) {
    throw new Error(`Redisコマンドに失敗しました: ${data.error}`);
  }
  return data.result;
}

export async function redisSetWithTtl(key: string, value: string, ttlSeconds: number): Promise<void> {
  await redisCommand(['SET', key, value, 'EX', ttlSeconds]);
}

export async function redisGet(key: string): Promise<string | null> {
  return redisCommand<string | null>(['GET', key]);
}
