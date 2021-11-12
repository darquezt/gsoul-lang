import { Sens, Senv, SenvUtils, Type, TypeEff } from '@gsens-lang/core/utils';
import { UnknownSens } from '@gsens-lang/core/utils/Sens';
import { Arrow, Bool, Nil, Real } from '@gsens-lang/core/utils/Type';

import {
  Expression,
  Statement,
  Literal,
  Fun,
  Variable,
  Grouping,
  VarStmt,
  Call,
  ExprStmt,
  Print,
  Ascription,
  Binary,
  Block,
  NonLinearBinary,
} from './ast';
import Token from './lexing/Token';
import TokenType from './lexing/TokenType';
import { errorMessage } from './errors';

// const MAX_ARGS = 255;

export type Failure = { token: Token; reason?: string };
export const Failure = (token: Token, reason?: string): Failure => ({
  token,
  reason,
});

export type Result<T> = {
  result: T;
  failures: Failure[];
};
export const Result = <T>(result: T, failures: Failure[]): Result<T> => ({
  result,
  failures,
});

class ParseError extends Error {
  constructor(public token: Token, public reason?: string) {
    super();
  }
}

export function parse(tokens: Token[]): Result<Statement[]> {
  let current = 0;

  const statements: Statement[] = [];
  const failures: Failure[] = [];

  function declaration(): Statement | null {
    return synchronized(() => {
      if (check(TokenType.VAR)) {
        return varDeclaration(false);
      }
      if (check(TokenType.RESOURCE)) {
        return varDeclaration(true);
      }

      return statement();
    });
  }

  function varDeclaration(resource = false): Statement {
    consume(
      resource ? TokenType.RESOURCE : TokenType.VAR,
      errorMessage({
        expected: '`var` keyword',
        beginning: 'a variable declaration',
      }),
    );

    const name = consume(
      TokenType.IDENTIFIER,
      errorMessage({ expected: 'variable name' }),
    );

    consume(
      TokenType.EQUAL,
      errorMessage({
        expected: '= (equal sign)',
        after: 'variable name',
      }),
    );

    const assignment = expression();

    consume(
      TokenType.SEMICOLON,
      errorMessage({ expected: ';', after: 'variable declaration' }),
    );

    return VarStmt({ name, assignment, resource });
  }

  function statement(): Statement {
    if (match(TokenType.PRINT)) {
      return printStatement(false);
    }
    if (match(TokenType.PRINTEV)) {
      return printStatement(true);
    }
    if (check(TokenType.LEFT_BRACE)) {
      return block();
    }

    return expressionStatement();
  }

  function block(): Statement {
    consume(
      TokenType.LEFT_BRACE,
      errorMessage({ expected: '{', beginning: 'a block' }),
    );

    const statements: Statement[] = [];

    while (!check(TokenType.RIGHT_BRACE) && !isAtEnd()) {
      const decl = declaration();

      if (decl) {
        statements.push(decl);
      }
    }

    consume(
      TokenType.RIGHT_BRACE,
      errorMessage({ expected: '}', end: 'a block' }),
    );

    return Block({
      statements,
    });
  }

  function expressionStatement(): Statement {
    const value = expression();

    consume(
      TokenType.SEMICOLON,
      errorMessage({
        expected: ';',
        end: 'a statement',
      }),
    );

    return ExprStmt({
      expression: value,
    });
  }

  function printStatement(showEvidence = false): Statement {
    const value = expression();

    consume(
      TokenType.SEMICOLON,
      errorMessage({
        expected: ';',
        end: 'a statement',
      }),
    );

    return Print({
      expression: value,
      showEvidence,
    });
  }

  function expression(): Expression {
    return ascription();
  }

  function ascription(): Expression {
    let expr: Expression = equality();

    while (match(TokenType.COLON_COLON)) {
      const ascrTE = typeEff();
      expr = Ascription({
        expression: expr,
        typeEff: ascrTE,
        ascriptionToken: previous(),
      });
    }

    return expr;
  }

  function equality(): Expression {
    const expr = comparison();

    // while (match(TokenType.BANG_EQUAL, TokenType.EQUAL_EQUAL)) {
    //   const operator = previous();
    //   const right = comparison();
    //   expr = new Binary(operator, expr, right);
    // }

    return expr;
  }

  function comparison(): Expression {
    let expr: Expression = additive();

    while (
      match(
        // TokenType.GREATER,
        // TokenType.GREATER_EQUAL,
        // TokenType.LESS,
        TokenType.LESS_EQUAL,
      )
    ) {
      const operator = previous();
      const right = additive();
      expr = NonLinearBinary({
        operator,
        left: expr,
        right,
      });
    }

    return expr;
  }

  function additive(): Expression {
    let expr = multiplicative();

    while (match(TokenType.MINUS, TokenType.PLUS, TokenType.PLUS_PLUS)) {
      const operator = previous();
      const right = multiplicative();
      expr = Binary({
        operator,
        left: expr,
        right,
      });
    }

    return expr;
  }

  function multiplicative(): Expression {
    let expr = unary();

    while (match(TokenType.SLASH, TokenType.STAR)) {
      const operator = previous();
      const right = unary();
      expr = NonLinearBinary({
        operator,
        left: expr,
        right,
      });
    }

    return expr;
  }

  function unary(): Expression {
    // if (match(TokenType.BANG, TokenType.MINUS)) {
    //   const operator = previous();
    //   const right = unary();
    //   return new Unary(operator, right);
    // }

    return call();
  }

  function call(): Expression {
    const callee = primary();

    // // eslint-disable-next-line no-constant-condition
    // while (true) {
    //   if (match(TokenType.LEFT_PAREN)) {
    //     expr = finishCall(expr);
    //   } else if (match(TokenType.DOT)) {
    //     const name = consume(
    //       TokenType.IDENTIFIER,
    //       'Expected identifier after ".".',
    //     );

    //     expr = new Getter(expr, name);
    //   } else {
    //     break;
    //   }
    // }
    if (match(TokenType.LEFT_PAREN)) {
      const arg = expression();

      const paren = consume(
        TokenType.RIGHT_PAREN,
        errorMessage({
          expected: ')',
          end: 'a function call',
        }),
      );

      return Call({
        callee,
        arg,
        paren,
      });
    }

    return callee;
  }

  function primary(): Expression {
    if (match(TokenType.FALSE)) {
      return Literal({ value: false });
    } else if (match(TokenType.TRUE)) {
      return Literal({ value: true });
    } else if (match(TokenType.NILLIT)) {
      return Literal({ value: null });
    } else if (match(TokenType.FUN)) {
      consume(
        TokenType.LEFT_PAREN,
        errorMessage({
          expected: '(',
          after: '`fun` keyword',
        }),
      );
      const paramName = consume(
        TokenType.IDENTIFIER,
        errorMessage({
          expected: 'argument name',
          beginning: 'a function parameters',
        }),
      );
      consume(
        TokenType.COLON,
        errorMessage({
          expected: ':',
          after: 'argument name',
        }),
      );
      const type = preType();
      consume(
        TokenType.RIGHT_PAREN,
        errorMessage({
          expected: ')',
          after: 'function parameters',
        }),
      );
      const body = block();

      return Fun({
        binder: {
          name: paramName,
          type,
        },
        body,
      });
    } else if (match(TokenType.NUMBERLIT)) {
      return Literal({
        value: previous().literal as number,
      });
    } else if (match(TokenType.IDENTIFIER)) {
      return Variable({
        name: previous(),
      });
    } else if (match(TokenType.LEFT_PAREN)) {
      const expr = expression();
      consume(
        TokenType.RIGHT_PAREN,
        errorMessage({
          expected: ')',
          end: 'a grouping (parenthesized expression)',
        }),
      );

      return Grouping({
        expression: expr,
      });
    }

    throw error(peek(), errorMessage());
  }

  function sensitivity(): Sens {
    if (match(TokenType.QUESTION)) {
      return UnknownSens();
    } else if (match(TokenType.NUMBERLIT)) {
      return Sens(previous().literal as number);
    }

    throw error(
      peek(),
      errorMessage({
        expected:
          'a sensitivty (either a number, e.g. 2 or 3.14, or the unknown sensitivity `?`)',
      }),
    );
  }

  function senv(): Senv {
    consume(
      TokenType.AT,
      errorMessage({
        expected: '@',
        beginning: 'a sensitivity environment',
      }),
    );
    consume(
      TokenType.LEFT_BRACKET,
      errorMessage({
        expected: '[',
        after: 'a sensitivity environment',
      }),
    );

    let s = Senv();

    if (!check(TokenType.RIGHT_BRACKET)) {
      const sens = sensitivity();
      const identifier = consume(
        TokenType.IDENTIFIER,
        errorMessage({
          expected: 'variable name',
          after: 'sensitivity value',
        }),
      );

      s = SenvUtils.extend(s, identifier.lexeme, sens);

      while (!check(TokenType.RIGHT_BRACKET) && !isAtEnd()) {
        consume(
          TokenType.PLUS,
          errorMessage({
            expected: '+',
            before: 'declaring more sensitivities',
          }),
        );
        const sens = sensitivity();
        const identifier = consume(
          TokenType.IDENTIFIER,
          errorMessage({
            expected: 'variable name',
            after: 'sensitivity value',
          }),
        );

        s = SenvUtils.extend(s, identifier.lexeme, sens);
      }
    }

    consume(
      TokenType.RIGHT_BRACKET,
      errorMessage({
        expected: ']',
        end: 'a sensitivity environment',
      }),
    );

    return Senv(s);
  }

  function preType(): Type {
    if (match(TokenType.NUMBER)) {
      return Real();
    } else if (match(TokenType.BOOL)) {
      return Bool();
    } else if (match(TokenType.NIL)) {
      return Nil();
    } else if (match(TokenType.LEFT_PAREN, TokenType.IDENTIFIER)) {
      const id = previous();
      const argType = preType();
      consume(
        TokenType.ARROW,
        errorMessage({
          expected: '->',
          after: 'argument type',
        }),
      );
      const returnTypeEff = typeEff();
      consume(
        TokenType.RIGHT_PAREN,
        errorMessage({ expected: ')', end: 'a function type' }),
      );

      return Arrow({
        binder: {
          identifier: id.lexeme,
          type: argType,
        },
        returnTypeEff,
      });
    }

    throw error(
      peek(),
      errorMessage({
        expected: 'a type',
      }),
    );
  }

  function typeEff(): TypeEff {
    const ty = preType();
    const s = senv();

    return TypeEff(ty, s);
  }

  function consume(type: TokenType, message: string): Token {
    if (check(type)) {
      return advance();
    }

    throw error(peek(), message);
  }

  function error(token: Token, message: string): ParseError {
    return new ParseError(token, message);
  }

  function synchronized<T>(parser: () => T): T | null {
    try {
      const parsed = parser();

      return parsed;
    } catch (error) {
      if (error instanceof ParseError) {
        synchronize();
        failures.push(Failure(error.token, error.reason));
        return null;
      }

      throw error;
    }
  }

  function synchronize(): void {
    advance();

    while (!isAtEnd()) {
      if (previous().type === TokenType.SEMICOLON) {
        return;
      }

      switch (peek().type) {
        case TokenType.VAR:
        case TokenType.PRINT:
          return;
      }

      advance();
    }
  }

  function match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (check(type)) {
        advance();
        return true;
      }
    }

    return false;
  }

  function check(type: TokenType): boolean {
    if (isAtEnd()) {
      return false;
    }

    return peek().type === type;
  }

  function advance(): Token {
    if (!isAtEnd()) {
      current++;
    }

    return previous();
  }

  function isAtEnd(): boolean {
    return peek().type === TokenType.EOF;
  }

  function peek(): Token {
    return tokens[current];
  }

  function previous(): Token {
    return tokens[current - 1];
  }

  while (!isAtEnd()) {
    const decl = declaration();

    if (decl) {
      statements.push(decl);
    }
  }

  return Result(statements, failures);
}
