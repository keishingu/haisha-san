'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { getCurrentMember } from '@/lib/auth/current-member';
import { getProject, getProjectMembers } from '@/lib/cairn/client';
import { CairnError, cairnErrorMessage } from '@/lib/cairn/errors';
import { DomainError } from '@/lib/errors';
import { createServerGateway } from '@/lib/google-maps/server';
import type { PlanFormInput } from '@/lib/plans/input';
import { createPlan } from '@/lib/plans/service';

/** 配車を計算して保存し、プランの画面へ移る。失敗したら理由を返す（画面に出す） */
export async function createPlanAction(input: PlanFormInput): Promise<{ error: string }> {
  const me = await getCurrentMember();
  let planId: string;
  try {
    const [project, projectMembers] = await Promise.all([getProject(input.projectId), getProjectMembers(input.projectId)]);
    const plan = await createPlan(await getDb(), createServerGateway(), {
      actor: me,
      project,
      projectMembers: projectMembers.items,
      input,
    });
    planId = plan.id;
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    if (error instanceof CairnError) return { error: cairnErrorMessage(error) };
    console.error('[createPlanAction] 配車を作れません', error);
    return { error: error instanceof Error ? error.message : '配車を計算できませんでした。' };
  }
  redirect(`/plans/${planId}`);
}
