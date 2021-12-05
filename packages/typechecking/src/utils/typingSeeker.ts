import { TypeEff } from '@gsens-lang/core/utils';
import Token from '@gsens-lang/parsing/lexing/Token';

export type TypeAssoc = [Token, TypeEff];
export type TypeAssocs = Array<TypeAssoc>;

export class TypingSeeker {
  constructor(private assocs: TypeAssocs = []) {}

  get(line: number, column: number): TypeAssoc | null {
    const result = this.assocs.find(
      ([token]) =>
        token.line === line &&
        token.col <= column &&
        column <= token.col + token.lexeme.length,
    );

    if (!result) {
      return null;
    }

    return result;
  }
}
