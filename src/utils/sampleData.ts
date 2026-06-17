import { Member, Destination, LatLng } from '../types';

// サンプルの緯度経度データ（東京周辺）
const sampleLocations: Record<string, LatLng> = {
  '東京都新宿区': { lat: 35.6938, lng: 139.7034 },
  '東京都世田谷区': { lat: 35.6462, lng: 139.6527 },
  '東京都中野区': { lat: 35.7077, lng: 139.6639 },
  '東京都杉並区': { lat: 35.6994, lng: 139.6367 },
  '神奈川県川崎市': { lat: 35.5308, lng: 139.7029 },
  '神奈川県横浜市': { lat: 35.4437, lng: 139.6380 },
  '河口湖キャンプ場': { lat: 35.4786, lng: 138.7531 },
};

export function getSampleLocation(address: string): LatLng | undefined {
  return sampleLocations[address];
}

export function getSampleDestination(): Destination {
  return {
    addressInput: '河口湖キャンプ場',
    location: sampleLocations['河口湖キャンプ場'],
  };
}

export function getSampleMembers(): Member[] {
  return [
    {
      id: '1',
      name: '田中',
      addressInput: '東京都新宿区',
      location: sampleLocations['東京都新宿区'],
      isDriver: true,
      vehicleCapacity: 4,
    },
    {
      id: '2',
      name: '佐藤',
      addressInput: '東京都世田谷区',
      location: sampleLocations['東京都世田谷区'],
      isDriver: true,
      vehicleCapacity: 5,
    },
    {
      id: '3',
      name: '鈴木',
      addressInput: '東京都中野区',
      location: sampleLocations['東京都中野区'],
      isDriver: false,
    },
    {
      id: '4',
      name: '高橋',
      addressInput: '東京都杉並区',
      location: sampleLocations['東京都杉並区'],
      isDriver: false,
    },
    {
      id: '5',
      name: '伊藤',
      addressInput: '神奈川県川崎市',
      location: sampleLocations['神奈川県川崎市'],
      isDriver: false,
    },
    {
      id: '6',
      name: '山本',
      addressInput: '神奈川県横浜市',
      location: sampleLocations['神奈川県横浜市'],
      isDriver: false,
    },
  ];
}

// サンプルの集合地点候補
export function getSampleMeetingCandidates() {
  return [
    {
      id: 'station1',
      name: '中野駅',
      address: '東京都中野区中野5丁目',
      location: { lat: 35.7061, lng: 139.6658 },
      placeType: 'station' as const,
    },
    {
      id: 'station2',
      name: '武蔵小杉駅',
      address: '神奈川県川崎市中原区小杉町1丁目',
      location: { lat: 35.5764, lng: 139.6609 },
      placeType: 'station' as const,
    },
    {
      id: 'parking1',
      name: '中野駅北口駐車場',
      address: '東京都中野区中野5丁目',
      location: { lat: 35.7075, lng: 139.6650 },
      placeType: 'parking' as const,
    },
  ];
}