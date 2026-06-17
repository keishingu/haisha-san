import { LatLng, MeetingCandidate } from '../types';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export function isApiKeyConfigured(): boolean {
  return !!API_KEY && API_KEY.length > 0;
}

let mapsApiLoaded = false;
let mapsApiLoading: Promise<void> | null = null;

export function loadMapsApi(): Promise<void> {
  if (mapsApiLoaded) return Promise.resolve();
  if (mapsApiLoading) return mapsApiLoading;

  mapsApiLoading = new Promise<void>((resolve, reject) => {
    if (!isApiKeyConfigured()) {
      reject(new Error('APIキー未設定'));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&language=ja`;
    script.async = true;
    script.onload = () => { mapsApiLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('Google Maps APIの読み込みに失敗しました'));
    document.head.appendChild(script);
  });

  return mapsApiLoading;
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

type PlaceResult = {
  name: string;
  vicinity?: string;
  geometry: { location: { lat: number; lng: number } };
};

async function fetchPlaces(url: string): Promise<PlaceResult[]> {
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return [];
  return data.results || [];
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

  const addResults = (places: PlaceResult[], type: string) => {
    for (const place of places) {
      const key = `${place.geometry.location.lat.toFixed(4)},${place.geometry.location.lng.toFixed(4)}`;
      if (!seen.has(key) && results.length < 10) {
        seen.add(key);
        results.push({
          id: `place-${results.length}`,
          name: place.name,
          address: place.vicinity || '',
          location: {
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
          },
          placeType: mapPlaceType(type),
        });
      }
    }
  };

  // 1. rankby=distance で近い順に検索（半径制限なし）
  const distanceSearches = [
    { type: 'train_station' },
    { type: 'transit_station' },
    { type: 'parking' },
  ];

  for (const search of distanceSearches) {
    const params = new URLSearchParams({
      location: `${center.lat},${center.lng}`,
      rankby: 'distance',
      type: search.type,
      key: API_KEY!,
      language: 'ja',
    });
    const places = await fetchPlaces(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`);
    addResults(places, search.type);
  }

  // 2. まだ少なければ半径指定で追加検索
  if (results.length < 3) {
    const radiusSearches = [
      { type: 'train_station', radius: 10000 },
      { type: 'transit_station', radius: 10000 },
      { type: 'parking', radius: 5000 },
    ];

    for (const search of radiusSearches) {
      const params = new URLSearchParams({
        location: `${center.lat},${center.lng}`,
        radius: search.radius.toString(),
        type: search.type,
        key: API_KEY!,
        language: 'ja',
      });
      const places = await fetchPlaces(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`);
      addResults(places, search.type);
    }
  }

  return results;
}
