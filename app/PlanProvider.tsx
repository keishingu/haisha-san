'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { Member, Destination, PlanResult, LatLng } from '@/lib/types';

// 入力・結果をルート（/ と /result）間で共有するためのメモリ上ストア。
// 住所・氏名・目的地はここ（Reactメモリ）だけで保持し、永続化しない。
export type ComputedPlan = {
  planResult: PlanResult;
  resultMembers: Member[]; // 結果表示用（氏名のみ。住所/緯度経度は保持しない）
  destinationLabel: string;
  destinationLocation: LatLng; // 共有リンク（目的地ピン）生成用。共有URLには座標生値は残さずリンクのみ。
  shareText: string;
};

type PlanContextValue = {
  members: Member[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  destination: Destination;
  setDestination: React.Dispatch<React.SetStateAction<Destination>>;
  plan: ComputedPlan | null;
  setPlan: React.Dispatch<React.SetStateAction<ComputedPlan | null>>;
};

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [destination, setDestination] = useState<Destination>({ addressInput: '' });
  const [plan, setPlan] = useState<ComputedPlan | null>(null);

  return (
    <PlanContext.Provider value={{ members, setMembers, destination, setDestination, plan, setPlan }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within PlanProvider');
  return ctx;
}
