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
  meetingPoint: MeetingCandidate;
  driveDurationMinutes: number;
  driverDetourMinutes: number;
  passengerAccess: PassengerAccess[];
  googleMapsUrl: string;
};

export type PassengerAccess = {
  memberId: MemberId;
  mode: 'transit' | 'walking' | 'unknown';
  durationMinutes?: number;
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
  meetingPointName: string;
  meetingPointMapsUrl: string;
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