import { z } from "zod";

/**
 * Cairn MCP の返り値。2026-11-03 に山岳部のワークスペースで実際に呼んで確かめた形に合わせる。
 * 配車さんで使う項目だけを検証し、それ以外は捨てる。
 */

const dateOrNull = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

export const cairnProjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  statusName: z.string().nullable().optional(),
  statusColor: z.string().nullable().optional(),
  /** 空のことがある。表示と並び順にだけ使う */
  startDate: dateOrNull.optional().default(null),
  endDate: dateOrNull.optional().default(null),
  archived: z.boolean().optional().default(false),
  /** 山行の「場所」。配車の目的地の初期値にする */
  location: z.string().nullable().optional(),
  /** 場所の Google の Place ID。あれば座標の解決に使う */
  placeId: z.string().nullable().optional(),
  memberNames: z.array(z.string()).optional().default([]),
});
export type CairnProject = z.infer<typeof cairnProjectSchema>;

export const listProjectsResultSchema = z.array(cairnProjectSchema);

export const getProjectResultSchema = cairnProjectSchema;

export const cairnProjectMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  /** leader / member / reviewer など */
  role: z.string(),
  roleName: z.string().nullable().optional(),
  attendance: z.string().nullable().optional(),
});
export type CairnProjectMember = z.infer<typeof cairnProjectMemberSchema>;

export const getProjectMembersResultSchema = z.object({
  items: z.array(cairnProjectMemberSchema),
  totalCount: z.number().optional(),
  truncated: z.boolean().optional().default(false),
});

const profileAttributeSchema = z.object({ id: z.string(), name: z.string() });

export const cairnWorkspaceMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  workspaceRole: z.string().nullable().optional(),
  /** active 以外（退部など）は部員として扱わない */
  membershipStatus: z.string(),
  avatarUrl: z.string().nullable().optional(),
  profileAttributes: z.array(profileAttributeSchema).optional().default([]),
});
export type CairnWorkspaceMember = z.infer<typeof cairnWorkspaceMemberSchema>;

export const listMembersResultSchema = z.object({
  items: z.array(cairnWorkspaceMemberSchema),
  returnedCount: z.number().optional(),
  totalCount: z.number(),
  truncated: z.boolean(),
});
export type ListMembersResult = z.infer<typeof listMembersResultSchema>;
