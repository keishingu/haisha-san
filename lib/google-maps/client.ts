import { LatLng, MeetingCandidate } from '../types';

// ── ブラウザ用キー（Maps JavaScript API = 住所サジェスト用）の有無 ──
// サーバー用キー（GOOGLE_MAPS_API_KEY）はブラウザから参照できないため、
// 実際の住所解決/距離計算が使えるか（live モードか）は getApiStatus() で確認する。
export function isBrowserMapsKeyConfigured(): boolean {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  return !!key && key.length > 0;
}

// 後方互換のためのエイリアス（サジェスト用ブラウザキーの有無）。
export function isApiKeyConfigured(): boolean {
  return isBrowserMapsKeyConfigured();
}

// サーバー側 Google API（Route Handler）が利用可能かを確認する。
export async function getApiStatus(): Promise<{ live: boolean }> {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) return { live: false };
    const data = await res.json();
    return { live: !!data.live };
  } catch {
    return { live: false };
  }
}

let mapsApiLoading: Promise<void> | null = null;

function isPlacesReady(): boolean {
  return typeof window !== 'undefined' && !!window.google?.maps?.places;
}

export function loadMapsApi(): Promise<void> {
  if (isPlacesReady()) return Promise.resolve();
  if (mapsApiLoading) return mapsApiLoading;

  mapsApiLoading = new Promise<void>((resolve, reject) => {
    if (!isBrowserMapsKeyConfigured()) {
      reject(new Error('ブラウザ用APIキー未設定'));
      return;
    }

    // loading=async ではスクリプトの onload と places の利用可能タイミングがずれるため、
    // places が実際に使えるようになるまでポーリングして待つ。
    const waitForReady = () => {
      const start = Date.now();
      const iv = setInterval(() => {
        if (isPlacesReady()) {
          clearInterval(iv);
          resolve();
        } else if (Date.now() - start > 10000) {
          clearInterval(iv);
          reject(new Error('Google Maps APIの読み込みに失敗しました'));
        }
      }, 100);
    };

    // layout が先読みしたローダーがあれば、その完了を待つだけにする（二重読み込みを防ぐ）。
    if (document.getElementById('gmaps-loader')) {
      waitForReady();
      return;
    }

    // フォールバック: ローダーが無ければ動的に注入する。
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
    const script = document.createElement('script');
    script.id = 'gmaps-loader';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&language=ja&loading=async`;
    script.async = true;
    script.onload = () => waitForReady();
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
  const res = await fetch('/api/routes', {
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
  const res = await fetch('/api/places', {
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

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export async function searchMeetingCandidates(center: LatLng): Promise<MeetingCandidate[]> {
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
