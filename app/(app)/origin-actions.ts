'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db';
import { getCurrentMember } from '@/lib/auth/current-member';
import { listAllWorkspaceMembers } from '@/lib/cairn/client';
import { CairnError, cairnErrorMessage } from '@/lib/cairn/errors';
import { DomainError } from '@/lib/errors';
import { createServerGateway } from '@/lib/google-maps/server';
import { deleteOrigin, saveOrigin } from '@/lib/origins/service';

export type OriginFormState = { ok: boolean; message: string | null };

/** 出発地の保存。本人か配車係だけ。配車係が代理で入れるときは、相手が Cairn の active な部員であることを確かめる */
export async function saveOriginAction(_prev: OriginFormState, formData: FormData): Promise<OriginFormState> {
  const me = await getCurrentMember();
  const target = String(formData.get('cairnUserId') ?? '');
  if (!target) return { ok: false, message: '部員が指定されていません。' };
  if (target !== me.cairnUserId && me.role !== 'kakari') {
    return { ok: false, message: '他の部員の出発地は、配車係だけが変更できます。' };
  }
  try {
    if (target !== me.cairnUserId) {
      const members = await listAllWorkspaceMembers();
      if (!members.some((m) => m.userId === target && m.membershipStatus === 'active')) {
        return { ok: false, message: 'Cairn のワークスペースの部員ではありません。' };
      }
    }
    const canDrive = formData.get('canDrive') === 'on';
    const capacityRaw = String(formData.get('vehicleCapacity') ?? '').trim();
    await saveOrigin(await getDb(), createServerGateway(), {
      cairnUserId: target,
      actorId: me.cairnUserId,
      origin: {
        addressInput: String(formData.get('addressInput') ?? ''),
        canDrive,
        vehicleCapacity: canDrive && capacityRaw !== '' ? Number(capacityRaw) : null,
      },
    });
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, message: error.message };
    if (error instanceof CairnError) return { ok: false, message: cairnErrorMessage(error, '部員の一覧') };
    console.error('[saveOriginAction] 保存できません', error);
    return { ok: false, message: error instanceof Error ? error.message : '保存できませんでした。' };
  }
  revalidatePath('/me');
  revalidatePath('/members');
  return { ok: true, message: '保存しました。' };
}

/** 出発地の削除。本人か配車係だけ */
export async function deleteOriginAction(formData: FormData): Promise<void> {
  const me = await getCurrentMember();
  const target = String(formData.get('cairnUserId') ?? '');
  if (target !== me.cairnUserId && me.role !== 'kakari') {
    throw new Error('他の部員の出発地は、配車係だけが削除できます。');
  }
  await deleteOrigin(await getDb(), target);
  revalidatePath('/me');
  revalidatePath('/members');
}
