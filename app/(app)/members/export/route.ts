import { getDb } from '@/db';
import { getCurrentMember } from '@/lib/auth/current-member';
import { listAllWorkspaceMembers } from '@/lib/cairn/client';
import { CairnError, cairnErrorMessage } from '@/lib/cairn/errors';
import { buildAddressBookCsv } from '@/lib/io/addressBook';
import { listAllOrigins } from '@/lib/origins/service';

/** 部員の出発地を CSV で書き出す（配車係だけ）。Cairn にいない人の行は出さない */
export async function GET() {
  const me = await getCurrentMember();
  if (me.role !== 'kakari') return new Response('配車係だけが使える機能です', { status: 403 });
  let workspaceMembers;
  try {
    workspaceMembers = await listAllWorkspaceMembers();
  } catch (error) {
    if (error instanceof CairnError) return new Response(cairnErrorMessage(error, '部員の一覧'), { status: 502 });
    throw error;
  }
  const origins = new Map((await listAllOrigins(await getDb())).map((o) => [o.cairnUserId, o]));
  const rows = workspaceMembers
    .filter((m) => m.membershipStatus === 'active' && origins.has(m.userId))
    .map((m) => {
      const o = origins.get(m.userId)!;
      return {
        id: m.userId,
        name: m.name,
        addressInput: o.addressInput,
        isDriver: o.canDrive,
        vehicleCapacity: o.vehicleCapacity ?? undefined,
      };
    });
  const date = new Date().toISOString().slice(0, 10);
  // Excel で文字化けしないよう UTF-8 の BOM を付ける
  return new Response(`﻿${buildAddressBookCsv(rows)}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`配車さん-出発地-${date}.csv`)}`,
      'Cache-Control': 'no-store',
    },
  });
}
