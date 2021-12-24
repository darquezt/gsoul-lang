import TokenType from './TokenType';

export type TokenLiteral = number | boolean;

export default class Token {
  constructor(
    public type: TokenType,
    public lexeme: string,
    public literal: TokenLiteral | null,
    public line: number,
    public col: number,
  ) {}

  toString(): string {
    return `code = ${this.type}, lexeme = '${this.lexeme}', value = ${this.literal}`;
  }
}
