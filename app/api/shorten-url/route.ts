import { NextRequest, NextResponse } from 'next/server';

// TinyURL プロキシ。自分自身が発行した共有URL（/s 以下）以外は短縮しない（オープンプロキシ化防止）。
export async function POST(req: NextRequest) {
  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です。' }, { status: 400 });
  }

  const { url } = body;
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url が必要です。' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'URLの形式が不正です。' }, { status: 400 });
  }

  if (parsed.origin !== req.nextUrl.origin || !parsed.pathname.startsWith('/s')) {
    return NextResponse.json({ error: '共有URL以外は短縮できません。' }, { status: 400 });
  }

  let tinyUrlRes: Response;
  try {
    tinyUrlRes = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
  } catch {
    return NextResponse.json({ error: '短縮URLサービスに接続できませんでした。' }, { status: 502 });
  }

  if (!tinyUrlRes.ok) {
    return NextResponse.json({ error: '短縮URLの作成に失敗しました。' }, { status: 502 });
  }

  const shortUrl = (await tinyUrlRes.text()).trim();
  if (!shortUrl.startsWith('https://tinyurl.com/')) {
    return NextResponse.json({ error: '短縮URLの作成に失敗しました。' }, { status: 502 });
  }

  return NextResponse.json({ shortUrl });
}
