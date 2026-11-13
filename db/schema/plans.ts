import { doublePrecision, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { OptimizationMode } from "@/lib/planner/optimization";
import type { PlanResult } from "@/lib/types";

/** プランに載せる参加者。住所・座標は入れない（プランはログインした部員全員が見る） */
export type PlanParticipant = {
  /** Cairn の部員はユーザーID、Cairn にいない参加者は guest- で始まる ID */
  id: string;
  name: string;
  kind: "member" | "guest";
  groupId?: string;
};

/**
 * 保存した配車プラン。ログインした部員だけが /plans/[id] で開ける。
 * result（PlanResult）からは、自宅の座標が入る直行の車のルート URL を目的地だけの URL に置き換えて保存する（lib/plans/sanitize.ts）。
 */
export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Cairn の山行（プロジェクト）の ID */
    cairnProjectId: text("cairn_project_id").notNull(),
    /** 作成時の山行名の写し（Cairn が読めないときも一覧を出せるように） */
    projectTitle: text("project_title").notNull(),
    destinationLabel: text("destination_label").notNull(),
    destinationLat: doublePrecision("destination_lat").notNull(),
    destinationLng: doublePrecision("destination_lng").notNull(),
    optimizationMode: text("optimization_mode").$type<OptimizationMode>().notNull(),
    participants: jsonb("participants").$type<PlanParticipant[]>().notNull(),
    result: jsonb("result").$type<PlanResult>().notNull(),
    notes: text("notes"),
    createdById: text("created_by_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("plans_project_idx").on(t.cairnProjectId, t.createdAt)],
);

export type Plan = typeof plans.$inferSelect;
