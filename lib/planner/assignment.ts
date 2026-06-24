import { Member, MeetingCandidate, VehiclePlan, TransitOnlyPlan, PlanResult, LatLng, TransitRouteStep } from '../types';
import { buildGoogleMapsDirectionsUrl, buildDestinationUrl } from '../google-maps/links';
import { getDistanceMatrix, getTransitRoute } from '../google-maps/client';
import { OptimizationMode, ScoreWeights, OPTIMIZATION_WEIGHTS, DEFAULT_OPTIMIZATION_MODE } from './optimization';

function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function estimateDrivingMinutes(distanceKm: number): number {
  return Math.round(distanceKm * 2);
}

function estimateTransitMinutes(distanceKm: number): number {
  return Math.round(distanceKm * 3);
}

type CandidateScore = {
  driverId: string;
  meetingPoint: MeetingCandidate;
  score: number;
  driverDetourMinutes: number;
  driveDurationMinutes: number;
  passengerAccessMinutes: number;
};

function scoreCandidate(
  driver: Member,
  passenger: Member,
  existingPassengerCount: number,
  meetingPoint: MeetingCandidate,
  destination: LatLng,
  weights: ScoreWeights
): CandidateScore {
  const driverLoc = driver.location!;
  const meetingLoc = meetingPoint.location;
  const passengerLoc = passenger.location!;

  const driverToMeeting = haversineDistance(driverLoc, meetingLoc);
  const meetingToDest = haversineDistance(meetingLoc, destination);
  const driverDirect = haversineDistance(driverLoc, destination);

  const driverDetourKm = driverToMeeting + meetingToDest - driverDirect;
  const driverDetourMinutes = estimateDrivingMinutes(Math.max(0, driverDetourKm));
  const driveDurationMinutes = estimateDrivingMinutes(driverToMeeting + meetingToDest);

  const passengerDist = haversineDistance(passengerLoc, meetingLoc);
  const passengerAccessMinutes = estimateTransitMinutes(passengerDist);

  const destBacktrack = haversineDistance(meetingLoc, destination) > driverDirect ? driverDetourMinutes : 0;

  const congestionPenalty = existingPassengerCount * weights.congestion;

  const score = driverDetourMinutes * weights.detour
    + passengerAccessMinutes * weights.access
    + destBacktrack * weights.backtrack
    + congestionPenalty;

  return {
    driverId: driver.id,
    meetingPoint,
    score,
    driverDetourMinutes,
    driveDurationMinutes,
    passengerAccessMinutes,
  };
}

function centroid(locations: LatLng[]): LatLng {
  return {
    lat: locations.reduce((s, p) => s + p.lat, 0) / locations.length,
    lng: locations.reduce((s, p) => s + p.lng, 0) / locations.length,
  };
}

type GroupMeetingChoice = {
  meetingPoint: MeetingCandidate;
  driverDetourMinutes: number;
  driveDurationMinutes: number;
  passengerAccessMinutes: Map<string, number>;
};

// 1台分（ドライバー＋同乗者）について、与えられた候補から最適な集合地点を選ぶ。
function chooseMeetingPointForGroup(
  driver: Member,
  passengers: Member[],
  candidates: MeetingCandidate[],
  destination: LatLng,
  weights: ScoreWeights
): GroupMeetingChoice | null {
  const driverLoc = driver.location!;
  const driverDirect = haversineDistance(driverLoc, destination);

  let best: GroupMeetingChoice | null = null;
  let bestScore = Infinity;

  for (const mp of candidates) {
    const meetingLoc = mp.location;
    const driverToMeeting = haversineDistance(driverLoc, meetingLoc);
    const meetingToDest = haversineDistance(meetingLoc, destination);
    const detourMinutes = estimateDrivingMinutes(Math.max(0, driverToMeeting + meetingToDest - driverDirect));
    const driveMinutes = estimateDrivingMinutes(driverToMeeting + meetingToDest);
    const backtrack = meetingToDest > driverDirect ? detourMinutes : 0;

    const accessMap = new Map<string, number>();
    let accessSum = 0;
    for (const p of passengers) {
      const a = estimateTransitMinutes(haversineDistance(p.location!, meetingLoc));
      accessMap.set(p.id, a);
      accessSum += a;
    }

    const score = detourMinutes * weights.detour
      + accessSum * weights.access
      + backtrack * weights.backtrack;

    if (score < bestScore) {
      bestScore = score;
      best = {
        meetingPoint: mp,
        driverDetourMinutes: detourMinutes,
        driveDurationMinutes: driveMinutes,
        passengerAccessMinutes: accessMap,
      };
    }
  }

  return best;
}

type AssignmentEntry = {
  driverId: string;
  passengerIds: string[];
  meetingPoint: MeetingCandidate;
  driverDetourMinutes: number;
  driveDurationMinutes: number;
  passengerAccessMinutes: Map<string, number>;
  passengerTransitRoutes: Map<string, TransitRouteStep[]>;
};

export async function calculateAssignment(
  members: Member[],
  destination: LatLng,
  meetingCandidates: MeetingCandidate[],
  useRealApi: boolean = false,
  mode: OptimizationMode = DEFAULT_OPTIMIZATION_MODE,
  candidateProvider?: (center: LatLng) => Promise<MeetingCandidate[]>
): Promise<PlanResult> {
  const weights = OPTIMIZATION_WEIGHTS[mode];
  const drivers = members.filter(m => m.isDriver && m.location);
  const nonDrivers = members.filter(m => !m.isDriver && m.location);

  if (drivers.length === 0) {
    const transitOnlyPlans: TransitOnlyPlan[] = members.map(member => ({
      memberId: member.id,
      destinationMapsUrl: buildDestinationUrl(destination),
      reason: 'no_vehicle' as const,
    }));
    return {
      vehiclePlans: [],
      transitOnlyPlans,
      warnings: ['車ありメンバーがいません。全員が公共交通で目的地へ向かいます。'],
    };
  }

  const assignments = new Map<string, AssignmentEntry>();
  for (const d of drivers) {
    assignments.set(d.id, {
      driverId: d.id,
      passengerIds: [],
      meetingPoint: meetingCandidates[0],
      driverDetourMinutes: 0,
      driveDurationMinutes: 0,
      passengerAccessMinutes: new Map(),
      passengerTransitRoutes: new Map(),
    });
  }

  const unassigned: Member[] = [];

  for (const passenger of nonDrivers) {
    let best: CandidateScore | null = null;
    let bestDriverId = '';

    for (const driver of drivers) {
      const entry = assignments.get(driver.id)!;
      const cap = (driver.vehicleCapacity || 1) - 1;
      if (entry.passengerIds.length >= cap) continue;

      for (const mp of meetingCandidates) {
        const scored = scoreCandidate(driver, passenger, entry.passengerIds.length, mp, destination, weights);
        if (!best || scored.score < best.score) {
          best = scored;
          bestDriverId = driver.id;
        }
      }
    }

    if (best) {
      const entry = assignments.get(bestDriverId)!;
      entry.passengerIds.push(passenger.id);
      entry.meetingPoint = best.meetingPoint;
      entry.driverDetourMinutes = Math.max(entry.driverDetourMinutes, best.driverDetourMinutes);
      entry.driveDurationMinutes = best.driveDurationMinutes;
      entry.passengerAccessMinutes.set(passenger.id, best.passengerAccessMinutes);
    } else {
      unassigned.push(passenger);
    }
  }

  // 集合地点を車ごとに見直す: その車の同乗者＋ドライバーの位置から候補を取り直し、
  // 車ごとに最適な集合地点を選ぶ。全車で同じ重心の候補を共有して同じ駅に偏るのを防ぐ。
  if (candidateProvider) {
    for (const driver of drivers) {
      const entry = assignments.get(driver.id)!;
      if (entry.passengerIds.length === 0) continue;

      const passengers = entry.passengerIds
        .map(id => members.find(m => m.id === id))
        .filter((m): m is Member => !!m?.location);
      const groupCenter = centroid([driver.location!, ...passengers.map(p => p.location!)]);

      let localCandidates: MeetingCandidate[] = [];
      try {
        localCandidates = await candidateProvider(groupCenter);
      } catch {
        localCandidates = [];
      }
      if (localCandidates.length === 0) continue; // 取得できなければ既存の集合地点を維持

      const chosen = chooseMeetingPointForGroup(driver, passengers, localCandidates, destination, weights);
      if (chosen) {
        entry.meetingPoint = chosen.meetingPoint;
        entry.driverDetourMinutes = chosen.driverDetourMinutes;
        entry.driveDurationMinutes = chosen.driveDurationMinutes;
        entry.passengerAccessMinutes = chosen.passengerAccessMinutes;
      }
    }
  }

  let realDurations: Map<string, number> | null = null;
  if (useRealApi) {
    try {
      const origins: LatLng[] = [];
      const dests: LatLng[] = [];

      for (const [, entry] of assignments) {
        if (entry.passengerIds.length === 0) continue;
        const driver = members.find(m => m.id === entry.driverId)!;
        origins.push(driver.location!);
        dests.push(entry.meetingPoint.location);
        origins.push(entry.meetingPoint.location);
        dests.push(destination);
      }

      if (origins.length > 0) {
        const matrix = await getDistanceMatrix(origins, dests);
        realDurations = new Map();
        let idx = 0;
        for (const [, entry] of assignments) {
          if (entry.passengerIds.length === 0) continue;
          const toMeeting = matrix[idx]?.[idx]?.durationMinutes ?? -1;
          idx++;
          const toDest = matrix[idx]?.[idx]?.durationMinutes ?? -1;
          idx++;
          if (toMeeting >= 0 && toDest >= 0) {
            realDurations.set(entry.driverId, toMeeting + toDest);
          }
        }
      }
    } catch {
      // Distance Matrix失敗時は推定値を使用
    }
  }

  // 車なしメンバーの集合経路（乗車駅→降車駅）を取得する。結果の妥当性検証用で、推定時間には影響しない。
  if (useRealApi) {
    for (const [, entry] of assignments) {
      for (const passengerId of entry.passengerIds) {
        const passenger = members.find(m => m.id === passengerId);
        if (!passenger?.location) continue;
        try {
          const route = await getTransitRoute(passenger.location, entry.meetingPoint.location);
          if (route.steps.length > 0) {
            entry.passengerTransitRoutes.set(passengerId, route.steps);
          }
        } catch {
          // 経路取得失敗時は詳細経路なしで継続（時間の推定/算出には影響しない）
        }
      }
    }
  }

  // 車ありメンバーは全員「1台の車」として表示する（同乗者0人でも自宅から直行する車として出す）。
  // ドライバーの定義順を保って安定した並びにする。
  const vehiclePlans: VehiclePlan[] = [];
  for (const driver of drivers) {
    const entry = assignments.get(driver.id)!;

    if (entry.passengerIds.length === 0) {
      // ソロ車: 集合地点なし。自宅から目的地へ直行。
      const directKm = haversineDistance(driver.location!, destination);
      vehiclePlans.push({
        vehicleId: driver.id,
        driverId: driver.id,
        passengerIds: [],
        meetingPoint: undefined,
        driveDurationMinutes: estimateDrivingMinutes(directKm),
        driverDetourMinutes: 0,
        passengerAccess: [],
        googleMapsUrl: buildGoogleMapsDirectionsUrl(driver.location!, destination),
      });
      continue;
    }

    const duration = realDurations?.get(entry.driverId) ?? entry.driveDurationMinutes;
    const googleMapsUrl = buildGoogleMapsDirectionsUrl(entry.meetingPoint.location, destination);

    vehiclePlans.push({
      vehicleId: entry.driverId,
      driverId: entry.driverId,
      passengerIds: entry.passengerIds,
      meetingPoint: entry.meetingPoint,
      driveDurationMinutes: duration,
      driverDetourMinutes: entry.driverDetourMinutes,
      passengerAccess: entry.passengerIds.map(pid => ({
        memberId: pid,
        mode: 'transit' as const,
        durationMinutes: entry.passengerAccessMinutes.get(pid),
        transitRoute: entry.passengerTransitRoutes.get(pid),
      })),
      googleMapsUrl,
    });
  }

  const transitOnlyPlans: TransitOnlyPlan[] = unassigned.map(member => ({
    memberId: member.id,
    destinationMapsUrl: buildDestinationUrl(destination),
    reason: 'seat_shortage' as const,
  }));

  const warnings: string[] = [];
  const totalCapacity = drivers.reduce((sum, d) => sum + (d.vehicleCapacity || 0), 0);
  const shortage = Math.max(0, members.length - totalCapacity);
  if (shortage > 0) {
    warnings.push(`席が${shortage}席不足しています。`);
  }

  return { vehiclePlans, transitOnlyPlans, warnings };
}
