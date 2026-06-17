import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY が設定されていません。' });
  }

  const { address } = req.body;
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'address が必要です。' });
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}&language=ja`;
  const googleRes = await fetch(url);
  const data = await googleRes.json();

  if (data.status !== 'OK' || !data.results?.length) {
    return res.status(400).json({
      error: `住所「${address}」を特定できませんでした。市区町村や番地を追加してください。`,
      status: data.status,
    });
  }

  const result = data.results[0];
  return res.status(200).json({
    location: {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
    },
    formattedAddress: result.formatted_address,
  });
}
