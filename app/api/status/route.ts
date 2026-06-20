import { NextResponse } from 'next/server';

// サーバー用 Google API キーが設定済みか（live モードか）だけを返す。キー値は返さない。
export function GET() {
  return NextResponse.json({ live: !!process.env.GOOGLE_MAPS_API_KEY });
}
