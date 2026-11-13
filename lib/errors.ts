/** 利用者にそのまま見せてよいエラー（入力の誤り・権限・見つからないなど） */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}
