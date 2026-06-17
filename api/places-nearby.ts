import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY が設定されていません。' });
  }

  const { lat, lng, radius, type } = req.body;
  if (typeof lat !== 'number' || typeof lng !== 'number' || typeof radius !== 'number' || typeof type !== 'string') {
    return res.status(400).json({ error: 'lat, lng, radius, type が必要です。' });
  }

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${encodeURIComponent(type)}&key=${API_KEY}&language=ja`;
  const googleRes = await fetch(url);
  const data = await googleRes.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    return res.status(400).json({ error: '集合地点を検索できませんでした。', status: data.status });
  }

  const results = (data.results || []).map((place: { name: string; vicinity?: string; geometry: { location: { lat: number; lng: number } } }) => ({
    name: place.name,
    address: place.vicinity || '',
    location: {
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
    },
  }));

  return res.status(200).json({ results });
}
