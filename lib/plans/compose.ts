import type { MemberOrigin, PlanParticipant } from "@/db/schema";
import { DomainError } from "@/lib/errors";
import type { Member } from "@/lib/types";
import type { ParsedPlanFormInput } from "./input";

/**
 * 入力画面の内容と、保存済みの出発地・Cairn の名前から、配車の計算に渡すメンバーを組み立てる（純粋関数）。
 * 出発地が無い・定員が無いなど、計算できない入力はまとめて DomainError にする。
 */
export function composePlanMembers(input: {
  participants: ParsedPlanFormInput["participants"];
  /** 山行のメンバーの名前（Cairn） */
  projectMemberNames: ReadonlyMap<string, string>;
  origins: ReadonlyMap<string, MemberOrigin>;
}): { members: Member[]; participants: PlanParticipant[] } {
  const members: Member[] = [];
  const participants: PlanParticipant[] = [];
  const problems: string[] = [];

  for (const p of input.participants) {
    if (p.kind === "member" && !p.included) continue;

    let id: string;
    let name: string;
    let addressInput: string;
    let location: Member["location"];
    if (p.kind === "member") {
      const cairnName = input.projectMemberNames.get(p.cairnUserId);
      if (!cairnName) {
        problems.push("山行のメンバーではない部員が含まれています。画面を開き直してください。");
        continue;
      }
      id = p.cairnUserId;
      name = cairnName;
      const origin = input.origins.get(p.cairnUserId);
      if (p.addressOverride) {
        addressInput = p.addressOverride;
      } else if (origin) {
        addressInput = origin.addressInput;
        location = { lat: origin.lat, lng: origin.lng };
      } else {
        problems.push(`${name}さんの出発地が登録されていません。今回の出発地を入れるか、本人か配車係に登録してもらってください。`);
        continue;
      }
    } else {
      id = p.id;
      name = p.name;
      addressInput = p.addressInput;
    }

    if (p.canDrive && p.vehicleCapacity === null) {
      problems.push(`${name}さんの車の定員を入れてください。`);
      continue;
    }

    const member: Member = {
      id,
      name,
      addressInput,
      location,
      isDriver: p.canDrive,
      vehicleCapacity: p.canDrive ? (p.vehicleCapacity ?? undefined) : undefined,
      groupId: p.groupId,
    };
    if (p.canDrive && p.meetingAtHome) {
      // 住所の文字列はプランに出さず、「◯◯さんの自宅」として座標だけで示す（座標は buildPlan が出発地から入れる）
      member.meetingPointInput = `${name}さんの自宅`;
      member.meetingAtHome = true;
    } else if (p.canDrive && p.meetingPointInput) {
      member.meetingPointInput = p.meetingPointInput;
    }
    members.push(member);
    participants.push({ id, name, kind: p.kind, groupId: p.groupId });
  }

  if (problems.length > 0) throw new DomainError(problems.join("\n"));
  if (members.length === 0) throw new DomainError("参加者がいません。");
  return { members, participants };
}
