// 同乗グループの表示スタイル（バッジ色・ドット色・ラベル）を一元管理する。
// 入力画面のピッカーと結果画面のバッジで同じ色・ラベルを使い、対応関係を分かりやすくする。

export type GroupStyle = {
  badgeClass: string; // バッジ（背景＋文字＋枠）用のTailwindクラス
  dotClass: string; // 色見本ドット用のTailwindクラス
};

// 番号ごとの配色パレット。視認しやすく区別しやすい9色。
const PALETTE: GroupStyle[] = [
  { badgeClass: 'bg-rose-100 text-rose-800 border-rose-300', dotClass: 'bg-rose-500' },
  { badgeClass: 'bg-amber-100 text-amber-800 border-amber-300', dotClass: 'bg-amber-500' },
  { badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300', dotClass: 'bg-emerald-500' },
  { badgeClass: 'bg-sky-100 text-sky-800 border-sky-300', dotClass: 'bg-sky-500' },
  { badgeClass: 'bg-violet-100 text-violet-800 border-violet-300', dotClass: 'bg-violet-500' },
  { badgeClass: 'bg-pink-100 text-pink-800 border-pink-300', dotClass: 'bg-pink-500' },
  { badgeClass: 'bg-lime-100 text-lime-800 border-lime-300', dotClass: 'bg-lime-500' },
  { badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-300', dotClass: 'bg-cyan-500' },
  { badgeClass: 'bg-orange-100 text-orange-800 border-orange-300', dotClass: 'bg-orange-500' },
];

// グループピッカーで選べる番号（1〜9）。
export const GROUP_OPTIONS: string[] = PALETTE.map((_, i) => String(i + 1));

const CIRCLED = '①②③④⑤⑥⑦⑧⑨';

// groupId を 0 始まりのパレット添字に変換する。数字以外は文字コードから安定的に割り当てる。
function paletteIndex(groupId: string): number {
  const n = parseInt(groupId, 10);
  if (Number.isFinite(n)) {
    // 1始まりの番号を 0 始まりに。負や 0 も剰余で安全に丸める。
    return ((n - 1) % PALETTE.length + PALETTE.length) % PALETTE.length;
  }
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) hash = (hash + groupId.charCodeAt(i)) % PALETTE.length;
  return hash;
}

export function getGroupStyle(groupId: string): GroupStyle {
  return PALETTE[paletteIndex(groupId)];
}

// 「グループ①」のような表示ラベル。1〜9は丸数字、それ以外はそのまま付与する。
export function getGroupLabel(groupId: string): string {
  const n = parseInt(groupId, 10);
  if (Number.isFinite(n) && n >= 1 && n <= 9) return `グループ${CIRCLED[n - 1]}`;
  return `グループ${groupId}`;
}
