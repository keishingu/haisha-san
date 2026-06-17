import { Member, MeetingCandidate, VehiclePlan, TransitOnlyPlan, PlanResult, LatLng } from '../types';
import { buildGoogleMapsDirectionsUrl, buildDestinationUrl } from './googleMaps';
import { getDistanceMatrix } from './googleMapsApi';

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

type ScoredAssignment = {
  driverId: string;
  passengerIds: string[];
  meetingPoint: MeetingCandidate;
  score: number;
  driverDetourMinutes: number;
  driveDurationMinutes: number;
  passengerAccessMinutes: Map<string, number>;
};

function scoreAssignment(
  driver: Member,
  passengers: Member[],
  meetingPoint: MeetingCandidate,
  destination: LatLng
): ScoredAssignment {
  const driverLoc = driver.location!;
  const meetingLoc = meetingPoint.location;

  const driverToMeeting = haversineDistance(driverLoc, meetingLoc);
  const meetingToDest = haversineDistance(meetingLoc, destination);
  const driverDirect = haversineDistance(driverLoc, destination);

  const driverDetourKm = driverToMeeting + meetingToDest - driverDirect;
  const driverDetourMinutes = estimateDrivingMinutes(Math.max(0, driverDetourKm));
  const driveDurationMinutes = estimateDrivingMinutes(driverToMeeting + meetingToDest);

  const passengerAccessMinutes = new Map<string, number>();
  let totalAccess = 0;
  let maxAccess = 0;

  for (const p of passengers) {
    const dist = haversineDistance(p.location!, meetingLoc);
    const minutes = estimateTransitMinutes(dist);
    passengerAccessMinutes.set(p.id, minutes);
    totalAccess += minutes;
    if (minutes > maxAccess) maxAccess = minutes;
  }

  const avgAccess = passengers.length > 0 ? totalAccess / passengers.length : 0;
  const destBacktrack = haversineDistance(meetingLoc, destination) > driverDirect ? driverDetourMinutes * 2 : 0;

  const score = driverDetourMinutes * 3 + avgAccess * 2 + maxAccess * 1 + destBacktrack * 2;

  return {
    driverId: driver.id,
    passengerIds: passengers.map(p => p.id),
    meetingPoint,
    score,
    driverDetourMinutes,
    driveDurationMinutes,
    passengerAccessMinutes,
  };
}

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

  const totalCapacity = drivers.reduce((sum, d) => sum + (d.vehicleCapacity || 0), 0);
  const shortage = Math.max(0, members.length - totalCapacity);

  const driverCapacities = new Map<string, number>();
  for (const d of drivers) {
    driverCapacities.set(d.id, (d.vehicleCapacity || 1) - 1);
  }

  const bestAssignments = new Map<string, ScoredAssignment>();

  for (const passenger of nonDrivers) {
    let bestForPassenger: ScoredAssignment | null = null;

    for (const driver of drivers) {
      const remaining = driverCapacities.get(driver.id) ?? 0;
      if (remaining <= 0) continue;

      for (const mp of meetingCandidates) {
        const currentPassengerIds = bestAssignments.get(driver.id)?.passengerIds ?? [];
        const fakePassengers = currentPassengerIds
          .map(id => members.find(m => m.id === id)!)
          .filter(Boolean);
        fakePassengers.push(passenger);

        const scored = scoreAssignment(driver, fakePassengers, mp, destination);
        if (!bestForPassenger || scored.score < bestForPassenger.score) {
          bestForPassenger = scored;
        }
      }
    }

    if (bestForPassenger) {
      const existing = bestAssignments.get(bestForPassenger.driverId);
      if (existing) {
        existing.passengerIds.push(passenger.id);
        existing.score += bestForPassenger.score;
        existing.driverDetourMinutes = Math.max(existing.driverDetourMinutes, bestForPassenger.driverDetourMinutes);
        const minutes = bestForPassenger.passengerAccessMinutes.get(passenger.id) ?? 0;
        existing.passengerAccessMinutes.set(passenger.id, minutes);
      } else {
        bestAssignments.set(bestForPassenger.driverId, {
          ...bestForPassenger,
          passengerIds: [passenger.id],
        });
      }
    }
  }

  const assignedIds = new Set<string>();
  const vehiclePlansRaw: { driver: Member; assignment: ScoredAssignment }[] = [];

  for (const driver of drivers) {
    const assignment = bestAssignments.get(driver.id);
      if (assignment && assignment.passengerIds.length > 0) {
        const cap = driverCapacities.get(driver.id) ?? 0;
        const kept = assignment.passengerIds.slice(0, cap);
        assignment.passengerIds = kept;
        vehiclePlansRaw.push({ driver, assignment });
        kept.forEach(id => assignedIds.add(id));
      }
  }

  const unassigned = nonDrivers.filter(m => !assignedIds.has(m.id));

  let realDurations: Map<string, number> | null = null;
  if (useRealApi && meetingCandidates.length > 0) {
    try {
      const origins: LatLng[] = [];
      const destinations: LatLng[] = [];

      for (const { driver, assignment } of vehiclePlansRaw) {
        origins.push(driver.location!);
        destinations.push(assignment.meetingPoint.location);
        origins.push(assignment.meetingPoint.location);
        destinations.push(destination);
      }

      if (origins.length > 0) {
        const matrix = await getDistanceMatrix(origins, destinations);
        realDurations = new Map();
        let idx = 0;
        for (const { assignment } of vehiclePlansRaw) {
          const driverToMeeting = matrix[idx]?.[idx]?.durationMinutes ?? -1;
          idx++;
          const meetingToDest = matrix[idx]?.[idx]?.durationMinutes ?? -1;
          idx++;
          if (driverToMeeting >= 0 && meetingToDest >= 0) {
            realDurations.set(assignment.driverId, driverToMeeting + meetingToDest);
          }
        }
      }
    } catch {
      // Distance Matrix失敗時は推定値を使用
    }
  }

  const vehiclePlans: VehiclePlan[] = vehiclePlansRaw.map(({ driver, assignment }) => {
    const duration = realDurations?.get(assignment.driverId) ?? assignment.driveDurationMinutes;
    const googleMapsUrl = buildGoogleMapsDirectionsUrl(assignment.meetingPoint.location, destination);

    return {
      vehicleId: driver.id,
      driverId: driver.id,
      passengerIds: assignment.passengerIds,
      meetingPoint: assignment.meetingPoint,
      driveDurationMinutes: duration,
      driverDetourMinutes: assignment.driverDetourMinutes,
      passengerAccess: assignment.passengerIds.map(pid => ({
        memberId: pid,
        mode: 'transit' as const,
        durationMinutes: assignment.passengerAccessMinutes.get(pid),
      })),
      googleMapsUrl,
    };
  });

  const transitOnlyPlans: TransitOnlyPlan[] = unassigned.map(member => ({
    memberId: member.id,
    destinationMapsUrl: buildDestinationUrl(destination),
    reason: 'seat_shortage' as const,
  }));

  const warnings: string[] = [];
  if (shortage > 0) {
    warnings.push(`席が${shortage}席不足しています。`);
  }

  return { vehiclePlans, transitOnlyPlans, warnings };
}
