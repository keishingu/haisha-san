import { sql } from "drizzle-orm";
import { boolean, check, doublePrecision, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * 部員ごとの出発地と車の既定値（1部員1行）。
 * キーは Cairn のユーザーID。配車係はまだログインしたことがない部員の分も登録できるので、members への外部キーは張らない。
 * 住所は個人情報なので、本人と配車係以外の画面には出さない。
 */
export const memberOrigins = pgTable(
  "member_origins",
  {
    cairnUserId: text("cairn_user_id").primaryKey(),
    addressInput: text("address_input").notNull(),
    /** 保存時に住所を解決した座標。解決できない住所は保存しない */
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    canDrive: boolean("can_drive").notNull().default(false),
    /** ドライバー本人を含む定員。運転できないときは null */
    vehicleCapacity: integer("vehicle_capacity"),
    /** 最後に変更した人（本人か配車係）の Cairn のユーザーID */
    updatedById: text("updated_by_id").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "member_origins_capacity",
      sql`(${t.canDrive} and ${t.vehicleCapacity} >= 1) or (not ${t.canDrive} and ${t.vehicleCapacity} is null)`,
    ),
  ],
);

export type MemberOrigin = typeof memberOrigins.$inferSelect;
