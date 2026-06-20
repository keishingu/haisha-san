import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// 住所・氏名・目的地・緯度経度を永続化しない方針を静的に担保する。
// LocalStorage / SessionStorage / IndexedDB への書き込みAPIをソースが使っていないことを確認する。
function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.ts$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('PIIをストレージへ保存しないこと（静的チェック）', () => {
  const root = join(__dirname, '..', '..');
  const dirs = ['lib', 'app', 'components'].map((d) => join(root, d));
  const files = dirs.flatMap(collectSourceFiles);

  const forbidden = [
    'localStorage.setItem',
    'sessionStorage.setItem',
    'indexedDB',
    'window.localStorage.setItem',
    'window.sessionStorage.setItem',
  ];

  it('書き込み系ストレージAPIを使用していないこと', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      for (const term of forbidden) {
        if (content.includes(term)) {
          offenders.push(`${file}: ${term}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
