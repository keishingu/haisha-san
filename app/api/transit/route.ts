import { NextRequest, NextResponse } from 'next/server';

type Coord = { lat: number; lng: number };

type GoogleTransitDetails = {
  line?: { short_name?: string; name?: string };
  departure_stop?: { name?: string };
  arrival_stop?: { name?: string };
};

type GoogleStep = {
  travel_mode: string;
  transit_details?: GoogleTransitDetails;
};

// 車なしメンバーの集合地点までの公共交通経路（乗車駅→降車駅）を取得する（Directions API）。
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

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=transit&key=${apiKey}&language=ja`;
  const googleRes = await fetch(url);
  const data = await googleRes.json();

  if (data.status !== 'OK' || !data.routes?.length) {
    // 住所/緯度経度/レスポンス詳細はログ出力しないが、原因切り分けのためstatusコードのみ出力する。
    console.error(`[/api/transit] Directions API status=${data.status}${data.error_message ? ` message=${data.error_message}` : ''}`);
    return NextResponse.json({ steps: [], durationMinutes: undefined, status: data.status });
  }

  const leg = data.routes[0].legs?.[0];
  const steps: GoogleStep[] = leg?.steps || [];

  const transitSteps = steps
    .filter((s) => s.travel_mode === 'TRANSIT' && s.transit_details?.departure_stop?.name && s.transit_details?.arrival_stop?.name)
    .map((s) => ({
      line: s.transit_details?.line?.short_name || s.transit_details?.line?.name,
      departureStop: s.transit_details!.departure_stop!.name as string,
      arrivalStop: s.transit_details!.arrival_stop!.name as string,
    }));

  const durationMinutes = leg?.duration?.value ? Math.round(leg.duration.value / 60) : undefined;

  return NextResponse.json({ steps: transitSteps, durationMinutes });
}
