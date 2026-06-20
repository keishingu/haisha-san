import { LatLng } from '../types';

export function buildGoogleMapsDirectionsUrl(origin: LatLng, destination: LatLng): string {
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: 'driving',
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildTransitToMeetingUrl(origin: LatLng, meetingPoint: LatLng): string {
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${meetingPoint.lat},${meetingPoint.lng}`,
    travelmode: 'transit',
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildDestinationUrl(destination: LatLng): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${destination.lat},${destination.lng}`,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

// 集合地点を地図ピンで開くリンク（座標のみ。住所文字列は含めない）。
export function buildMeetingPointUrl(meetingPoint: LatLng): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${meetingPoint.lat},${meetingPoint.lng}`,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
