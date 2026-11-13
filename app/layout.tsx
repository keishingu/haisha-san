import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: '配車さん',
  description: '山行の参加メンバーと出発地から、車ごとの乗車メンバーと集合地点を提案します。',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

// 空文字のときに <head> へ空のテキストを描かないよう、真偽値にしてから使う
const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY || null;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        {/* 住所サジェスト用 Maps JS を最初期に先読みし、最初の入力欄でも候補がすぐ出るようにする */}
        {browserKey && (
          <>
            <link rel="preconnect" href="https://maps.googleapis.com" />
            <link rel="preconnect" href="https://maps.gstatic.com" crossOrigin="" />
          </>
        )}
      </head>
      <body className="bg-gray-50">
        {browserKey && (
          <Script
            id="gmaps-loader"
            strategy="beforeInteractive"
            src={`https://maps.googleapis.com/maps/api/js?key=${browserKey}&libraries=places&language=ja&loading=async`}
          />
        )}
        {children}
      </body>
    </html>
  );
}
