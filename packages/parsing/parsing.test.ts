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

const exprStmt = (expression: Expression) =>
  Result<Statement[]>([ExprStmt({ expression })], []);

describe('Parsing booleans', () => {
  test('The thuth', () => {
    expect(lexAndParse('true;')).toStrictEqual<Result<Statement[]>>(
      exprStmt(
        Literal({
          value: true,
        }),
      ),
    );
  });

  test('The falsity 💔', () => {
    expect(lexAndParse('false;')).toStrictEqual<Result<Statement[]>>(
      exprStmt(
        Literal({
          value: false,
        }),
      ),
    );
  });
});

describe('Parsing numbers', () => {
  test('An integer', () => {
    expect(lexAndParse('2;')).toStrictEqual<Result<Statement[]>>(
      exprStmt(
        Literal({
          value: 2,
        }),
      ),
    );
  });

  test('A floating point', () => {
    expect(lexAndParse('3.42;')).toStrictEqual<Result<Statement[]>>(
      exprStmt(
        Literal({
          value: 3.42,
        }),
      ),
    );
  });
});

describe('Parsing variables', () => {
  test('A simple identifier', () => {
    expect(lexAndParse('x;')).toStrictEqual<Result<Statement[]>>(
      exprStmt(
        Variable({
          name: new Token(TokenType.IDENTIFIER, 'x', null, 1),
        }),
      ),
    );
  });
});

describe('Parsing groupings', () => {
  test('A simple parenthesized expression', () => {
    expect(lexAndParse('(2);')).toStrictEqual<Result<Statement[]>>(
      exprStmt(
        Grouping({
          expression: Literal({
            value: 2,
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
                value: 2,
              }),
            }),
          }),
        }),
      ),
    );
  });
});

describe('Parsing functions', () => {
  test('A simple function', () => {
    const x = new Token(TokenType.IDENTIFIER, 'x', null, 1);
    expect(lexAndParse('fun(x:Number) { x; };')).toStrictEqual<
      Result<Statement[]>
    >(
      exprStmt(
        Fun({
          binder: {
            name: x,
            type: Real(),
          },
          body: Block({
            statements: [
              ExprStmt({
                expression: Variable({
                  name: x,
                }),
              }),
            ],
          }),
        }),
      ),
    );
  });

  test('A simple function with Nil type', () => {
    const x = new Token(TokenType.IDENTIFIER, 'x', null, 1);
    expect(lexAndParse('fun(x:Nil) { x; };')).toStrictEqual<
      Result<Statement[]>
    >(
      exprStmt(
        Fun({
          binder: {
            name: x,
            type: Nil(),
          },
          body: Block({
            statements: [
              ExprStmt({
                expression: Variable({
                  name: x,
                }),
              }),
            ],
          }),
        }),
      ),
    );
  });
});

describe('Parsing calls', () => {
  test('Variable call', () => {
    const someFunction = new Token(
      TokenType.IDENTIFIER,
      'someFunction',
      null,
      1,
    );
    expect(lexAndParse('someFunction(2);')).toStrictEqual<Result<Statement[]>>(
      exprStmt(
        Call({
          callee: Variable({
            name: someFunction,
          }),
          arg: Literal({
            value: 2,
          }),
          paren: new Token(TokenType.RIGHT_PAREN, ')', null, 1),
        }),
      ),
    );
  });

  test('Variable call with nil', () => {
    const someFunction = new Token(
      TokenType.IDENTIFIER,
      'someFunction',
      null,
      1,
    );
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
          }),
          paren: new Token(TokenType.RIGHT_PAREN, ')', null, 1),
        }),
      ),
    );
  });

  test('Inline function call', () => {
    const x = new Token(TokenType.IDENTIFIER, 'x', null, 1);
    expect(lexAndParse('(fun(x:Number) {x;})(2);')).toStrictEqual<
      Result<Statement[]>
    >(
      exprStmt(
        Call({
          callee: Grouping({
            expression: Fun({
              binder: {
                name: x,
                type: Real(),
              },
              body: Block({
                statements: [
                  ExprStmt({
                    expression: Variable({
                      name: x,
                    }),
                  }),
                ],
              }),
            }),
          }),
          arg: Literal({
            value: 2,
          }),
          paren: new Token(TokenType.RIGHT_PAREN, ')', null, 1),
        }),
      ),
    );
  });
});

describe('Binary operators (*, +, <=)', () => {
  test('Leq comparison', () => {
    expect(lexAndParse('2 <= 34;')).toStrictEqual<Result<Statement[]>>(
      exprStmt(
        NonLinearBinary({
          operator: new Token(TokenType.LESS_EQUAL, '<=', null, 1),
          left: Literal({
            value: 2,
          }),
          right: Literal({
            value: 34,
          }),
        }),
      ),
    );
  });

  test('Multiplication', () => {
    expect(lexAndParse('2 * 34;')).toStrictEqual<Result<Statement[]>>(
      exprStmt(
        NonLinearBinary({
          operator: new Token(TokenType.STAR, '*', null, 1),
          left: Literal({
            value: 2,
          }),
          right: Literal({
            value: 34,
          }),
        }),
      ),
    );
  });

  test('Addition', () => {
    expect(lexAndParse('2 + 34;')).toStrictEqual<Result<Statement[]>>(
      exprStmt(
        Binary({
          operator: new Token(TokenType.PLUS, '+', null, 1),
          left: Literal({
            value: 2,
          }),
          right: Literal({
            value: 34,
          }),
        }),
      ),
    );
  });

  test('Predescence between multiplication and addition', () => {
    expect(lexAndParse('2 + 34 * 3;')).toStrictEqual<Result<Statement[]>>(
      exprStmt(
        Binary({
          operator: new Token(TokenType.PLUS, '+', null, 1),
          left: Literal({
            value: 2,
          }),
          right: NonLinearBinary({
            operator: new Token(TokenType.STAR, '*', null, 1),
            left: Literal({
              value: 34,
            }),
            right: Literal({
              value: 3,
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
          operator: new Token(TokenType.STAR, '*', null, 1),
          left: Grouping({
            expression: Binary({
              operator: new Token(TokenType.PLUS, '+', null, 1),
              left: Literal({
                value: 2,
              }),
              right: Literal({
                value: 34,
              }),
            }),
          }),
          right: Literal({
            value: 3,
          }),
        }),
      ),
    );
  });
});

describe('Parsing ascriptions', () => {
  test('A simple ascription', () => {
    expect(lexAndParse('2::Number@[3x];')).toStrictEqual<Result<Statement[]>>(
      exprStmt(
        Ascription({
          ascriptionToken: new Token(TokenType.COLON_COLON, '::', null, 1),
          expression: Literal({
            value: 2,
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
          ascriptionToken: new Token(TokenType.COLON_COLON, '::', null, 1),
          expression: Literal({
            value: 2,
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
          ascriptionToken: new Token(TokenType.COLON_COLON, '::', null, 1),
          expression: Literal({
            value: 2,
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
          ascriptionToken: new Token(TokenType.COLON_COLON, '::', null, 1),
          expression: Ascription({
            ascriptionToken: new Token(TokenType.COLON_COLON, '::', null, 1),
            expression: Literal({
              value: 2,
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

describe('Parsing block statements', () => {
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
    const x = new Token(TokenType.IDENTIFIER, 'x', null, 1);

    expect(lexAndParse('{1; x;}')).toStrictEqual<Result<Statement[]>>(
      Result(
        [
          Block({
            statements: [
              ExprStmt({
                expression: Literal({ value: 1 }),
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

describe('Parsing print statements', () => {
  test('A simple print', () => {
    expect(lexAndParse('print 2;')).toStrictEqual<Result<Statement[]>>(
      Result(
        [
          Print({
            showEvidence: false,
            expression: Literal({
              value: 2,
            }),
          }),
        ],
        [],
      ),
    );
  });
});

describe('Variable declarations', () => {
  test('A simple assignment', () => {
    const x = new Token(TokenType.IDENTIFIER, 'x', null, 1);
    expect(lexAndParse('var x = 2;')).toStrictEqual<Result<Statement[]>>(
      Result(
        [
          VarStmt({
            name: x,
            assignment: Literal({
              value: 2,
            }),
            resource: false,
          }),
        ],
        [],
      ),
    );
  });

  test('A function assignment', () => {
    const x = new Token(TokenType.IDENTIFIER, 'x', null, 1);
    const y = new Token(TokenType.IDENTIFIER, 'y', null, 1);
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
                name: y,
                type: Real(),
              },
              body: Block({
                statements: [
                  ExprStmt({
                    expression: Variable({
                      name: y,
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

describe('Getting failures', () => {
  test('Simple failure', () => {
    expect(lexAndParse('2 + * 4 <=;').failures).toContainEqual<Failure>(
      Failure(new Token(TokenType.STAR, '*', null, 1), errorMessage()),
    );
  });

  test('A good one and a bad one', () => {
    const { failures, result } = lexAndParse('2 + * 4 <=; 2 + 3;');

    expect(result).toStrictEqual<Statement[]>([
      ExprStmt({
        expression: Binary({
          operator: new Token(TokenType.PLUS, '+', null, 1),
          left: Literal({ value: 2 }),
          right: Literal({ value: 3 }),
        }),
      }),
    ]);

    expect(failures).toContainEqual<Failure>(
      Failure(new Token(TokenType.STAR, '*', null, 1), errorMessage()),
    );
  });

  test('Multiple failures', () => {
    const { failures } = lexAndParse('2 + * 4 <=; f(; var 8 = 2; var;');

    expect(failures).toHaveLength(4);
  });
});
