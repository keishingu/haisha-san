import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { PlanProvider } from './PlanProvider';

export const metadata: Metadata = {
  title: '配車さん',
  description:
    '複数人で同じ目的地へ車移動するときの配車・集合案を提案します。住所や氏名は保存しません。',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;

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
      <body>
        {browserKey && (
          <Script
            id="gmaps-loader"
            strategy="beforeInteractive"
            src={`https://maps.googleapis.com/maps/api/js?key=${browserKey}&libraries=places&language=ja&loading=async`}
          />
        )}
        <PlanProvider>{children}</PlanProvider>
      </body>
    </html>
  );
}
