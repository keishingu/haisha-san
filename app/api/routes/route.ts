import { NextRequest, NextResponse } from 'next/server';

type Coord = { lat: number; lng: number };

type RouteMatrixElement = {
  originIndex?: number;
  destinationIndex?: number;
  duration?: string;
  distanceMeters?: number;
  condition?: string;
};

function toWaypoint(c: Coord) {
  return { waypoint: { location: { latLng: { latitude: c.lat, longitude: c.lng } } } };
}

// 車移動時間・距離を取得する（Routes API computeRouteMatrix）。
// Distance Matrix API（レガシー）は2025年以降新規プロジェクトで使用できないため、Routes APIを使う。
// 住所/緯度経度/レスポンス詳細はログ出力しない。
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

  const requestBody = {
    origins: (origins as Coord[]).map(toWaypoint),
    destinations: (destinations as Coord[]).map(toWaypoint),
    travelMode: 'DRIVE',
    languageCode: 'ja',
  };

  const googleRes = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,condition,status',
    },
    body: JSON.stringify(requestBody),
  });

  if (!googleRes.ok) {
    const errText = await googleRes.text().catch(() => '');
    console.error(`[/api/routes] computeRouteMatrix HTTP ${googleRes.status} ${errText.slice(0, 300)}`);
    return NextResponse.json(
      { error: '移動時間を取得できませんでした。', status: googleRes.status },
      { status: 400 }
    );
  }

  const elements: RouteMatrixElement[] = await googleRes.json();

  const rows: { durationMinutes: number; distanceMeters: number; status: string }[][] = origins.map(() =>
    destinations.map(() => ({ durationMinutes: -1, distanceMeters: 0, status: 'error' }))
  );

  for (const el of elements) {
    if (el.originIndex === undefined || el.destinationIndex === undefined) continue;
    const ok = el.condition === 'ROUTE_EXISTS' && !!el.duration;
    rows[el.originIndex][el.destinationIndex] = {
      durationMinutes: ok ? Math.round(parseInt(el.duration!, 10) / 60) : -1,
      distanceMeters: el.distanceMeters ?? 0,
      status: ok ? 'OK' : 'error',
    };
  }

  return NextResponse.json({ rows });
}
