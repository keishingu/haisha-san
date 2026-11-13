// 開発用の Cairn MCP サーバー（Cairn の PAT が手元に無いときに画面を通しで試すためのもの）。
// 返り値の形は、2026-11-03 に実際の Cairn MCP で確かめた形に合わせている。
// 名前・山行はすべて架空。本番では使わない（CAIRN_MCP_URL を明示的にこのサーバーへ向けたときだけ使われる）。
//
//   node scripts/dev-cairn-mcp.mjs            # http://localhost:3999/mcp
//   CAIRN_MCP_URL=http://localhost:3999/mcp CAIRN_PAT=dev pnpm dev
//
// 環境変数 DEV_CAIRN_FAIL=unauthorized で 401 を返し、Cairn に繋がらないときの画面を確かめられる。

import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const PORT = Number(process.env.DEV_CAIRN_PORT ?? 3999);

const iso = (offsetDays) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const attr = (name) => ({ id: `attr-${name}`, name });

const MEMBERS = [
  { userId: "00000000-0000-4000-8000-000000000001", name: "配車 係子", workspaceRole: "admin", membershipStatus: "active", profileAttributes: [attr("R1")] },
  { userId: "00000000-0000-4000-8000-000000000002", name: "山田 太郎", workspaceRole: "member", membershipStatus: "active", profileAttributes: [attr("R3")] },
  { userId: "00000000-0000-4000-8000-000000000003", name: "川口 花子", workspaceRole: "member", membershipStatus: "active", profileAttributes: [attr("R2")] },
  { userId: "00000000-0000-4000-8000-000000000004", name: "森 一郎", workspaceRole: "member", membershipStatus: "active", profileAttributes: [attr("R1")] },
  { userId: "00000000-0000-4000-8000-000000000005", name: "退部 済子", workspaceRole: "member", membershipStatus: "inactive", profileAttributes: [attr("R4")] },
];
const [kakari, yamada, kawaguchi, mori] = MEMBERS;

const project = (id, title, start, end, leader, members, extra = {}) => ({
  id,
  title,
  description: null,
  statusName: "計画中",
  statusColor: "#3B82F6",
  startDate: start === null ? null : iso(start),
  endDate: end === null ? null : iso(end),
  archived: false,
  memberCount: members.length + 1,
  memberNames: [leader.name, ...members.map((m) => m.name)],
  location: null,
  placeId: null,
  _leader: leader,
  _members: members,
  ...extra,
});

const PROJECTS = [
  project("10000000-0000-4000-8000-000000000001", "沢登り 架空沢", -3, -1, yamada, [mori], { location: "奥多摩" }),
  project("10000000-0000-4000-8000-000000000002", "岩稜 架空岳", 3, 5, kawaguchi, [kakari, yamada, mori], { location: "丹沢 大倉" }),
  project("10000000-0000-4000-8000-000000000003", "新人山行 架空丘", 4, 4, mori, [kawaguchi], { location: "河口湖" }),
  project("10000000-0000-4000-8000-000000000004", "縦走 架空連峰", 10, 13, yamada, [kawaguchi]),
  project("10000000-0000-4000-8000-000000000005", "日程未定の山行", null, null, kawaguchi, []),
  project("10000000-0000-4000-8000-000000000006", "去年の山行", -400, -398, yamada, [], { archived: true }),
];

// 先頭が _ の項目は、このサーバーの中だけで使う（返さない）
const publicProject = (p) => Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith("_")));
const text = (value) => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });

function buildServer() {
  const server = new McpServer({ name: "dev-cairn", version: "0.0.0" });
  server.registerTool("list_projects", { description: "List projects" }, async () =>
    text(PROJECTS.map(publicProject)),
  );
  server.registerTool(
    "get_project",
    { description: "Get one project", inputSchema: { projectId: z.string() } },
    async ({ projectId }) => {
      const p = PROJECTS.find((x) => x.id === projectId);
      if (!p) return { isError: true, content: [{ type: "text", text: "project not found" }] };
      return text({ ...publicProject(p), channelId: "dev-channel" });
    },
  );
  server.registerTool(
    "get_project_members",
    { description: "List project members", inputSchema: { projectId: z.string() } },
    async ({ projectId }) => {
      const p = PROJECTS.find((x) => x.id === projectId);
      if (!p) return { isError: true, content: [{ type: "text", text: "project not found" }] };
      const items = [
        { userId: p._leader.userId, name: p._leader.name, role: "leader", roleName: "リーダー", attendance: "attending" },
        ...p._members.map((m) => ({ userId: m.userId, name: m.name, role: "member", roleName: "メンバー", attendance: "attending" })),
      ];
      return text({ ok: true, items, returnedCount: items.length, totalCount: items.length, truncated: false });
    },
  );
  server.registerTool(
    "list_members",
    {
      description: "List workspace members",
      inputSchema: {
        query: z.string().optional(),
        attributeNames: z.array(z.string()).optional(),
        includeInactive: z.boolean().optional(),
        limit: z.number().optional(),
      },
    },
    async ({ query, includeInactive, limit = 50 }) => {
      const all = MEMBERS.filter(
        (m) => (includeInactive || m.membershipStatus === "active") && (!query || m.name.includes(query)),
      );
      const items = all.slice(0, limit);
      return text({ ok: true, items, returnedCount: items.length, totalCount: all.length, truncated: items.length < all.length });
    },
  );
  return server;
}

createServer(async (req, res) => {
  if (!req.url?.startsWith("/mcp")) {
    res.writeHead(404).end();
    return;
  }
  if (process.env.DEV_CAIRN_FAIL === "unauthorized" || !req.headers.authorization?.startsWith("Bearer ")) {
    res.writeHead(401, { "content-type": "application/json" }).end(JSON.stringify({ error: "unauthorized" }));
    return;
  }
  // 1リクエストごとにサーバーを作る（状態を持たない）
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res);
}).listen(PORT, () => {
  console.log(`dev Cairn MCP: http://localhost:${PORT}/mcp`);
  console.log(`配車係にするなら HAISHA_INITIAL_ADMIN_CAIRN_USER_IDS=${kakari.userId}`);
});
