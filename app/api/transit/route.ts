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

type NearbyPlace = {
  name?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
};

const TRANSIT_FIELD_MASK = [
  'routes.duration',
  'routes.legs.steps.travelMode',
  'routes.legs.steps.transitDetails.stopDetails.departureStop.name',
  'routes.legs.steps.transitDetails.stopDetails.arrivalStop.name',
  'routes.legs.steps.transitDetails.transitLine.name',
  'routes.legs.steps.transitDetails.transitLine.nameShort',
].join(',');

function toWaypoint(c: Coord) {
  return { location: { latLng: { latitude: c.lat, longitude: c.lng } } };
}

function distanceMeters(a: Coord, b: Coord): number {
  const r = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function findNearestStation(apiKey: string, c: Coord): Promise<string | undefined> {
  for (const type of ['train_station', 'transit_station']) {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${c.lat},${c.lng}&radius=2000&type=${type}&key=${apiKey}&language=ja`;
    const res = await fetch(url);
    if (!res.ok) continue;

    const data: { status?: string; results?: NearbyPlace[] } = await res.json();
    if (data.status !== 'OK' || !data.results?.length) continue;

    return data.results
      .map((place) => {
        const loc = place.geometry?.location;
        if (!place.name || typeof loc?.lat !== 'number' || typeof loc.lng !== 'number') return undefined;
        return { name: place.name, distance: distanceMeters(c, { lat: loc.lat, lng: loc.lng }) };
      })
      .filter((place): place is { name: string; distance: number } => !!place)
      .sort((a, b) => a.distance - b.distance)[0]?.name;
  }

  return undefined;
}

async function buildNearestStationFallback(apiKey: string, origin: Coord, destination: Coord) {
  const [departureStop, arrivalStop] = await Promise.all([
    findNearestStation(apiKey, origin),
    findNearestStation(apiKey, destination),
  ]);

  if (!departureStop || !arrivalStop || departureStop === arrivalStop) return [];
  return [{ departureStop, arrivalStop }];
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
    regionCode: 'JP',
    departureTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };

  const googleRes = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': TRANSIT_FIELD_MASK,
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
    console.error(`[/api/transit] computeRoutes returned no routes`);
    const fallbackSteps = await buildNearestStationFallback(apiKey, origin, destination);
    return NextResponse.json({ steps: fallbackSteps, durationMinutes: undefined });
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

  if (transitSteps.length > 0) {
    return NextResponse.json({ steps: transitSteps, durationMinutes });
  }

  const fallbackSteps = await buildNearestStationFallback(apiKey, origin, destination);
  return NextResponse.json({ steps: fallbackSteps, durationMinutes });
}
