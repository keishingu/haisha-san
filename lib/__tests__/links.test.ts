import { describe, it, expect } from 'vitest';
import { buildGoogleMapsDirectionsUrl, buildTransitToMeetingUrl, buildDestinationUrl } from '../google-maps/links';
import { LatLng } from '../types';

describe('Google Maps URL生成', () => {
  const origin: LatLng = { lat: 35.6938, lng: 139.7034 };
  const destination: LatLng = { lat: 35.4786, lng: 138.7531 };

  it('車ルートリンクが生成されること', () => {
    const url = buildGoogleMapsDirectionsUrl(origin, destination);
    expect(url).toContain('https://www.google.com/maps/dir/');
    expect(url).toContain(`origin=${origin.lat}%2C${origin.lng}`);
    expect(url).toContain(`destination=${destination.lat}%2C${destination.lng}`);
    expect(url).toContain('travelmode=driving');
  });

  it('集合地点への公共交通リンクが生成されること', () => {
    const meetingPoint: LatLng = { lat: 35.7061, lng: 139.6658 };
    const url = buildTransitToMeetingUrl(origin, meetingPoint);
    expect(url).toContain('https://www.google.com/maps/dir/');
    expect(url).toContain(`origin=${origin.lat}%2C${origin.lng}`);
    expect(url).toContain(`destination=${meetingPoint.lat}%2C${meetingPoint.lng}`);
    expect(url).toContain('travelmode=transit');
  });

  it('目的地へのリンクが生成されること', () => {
    const url = buildDestinationUrl(destination);
    expect(url).toContain('https://www.google.com/maps/dir/');
    expect(url).toContain(`destination=${destination.lat}%2C${destination.lng}`);
  });
});
