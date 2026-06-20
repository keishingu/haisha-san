import { NextRequest, NextResponse } from 'next/server';

// Google Maps Platform プロキシ。住所・氏名・緯度経度・APIレスポンス詳細はログ出力しない。
export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GOOGLE_MAPS_API_KEY が設定されていません。', code: 'NO_API_KEY' },
      { status: 503 }
    );
  }

  let body: { address?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です。' }, { status: 400 });
  }

  const { address } = body;
  if (!address || typeof address !== 'string') {
    return NextResponse.json({ error: 'address が必要です。' }, { status: 400 });
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&language=ja`;
  const googleRes = await fetch(url);
  const data = await googleRes.json();

  if (data.status !== 'OK' || !data.results?.length) {
    return NextResponse.json(
      { error: '住所を特定できませんでした。市区町村や番地を追加してください。', status: data.status },
      { status: 400 }
    );
  }

  const result = data.results[0];
  return NextResponse.json({
    location: {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
    },
    formattedAddress: result.formatted_address,
  });
}
