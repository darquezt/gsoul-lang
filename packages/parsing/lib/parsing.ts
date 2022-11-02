import { Sens, Senv, SenvUtils, TypeEff } from '@gsens-lang/core/utils';
import { UnknownSens } from '@gsens-lang/core/utils/Sens';
import {
  Arrow,
  Bool,
  ForallT,
  Nil,
  Real,
  RecType,
} from '@gsens-lang/core/utils/Type';
import {
  RecursiveVar,
  TypeEffect,
  TypeEffectKind,
} from '@gsens-lang/core/utils/TypeEff';

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
  Forall,
  SCall,
  Pair,
  ProjFst,
  ProjSnd,
  Fold,
  Unfold,
  Tuple,
  Projection,
} from './ast';
import Token from './lexing/Token';
import TokenType from './lexing/TokenType';
import { errorMessage } from './utils/errors';

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

enum EffectSource {
  INFERRED = 'INFERRED',
  EXPLICIT = 'EXPLICIT',
}

type WithEffectInfo<T> = [EffectSource, T];

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
      if (check(TokenType.LET)) {
        return varDeclaration(false);
      }
      if (check(TokenType.SLET)) {
        return varDeclaration(true);
      }

      return statement();
    });
  }

  function varDeclaration(resource = false): Statement {
    consume(
      resource ? TokenType.SLET : TokenType.LET,
      errorMessage({
        expected: resource ? '`slet` keyword' : '`let` keyword',
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
    return expressionStatement();
  }

  function block(): Expression {
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

  function printExpression(showEvidence = false): Expression {
    const token = previous();
    const value = expression();

    return Print({
      token,
      expression: value,
      showEvidence,
    });
  }

  function expression(): Expression {
    if (match(TokenType.PRINT)) {
      return printExpression(false);
    }
    if (match(TokenType.PRINTEV)) {
      return printExpression(true);
    }
    if (check(TokenType.LEFT_BRACE)) {
      return block();
    }

    return ascription();
  }

  function ascription(): Expression {
    let expr: Expression = equality();

    while (match(TokenType.COLON_COLON)) {
      const doubleColon = previous();
      const ascrTE = typeEff();

      if (ascrTE.kind === TypeEffectKind.RecursiveVar) {
        throw error(
          previous(),
          errorMessage({
            beginning: 'ascription type. Ascription types cannot be recursive',
          }),
        );
      }

      expr = Ascription({
        expression: expr,
        typeEff: ascrTE,
        ascriptionToken: doubleColon,
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
    let callee = primary();

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
    while (check(TokenType.LEFT_PAREN) || check(TokenType.LEFT_BRACKET)) {
      if (match(TokenType.LEFT_PAREN)) {
        const arg = expression();

        const paren = consume(
          TokenType.RIGHT_PAREN,
          errorMessage({
            expected: ')',
            end: 'a function call',
          }),
        );

        callee = Call({
          callee,
          arg,
          paren,
        });
      } else if (match(TokenType.LESS)) {
        const arg = senv();

        const bracket = consume(
          TokenType.GREATER,
          errorMessage({
            expected: '>',
            end: 'a sensitivity effect call',
          }),
        );

        callee = SCall({
          callee,
          arg,
          bracket,
        });
      } else if (match(TokenType.LEFT_BRACKET)) {
        const index = consume(
          TokenType.NUMBERLIT,
          errorMessage({
            expected: 'an index',
            after: 'tuple projection',
          }),
        );

        const projectToken = consume(
          TokenType.RIGHT_BRACKET,
          errorMessage({
            expected: ']',
            end: 'a tuple projection',
          }),
        );

        callee = Projection({
          tuple: callee,
          index: index.literal as number,
          projectToken,
        });
      }

      if (check(TokenType.LEFT_BRACKET)) {
        const bracket = peek();
        const arg = senv();

        callee = SCall({
          callee,
          arg,
          bracket,
        });
      }
    }

    return callee;
  }

  function primary(): Expression {
    if (match(TokenType.FALSE)) {
      return Literal({ value: false, token: previous() });
    } else if (match(TokenType.TRUE)) {
      return Literal({ value: true, token: previous() });
    } else if (match(TokenType.NILLIT)) {
      return Literal({ value: null, token: previous() });
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
      const type = typeEff();

      if (type.kind === TypeEffectKind.RecursiveVar) {
        throw error(
          previous(),
          errorMessage({
            beginning: 'argument type. Argument types cannot be recursive vars',
          }),
        );
      }

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
    } else if (match(TokenType.FORALL)) {
      if (check(TokenType.DOT)) {
        error(
          peek(),
          errorMessage({
            expected: 'at least one identifier',
            after: '`forall` constructor',
          }),
        );
      }

      const sensVars: Token[] = [];

      while (!match(TokenType.DOT)) {
        const sensVar = consume(
          TokenType.IDENTIFIER,
          errorMessage({
            expected: 'an identifier',
            after: '`forall` constructor',
          }),
        );

        sensVars.push(sensVar);
      }

      const expr = expression();

      return Forall({
        sensVars,
        expr,
      });
    } else if (match(TokenType.PAIR)) {
      const constructorToken = previous();
      consume(
        TokenType.LEFT_PAREN,
        errorMessage({
          expected: '(',
          after: 'pair constructor',
        }),
      );
      const first = expression();
      consume(
        TokenType.COMMA,
        errorMessage({
          expected: ',',
          after: 'pair component',
        }),
      );
      const second = expression();
      consume(
        TokenType.RIGHT_PAREN,
        errorMessage({
          expected: ')',
          after: 'pair components',
        }),
      );

      return Pair({
        first,
        second,
        constructorToken,
      });
    } else if (match(TokenType.FST, TokenType.SND)) {
      const projToken = previous();
      consume(
        TokenType.LEFT_PAREN,
        errorMessage({
          expected: '(',
          after: `${projToken.lexeme} projector`,
        }),
      );
      const pair = expression();
      consume(
        TokenType.RIGHT_PAREN,
        errorMessage({
          expected: ')',
          after: 'pair expression',
        }),
      );

      const constructor = projToken.type === TokenType.FST ? ProjFst : ProjSnd;

      return constructor({
        projToken,
        pair,
      });
    } else if (match(TokenType.FOLD)) {
      const foldToken = previous();

      consume(
        TokenType.LESS,
        errorMessage({
          expected: '<',
          after: `${foldToken.lexeme} constructor`,
        }),
      );
      const teff = typeEff();
      consume(
        TokenType.GREATER,
        errorMessage({
          expected: '>',
          after: `${foldToken.lexeme} fold type instantiation`,
        }),
      );

      consume(
        TokenType.LEFT_PAREN,
        errorMessage({
          expected: '(',
          after: `${foldToken.lexeme}`,
        }),
      );
      const expr = expression();
      consume(
        TokenType.RIGHT_PAREN,
        errorMessage({
          expected: ')',
          after: `${foldToken.lexeme} expression`,
        }),
      );

      return Fold({
        foldToken,
        expression: expr,
        recType: (teff as TypeEff<RecType, Senv>).type,
      });
    } else if (match(TokenType.TUPLE)) {
      const constructorToken = previous();

      consume(
        TokenType.LEFT_PAREN,
        errorMessage({
          expected: '(',
          after: 'tuple constructor',
        }),
      );
      const first = expression();

      const expressions = [first];

      while (match(TokenType.COMMA)) {
        const another = expression();

        expressions.push(another);
      }

      consume(
        TokenType.RIGHT_PAREN,
        errorMessage({
          expected: ')',
          after: 'tuple components',
        }),
      );

      return Tuple({
        expressions,
        constructorToken,
      });
    } else if (match(TokenType.UNFOLD)) {
      const unfoldToken = previous();

      consume(
        TokenType.LEFT_PAREN,
        errorMessage({
          expected: '(',
          after: `${unfoldToken.lexeme}`,
        }),
      );
      const expr = expression();
      consume(
        TokenType.RIGHT_PAREN,
        errorMessage({
          expected: ')',
          after: `${unfoldToken.lexeme} expression`,
        }),
      );

      return Unfold({
        unfoldToken,
        expression: expr,
      });
    } else if (match(TokenType.NUMBERLIT)) {
      return Literal({
        value: previous().literal as number,
        token: previous(),
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

    // consume(
    //   TokenType.RIGHT_BRACKET,
    //   errorMessage({
    //     expected: ']',
    //     end: 'a sensitivity environment',
    //   }),
    // );

    return Senv(s);
  }

  function optionalSenv(): WithEffectInfo<Senv> {
    if (match(TokenType.BANG)) {
      consume(
        TokenType.LEFT_BRACKET,
        errorMessage({
          expected: '[',
          beginning: 'a sensitivity environment',
        }),
      );

      const eff = senv();

      consume(
        TokenType.RIGHT_BRACKET,
        errorMessage({
          expected: ']',
          end: 'a sensitivity environment',
        }),
      );

      return [EffectSource.EXPLICIT, eff];
    }

    return [EffectSource.INFERRED, Senv()];
  }

  function atomTypeEff(): WithEffectInfo<TypeEffect> {
    let currentType = null;

    if (match(TokenType.NUMBER)) {
      currentType = Real();
    } else if (match(TokenType.BOOL)) {
      currentType = Bool();
    } else if (match(TokenType.NIL)) {
      currentType = Nil();
    } else if (match(TokenType.FORALLT)) {
      const forallKeyword = previous();

      const firstSensVar = consume(
        TokenType.IDENTIFIER,
        errorMessage({
          expected: 'at least one sensitive variable name',
          after: `${forallKeyword.lexeme} keyword`,
        }),
      );
      const sensVars = [firstSensVar.lexeme];

      while (match(TokenType.IDENTIFIER)) {
        sensVars.push(previous().lexeme);
      }

      consume(
        TokenType.DOT,
        errorMessage({
          expected: 'a dot (.)',
          after: 'sensitive variables',
        }),
      );

      const codomain = typeEff();

      currentType = ForallT({
        sensVars,
        codomain,
      });
    } else if (match(TokenType.RECTYPE)) {
      const rectypeKeyword = previous();

      const variable = consume(
        TokenType.IDENTIFIER,
        errorMessage({
          expected: 'a type variable name',
          after: `${rectypeKeyword.lexeme} keyword`,
        }),
      ).lexeme;

      consume(
        TokenType.DOT,
        errorMessage({
          expected: 'a dot (.)',
          after: 'the recursive type variable',
        }),
      );

      const body = typeEff();

      currentType = RecType({
        variable,
        body,
      });
    }

    if (currentType) {
      const [source, effect] = optionalSenv();

      return [source, TypeEff(currentType, effect)];
    }

    if (match(TokenType.LEFT_PAREN)) {
      const [senvSource, teff] = internalTypeEff();

      consume(
        TokenType.RIGHT_PAREN,
        errorMessage({
          expected: 'a right parenthesis )',
          after: 'declaring a pure type',
        }),
      );

      if (match(TokenType.BANG)) {
        if (senvSource === EffectSource.EXPLICIT) {
          throw error(
            peek(),
            errorMessage({
              after: 'type-and-effect',
            }),
          );
        }

        consume(
          TokenType.LEFT_BRACKET,
          errorMessage({
            expected: '[',
            beginning: 'a sensitivity environment',
          }),
        );

        const effect = senv();

        consume(
          TokenType.RIGHT_BRACKET,
          errorMessage({
            expected: ']',
            end: 'a sensitivity environment',
          }),
        );

        return [EffectSource.EXPLICIT, TypeEff((teff as TypeEff).type, effect)];
      }

      return [senvSource, teff];
    }

    if (match(TokenType.IDENTIFIER)) {
      const identifier = previous();

      return [
        EffectSource.EXPLICIT,
        RecursiveVar({
          name: identifier.lexeme,
        }),
      ];
    }

    throw error(
      peek(),
      errorMessage({
        expected: 'a type',
      }),
    );
  }

  function internalTypeEff(): WithEffectInfo<TypeEffect> {
    const ty = atomTypeEff();

    const arrows = [];

    while (match(TokenType.ARROW)) {
      const [, codomain] = atomTypeEff();

      arrows.push(codomain);
    }

    if (arrows.length === 0) {
      return ty;
    }

    const arrow = arrows.reduceRight(
      (domain, codomain) =>
        TypeEff(
          Arrow({
            domain,
            codomain,
          }),
          Senv(),
        ),
      ty[1],
    );

    return [EffectSource.INFERRED, arrow];
  }

  function typeEff(): TypeEffect {
    const [, teff] = internalTypeEff();

    return teff;
  }

  // function typeEff(): TypeEff {
  //   let t: TypeEff | null = null;

  //   if (match(TokenType.NUMBER, TokenType.BOOL, TokenType.NIL)) {
  //     const typeToken = previous();

  //     const effect = match(TokenType.BANG) ? senv() : MaxSenv();

  //     switch (typeToken.type) {
  //       case TokenType.NUMBER: {
  //         t = TypeEff(Real(), effect);
  //         break;
  //       }
  //       case TokenType.BOOL: {
  //         t = TypeEff(Bool(), effect);
  //         break;
  //       }
  //       case TokenType.NIL: {
  //         t = TypeEff(Nil(), effect);
  //         break;
  //       }
  //     }
  //   }

  //   if (match(TokenType.LEFT_PAREN)) {
  //     t = typeEff();

  //     consume(
  //       TokenType.RIGHT_PAREN,
  //       errorMessage({
  //         expected: 'aclosing paranthesis )',
  //         end: 'this type-and-effect',
  //       }),
  //     );

  //     if (match(TokenType.BANG)) {
  //       const effect = senv();

  //       t = TypeEff(t.type, SenvUtils.add(t.effect, effect));
  //     }
  //   }

  //   if (!t) {
  //     throw error(
  //       peek(),
  //       errorMessage({ expected: 'a type or a type-and-effect' }),
  //     );
  //   }

  //   while (match(TokenType.ARROW)) {
  //     switch (previous().type) {
  //       case TokenType.ARROW: {
  //         const codomain = typeEff();

  //         t = TypeEff(
  //           Arrow({
  //             domain: t,
  //             codomain,
  //           }),
  //           Senv(),
  //         );

  //         break;
  //       }
  //     }
  //   }

  //   return t;
  // }

  function consume(type: TokenType, message: string): Token {
    if (check(type)) {
      return advance();
    }

    throw error(peek(), message);
  }

  function error(token: Token, message: string): ParseError {
    return new ParseError(token, message);
  }

  /**
   * It tries to execute a parser and return its result.
   * In the case of an error during the parser execution:
   *    1. The source is synchronized, e.g. the input is thrown away until reaching an end of statement
   *    2. A new failure is created and pushed into `failures` for blaming the bad syntax
   *    3. `null` is returned
   *
   * In the case of an unknown error (not related to parsing), the error is thrown up.
   *
   * @param parser A Parser function
   * @returns The result of the parser or `null`
   */
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

  /**
   * It discards tokens until a new statement is reached
   *
   * _Note: This is a best effort synchronization and is not meant to be perfect_
   * @returns void
   */
  function synchronize(): void {
    advance();

    while (!isAtEnd()) {
      if (previous().type === TokenType.SEMICOLON) {
        return;
      }

      switch (peek().type) {
        case TokenType.LET:
        case TokenType.SLET:
        case TokenType.PRINT:
        case TokenType.PRINTEV:
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
