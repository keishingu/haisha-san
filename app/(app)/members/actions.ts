'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db';
import { requireKakari } from '@/lib/auth/current-member';
import type { MemberRole } from '@/lib/auth/membership';
import { listAllWorkspaceMembers } from '@/lib/cairn/client';
import { CairnError, cairnErrorMessage } from '@/lib/cairn/errors';
import { DomainError } from '@/lib/errors';
import { createServerGateway } from '@/lib/google-maps/server';
import { AddressBookParseError } from '@/lib/io/addressBook';
import { changeMemberRole } from '@/lib/members/service';
import { planCsvImport } from '@/lib/origins/csv-import';
import { saveOrigin } from '@/lib/origins/service';

export type ImportState = { ok: boolean; messages: string[] } | null;

/**
 * CSV で出発地をまとめて登録する（配車係）。名前を Cairn の部員に対応づけられない行があれば何も取り込まない。
 * 住所を解決できなかった行は、それだけ取り込まずに知らせる。
 */
export async function importOriginsAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const me = await requireKakari();
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, messages: ['CSV ファイルを選んでください。'] };
  if (file.size > 512 * 1024) return { ok: false, messages: ['CSV ファイルが大きすぎます（512KB まで）。'] };

  let plan;
  try {
    const planned = planCsvImport(await file.text(), await listAllWorkspaceMembers());
    if (!planned.ok) return { ok: false, messages: ['何も取り込んでいません。', ...planned.problems] };
    plan = planned.plan;
  } catch (error) {
    if (error instanceof AddressBookParseError) return { ok: false, messages: [error.message] };
    if (error instanceof CairnError) return { ok: false, messages: [cairnErrorMessage(error, '部員の一覧')] };
    throw error;
  }

  const db = await getDb();
  const maps = createServerGateway();
  const failed: string[] = [];
  let saved = 0;
  for (const row of plan.rows) {
    try {
      await saveOrigin(db, maps, { cairnUserId: row.cairnUserId, actorId: me.cairnUserId, origin: row.origin });
      saved++;
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      failed.push(`${row.name}: ${error.message}`);
    }
  }
  revalidatePath('/members');
  return {
    ok: failed.length === 0,
    messages: [`${saved}人の出発地を登録しました。`, ...(failed.length > 0 ? ['次の人は登録できませんでした。', ...failed] : [])],
  };
}

/** 配車係の付け外し */
export async function setRoleAction(formData: FormData): Promise<void> {
  const me = await requireKakari();
  const target = String(formData.get('cairnUserId') ?? '');
  const newRole = String(formData.get('role') ?? '') as MemberRole;
  if (newRole !== 'member' && newRole !== 'kakari') throw new Error('役割が正しくありません');
  await changeMemberRole(await getDb(), {
    actorId: me.cairnUserId,
    targetCairnUserId: target,
    newRole,
    workspaceMembers: await listAllWorkspaceMembers(),
  });
  revalidatePath('/members');
}
