import { Member, Destination } from '../types';

export type ValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
};

export function validateInputs(members: Member[], destination: Destination): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 目的地チェック
  if (!destination.addressInput.trim()) {
    errors.push('目的地を入力してください。');
  }

  // メンバーチェック
  if (members.length < 2) {
    errors.push('メンバーは2人以上必要です。');
  }

  // 各メンバーのチェック
  members.forEach((member, index) => {
    if (!member.name.trim()) {
      errors.push(`${index + 1}人目のメンバー名を入力してください。`);
    }
    if (!member.addressInput.trim()) {
      errors.push(`${member.name || `${index + 1}人目`}の住所を入力してください。`);
    }
    if (member.isDriver && (!member.vehicleCapacity || member.vehicleCapacity < 1)) {
      errors.push(`${member.name}の車の定員を1以上に設定してください。`);
    }
  });

  // 車ありメンバーがいない警告
  const drivers = members.filter(m => m.isDriver);
  if (drivers.length === 0) {
    warnings.push('車ありメンバーがいません。全員が公共交通で目的地へ向かいます。');
  }

  // 総定員チェック
  const totalCapacity = drivers.reduce((sum, d) => sum + (d.vehicleCapacity || 0), 0);
  if (totalCapacity > 0 && totalCapacity < members.length) {
    const shortage = members.length - totalCapacity;
    warnings.push(`全員を乗せるにはあと${shortage}席足りません。乗車できないメンバーは公共交通で目的地へ向かう案として表示します。`);
  }

  // 同乗グループの整合性チェック
  const groups = new Map<string, Member[]>();
  for (const m of members) {
    const gid = m.groupId?.trim();
    if (!gid) continue;
    groups.set(gid, [...(groups.get(gid) ?? []), m]);
  }
  const maxCapacity = drivers.reduce((max, d) => Math.max(max, d.vehicleCapacity || 0), 0);
  for (const [gid, groupMembers] of groups) {
    const groupDrivers = groupMembers.filter(m => m.isDriver);
    // 同一グループにドライバーが複数いると1台にまとめられないため、計算前にエラーで止める。
    if (groupDrivers.length > 1) {
      errors.push(`同乗グループ「${gid}」に車ありメンバーが${groupDrivers.length}人います。1つのグループに車ありは1人までにしてください。`);
      continue;
    }
    const passengers = groupMembers.filter(m => !m.isDriver);
    if (passengers.length === 0) continue;
    if (groupDrivers.length === 1) {
      // ドライバー固定グループは「同じ車」がハード制約のため、定員を超える指定は
      // 分割せず計算前にエラーで止める（定員未設定は別途エラーになるのでここでは除外）。
      const capacity = groupDrivers[0].vehicleCapacity;
      if (capacity && passengers.length > capacity - 1) {
        errors.push(`同乗グループ「${gid}」は「${groupDrivers[0].name}」の定員(${capacity}人)では乗り切れません（同乗${passengers.length}人）。グループの人数を減らすか定員を増やしてください。`);
      }
    } else if (passengers.length > Math.max(0, maxCapacity - 1)) {
      warnings.push(`同乗グループ「${gid}」(${passengers.length}人)を1台にまとめられる車がありません。公共交通で目的地へ向かう案になります。`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
