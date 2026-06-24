export type MemberId = string;
export type VehicleId = string;

export type LatLng = {
  lat: number;
  lng: number;
};

export type Member = {
  id: MemberId;
  name: string;
  addressInput: string;
  location?: LatLng;
  isDriver: boolean;
  vehicleCapacity?: number; // ドライバー本人を含む総定員
};

export type Destination = {
  addressInput: string;
  location?: LatLng;
};

export type MeetingCandidate = {
  id: string;
  name: string;
  address: string;
  location: LatLng;
  placeType: 'station' | 'parking' | 'convenience_store' | 'custom';
};

export type VehiclePlan = {
  vehicleId: VehicleId;
  driverId: MemberId;
  passengerIds: MemberId[];
  meetingPoint?: MeetingCandidate; // 同乗者がいない車（自宅から直行）は未設定
  driveDurationMinutes: number;
  driverDetourMinutes: number;
  passengerAccess: PassengerAccess[];
  googleMapsUrl: string;
};

export type PassengerAccess = {
  memberId: MemberId;
  mode: 'transit' | 'walking' | 'unknown';
  durationMinutes?: number;
  // 結果が妥当か検証するための詳細経路（乗車駅→降車駅）。共有URLには含めない。
  transitRoute?: TransitRouteStep[];
};

export type TransitRouteStep = {
  line?: string;
  departureStop: string;
  arrivalStop: string;
};

export type PlanResult = {
  vehiclePlans: VehiclePlan[];
  transitOnlyPlans: TransitOnlyPlan[];
  warnings: string[];
};

export type TransitOnlyPlan = {
  memberId: MemberId;
  destinationMapsUrl: string;
  durationMinutes?: number;
  reason: 'seat_shortage' | 'no_vehicle' | 'manual';
};

export type SharePlanPayload = {
  title: string;
  destinationLabel: string;
  vehiclePlans: SharedVehiclePlan[];
  transitOnlyPlans: SharedTransitOnlyPlan[];
  notes?: string;
  createdAt?: string;
};

export type SharedVehiclePlan = {
  driverName: string;
  passengerNames: string[];
  meetingPointName?: string; // 同乗者がいない車では未設定
  meetingPointMapsUrl?: string; // 同乗者がいない車では未設定
  destinationMapsUrl: string;
  driveDurationText?: string;
};

export type SharedTransitOnlyPlan = {
  memberName: string;
  destinationMapsUrl: string;
  durationText?: string;
  reasonText: string;
};

export type CreatedSharePlan = {
  shareUrl: string;
  byteLength: number;
  warning?: string;
};
