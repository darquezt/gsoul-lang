import { Token, TokenType } from '@gsoul-lang/parsing/lib/lexing';
import { parse } from '@gsoul-lang/parsing';
import { Senv, TypeEff } from '@gsoul-lang/core/utils';
import { Bool, Real } from '@gsoul-lang/core/utils/Type';
import { TypeCheckingResult, typeCheck, TypeCheckingSuccess } from './checker';
import { TypingSeeker } from '..';

const pipeline = (source: string): TypeCheckingResult => {
  const parsed = parse(source);

  return typeCheck(parsed.result);
};

describe('Typechecking', () => {
  test('One expression', () => {
    const result = pipeline('2 + 3;');

    expect(result.success).toBe(true);

    expect((result as TypeCheckingSuccess).typeEff).toStrictEqual<TypeEff>(
      TypeEff(Real(), Senv()),
    );
  });

  test('A program', () => {
    const result = pipeline('2 + 3; { let x = 2; let y = x + 2; }; true;');
    expect(result.success).toBe(true);

    expect((result as TypeCheckingSuccess).typeEff).toStrictEqual<TypeEff>(
      TypeEff(Bool(), Senv()),
    );
  });

  describe('Typing seeker', () => {
    test('A program', () => {
      const result = pipeline('2 + 3; { let x = 2; let y = x + 2; }; true;');
      expect(result.success).toBe(true);

      expect((result as TypeCheckingSuccess).typings).toMatchObject(
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
            new Token(TokenType.TRUE, 'true', null, 1, 39),
            TypeEff(Bool(), Senv()),
          ],
        ]),
      );
    });
  });
});
