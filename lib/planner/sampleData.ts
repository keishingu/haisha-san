import { Member, Destination, LatLng, MeetingCandidate } from '../types';

const knownLocations: Record<string, LatLng> = {
  // 東京都
  '東京都新宿区': { lat: 35.6938, lng: 139.7034 },
  '新宿': { lat: 35.6938, lng: 139.7034 },
  '東京都世田谷区': { lat: 35.6462, lng: 139.6527 },
  '世田谷': { lat: 35.6462, lng: 139.6527 },
  '東京都中野区': { lat: 35.7077, lng: 139.6639 },
  '中野': { lat: 35.7077, lng: 139.6639 },
  '東京都杉並区': { lat: 35.6994, lng: 139.6367 },
  '杉並': { lat: 35.6994, lng: 139.6367 },
  '東京都渋谷区': { lat: 35.6640, lng: 139.6982 },
  '渋谷': { lat: 35.6640, lng: 139.6982 },
  '東京都港区': { lat: 35.6581, lng: 139.7514 },
  '港区': { lat: 35.6581, lng: 139.7514 },
  '東京都品川区': { lat: 35.6091, lng: 139.7300 },
  '品川': { lat: 35.6091, lng: 139.7300 },
  '東京都目黒区': { lat: 35.6414, lng: 139.6982 },
  '目黒': { lat: 35.6414, lng: 139.6982 },
  '東京都大田区': { lat: 35.5613, lng: 139.7161 },
  '大田': { lat: 35.5613, lng: 139.7161 },
  '東京都板橋区': { lat: 35.7766, lng: 139.6861 },
  '板橋': { lat: 35.7766, lng: 139.6861 },
  '東京都足立区': { lat: 35.7926, lng: 139.7061 },
  '足立': { lat: 35.7926, lng: 139.7061 },
  '東京都江戸川区': { lat: 35.7066, lng: 139.8681 },
  '江戸川': { lat: 35.7066, lng: 139.8681 },
  '東京都豊島区': { lat: 35.7261, lng: 139.7167 },
  '豊島': { lat: 35.7261, lng: 139.7167 },
  '東京都北区': { lat: 35.7528, lng: 139.7377 },
  '北区': { lat: 35.7528, lng: 139.7377 },
  '東京都荒川区': { lat: 35.7368, lng: 139.7833 },
  '荒川': { lat: 35.7368, lng: 139.7833 },
  '東京都台東区': { lat: 35.7126, lng: 139.7800 },
  '台東': { lat: 35.7126, lng: 139.7800 },
  '東京都中央区': { lat: 35.6707, lng: 139.7722 },
  '中央区': { lat: 35.6707, lng: 139.7722 },
  '東京都千代田区': { lat: 35.6940, lng: 139.7536 },
  '千代田': { lat: 35.6940, lng: 139.7536 },
  '東京都文京区': { lat: 35.7080, lng: 139.7521 },
  '文京': { lat: 35.7080, lng: 139.7521 },
  '東京都墨田区': { lat: 35.7108, lng: 139.8014 },
  '墨田': { lat: 35.7108, lng: 139.8014 },
  '東京都葛飾区': { lat: 35.7435, lng: 139.8473 },
  '葛飾': { lat: 35.7435, lng: 139.8473 },
  '東京都町田市': { lat: 35.5431, lng: 139.4467 },
  '町田': { lat: 35.5431, lng: 139.4467 },
  '東京都八王子市': { lat: 35.6664, lng: 139.3161 },
  '八王子': { lat: 35.6664, lng: 139.3161 },
  '東京都府中市': { lat: 35.6726, lng: 139.4781 },
  '府中': { lat: 35.6726, lng: 139.4781 },
  '東京都調布市': { lat: 35.6506, lng: 139.5407 },
  '調布': { lat: 35.6506, lng: 139.5407 },
  '東京都三鷹市': { lat: 35.6833, lng: 139.5596 },
  '三鷹': { lat: 35.6833, lng: 139.5596 },
  '東京都西東京市': { lat: 35.7257, lng: 139.5386 },
  '東京都立川市': { lat: 35.7141, lng: 139.4091 },
  '立川': { lat: 35.7141, lng: 139.4091 },

  // 神奈川県
  '神奈川県川崎市': { lat: 35.5308, lng: 139.7029 },
  '川崎': { lat: 35.5308, lng: 139.7029 },
  '神奈川県横浜市': { lat: 35.4437, lng: 139.6380 },
  '横浜': { lat: 35.4437, lng: 139.6380 },
  '神奈川県相模原市': { lat: 35.5716, lng: 139.3732 },
  '相模原': { lat: 35.5716, lng: 139.3732 },
  '神奈川県藤沢市': { lat: 35.3391, lng: 139.4900 },
  '藤沢': { lat: 35.3391, lng: 139.4900 },
  '神奈川県鎌倉市': { lat: 35.3192, lng: 139.5467 },
  '鎌倉': { lat: 35.3192, lng: 139.5467 },
  '神奈川県逗子市': { lat: 35.2956, lng: 139.5803 },
  '逗子': { lat: 35.2956, lng: 139.5803 },
  '神奈川県茅ヶ崎市': { lat: 35.3335, lng: 139.4058 },
  '茅ヶ崎': { lat: 35.3335, lng: 139.4058 },
  '神奈川県大和市': { lat: 35.4693, lng: 139.4616 },
  '大和': { lat: 35.4693, lng: 139.4616 },
  '神奈川県海老名市': { lat: 35.4834, lng: 139.3909 },
  '海老名': { lat: 35.4834, lng: 139.3909 },
  '神奈川県厚木市': { lat: 35.4430, lng: 139.3607 },
  '厚木': { lat: 35.4430, lng: 139.3607 },

  // 埼玉県
  '埼玉県さいたま市': { lat: 35.8617, lng: 139.6455 },
  'さいたま': { lat: 35.8617, lng: 139.6455 },
  '埼玉県川口市': { lat: 35.8073, lng: 139.7261 },
  '川口': { lat: 35.8073, lng: 139.7261 },
  '埼玉県川越市': { lat: 35.9251, lng: 139.4858 },
  '川越': { lat: 35.9251, lng: 139.4858 },
  '埼玉県所沢市': { lat: 35.7997, lng: 139.4687 },
  '所沢': { lat: 35.7997, lng: 139.4687 },
  '埼玉県越谷市': { lat: 35.8911, lng: 139.7905 },
  '越谷': { lat: 35.8911, lng: 139.7905 },

  // 千葉県
  '千葉県千葉市': { lat: 35.6074, lng: 140.1065 },
  '千葉': { lat: 35.6074, lng: 140.1065 },
  '千葉県船橋市': { lat: 35.6947, lng: 139.9829 },
  '船橋': { lat: 35.6947, lng: 139.9829 },
  '千葉県松戸市': { lat: 35.7875, lng: 139.9031 },
  '松戸': { lat: 35.7875, lng: 139.9031 },
  '千葉県市原市': { lat: 35.4979, lng: 140.1157 },
  '千葉県浦安市': { lat: 35.6536, lng: 139.8941 },
  '浦安': { lat: 35.6536, lng: 139.8941 },
  '千葉県柏市': { lat: 35.8676, lng: 139.9755 },
  '柏': { lat: 35.8676, lng: 139.9755 },

  // 観光地・ランドマーク
  '河口湖キャンプ場': { lat: 35.4786, lng: 138.7531 },
  '河口湖': { lat: 35.5089, lng: 138.7547 },
  '富士山': { lat: 35.3606, lng: 138.7274 },
  '箱根': { lat: 35.2324, lng: 139.1069 },
  '熱海': { lat: 35.0929, lng: 139.0743 },
  '軽井沢': { lat: 36.3481, lng: 138.5967 },
  '日光': { lat: 36.7200, lng: 139.6982 },
  '御殿場': { lat: 35.3087, lng: 138.9346 },
  '三浦': { lat: 35.1441, lng: 139.6206 },
  '三浦海岸': { lat: 35.1276, lng: 139.6429 },
  '江ノ島': { lat: 35.2994, lng: 139.4803 },
  '湘南': { lat: 35.3295, lng: 139.4779 },

  // 主要駅
  '東京駅': { lat: 35.6812, lng: 139.7671 },
  '新宿駅': { lat: 35.6896, lng: 139.7006 },
  '渋谷駅': { lat: 35.6580, lng: 139.7016 },
  '池袋駅': { lat: 35.7295, lng: 139.7109 },
  '品川駅': { lat: 35.6284, lng: 139.7387 },
  '上野駅': { lat: 35.7141, lng: 139.7774 },
  '横浜駅': { lat: 35.4657, lng: 139.6201 },
  '大宮駅': { lat: 35.9062, lng: 139.6240 },
  '立川駅': { lat: 35.7142, lng: 139.4096 },
  '八王子駅': { lat: 35.6556, lng: 139.3389 },
  '町田駅': { lat: 35.5424, lng: 139.4460 },
  '吉祥寺駅': { lat: 35.7031, lng: 139.5797 },
  '三鷹駅': { lat: 35.6812, lng: 139.5596 },
  '調布駅': { lat: 35.6515, lng: 139.5444 },
  '府中駅': { lat: 35.6720, lng: 139.4778 },
  '柏駅': { lat: 35.8623, lng: 139.9710 },
  '松戸駅': { lat: 35.7849, lng: 139.9015 },
  '船橋駅': { lat: 35.6953, lng: 139.9838 },
  '藤沢駅': { lat: 35.3390, lng: 139.4880 },
  '鎌倉駅': { lat: 35.3189, lng: 139.5508 },
};

export function getSampleLocation(address: string): LatLng | undefined {
  // 完全一致
  if (knownLocations[address]) return knownLocations[address];

  // 部分一致（長いキーから順に）
  const sortedKeys = Object.keys(knownLocations).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (address.includes(key)) return knownLocations[key];
  }

  return undefined;
}

export function getSampleDestination(): Destination {
  return {
    addressInput: '河口湖キャンプ場',
    location: knownLocations['河口湖キャンプ場'],
  };
}

export function getSampleMembers(): Member[] {
  return [
    { id: '1', name: '田中', addressInput: '東京都新宿区', location: knownLocations['東京都新宿区'], isDriver: true, vehicleCapacity: 4 },
    { id: '2', name: '佐藤', addressInput: '東京都世田谷区', location: knownLocations['東京都世田谷区'], isDriver: true, vehicleCapacity: 5 },
    { id: '3', name: '鈴木', addressInput: '東京都中野区', location: knownLocations['東京都中野区'], isDriver: false },
    { id: '4', name: '高橋', addressInput: '東京都杉並区', location: knownLocations['東京都杉並区'], isDriver: false },
    { id: '5', name: '伊藤', addressInput: '神奈川県川崎市', location: knownLocations['神奈川県川崎市'], isDriver: false },
    { id: '6', name: '山本', addressInput: '神奈川県横浜市', location: knownLocations['神奈川県横浜市'], isDriver: false },
  ];
}

// 重心から近い主要駅を動的に生成（APIキー未設定時の集合地点候補に使用）
const majorStations: { name: string; location: LatLng }[] = [
  { name: '新宿駅', location: { lat: 35.6896, lng: 139.7006 } },
  { name: '渋谷駅', location: { lat: 35.6580, lng: 139.7016 } },
  { name: '池袋駅', location: { lat: 35.7295, lng: 139.7109 } },
  { name: '品川駅', location: { lat: 35.6284, lng: 139.7387 } },
  { name: '東京駅', location: { lat: 35.6812, lng: 139.7671 } },
  { name: '上野駅', location: { lat: 35.7141, lng: 139.7774 } },
  { name: '横浜駅', location: { lat: 35.4657, lng: 139.6201 } },
  { name: '大宮駅', location: { lat: 35.9062, lng: 139.6240 } },
  { name: '立川駅', location: { lat: 35.7142, lng: 139.4096 } },
  { name: '八王子駅', location: { lat: 35.6556, lng: 139.3389 } },
  { name: '町田駅', location: { lat: 35.5424, lng: 139.4460 } },
  { name: '吉祥寺駅', location: { lat: 35.7031, lng: 139.5797 } },
  { name: '三鷹駅', location: { lat: 35.6812, lng: 139.5596 } },
  { name: '調布駅', location: { lat: 35.6515, lng: 139.5444 } },
  { name: '府中駅', location: { lat: 35.6720, lng: 139.4778 } },
  { name: '中野駅', location: { lat: 35.7061, lng: 139.6658 } },
  { name: '高円寺駅', location: { lat: 35.7052, lng: 139.6490 } },
  { name: '荻窪駅', location: { lat: 35.7037, lng: 139.6195 } },
  { name: '西船橋駅', location: { lat: 35.7077, lng: 139.9581 } },
  { name: '柏駅', location: { lat: 35.8623, lng: 139.9710 } },
  { name: '松戸駅', location: { lat: 35.7849, lng: 139.9015 } },
  { name: '船橋駅', location: { lat: 35.6953, lng: 139.9838 } },
  { name: '津田沼駅', location: { lat: 35.6816, lng: 140.0013 } },
  { name: '藤沢駅', location: { lat: 35.3390, lng: 139.4880 } },
  { name: '大船駅', location: { lat: 35.3526, lng: 139.5302 } },
  { name: '川崎駅', location: { lat: 35.5308, lng: 139.6995 } },
  { name: '武蔵小杉駅', location: { lat: 35.5764, lng: 139.6609 } },
  { name: '登戸駅', location: { lat: 35.6169, lng: 139.5741 } },
  { name: '二子玉川駅', location: { lat: 35.6117, lng: 139.6288 } },
  { name: '自由が丘駅', location: { lat: 35.6087, lng: 139.6687 } },
  { name: '大井町駅', location: { lat: 35.6050, lng: 139.7356 } },
  { name: '蒲田駅', location: { lat: 35.5624, lng: 139.7160 } },
  { name: '国分寺駅', location: { lat: 35.7004, lng: 139.4800 } },
  { name: '小平駅', location: { lat: 35.7220, lng: 139.4777 } },
  { name: '秋葉原駅', location: { lat: 35.6984, lng: 139.7731 } },
  { name: '有楽町駅', location: { lat: 35.6752, lng: 139.7639 } },
  { name: '新橋駅', location: { lat: 35.6663, lng: 139.7581 } },
  { name: '大崎駅', location: { lat: 35.6197, lng: 139.7285 } },
  { name: '五反田駅', location: { lat: 35.6260, lng: 139.7236 } },
  { name: '目黒駅', location: { lat: 35.6338, lng: 139.7156 } },
  { name: '恵比寿駅', location: { lat: 35.6467, lng: 139.7101 } },
  { name: '原宿駅', location: { lat: 35.6702, lng: 139.7026 } },
  { name: '代々木駅', location: { lat: 35.6834, lng: 139.7019 } },
  { name: '高田馬場駅', location: { lat: 35.7127, lng: 139.7037 } },
  { name: '早稲田駅', location: { lat: 35.7089, lng: 139.7186 } },
];

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function getDynamicMeetingCandidates(center: LatLng, radiusKm: number = 5): MeetingCandidate[] {
  const nearby = majorStations
    .map(s => ({ ...s, distance: haversineKm(center, s.location) }))
    .filter(s => s.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 6);

  // 近隣に駅がなければ最寄り数件にフォールバック
  const list = nearby.length > 0
    ? nearby
    : majorStations
        .map(s => ({ ...s, distance: haversineKm(center, s.location) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3);

  return list.map((s, i) => ({
    id: `station-${i}`,
    name: s.name,
    address: s.name,
    location: s.location,
    placeType: 'station' as const,
  }));
}

export function getSampleMeetingCandidates(): MeetingCandidate[] {
  return [
    { id: 'station1', name: '中野駅', address: '東京都中野区中野5丁目', location: { lat: 35.7061, lng: 139.6658 }, placeType: 'station' },
    { id: 'station2', name: '武蔵小杉駅', address: '神奈川県川崎市中原区小杉町1丁目', location: { lat: 35.5764, lng: 139.6609 }, placeType: 'station' },
    { id: 'parking1', name: '中野駅北口駐車場', address: '東京都中野区中野5丁目', location: { lat: 35.7075, lng: 139.6650 }, placeType: 'parking' },
  ];
}
