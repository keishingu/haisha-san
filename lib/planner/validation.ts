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

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
