import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY が設定されていません。' });
  }

  const { origins, destinations } = req.body;
  if (!Array.isArray(origins) || !Array.isArray(destinations)) {
    return res.status(400).json({ error: 'origins と destinations が必要です。' });
  }

  const originsStr = origins.map((o: { lat: number; lng: number }) => `${o.lat},${o.lng}`).join('|');
  const destStr = destinations.map((d: { lat: number; lng: number }) => `${d.lat},${d.lng}`).join('|');

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originsStr}&destinations=${destStr}&key=${API_KEY}&language=ja`;
  const googleRes = await fetch(url);
  const data = await googleRes.json();

  if (data.status !== 'OK') {
    return res.status(400).json({ error: '移動時間を取得できませんでした。', status: data.status });
  }

  const rows = data.rows.map((row: { elements: { status: string; duration?: { value: number }; distance?: { value: number } }[] }) =>
    row.elements.map((elem: { status: string; duration?: { value: number }; distance?: { value: number } }) => ({
      durationMinutes: elem.status === 'OK' ? Math.round((elem.duration?.value ?? 0) / 60) : -1,
      distanceMeters: elem.distance?.value ?? 0,
      status: elem.status,
    }))
  );

  return res.status(200).json({ rows });
}
