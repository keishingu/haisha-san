import { parseAddressBookCsv } from "@/lib/io/addressBook";
import type { CairnWorkspaceMember } from "@/lib/cairn/schemas";
import type { OriginInput } from "./schema";

/** 名前の比べ方: 前後と間の空白（全角を含む）を無視する */
export function normalizeName(name: string): string {
  return name.replace(/[\s　]+/g, "");
}

export type CsvImportPlan = { rows: { cairnUserId: string; name: string; origin: OriginInput }[] };

/**
 * CSV（氏名・住所・運転・定員）を、Cairn の active な部員に名前で対応づける（純粋関数）。
 * 見つからない名前・同じ名前の部員が2人以上いる名前・住所が空の行があれば、何も取り込まずに全部の問題を返す。
 */
export function planCsvImport(
  csv: string,
  workspaceMembers: readonly CairnWorkspaceMember[],
): { ok: true; plan: CsvImportPlan } | { ok: false; problems: string[] } {
  const parsed = parseAddressBookCsv(csv);
  const active = workspaceMembers.filter((m) => m.membershipStatus === "active");
  const byName = new Map<string, CairnWorkspaceMember[]>();
  for (const m of active) {
    const key = normalizeName(m.name);
    byName.set(key, [...(byName.get(key) ?? []), m]);
  }

  const problems: string[] = [];
  const rows: CsvImportPlan["rows"] = [];
  const seen = new Set<string>();
  for (const row of parsed) {
    const matches = byName.get(normalizeName(row.name)) ?? [];
    if (matches.length === 0) {
      problems.push(`「${row.name}」は Cairn の部員に見つかりません。`);
      continue;
    }
    if (matches.length > 1) {
      problems.push(`「${row.name}」という部員が ${matches.length} 人いるため、どちらか決められません。画面から個別に入れてください。`);
      continue;
    }
    if (!row.addressInput) {
      problems.push(`「${row.name}」の住所が空です。`);
      continue;
    }
    const target = matches[0];
    if (seen.has(target.userId)) {
      problems.push(`「${row.name}」が CSV に2回以上出てきます。`);
      continue;
    }
    seen.add(target.userId);
    rows.push({
      cairnUserId: target.userId,
      name: target.name,
      origin: {
        addressInput: row.addressInput,
        canDrive: row.isDriver,
        vehicleCapacity: row.isDriver ? (row.vehicleCapacity ?? null) : null,
      },
    });
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, plan: { rows } };
}
