import { NextRequest, NextResponse } from 'next/server';
import { decodeSharePayload } from '@/lib/share-url/shareUrl';
import { generateShortCode, redisKeyForCode } from '@/lib/short-link/shortLink';
import { SHORT_LINK_TTL_SECONDS, SHORT_LINK_TTL_DAYS } from '@/lib/short-link/constants';
import { isShortLinkConfigured, redisSetWithTtl } from '@/lib/short-link/redis';

// 共有URL(/s#...)のフラグメントを期限付き(30日)で自社Redisに保存し、短いコードを発行する。
// 外部の短縮URLサービスにはデータを渡さない。期限切れ後はコードを解決できなくなる。
export async function POST(req: NextRequest) {
  if (!isShortLinkConfigured()) {
    return NextResponse.json(
      { error: '短縮URL機能が設定されていません（UPSTASH_REDIS_REST_URL / TOKEN 未設定）。', code: 'NOT_CONFIGURED' },
      { status: 503 }
    );
  }

  let body: { hash?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です。' }, { status: 400 });
  }

  const { hash } = body;
  if (!hash || typeof hash !== 'string') {
    return NextResponse.json({ error: 'hash が必要です。' }, { status: 400 });
  }

  // 壊れたデータや任意文字列の保存を防ぐため、共有ペイロードとして復元できることを検証する。
  if (!decodeSharePayload(hash)) {
    return NextResponse.json({ error: '共有データの形式が不正です。' }, { status: 400 });
  }

  const code = generateShortCode();
  await redisSetWithTtl(redisKeyForCode(code), hash, SHORT_LINK_TTL_SECONDS);

  return NextResponse.json({
    code,
    shortUrl: `${req.nextUrl.origin}/x/${code}`,
    ttlDays: SHORT_LINK_TTL_DAYS,
  });
}
