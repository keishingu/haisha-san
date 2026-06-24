import { NextRequest, NextResponse } from 'next/server';

type Coord = { lat: number; lng: number };

type TransitLine = { name?: string; nameShort?: string };

type StopDetails = {
  arrivalStop?: { name?: string };
  departureStop?: { name?: string };
};

type TransitDetails = {
  stopDetails?: StopDetails;
  transitLine?: TransitLine;
};

type RouteStep = {
  travelMode?: string;
  transitDetails?: TransitDetails;
};

type RouteLeg = {
  steps?: RouteStep[];
};

type Route = {
  duration?: string;
  legs?: RouteLeg[];
};

function toWaypoint(c: Coord) {
  return { location: { latLng: { latitude: c.lat, longitude: c.lng } } };
}

// 車なしメンバーの集合地点までの公共交通経路（乗車駅→降車駅）を取得する（Routes API computeRoutes）。
// Directions API（レガシー）は2025年以降新規プロジェクトで使用できないため、Routes APIを使う。
// 検証用途のみ。住所/緯度経度/レスポンス詳細はログ出力しない。
export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GOOGLE_MAPS_API_KEY が設定されていません。', code: 'NO_API_KEY' },
      { status: 503 }
    );
  }

  let body: { origin?: unknown; destination?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'リクエストボディが不正です。' }, { status: 400 });
  }

  const { origin, destination } = body as { origin?: Coord; destination?: Coord };
  if (
    !origin || !destination ||
    typeof origin.lat !== 'number' || typeof origin.lng !== 'number' ||
    typeof destination.lat !== 'number' || typeof destination.lng !== 'number'
  ) {
    return NextResponse.json({ error: 'origin と destination が必要です。' }, { status: 400 });
  }

  const requestBody = {
    origin: toWaypoint(origin),
    destination: toWaypoint(destination),
    travelMode: 'TRANSIT',
    languageCode: 'ja',
  };

  const googleRes = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.duration,routes.legs.steps.travelMode,routes.legs.steps.transitDetails',
    },
    body: JSON.stringify(requestBody),
  });

  if (!googleRes.ok) {
    // 住所/緯度経度/レスポンス詳細はログ出力しないが、原因切り分けのためHTTPステータスのみ出力する。
    const errText = await googleRes.text().catch(() => '');
    console.error(`[/api/transit] computeRoutes HTTP ${googleRes.status} ${errText.slice(0, 300)}`);
    return NextResponse.json({ steps: [], durationMinutes: undefined, status: googleRes.status });
  }

  const data: { routes?: Route[] } = await googleRes.json();
  const route = data.routes?.[0];
  if (!route) {
    return NextResponse.json({ steps: [], durationMinutes: undefined });
  }

  const steps = route.legs?.flatMap((leg) => leg.steps || []) || [];
  const transitSteps = steps
    .filter((s) => s.travelMode === 'TRANSIT' && s.transitDetails?.stopDetails?.departureStop?.name && s.transitDetails?.stopDetails?.arrivalStop?.name)
    .map((s) => ({
      line: s.transitDetails?.transitLine?.nameShort || s.transitDetails?.transitLine?.name,
      departureStop: s.transitDetails!.stopDetails!.departureStop!.name as string,
      arrivalStop: s.transitDetails!.stopDetails!.arrivalStop!.name as string,
    }));

  const durationMinutes = route.duration ? Math.round(parseInt(route.duration, 10) / 60) : undefined;

  return NextResponse.json({ steps: transitSteps, durationMinutes });
}
