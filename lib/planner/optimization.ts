// 割り当てスコアの最適化モード（重み）定義。assignment と入力UIの両方から参照する。

export type OptimizationMode = 'balanced' | 'driver' | 'gathering';

export type ScoreWeights = {
  detour: number; // ドライバーの遠回り時間
  access: number; // 車なしメンバーが集合地点へ向かう時間（集合時間）
  backtrack: number; // 目的地と逆方向へ戻る集合地点への罰則
  congestion: number; // 1台へ偏らせない軽い罰則
};

export const OPTIMIZATION_WEIGHTS: Record<OptimizationMode, ScoreWeights> = {
  // 遠回りと集合のしやすさをバランス（従来の既定値）
  balanced: { detour: 3, access: 2, backtrack: 2, congestion: 2 },
  // ドライバーの遠回りを最優先で小さくする
  driver: { detour: 5, access: 1, backtrack: 3, congestion: 2 },
  // 集合時間（車なしメンバーが集合地点へ向かう時間）を最優先で小さくする
  gathering: { detour: 1, access: 4, backtrack: 1, congestion: 2 },
};

export const DEFAULT_OPTIMIZATION_MODE: OptimizationMode = 'balanced';

export const OPTIMIZATION_OPTIONS: { mode: OptimizationMode; label: string; description: string }[] = [
  { mode: 'balanced', label: 'バランス', description: 'ドライバーの遠回りと集合のしやすさをバランスよく考慮します（おすすめ）。' },
  { mode: 'gathering', label: '集合のしやすさ重視', description: '車なしメンバーが集合地点へ向かう時間をなるべく短くします。' },
  { mode: 'driver', label: 'ドライバー負担重視', description: 'ドライバーの遠回り時間をなるべく小さくします。' },
];
