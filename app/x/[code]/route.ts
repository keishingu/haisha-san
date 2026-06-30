import { NextRequest, NextResponse } from 'next/server';
import { redisGet } from '@/lib/short-link/redis';
import { redisKeyForCode } from '@/lib/short-link/shortLink';

// 短縮コード→共有URLフラグメントへのリダイレクト。期限切れ/未知のコードは共有ページのエラー表示に倒す。
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  let hash: string | null = null;
  try {
    hash = await redisGet(redisKeyForCode(code));
  } catch {
    hash = null;
  }

  if (!hash) {
    return NextResponse.redirect(new URL('/s', req.url));
  }

  return NextResponse.redirect(new URL(`/s#${hash}`, req.url));
}
