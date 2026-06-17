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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&language=ja&loading=async`;
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
  const res = await fetch('/api/geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || '住所の特定に失敗しました。');
  }

  return {
    address,
    location: data.location,
    formattedAddress: data.formattedAddress,
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
  const res = await fetch('/api/distance-matrix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origins, destinations }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || '移動時間の取得に失敗しました。');
  }

  return data.rows.map((row: { durationMinutes: number; distanceMeters: number; status: string }[]) =>
    row.map((elem) => ({
      durationMinutes: elem.status === 'OK' ? elem.durationMinutes : -1,
      distanceMeters: elem.distanceMeters,
      status: elem.status === 'OK' ? 'OK' as const : 'error' as const,
    }))
  );
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

async function nearbySearch(
  center: LatLng,
  radius: number,
  type: string
): Promise<MeetingCandidate[]> {
  const res = await fetch('/api/places-nearby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: center.lat, lng: center.lng, radius, type }),
  });

  if (!res.ok) return [];

  const data = await res.json();
  return (data.results || []).map((r: { name: string; address: string; location: LatLng }, i: number) => ({
    id: `place-${type}-${i}`,
    name: r.name,
    address: r.address,
    location: r.location,
    placeType: mapPlaceType(type),
  }));
}

export async function searchMeetingCandidates(center: LatLng): Promise<MeetingCandidate[]> {
  const haversineKm = (a: LatLng, b: LatLng) => {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  const searches = [
    { type: 'train_station', radius: 15000 },
    { type: 'transit_station', radius: 15000 },
    { type: 'parking', radius: 8000 },
  ];

  const allResults: MeetingCandidate[] = [];
  const seen = new Set<string>();

  for (const search of searches) {
    const results = await nearbySearch(center, search.radius, search.type);
    for (const r of results) {
      const key = `${r.location.lat.toFixed(4)},${r.location.lng.toFixed(4)}`;
      if (!seen.has(key) && allResults.length < 10) {
        seen.add(key);
        allResults.push(r);
      }
    }
  }

  allResults.sort((a, b) => haversineKm(center, a.location) - haversineKm(center, b.location));

  return allResults;
}
