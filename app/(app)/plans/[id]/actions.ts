'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { getCurrentMember } from '@/lib/auth/current-member';
import { getProjectMembers } from '@/lib/cairn/client';
import { CairnError, cairnErrorMessage } from '@/lib/cairn/errors';
import { DomainError } from '@/lib/errors';
import { deletePlan, getPlan } from '@/lib/plans/service';

/** プランを消す。作った人・山行のリーダー・配車係だけ */
export async function deletePlanAction(_prev: string | null, formData: FormData): Promise<string | null> {
  const me = await getCurrentMember();
  const planId = String(formData.get('planId') ?? '');
  const db = await getDb();
  let projectId: string;
  try {
    const plan = await getPlan(db, planId);
    if (!plan) return 'プランが見つかりません。';
    projectId = plan.cairnProjectId;
    // リーダーかどうかは、作った人・配車係でないときだけ Cairn に確かめる
    let leaderIds = new Set<string>();
    if (me.role !== 'kakari' && plan.createdById !== me.cairnUserId) {
      const members = await getProjectMembers(plan.cairnProjectId);
      leaderIds = new Set(members.items.filter((m) => m.role === 'leader').map((m) => m.userId));
    }
    await deletePlan(db, { actor: me, planId, leaderIds });
  } catch (error) {
    if (error instanceof DomainError) return error.message;
    if (error instanceof CairnError) return cairnErrorMessage(error, '山行のメンバー');
    throw error;
  }
  redirect(`/trips/${projectId}`);
}
