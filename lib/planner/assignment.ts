import { Member, MeetingCandidate, VehiclePlan, TransitOnlyPlan, PlanResult, LatLng } from '../types';
import { buildGoogleMapsDirectionsUrl, buildDestinationUrl } from '../google-maps/links';
import { getDistanceMatrix } from '../google-maps/client';

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
  destination: LatLng
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

  const congestionPenalty = existingPassengerCount * 2;

  const score = driverDetourMinutes * 3
    + passengerAccessMinutes * 2
    + destBacktrack * 2
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

type AssignmentEntry = {
  driverId: string;
  passengerIds: string[];
  meetingPoint: MeetingCandidate;
  driverDetourMinutes: number;
  driveDurationMinutes: number;
  passengerAccessMinutes: Map<string, number>;
};

export async function calculateAssignment(
  members: Member[],
  destination: LatLng,
  meetingCandidates: MeetingCandidate[],
  useRealApi: boolean = false
): Promise<PlanResult> {
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
        const scored = scoreCandidate(driver, passenger, entry.passengerIds.length, mp, destination);
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

  const vehiclePlans: VehiclePlan[] = [];
  for (const [, entry] of assignments) {
    if (entry.passengerIds.length === 0) continue;
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
