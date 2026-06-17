import { LatLng, MeetingCandidate } from '../types';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export function isApiKeyConfigured(): boolean {
  return !!API_KEY && API_KEY.length > 0;
}

export type GeocodingResult = {
  address: string;
  location: LatLng;
  formattedAddress: string;
};

export async function geocodeAddress(address: string): Promise<GeocodingResult> {
  if (!isApiKeyConfigured()) {
    throw new Error('Google Maps APIキーが設定されていません。');
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}&language=ja`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Geocoding APIエラー: ${res.status}`);
  }

  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(`住所「${address}」を特定できませんでした。市区町村や番地を追加してください。`);
  }

  const result = data.results[0];
  return {
    address,
    location: {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
    },
    formattedAddress: result.formatted_address,
  };
}

export type DistanceMatrixResult = {
  durationMinutes: number;
  distanceMeters: number;
  status: 'OK' | 'error';
};

export async function getDistanceMatrix(
  origins: LatLng[],
  destinations: LatLng[]
): Promise<DistanceMatrixResult[][]> {
  if (!isApiKeyConfigured()) {
    throw new Error('Google Maps APIキーが設定されていません。');
  }

  const originsStr = origins.map(o => `${o.lat},${o.lng}`).join('|');
  const destinationsStr = destinations.map(d => `${d.lat},${d.lng}`).join('|');

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originsStr}&destinations=${destinationsStr}&key=${API_KEY}&language=ja`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Distance Matrix APIエラー: ${res.status}`);
  }

  const data = await res.json();
  if (data.status !== 'OK') {
    throw new Error('移動時間を取得できませんでした。');
  }

  return data.rows.map((row: { elements: { status: string; duration?: { value: number }; distance?: { value: number } }[] }) =>
    row.elements.map((elem) => ({
      durationMinutes: elem.status === 'OK' ? Math.round((elem.duration?.value ?? 0) / 60) : -1,
      distanceMeters: elem.distance?.value ?? 0,
      status: elem.status === 'OK' ? 'OK' as const : 'error' as const,
    }))
  );
}

export type PlacesSearchResult = {
  name: string;
  address: string;
  location: LatLng;
  placeType: MeetingCandidate['placeType'];
};

export async function searchNearbyPlaces(
  center: LatLng,
  _radiusMeters: number,
  type: string,
  keyword?: string
): Promise<PlacesSearchResult[]> {
  if (!isApiKeyConfigured()) {
    throw new Error('Google Maps APIキーが設定されていません。');
  }

  const params = new URLSearchParams({
    location: `${center.lat},${center.lng}`,
    rankby: 'distance',
    type,
    key: API_KEY!,
    language: 'ja',
  });
  if (keyword) {
    params.set('keyword', keyword);
  }

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Places APIエラー: ${res.status}`);
  }

  const data = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error('集合地点を検索できませんでした。');
  }

  return (data.results || []).map((place: { name: string; vicinity?: string; geometry: { location: { lat: number; lng: number } } }) => ({
    name: place.name,
    address: place.vicinity || '',
    location: {
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
    },
    placeType: mapPlaceType(type),
  }));
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

export async function searchMeetingCandidates(center: LatLng): Promise<MeetingCandidate[]> {
  const results: MeetingCandidate[] = [];
  const seen = new Set<string>();

  const searches = [
    { type: 'train_station', radius: 3000 },
    { type: 'transit_station', radius: 3000 },
    { type: 'parking', radius: 2000 },
    { type: 'convenience_store', keyword: 'セブン-イレブン', radius: 1500 },
  ];

  for (const search of searches) {
    try {
      const places = await searchNearbyPlaces(center, search.radius, search.type, search.keyword);
      for (const place of places) {
        const key = `${place.location.lat.toFixed(4)},${place.location.lng.toFixed(4)}`;
        if (!seen.has(key) && results.length < 10) {
          seen.add(key);
          results.push({
            id: `place-${results.length}`,
            name: place.name,
            address: place.address,
            location: place.location,
            placeType: place.placeType,
          });
        }
      }
    } catch {
      // 個別の検索が失敗しても続行
    }
  }

  return results;
}
