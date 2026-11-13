import { PlanProvider } from './PlanProvider';

/** サンプルモード。ログイン不要で、入力と結果はブラウザのメモリだけに持つ */
export default function SampleLayout({ children }: { children: React.ReactNode }) {
  return <PlanProvider>{children}</PlanProvider>;
}
