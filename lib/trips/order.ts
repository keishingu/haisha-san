import type { CairnProject } from "@/lib/cairn/schemas";

/**
 * ホームに出す山行の並び（純粋関数）。アーカイブは出さない。
 * - これからの山行・実施中の山行（終了日が今日以降）を開始日が近い順に
 * - 日程未定の山行
 * - 終わった山行を新しい順に
 */
export function orderTrips(projects: readonly CairnProject[], today: string): CairnProject[] {
  const active = projects.filter((p) => !p.archived);
  const end = (p: CairnProject) => p.endDate ?? p.startDate;
  const upcoming = active
    .filter((p) => p.startDate && (end(p) ?? "") >= today)
    .sort((a, b) => a.startDate!.localeCompare(b.startDate!));
  const undated = active.filter((p) => !p.startDate);
  const past = active
    .filter((p) => p.startDate && (end(p) ?? "") < today)
    .sort((a, b) => b.startDate!.localeCompare(a.startDate!));
  return [...upcoming, ...undated, ...past];
}

/** 日程の表示（10/13〜10/16） */
export function formatTripDates(p: Pick<CairnProject, "startDate" | "endDate">): string {
  if (!p.startDate) return "日程未定";
  const f = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  if (!p.endDate || p.endDate === p.startDate) return f(p.startDate);
  return `${f(p.startDate)}〜${f(p.endDate)}`;
}

/** 日本時間の今日（YYYY-MM-DD） */
export function todayInJapan(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
