import 'server-only';

import { LatLng, MeetingCandidate, TransitRouteStep } from '../types';
import { MapsGateway, sampleGateway, DistanceMatrixResult, TransitRouteResult } from './gateway';

/**
 * サーバーから Google Maps Platform を呼ぶ。キー（GOOGLE_MAPS_API_KEY）はブラウザへ出さない。
 * 住所・緯度経度・レスポンスの詳細はログに出さない（HTTP ステータスだけ出す）。
 */

function haversineMeters(a: LatLng, b: LatLng): number {
  const r = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function geocode(apiKey: string, address: string): Promise<LatLng | undefined> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&language=ja&region=jp`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`住所を解決できませんでした（Geocoding API HTTP ${res.status}）`);
  const data = await res.json();
  if (data.status === 'ZERO_RESULTS') return undefined;
  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(`住所を解決できませんでした（Geocoding API ${data.status}）`);
  }
  const loc = data.results[0].geometry.location;
  return { lat: loc.lat, lng: loc.lng };
}

async function geocodePlaceId(apiKey: string, placeId: string): Promise<LatLng | undefined> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${encodeURIComponent(placeId)}&key=${apiKey}&language=ja`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`場所を解決できませんでした（Geocoding API HTTP ${res.status}）`);
  const data = await res.json();
  if (data.status === 'ZERO_RESULTS' || data.status === 'NOT_FOUND') return undefined;
  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(`場所を解決できませんでした（Geocoding API ${data.status}）`);
  }
  const loc = data.results[0].geometry.location;
  return { lat: loc.lat, lng: loc.lng };
}

type NearbyPlace = { name?: string; vicinity?: string; geometry?: { location?: { lat?: number; lng?: number } } };

async function nearbySearch(apiKey: string, center: LatLng, radius: number, type: string): Promise<NearbyPlace[]> {
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${center.lat},${center.lng}&radius=${radius}&type=${encodeURIComponent(type)}&key=${apiKey}&language=ja`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`集合地点を検索できませんでした（Places API HTTP ${res.status}）`);
  const data = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`集合地点を検索できませんでした（Places API ${data.status}）`);
  }
  return data.results ?? [];
}

function mapPlaceType(googleType: string): MeetingCandidate['placeType'] {
  switch (googleType) {
    case 'train_station':
    case 'transit_station':
      return 'station';
    case 'parking':
      return 'parking';
    case 'convenience_store':
      return 'convenience_store';
    default:
      return 'custom';
  }
}

async function searchMeetingCandidates(apiKey: string, center: LatLng): Promise<MeetingCandidate[]> {
  const searches = [
    { type: 'train_station', radius: 15000 },
    { type: 'transit_station', radius: 15000 },
    { type: 'parking', radius: 8000 },
  ];
  const all: MeetingCandidate[] = [];
  const seen = new Set<string>();
  for (const search of searches) {
    const places = await nearbySearch(apiKey, center, search.radius, search.type);
    places.forEach((p, i) => {
      const loc = p.geometry?.location;
      if (!p.name || typeof loc?.lat !== 'number' || typeof loc.lng !== 'number') return;
      const key = `${loc.lat.toFixed(4)},${loc.lng.toFixed(4)}`;
      if (seen.has(key) || all.length >= 10) return;
      seen.add(key);
      all.push({
        id: `place-${search.type}-${i}`,
        name: p.name,
        address: p.vicinity ?? '',
        location: { lat: loc.lat, lng: loc.lng },
        placeType: mapPlaceType(search.type),
      });
    });
  }
  all.sort((a, b) => haversineMeters(center, a.location) - haversineMeters(center, b.location));
  return all;
}

type RouteMatrixElement = {
  originIndex?: number;
  destinationIndex?: number;
  duration?: string;
  distanceMeters?: number;
  condition?: string;
};

const toWaypoint = (c: LatLng) => ({ location: { latLng: { latitude: c.lat, longitude: c.lng } } });

// 車の移動時間・距離（Routes API computeRouteMatrix）。Distance Matrix API（レガシー）は新規プロジェクトで使えないため。
async function distanceMatrix(apiKey: string, origins: LatLng[], destinations: LatLng[]): Promise<DistanceMatrixResult[][]> {
  const res = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,condition,status',
    },
    body: JSON.stringify({
      origins: origins.map((c) => ({ waypoint: toWaypoint(c) })),
      destinations: destinations.map((c) => ({ waypoint: toWaypoint(c) })),
      travelMode: 'DRIVE',
      languageCode: 'ja',
    }),
  });
  if (!res.ok) {
    console.error(`[maps] computeRouteMatrix HTTP ${res.status}`);
    throw new Error('移動時間を取得できませんでした。');
  }
  const elements: RouteMatrixElement[] = await res.json();
  const rows: DistanceMatrixResult[][] = origins.map(() =>
    destinations.map(() => ({ durationMinutes: -1, distanceMeters: 0, status: 'error' as const })),
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
  return rows;
}

type RouteStep = {
  travelMode?: string;
  transitDetails?: {
    stopDetails?: { arrivalStop?: { name?: string }; departureStop?: { name?: string } };
    transitLine?: { name?: string; nameShort?: string };
  };
};

const TRANSIT_FIELD_MASK = [
  'routes.duration',
  'routes.legs.steps.travelMode',
  'routes.legs.steps.transitDetails.stopDetails.departureStop.name',
  'routes.legs.steps.transitDetails.stopDetails.arrivalStop.name',
  'routes.legs.steps.transitDetails.transitLine.name',
  'routes.legs.steps.transitDetails.transitLine.nameShort',
].join(',');

async function findNearestStation(apiKey: string, c: LatLng): Promise<string | undefined> {
  for (const type of ['train_station', 'transit_station']) {
    const places = await nearbySearch(apiKey, c, 2000, type).catch(() => []);
    const nearest = places
      .map((p) => {
        const loc = p.geometry?.location;
        if (!p.name || typeof loc?.lat !== 'number' || typeof loc.lng !== 'number') return undefined;
        return { name: p.name, distance: haversineMeters(c, { lat: loc.lat, lng: loc.lng }) };
      })
      .filter((p): p is { name: string; distance: number } => !!p)
      .sort((a, b) => a.distance - b.distance)[0];
    if (nearest) return nearest.name;
  }
  return undefined;
}

async function nearestStationRoute(apiKey: string, origin: LatLng, destination: LatLng): Promise<TransitRouteStep[]> {
  const [departureStop, arrivalStop] = await Promise.all([
    findNearestStation(apiKey, origin),
    findNearestStation(apiKey, destination),
  ]);
  if (!departureStop || !arrivalStop || departureStop === arrivalStop) return [];
  return [{ departureStop, arrivalStop }];
}

// 集合地点までの公共交通の経路（乗車駅→降車駅。Routes API computeRoutes）
async function transitRoute(apiKey: string, origin: LatLng, destination: LatLng): Promise<TransitRouteResult> {
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': TRANSIT_FIELD_MASK },
    body: JSON.stringify({
      origin: toWaypoint(origin),
      destination: toWaypoint(destination),
      travelMode: 'TRANSIT',
      languageCode: 'ja',
      regionCode: 'JP',
      departureTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    }),
  });
  if (!res.ok) {
    console.error(`[maps] computeRoutes HTTP ${res.status}`);
    throw new Error('公共交通の経路を取得できませんでした。');
  }
  const data: { routes?: { duration?: string; legs?: { steps?: RouteStep[] }[] }[] } = await res.json();
  const route = data.routes?.[0];
  if (!route) return { steps: await nearestStationRoute(apiKey, origin, destination) };
  const steps = (route.legs ?? [])
    .flatMap((leg) => leg.steps ?? [])
    .filter(
      (s) =>
        s.travelMode === 'TRANSIT' &&
        s.transitDetails?.stopDetails?.departureStop?.name &&
        s.transitDetails?.stopDetails?.arrivalStop?.name,
    )
    .map((s) => ({
      line: s.transitDetails?.transitLine?.nameShort || s.transitDetails?.transitLine?.name,
      departureStop: s.transitDetails!.stopDetails!.departureStop!.name as string,
      arrivalStop: s.transitDetails!.stopDetails!.arrivalStop!.name as string,
    }));
  const durationMinutes = route.duration ? Math.round(parseInt(route.duration, 10) / 60) : undefined;
  if (steps.length > 0) return { steps, durationMinutes };
  return { steps: await nearestStationRoute(apiKey, origin, destination), durationMinutes };
}

/**
 * サーバーで使う地図の機能。GOOGLE_MAPS_API_KEY があれば Google Maps Platform、無ければ内蔵の辞書（開発用）。
 * 本番でキーが無いときは、内蔵の辞書に代替せずエラーにする（実際の住所が解決できなくなるため）。
 */
export function createServerGateway(env: NodeJS.ProcessEnv = process.env): MapsGateway {
  const apiKey = env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    if (env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production') {
      throw new Error('環境変数 GOOGLE_MAPS_API_KEY が設定されていません。');
    }
    return sampleGateway;
  }
  return {
    live: true,
    geocode: (address) => geocode(apiKey, address),
    geocodePlaceId: (placeId) => geocodePlaceId(apiKey, placeId),
    searchMeetingCandidates: (center) => searchMeetingCandidates(apiKey, center),
    routes: {
      distanceMatrix: (o, d) => distanceMatrix(apiKey, o, d),
      transitRoute: (o, d) => transitRoute(apiKey, o, d),
    },
  };
}
