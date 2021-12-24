import { Token, TokenType } from '@gsens-lang/parsing/lib/lexing';
import { parse } from '@gsens-lang/parsing';
import { Senv, TypeEff } from '@gsens-lang/core/utils';
import { Bool, Real } from '@gsens-lang/core/utils/Type';
import { TypeCheckingResult, typeCheck, TypeCheckingSuccess } from './checker';
import { TypingSeeker } from '..';

const pipeline = (source: string): TypeCheckingResult => {
  const parsed = parse(source);

  return typeCheck(parsed.result);
};

describe('Typechecking', () => {
  test('One expression', () => {
    expect(pipeline('2 + 3;')).toStrictEqual(
      TypeCheckingSuccess(
        TypeEff(Real(), Senv()),
        new TypingSeeker([
          [
            new Token(TokenType.NUMBERLIT, '2', 2, 1, 1),
            TypeEff(Real(), Senv()),
          ],
          [
            new Token(TokenType.NUMBERLIT, '3', 3, 1, 5),
            TypeEff(Real(), Senv()),
          ],
        ]),
      ),
    );
  });

  test('A program', () => {
    expect(
      pipeline('2 + 3; { var x = 2; var y = x + 2; } true;'),
    ).toStrictEqual(
      TypeCheckingSuccess(
        TypeEff(Bool(), Senv()),
        new TypingSeeker([
          [
            new Token(TokenType.NUMBERLIT, '2', 2, 1, 1),
            TypeEff(Real(), Senv()),
          ],
          [
            new Token(TokenType.NUMBERLIT, '3', 3, 1, 5),
            TypeEff(Real(), Senv()),
          ],
          [
            new Token(TokenType.IDENTIFIER, 'x', null, 1, 14),
            TypeEff(Real(), Senv()),
          ],
          [
            new Token(TokenType.NUMBERLIT, '2', 2, 1, 18),
            TypeEff(Real(), Senv()),
          ],
          [
            new Token(TokenType.IDENTIFIER, 'y', null, 1, 25),
            TypeEff(Real(), Senv()),
          ],
          [
            new Token(TokenType.IDENTIFIER, 'x', null, 1, 29),
            TypeEff(Real(), Senv()),
          ],
          [
            new Token(TokenType.NUMBERLIT, '2', 2, 1, 33),
            TypeEff(Real(), Senv()),
          ],
          [
            new Token(TokenType.TRUE, 'true', null, 1, 38),
            TypeEff(Bool(), Senv()),
          ],
        ]),
      ),
    );
  });
});
