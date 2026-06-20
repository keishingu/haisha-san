import { NextRequest, NextResponse } from 'next/server';

type Coord = { lat: number; lng: number };

// 車移動時間・距離を取得する（Distance Matrix API）。住所/緯度経度/レスポンス詳細はログ出力しない。
export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GOOGLE_MAPS_API_KEY が設定されていません。', code: 'NO_API_KEY' },
      { status: 503 }
    );
  }

  let body: { origins?: unknown; destinations?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です。' }, { status: 400 });
  }

  const { origins, destinations } = body;
  if (!Array.isArray(origins) || !Array.isArray(destinations)) {
    return NextResponse.json({ error: 'origins と destinations が必要です。' }, { status: 400 });
  }

  const originsStr = (origins as Coord[]).map((o) => `${o.lat},${o.lng}`).join('|');
  const destStr = (destinations as Coord[]).map((d) => `${d.lat},${d.lng}`).join('|');

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originsStr}&destinations=${destStr}&key=${apiKey}&language=ja`;
  const googleRes = await fetch(url);
  const data = await googleRes.json();

  if (data.status !== 'OK') {
    return NextResponse.json(
      { error: '移動時間を取得できませんでした。', status: data.status },
      { status: 400 }
    );
  }

  const rows = data.rows.map((row: { elements: { status: string; duration?: { value: number }; distance?: { value: number } }[] }) =>
    row.elements.map((elem) => ({
      durationMinutes: elem.status === 'OK' ? Math.round((elem.duration?.value ?? 0) / 60) : -1,
      distanceMeters: elem.distance?.value ?? 0,
      status: elem.status,
    }))
  );

  return NextResponse.json({ rows });
}
