import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { SharePlanPayload, CreatedSharePlan } from '../types';

const LONG_URL_THRESHOLD = 1800;
const VERY_LONG_URL_THRESHOLD = 3000;

export function encodeSharePayload(payload: SharePlanPayload): string {
  const json = JSON.stringify(payload);
  return compressToEncodedURIComponent(json);
}

export function decodeSharePayload(encoded: string): SharePlanPayload | null {
  if (!encoded) return null;
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    return JSON.parse(json) as SharePlanPayload;
  } catch {
    return null;
  }
}

export function buildShareUrl(payload: SharePlanPayload, origin?: string): CreatedSharePlan {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const compressed = encodeSharePayload(payload);
  const shareUrl = `${base}/s#${compressed}`;

  let warning: string | undefined;
  if (shareUrl.length > VERY_LONG_URL_THRESHOLD) {
    warning = '共有URLがかなり長くなっています。一部のアプリでは送信できないため、共有テキストのコピーをおすすめします。';
  } else if (shareUrl.length > LONG_URL_THRESHOLD) {
    warning = '共有URLが長いため、一部のアプリでは送信できない可能性があります。';
  }

  return {
    shareUrl,
    byteLength: new Blob([shareUrl]).size,
    warning,
  };
}

// 共有ページ用: location.hash からペイロードを復元する。
export function parseSharePayload(hash?: string): SharePlanPayload | null {
  const raw = hash ?? (typeof window !== 'undefined' ? window.location.hash : '');
  const encoded = raw.replace(/^#/, '');
  return decodeSharePayload(encoded);
}
