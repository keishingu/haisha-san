import { NextRequest, NextResponse } from 'next/server';

// 集合地点候補を取得する（Places Nearby Search）。住所/緯度経度/レスポンス詳細はログ出力しない。
export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GOOGLE_MAPS_API_KEY が設定されていません。', code: 'NO_API_KEY' },
      { status: 503 }
    );
  }

  let body: { lat?: unknown; lng?: unknown; radius?: unknown; type?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です。' }, { status: 400 });
  }

  const { lat, lng, radius, type } = body;
  if (typeof lat !== 'number' || typeof lng !== 'number' || typeof radius !== 'number' || typeof type !== 'string') {
    return NextResponse.json({ error: 'lat, lng, radius, type が必要です。' }, { status: 400 });
  }

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${encodeURIComponent(type)}&key=${apiKey}&language=ja`;
  const googleRes = await fetch(url);
  const data = await googleRes.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    return NextResponse.json(
      { error: '集合地点を検索できませんでした。', status: data.status },
      { status: 400 }
    );
  }

  const results = (data.results || []).map((place: { name: string; vicinity?: string; geometry: { location: { lat: number; lng: number } } }) => ({
    name: place.name,
    address: place.vicinity || '',
    location: {
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
    },
  }));

  return NextResponse.json({ results });
}
