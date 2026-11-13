// ブラウザだけで使う Google Maps の機能（住所サジェスト用の Maps JavaScript API の読み込み）。
// 住所解決・移動時間・集合地点の検索はサーバーで行う（lib/google-maps/server.ts）。

export function isBrowserMapsKeyConfigured(): boolean {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  return !!key && key.length > 0;
}

// 後方互換のためのエイリアス（サジェスト用ブラウザキーの有無）。
export function isApiKeyConfigured(): boolean {
  return isBrowserMapsKeyConfigured();
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
