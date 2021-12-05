import { Sens, Senv, TypeEff } from '@gsens-lang/core/utils';
import { UnknownSens } from '@gsens-lang/core/utils/Sens';
import { Nil, Real } from '@gsens-lang/core/utils/Type';
import {
  Ascription,
  Binary,
  Block,
  Call,
  Expression,
  ExprStmt,
  Fun,
  Grouping,
  Literal,
  NonLinearBinary,
  Print,
  Statement,
  Variable,
  VarStmt,
} from './ast';
import { errorMessage } from './errors';
import { scanTokens } from './lexing/lexing';
import Token from './lexing/Token';
import TokenType from './lexing/TokenType';
import { Failure, parse, Result } from './parsing';

const lexAndParse = (source: string) => parse(scanTokens(source));

const variableToken = (name = 'x', line = 1, col = 1) =>
  new Token(TokenType.IDENTIFIER, name, null, line, col);

const exprStmt = (expression: Expression) =>
  Result<Statement[]>([ExprStmt({ expression })], []);

describe('Parsing', () => {
  describe('booleans', () => {
    test('The thuth', () => {
      expect(lexAndParse('true;')).toStrictEqual<Result<Statement[]>>(
        exprStmt(
          Literal({
            value: true,
            token: new Token(TokenType.TRUE, 'true', null, 1, 1),
          }),
        ),
      );
    });

    test('The falsity 💔', () => {
      expect(lexAndParse('false;')).toStrictEqual<Result<Statement[]>>(
        exprStmt(
          Literal({
            value: false,
            token: new Token(TokenType.FALSE, 'false', null, 1, 1),
          }),
        ),
      );
    });
  });

  describe('numbers', () => {
    test('An integer', () => {
      expect(lexAndParse('2;')).toStrictEqual<Result<Statement[]>>(
        exprStmt(
          Literal({
            value: 2,
            token: new Token(TokenType.NUMBERLIT, '2', 2, 1, 1),
          }),
        ),
      );
    });

    test('A floating point', () => {
      expect(lexAndParse('3.42;')).toStrictEqual<Result<Statement[]>>(
        exprStmt(
          Literal({
            value: 3.42,
            token: new Token(TokenType.NUMBERLIT, '3.42', 3.42, 1, 1),
          }),
        ),
      );
    });
  });

  describe('variables', () => {
    test('A simple identifier', () => {
      expect(lexAndParse('x;')).toStrictEqual<Result<Statement[]>>(
        exprStmt(
          Variable({
            name: variableToken(),
          }),
        ),
      );
    });
  });

  describe('groupings', () => {
    test('A simple parenthesized expression', () => {
      expect(lexAndParse('(2);')).toStrictEqual<Result<Statement[]>>(
        exprStmt(
          Grouping({
            expression: Literal({
              value: 2,
              token: new Token(TokenType.NUMBERLIT, '2', 2, 1, 2),
            }),
          }),
        ),
      );
    });

    test('A ridiculously parenthesized expression', () => {
      expect(lexAndParse('(((2)));')).toStrictEqual<Result<Statement[]>>(
        exprStmt(
          Grouping({
            expression: Grouping({
              expression: Grouping({
                expression: Literal({
                  token: new Token(TokenType.NUMBERLIT, '2', 2, 1, 4),
                  value: 2,
                }),
              }),
            }),
          }),
        ),
      );
    });
  });

  describe('functions', () => {
    test('A simple function', () => {
      expect(lexAndParse('fun(x:Number) { x; };')).toStrictEqual<
        Result<Statement[]>
      >(
        exprStmt(
          Fun({
            binder: {
              name: variableToken('x', 1, 5),
              type: Real(),
            },
            body: Block({
              statements: [
                ExprStmt({
                  expression: Variable({
                    name: variableToken('x', 1, 17),
                  }),
                }),
              ],
            }),
          }),
        ),
      );
    });

    test('A simple function with Nil type', () => {
      expect(lexAndParse('fun(x:Nil) { x; };')).toStrictEqual<
        Result<Statement[]>
      >(
        exprStmt(
          Fun({
            binder: {
              name: variableToken('x', 1, 5),
              type: Nil(),
            },
            body: Block({
              statements: [
                ExprStmt({
                  expression: Variable({
                    name: variableToken('x', 1, 14),
                  }),
                }),
              ],
            }),
          }),
        ),
      );
    });
  });

  describe('calls', () => {
    test('Variable call', () => {
      const someFunction = variableToken('someFunction');
      expect(lexAndParse('someFunction(2);')).toStrictEqual<
        Result<Statement[]>
      >(
        exprStmt(
          Call({
            callee: Variable({
              name: someFunction,
            }),
            arg: Literal({
              value: 2,
              token: new Token(TokenType.NUMBERLIT, '2', 2, 1, 14),
            }),
            paren: new Token(TokenType.RIGHT_PAREN, ')', null, 1, 15),
          }),
        ),
      );
    });

    test('Variable call with nil', () => {
      const someFunction = variableToken('someFunction');
      expect(lexAndParse('someFunction(nil);')).toStrictEqual<
        Result<Statement[]>
      >(
        exprStmt(
          Call({
            callee: Variable({
              name: someFunction,
            }),
            arg: Literal({
              value: null,
              token: new Token(TokenType.NILLIT, 'nil', null, 1, 14),
            }),
            paren: new Token(TokenType.RIGHT_PAREN, ')', null, 1, 17),
          }),
        ),
      );
    });

    test('Inline function call', () => {
      expect(lexAndParse('(fun(x:Number) {x;})(2);')).toStrictEqual<
        Result<Statement[]>
      >(
        exprStmt(
          Call({
            callee: Grouping({
              expression: Fun({
                binder: {
                  name: variableToken('x', 1, 6),
                  type: Real(),
                },
                body: Block({
                  statements: [
                    ExprStmt({
                      expression: Variable({
                        name: variableToken('x', 1, 17),
                      }),
                    }),
                  ],
                }),
              }),
            }),
            arg: Literal({
              value: 2,
              token: new Token(TokenType.NUMBERLIT, '2', 2, 1, 22),
            }),
            paren: new Token(TokenType.RIGHT_PAREN, ')', null, 1, 23),
          }),
        ),
      );
    });
  });

  describe('binary operators (*, +, <=)', () => {
    test('Leq comparison', () => {
      expect(lexAndParse('2 <= 34;')).toStrictEqual<Result<Statement[]>>(
        exprStmt(
          NonLinearBinary({
            operator: new Token(TokenType.LESS_EQUAL, '<=', null, 1, 3),
            left: Literal({
              value: 2,
              token: new Token(TokenType.NUMBERLIT, '2', 2, 1, 1),
            }),
            right: Literal({
              value: 34,
              token: new Token(TokenType.NUMBERLIT, '34', 34, 1, 6),
            }),
          }),
        ),
      );
    });

    test('Multiplication', () => {
      expect(lexAndParse('2 * 34;')).toStrictEqual<Result<Statement[]>>(
        exprStmt(
          NonLinearBinary({
            operator: new Token(TokenType.STAR, '*', null, 1, 3),
            left: Literal({
              value: 2,
              token: new Token(TokenType.NUMBERLIT, '2', 2, 1, 1),
            }),
            right: Literal({
              value: 34,
              token: new Token(TokenType.NUMBERLIT, '34', 34, 1, 5),
            }),
          }),
        ),
      );
    });

    test('Addition', () => {
      expect(lexAndParse('2 + 34;')).toStrictEqual<Result<Statement[]>>(
        exprStmt(
          Binary({
            operator: new Token(TokenType.PLUS, '+', null, 1, 3),
            left: Literal({
              value: 2,
              token: new Token(TokenType.NUMBERLIT, '2', 2, 1, 1),
            }),
            right: Literal({
              value: 34,
              token: new Token(TokenType.NUMBERLIT, '34', 34, 1, 5),
            }),
          }),
        ),
      );
    });

    test('Predescence between multiplication and addition', () => {
      expect(lexAndParse('2 + 34 * 3;')).toStrictEqual<Result<Statement[]>>(
        exprStmt(
          Binary({
            operator: new Token(TokenType.PLUS, '+', null, 1, 3),
            left: Literal({
              value: 2,
              token: new Token(TokenType.NUMBERLIT, '2', 2, 1, 1),
            }),
            right: NonLinearBinary({
              operator: new Token(TokenType.STAR, '*', null, 1, 8),
              left: Literal({
                value: 34,
                token: new Token(TokenType.NUMBERLIT, '34', 34, 1, 5),
              }),
              right: Literal({
                value: 3,
                token: new Token(TokenType.NUMBERLIT, '3', 3, 1, 10),
              }),
            }),
          }),
        ),
      );
    });

    test('Predescence between multiplication and addition with groupings', () => {
      expect(lexAndParse('(2 + 34) * 3;')).toStrictEqual<Result<Statement[]>>(
        exprStmt(
          NonLinearBinary({
            operator: new Token(TokenType.STAR, '*', null, 1, 10),
            left: Grouping({
              expression: Binary({
                operator: new Token(TokenType.PLUS, '+', null, 1, 4),
                left: Literal({
                  value: 2,
                  token: new Token(TokenType.NUMBERLIT, '2', 2, 1, 2),
                }),
                right: Literal({
                  value: 34,
                  token: new Token(TokenType.NUMBERLIT, '34', 34, 1, 6),
                }),
              }),
            }),
            right: Literal({
              value: 3,
              token: new Token(TokenType.NUMBERLIT, '3', 3, 1, 12),
            }),
          }),
        ),
      );
    });
  });

  describe('ascriptions', () => {
    test('A simple ascription', () => {
      expect(lexAndParse('2::Number@[3x];')).toStrictEqual<Result<Statement[]>>(
        exprStmt(
          Ascription({
            ascriptionToken: new Token(TokenType.COLON_COLON, '::', null, 1, 2),
            expression: Literal({
              value: 2,
              token: new Token(TokenType.NUMBERLIT, '2', 2, 1, 1),
            }),
            typeEff: TypeEff(
              Real(),
              Senv({
                x: Sens(3),
              }),
            ),
          }),
        ),
      );
    });

    test('An ascription with floating point sensitivities', () => {
      expect(lexAndParse('2::Number@[31.34x];')).toStrictEqual<
        Result<Statement[]>
      >(
        exprStmt(
          Ascription({
            ascriptionToken: new Token(TokenType.COLON_COLON, '::', null, 1, 2),
            expression: Literal({
              value: 2,
              token: new Token(TokenType.NUMBERLIT, '2', 2, 1, 1),
            }),
            typeEff: TypeEff(
              Real(),
              Senv({
                x: Sens(31.34),
              }),
            ),
          }),
        ),
      );
    });

    test('An ascription with an unknown sensitivity', () => {
      expect(lexAndParse('2::Number@[2y + ?x + 3z];')).toStrictEqual<
        Result<Statement[]>
      >(
        exprStmt(
          Ascription({
            ascriptionToken: new Token(TokenType.COLON_COLON, '::', null, 1, 2),
            expression: Literal({
              value: 2,
              token: new Token(TokenType.NUMBERLIT, '2', 2, 1, 1),
            }),
            typeEff: TypeEff(
              Real(),
              Senv({
                x: UnknownSens(),
                y: Sens(2),
                z: Sens(3),
              }),
            ),
          }),
        ),
      );
    });

    test('A multi-ascription', () => {
      expect(lexAndParse('2::Number@[3x]::Number@[4x];')).toStrictEqual<
        Result<Statement[]>
      >(
        exprStmt(
          Ascription({
            ascriptionToken: new Token(
              TokenType.COLON_COLON,
              '::',
              null,
              1,
              15,
            ),
            expression: Ascription({
              ascriptionToken: new Token(
                TokenType.COLON_COLON,
                '::',
                null,
                1,
                2,
              ),
              expression: Literal({
                value: 2,
                token: new Token(TokenType.NUMBERLIT, '2', 2, 1, 1),
              }),
              typeEff: TypeEff(
                Real(),
                Senv({
                  x: Sens(3),
                }),
              ),
            }),
            typeEff: TypeEff(
              Real(),
              Senv({
                x: Sens(4),
              }),
            ),
          }),
        ),
      );
    });
  });

  describe('block statements', () => {
    test('An empty block', () => {
      expect(lexAndParse('{}')).toStrictEqual<Result<Statement[]>>(
        Result(
          [
            Block({
              statements: [],
            }),
          ],
          [],
        ),
      );
    });

    test('A block with multiple statements', () => {
      const x = variableToken('x', 1, 5);

      expect(lexAndParse('{1; x;}')).toStrictEqual<Result<Statement[]>>(
        Result(
          [
            Block({
              statements: [
                ExprStmt({
                  expression: Literal({
                    value: 1,
                    token: new Token(TokenType.NUMBERLIT, '1', 1, 1, 2),
                  }),
                }),
                ExprStmt({
                  expression: Variable({ name: x }),
                }),
              ],
            }),
          ],
          [],
        ),
      );
    });
  });

  describe('print statements', () => {
    test('A simple print', () => {
      expect(lexAndParse('print 2;')).toStrictEqual<Result<Statement[]>>(
        Result(
          [
            Print({
              showEvidence: false,
              expression: Literal({
                value: 2,
                token: new Token(TokenType.NUMBERLIT, '2', 2, 1, 7),
              }),
              token: new Token(TokenType.PRINT, 'print', null, 1, 1),
            }),
          ],
          [],
        ),
      );
    });
  });

  describe('Variable declarations', () => {
    test('A simple assignment', () => {
      const x = variableToken('x', 1, 5);
      expect(lexAndParse('var x = 2;')).toStrictEqual<Result<Statement[]>>(
        Result(
          [
            VarStmt({
              name: x,
              assignment: Literal({
                value: 2,
                token: new Token(TokenType.NUMBERLIT, '2', 2, 1, 9),
              }),
              resource: false,
            }),
          ],
          [],
        ),
      );
    });

    test('A function assignment', () => {
      const x = variableToken('x', 1, 5);
      expect(lexAndParse('var x = fun(y: Number) {y;};')).toStrictEqual<
        Result<Statement[]>
      >(
        Result(
          [
            VarStmt({
              name: x,
              resource: false,
              assignment: Fun({
                binder: {
                  name: variableToken('y', 1, 13),
                  type: Real(),
                },
                body: Block({
                  statements: [
                    ExprStmt({
                      expression: Variable({
                        name: variableToken('y', 1, 25),
                      }),
                    }),
                  ],
                }),
              }),
            }),
          ],
          [],
        ),
      );
    });
  });

  describe('failures', () => {
    test('Simple failure', () => {
      expect(lexAndParse('2 + * 4 <=;').failures).toContainEqual<Failure>(
        Failure(new Token(TokenType.STAR, '*', null, 1, 5), errorMessage()),
      );
    });

    test('A good one and a bad one', () => {
      const { failures, result } = lexAndParse('2 + * 4 <=; 2 + 3;');

      expect(result).toStrictEqual<Statement[]>([
        ExprStmt({
          expression: Binary({
            operator: new Token(TokenType.PLUS, '+', null, 1, 15),
            left: Literal({
              value: 2,
              token: new Token(TokenType.NUMBERLIT, '2', 2, 1, 13),
            }),
            right: Literal({
              value: 3,
              token: new Token(TokenType.NUMBERLIT, '3', 3, 1, 17),
            }),
          }),
        }),
      ]);

      expect(failures).toContainEqual<Failure>(
        Failure(new Token(TokenType.STAR, '*', null, 1, 5), errorMessage()),
      );
    });

    test('Multiple failures', () => {
      const { failures } = lexAndParse('2 + * 4 <=; f(; var 8 = 2; var;');

      expect(failures).toHaveLength(4);
    });
  });
});
