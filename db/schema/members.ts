import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** 部員の役割。配車係は全部員の出発地の閲覧・代理入力・CSV 取り込みと、係の付け外しができる */
export const memberRoleEnum = pgEnum("member_role", ["member", "kakari"]);

/**
 * 配車さんにログインしたことがある部員。キーは Cairn のユーザーID（OIDC の ID トークンの `sub`）。
 * 表示名・アイコンは Cairn から取るので持たない。
 * 部員かどうかはログインのたびに Cairn の list_members で確かめる。この行は配車さん内の役割のためにある。
 */
export const members = pgTable("members", {
  cairnUserId: text("cairn_user_id").primaryKey(),
  role: memberRoleEnum("role").notNull().default("member"),
  /** ID トークンの email クレーム。開発用ログインでは null のまま */
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  /** 役割を最後に変えた配車係 */
  roleUpdatedById: text("role_updated_by_id"),
  roleUpdatedAt: timestamp("role_updated_at", { withTimezone: true }),
});

export type Member = typeof members.$inferSelect;
export type MemberRole = (typeof memberRoleEnum.enumValues)[number];
