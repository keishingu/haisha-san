import { LatLng, MeetingCandidate, TransitRouteStep } from '../types';
import { getDynamicMeetingCandidates, getSampleLocation } from '../planner/sampleData';

export type DistanceMatrixResult = {
  durationMinutes: number;
  distanceMeters: number;
  status: 'OK' | 'error';
};

export type TransitRouteResult = {
  steps: TransitRouteStep[];
  durationMinutes?: number;
};

/** 車の移動時間と公共交通の経路。Google Maps Platform を使えるときだけ渡す */
export type RouteApis = {
  distanceMatrix(origins: LatLng[], destinations: LatLng[]): Promise<DistanceMatrixResult[][]>;
  transitRoute(origin: LatLng, destination: LatLng): Promise<TransitRouteResult>;
};

/**
 * 配車の計算が使う地図の機能。
 * - live: Google Maps Platform（サーバーだけで作る。lib/google-maps/server.ts）
 * - sample: 内蔵の住所辞書と駅リスト、直線距離の概算（ネットワークを使わない）
 */
export type MapsGateway = {
  live: boolean;
  /** 住所を座標にする。特定できなければ undefined */
  geocode(address: string): Promise<LatLng | undefined>;
  /** Google の Place ID を座標にする。sample では使えない（undefined） */
  geocodePlaceId(placeId: string): Promise<LatLng | undefined>;
  searchMeetingCandidates(center: LatLng): Promise<MeetingCandidate[]>;
  routes: RouteApis | null;
};

/** サンプルモード: 内蔵の住所辞書・駅リストだけを使う */
export const sampleGateway: MapsGateway = {
  live: false,
  geocode: async (address) => getSampleLocation(address),
  geocodePlaceId: async () => undefined,
  searchMeetingCandidates: async (center) => getDynamicMeetingCandidates(center),
  routes: null,
};
