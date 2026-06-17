import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { SharePlanPayload, CreatedSharePlan } from '../types';

export function buildShareUrl(payload: SharePlanPayload): CreatedSharePlan {
  const json = JSON.stringify(payload);
  const compressed = compressToEncodedURIComponent(json);
  const shareUrl = `${window.location.origin}/s#${compressed}`;
  
  return {
    shareUrl,
    byteLength: new Blob([shareUrl]).size,
    warning: shareUrl.length > 1800
      ? '共有URLが長いため、一部のアプリでは送信できない可能性があります。'
      : undefined,
  };
}

export function parseSharePayload(): SharePlanPayload | null {
  const encoded = window.location.hash.replace(/^#/, '');
  if (!encoded) return null;
  
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    return JSON.parse(json) as SharePlanPayload;
  } catch {
    return null;
  }
}