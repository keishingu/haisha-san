import { z } from "zod";
import { OPTIMIZATION_OPTIONS } from "@/lib/planner/optimization";

const modes = OPTIMIZATION_OPTIONS.map((o) => o.mode) as [string, ...string[]];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const capacity = z.number().int().min(1, "定員は1人以上にしてください").max(15, "定員は15人までです").nullable();

const common = {
  canDrive: z.boolean(),
  vehicleCapacity: capacity,
  groupId: optionalText(20),
  /** ドライバーの指定集合場所（住所・駅名など） */
  meetingPointInput: optionalText(200),
  /** ドライバーの自宅（出発地）を集合場所にする */
  meetingAtHome: z.boolean().default(false),
};

/** Cairn の山行のメンバー。住所は送らない（サーバーで保存済みの出発地を引く）。今回だけ別の住所から出るときだけ addressOverride を送る */
const memberParticipant = z.object({
  kind: z.literal("member"),
  cairnUserId: z.string().min(1),
  included: z.boolean(),
  addressOverride: optionalText(200),
  ...common,
});

/** Cairn にいない参加者（OB・ゲストなど）。このプランにだけ使う */
const guestParticipant = z.object({
  kind: z.literal("guest"),
  id: z.string().regex(/^guest-[A-Za-z0-9-]{1,40}$/),
  name: z.string().trim().min(1, "参加者の名前を入れてください").max(40),
  addressInput: z.string().trim().min(1, "参加者の出発地を入れてください").max(200),
  ...common,
});

export const planFormInputSchema = z.object({
  projectId: z.string().min(1),
  destinationInput: z.string().trim().min(1, "目的地を入れてください").max(200),
  optimizationMode: z.enum(modes),
  notes: optionalText(1000),
  participants: z.array(z.discriminatedUnion("kind", [memberParticipant, guestParticipant])).max(80),
});

export type PlanFormInput = z.input<typeof planFormInputSchema>;
export type ParsedPlanFormInput = z.output<typeof planFormInputSchema>;
export type ParticipantInput = ParsedPlanFormInput["participants"][number];
