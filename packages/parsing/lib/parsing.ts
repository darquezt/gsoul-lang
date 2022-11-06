import { Sens, Senv, SenvUtils, Type, TypeEff } from '@gsoul-lang/core/utils';
import { UnknownSens } from '@gsoul-lang/core/utils/Sens';
import {
  Arrow,
  Product,
  Real,
  RecType,
  TypeKind,
} from '@gsoul-lang/core/utils/Type';
import {
  RecursiveVar,
  TypeEffect,
  TypeEffectKind,
} from '@gsoul-lang/core/utils/TypeEff';
import { head, last, reverse } from 'ramda';
import {
  Ascription,
  Binary,
  Block,
  Call,
  Expression,
  ExprStmt,
  Fold,
  Forall,
  Fun,
  Grouping,
  If,
  Literal,
  NonLinearBinary,
  PrintStmt,
  Projection,
  SCall,
  Statement,
  Tuple,
  Unfold,
  Variable,
  VarStmt,
} from './ast';
import { Token, TokenType } from './lexing';
import { errorMessage } from './utils/errors';

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

export enum ParsingErrorKind {
  ParsingSyntaxError = 'ParsingSyntaxError',
}

export class ParsingError extends Error {
  name = ParsingErrorKind.ParsingSyntaxError as const;
  constructor(public token: Token, public reason?: string) {
    super(reason);
  }
}

const prefixOps = [TokenType.FUN, TokenType.FORALL] as const;
type PrefixOpType = typeof prefixOps[number];

const linearInfixOps = [TokenType.PLUS, TokenType.MINUS] as const;
const nonLinearInfixOps = [
  TokenType.STAR,
  TokenType.GREATER,
  TokenType.GREATER_EQUAL,
  TokenType.LESS,
  TokenType.LESS_EQUAL,
  TokenType.EQUAL_EQUAL,
] as const;
const infixOps = [
  ...linearInfixOps,
  ...nonLinearInfixOps,
  TokenType.QUESTION,
] as const;

type InfixOpType = typeof infixOps[number];

const postfixOps = [
  TokenType.LEFT_PAREN,
  TokenType.AT,
  TokenType.LEFT_BRACKET,
  TokenType.COLON_COLON,
] as const;
type PostfixOpType = typeof postfixOps[number];

const typePrefixOps = [TokenType.RECTYPE] as const;
type TypePrefixOpsType = typeof typePrefixOps[number];

const typeInfixOps = [TokenType.ARROW] as const;
type TypeInfixOpsType = typeof typeInfixOps[number];

const typePostfixOps = [TokenType.BANG] as const;
type TypePostfixOpsType = typeof typePostfixOps[number];

enum TypeParsingResultKind {
  Type = 'Type',
  TypeAndEffect = 'TypeAndEffect',
}
type TypeParsingResultType = { kind: TypeParsingResultKind.Type; result: Type };
type TypeParsingResultTypeAndEffect = {
  kind: TypeParsingResultKind.TypeAndEffect;
  result: TypeEffect;
};

type TypeParsingResult = TypeParsingResultType | TypeParsingResultTypeAndEffect;

const typeResult = (result: Type): TypeParsingResultType => ({
  kind: TypeParsingResultKind.Type,
  result,
});
const typeAndEffectResult = (
  result: TypeEffect,
): TypeParsingResultTypeAndEffect => ({
  kind: TypeParsingResultKind.TypeAndEffect,
  result,
});

const normalizeTypeResult = (result: TypeParsingResult): TypeEffect => {
  switch (result.kind) {
    case TypeParsingResultKind.Type:
      return TypeEff(result.result, Senv());
    case TypeParsingResultKind.TypeAndEffect:
      return result.result;
  }
};

const BindingPower = {
  type: {
    prefix(op: TypePrefixOpsType): [number, number] {
      switch (op) {
        case TokenType.RECTYPE:
          return [6, 7];
      }
    },
    infix(op: TypeInfixOpsType): [number, number] {
      switch (op) {
        case TokenType.ARROW:
          return [9, 8];
      }
    },
    postfix(op: TypePostfixOpsType): [number, number] {
      switch (op) {
        case TokenType.BANG:
          return [18, 19];
      }
    },
  },
  expr: {
    prefix(op: PrefixOpType): [null, number] {
      switch (op) {
        case TokenType.FUN:
        case TokenType.FORALL:
          return [null, 1];
      }
    },
    infix(op: InfixOpType): [number, number] {
      switch (op) {
        case TokenType.QUESTION:
          return [15, 16];
        case TokenType.EQUAL_EQUAL:
          return [17, 18];
        case TokenType.GREATER:
        case TokenType.GREATER_EQUAL:
        case TokenType.LESS:
        case TokenType.LESS_EQUAL:
          return [19, 20];
        case TokenType.PLUS:
        case TokenType.MINUS:
          return [23, 24];
        case TokenType.STAR:
          return [25, 26];
      }
    },
    postfix(op: PostfixOpType): [number, null] {
      switch (op) {
        case TokenType.LEFT_PAREN:
        case TokenType.LEFT_BRACKET:
        case TokenType.AT:
          return [33, null];
        case TokenType.COLON_COLON:
          return [31, null];
      }
    },
  },
};

class Parser {
  eof: Token;
  program: Statement[] = [];
  failures: Failure[] = [];

  constructor(private tokens: Token[]) {
    const eof = head(tokens);

    if (!eof) {
      throw new Error('Cannot initialize a parser without tokens');
    }

    this.eof = eof;
  }

  parse(): Result<Statement[]> {
    while (!this.isAtEnd()) {
      const stmt = this.statement();

      if (stmt) {
        this.program.push(stmt);
      }
    }

    return Result(this.program, this.failures);
  }

  statement(): Statement | null {
    return this.synchronized(() => {
      if (this.check(TokenType.LET)) {
        /**
         * @case let declaration
         */
        this.advance();

        const name = this.consume(
          TokenType.IDENTIFIER,
          errorMessage({ expected: 'variable name' }),
        );

        this.consume(
          TokenType.EQUAL,
          errorMessage({
            expected: '= (equal sign)',
            after: 'variable name',
          }),
        );

        const assignment = this.expression(0);

        this.consume(
          TokenType.SEMICOLON,
          errorMessage({ expected: ';', after: 'variable declaration' }),
        );

        return VarStmt({ name, assignment, resource: false });
      }

      if (this.checkMany(TokenType.PRINT, TokenType.PRINTEV)) {
        /**
         * @case print statement
         */

        const token = this.advance();

        const expr = this.expression(0);

        this.consume(
          TokenType.SEMICOLON,
          errorMessage({ expected: ';', end: 'print statement' }),
        );

        return PrintStmt({
          token,
          expression: expr,
          showEvidence: token.type === TokenType.PRINTEV,
        });
      }

      /**
       * @case expression statement
       */

      const expr = this.expression(0);

      this.consume(
        TokenType.SEMICOLON,
        errorMessage({ expected: ';', end: 'statement' }),
      );

      return ExprStmt({
        expression: expr,
      });
    });
  }

  expression(minBP: number): Expression {
    let left: Expression;

    if (this.check(TokenType.FALSE)) {
      /**
       * @case false literal
       */
      left = Literal({ value: false, token: this.advance() });
    } else if (this.check(TokenType.TRUE)) {
      /**
       * @case true literal
       */
      left = Literal({ value: true, token: this.advance() });
    } else if (this.check(TokenType.NILLIT)) {
      /**
       * @case nil literal
       */
      left = Literal({ value: null, token: this.advance() });
    } else if (this.check(TokenType.NUMBERLIT)) {
      /**
       * @case number literal
       */
      const num = this.advance();

      left = Literal({
        value: num.literal as number,
        token: num,
      });
    } else if (this.check(TokenType.IDENTIFIER)) {
      /**
       * @case variable
       */
      left = Variable({
        name: this.advance(),
      });
    } else if (this.check(TokenType.LEFT_PAREN)) {
      const paren = this.advance();

      const inner = this.expression(0);

      if (this.check(TokenType.COMMA)) {
        /**
         * @case tuple
         */

        const expressions = [inner];

        while (this.match(TokenType.COMMA) && !this.isAtEnd()) {
          const another = this.expression(0);

          expressions.push(another);
        }

        this.consume(
          TokenType.RIGHT_PAREN,
          errorMessage({
            expected: ')',
            after: 'function argument',
          }),
        );

        left = Tuple({
          expressions,
          constructorToken: paren,
        });
      } else {
        /**
         * @case grouping
         */

        left = Grouping({
          expression: inner,
        });

        this.consume(
          TokenType.RIGHT_PAREN,
          errorMessage({
            expected: ') or ,',
            after: 'expression',
          }),
        );
      }
    } else if (this.check(TokenType.TUPLE)) {
      /**
       * @case tuple 2
       */
      const constructorToken = this.advance();

      this.consume(
        TokenType.LEFT_PAREN,
        errorMessage({
          expected: '(',
          after: 'tuple constructor',
        }),
      );
      const first = this.expression(0);

      const expressions = [first];

      while (this.match(TokenType.COMMA)) {
        const another = this.expression(0);

        expressions.push(another);
      }

      this.consume(
        TokenType.RIGHT_PAREN,
        errorMessage({
          expected: ')',
          after: 'tuple components',
        }),
      );

      left = Tuple({
        expressions,
        constructorToken,
      });
    } else if (this.check(TokenType.FOLD)) {
      /**
       * @case fold
       */
      const constructorToken = this.advance();

      this.consume(
        TokenType.LESS,
        errorMessage({
          expected: '<',
          after: 'fold keyword',
        }),
      );

      const typeResult = this.type(0);

      if (typeResult.kind === TypeParsingResultKind.TypeAndEffect) {
        throw this.makeSyntaxError(
          constructorToken,
          errorMessage({
            expected: 'a recursive type without a sensitivity effect',
          }),
        );
      }

      if (typeResult.result.kind !== TypeKind.RecType) {
        throw this.makeSyntaxError(
          constructorToken,
          errorMessage({
            expected: 'a recursive type',
          }),
        );
      }

      this.consume(
        TokenType.GREATER,
        errorMessage({
          expected: '>',
          after: 'recursive type',
        }),
      );

      this.consume(
        TokenType.LEFT_PAREN,
        errorMessage({
          expected: '(',
          after: 'fold constructor',
        }),
      );

      const expression = this.expression(0);

      this.consume(
        TokenType.RIGHT_PAREN,
        errorMessage({
          expected: ')',
          after: 'folded expression',
        }),
      );

      left = Fold({
        expression,
        recType: typeResult.result,
        foldToken: constructorToken,
      });
    } else if (this.check(TokenType.UNFOLD)) {
      /**
       * @case unfold
       */
      const constructorToken = this.advance();

      this.consume(
        TokenType.LEFT_PAREN,
        errorMessage({
          expected: '(',
          after: 'unfold operator',
        }),
      );

      const expression = this.expression(0);

      this.consume(
        TokenType.RIGHT_PAREN,
        errorMessage({
          expected: ')',
          after: 'folded expression',
        }),
      );

      left = Unfold({
        expression,
        unfoldToken: constructorToken,
      });
    } else if (this.check(TokenType.FUN)) {
      /**
       * @case lambda function
       */

      const prefixPower = BindingPower.expr.prefix(
        this.advance().type as PrefixOpType,
      );

      const arg = this.functionParameters();

      this.consume(
        TokenType.FAT_ARROW,
        errorMessage({
          expected: '=>',
          after: 'function parameters',
        }),
      );

      const body = this.expression(prefixPower[1]);

      left = Fun({
        binder: arg,
        body,
      });
    } else if (this.check(TokenType.FORALL)) {
      /**
       * @case sensitivity abstraction
       */

      const prefixPower = BindingPower.expr.prefix(
        this.advance().type as PrefixOpType,
      );

      const sensVars: Token[] = [];

      while (!this.check(TokenType.DOT)) {
        const sensVar = this.consume(
          TokenType.IDENTIFIER,
          errorMessage({
            expected: 'an identifier',
            after: '`forall` constructor',
          }),
        );

        sensVars.push(sensVar);
      }

      this.consume(
        TokenType.DOT,
        errorMessage({
          expected: '.',
          after: 'sensitivity variables parameters',
        }),
      );

      const body = this.expression(prefixPower[1]);

      left = Forall({
        sensVars,
        expr: body,
      });
    } else if (this.check(TokenType.LEFT_BRACE)) {
      /**
       * @case block
       */
      this.advance();

      const statements: Statement[] = [];

      while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
        const stmt = this.statement();

        if (stmt) {
          statements.push(stmt);
        }
      }

      this.consume(
        TokenType.RIGHT_BRACE,
        errorMessage({ expected: '}', end: 'a block' }),
      );

      left = Block({
        statements,
      });
    } else {
      /**
       * @case Syntax error
       */
      throw this.makeSyntaxError(
        this.peek(),
        errorMessage({ expected: 'an expression' }),
      );
    }

    while (!this.isAtEnd()) {
      const op = this.peek();

      /**
       * @case postfix operators
       */
      if (this.checkMany(...postfixOps)) {
        const postFixPower = BindingPower.expr.postfix(
          op.type as PostfixOpType,
        );

        if (postFixPower[0] < minBP) {
          break;
        }

        this.advance();

        if (op.type === TokenType.LEFT_PAREN) {
          /**
           * @case function call
           */

          const arg = this.expression(0);

          this.consume(
            TokenType.RIGHT_PAREN,
            errorMessage({
              expected: ')',
              after: 'function argument',
            }),
          );

          left = Call({
            callee: left,
            arg,
            paren: op,
          });
        } else if (op.type === TokenType.AT) {
          /**
           * @case function call
           */

          const args = this.sensitivityCallArguments();

          left = SCall({
            args,
            bracket: op,
            callee: left,
          });
        } else if (op.type === TokenType.LEFT_BRACKET) {
          /**
           * @case tuple projection
           */

          const index = this.consume(
            TokenType.NUMBERLIT,
            errorMessage({
              expected: 'an index',
              after: 'tuple projection',
            }),
          );

          this.consume(
            TokenType.RIGHT_BRACKET,
            errorMessage({
              expected: ']',
              after: 'index',
            }),
          );

          left = Projection({
            index: index.literal as number,
            tuple: left,
            projectToken: op,
          });
        } else if (op.type === TokenType.COLON_COLON) {
          /**
           * @case ascription
           */

          const ascribedType = this.type(0);

          const typeEff = normalizeTypeResult(ascribedType);

          if (typeEff.kind === TypeEffectKind.RecursiveVar) {
            throw this.makeSyntaxError(
              op,
              'Ascriptions cannot be a recursive variable',
            );
          }

          left = Ascription({
            expression: left,
            typeEff,
            ascriptionToken: op,
          });
        }

        continue;
      }

      /**
       * @case infix operators
       */
      if (this.checkMany(...infixOps)) {
        const infixPower = BindingPower.expr.infix(op.type as InfixOpType);

        if (infixPower[0] < minBP) {
          break;
        }

        this.advance();

        if ((linearInfixOps as readonly TokenType[]).includes(op.type)) {
          /**
           * @case linear binary (+, -)
           */

          const right = this.expression(infixPower[1]);

          left = Binary({
            left,
            operator: op,
            right,
          });
        } else if (
          (nonLinearInfixOps as readonly TokenType[]).includes(op.type)
        ) {
          /**
           * @case non-linear binary (*, <, etc)
           */

          const right = this.expression(infixPower[1]);

          left = NonLinearBinary({
            left,
            operator: op,
            right,
          });
        } else if (op.type === TokenType.QUESTION) {
          /**
           * @case ternary operator
           */

          const then = this.expression(0);

          this.consume(
            TokenType.COLON,
            errorMessage({
              expected: ':',
              after: 'then-expression in ternary operator',
            }),
          );

          const els = this.expression(infixPower[1]);

          left = If({
            condition: left,
            then,
            else: els,
            ifToken: op,
          });
        }

        continue;
      }

      break;
    }

    return left;
  }

  sensitivityCallArguments(): Senv[] {
    this.consume(
      TokenType.LEFT_BRACKET,
      errorMessage({
        expected: '[',
        beginning: 'sensitivity effect instantiation',
      }),
    );

    if (this.check(TokenType.RIGHT_BRACKET)) {
      throw this.makeSyntaxError(
        this.peek(),
        errorMessage({
          expected: 'at least one sensitivity effect',
          before: 'ending a sensitivity effect instantiation',
        }) + '. If you want to pass an empty effect use `\\` as an argument',
      );
    }

    const first = this.match(TokenType.BACKSLASH) ? Senv() : this.senv();

    const args = [first];

    while (this.check(TokenType.COMMA)) {
      this.advance();

      if (this.checkMany(TokenType.COMMA, TokenType.RIGHT_BRACKET)) {
        throw this.makeSyntaxError(
          this.peek(),
          errorMessage({
            expected: 'a sensitivity effect',
          }) + '. If you want to pass an empty effect use `\\` as an argument',
        );
      }

      const another = this.match(TokenType.BACKSLASH) ? Senv() : this.senv();

      args.push(another);
    }

    this.consume(
      TokenType.RIGHT_BRACKET,
      errorMessage({
        expected: ']',
        after: 'sensitivity effect arguments',
      }),
    );

    return args;
  }

  functionParameters(): { name: Token; type: TypeEff } {
    this.consume(
      TokenType.LEFT_PAREN,
      errorMessage({
        expected: '(',
        beginning: 'function parameters',
      }),
    );

    const name = this.consume(
      TokenType.IDENTIFIER,
      errorMessage({
        expected: 'a variable name',
        beginning: 'function parameters',
      }),
    );

    const colon = this.consume(
      TokenType.COLON,
      errorMessage({
        expected: ': [type]',
        after: 'parameter name',
      }),
    );

    const type = normalizeTypeResult(this.type(0));

    if (type.kind === TypeEffectKind.RecursiveVar) {
      throw this.makeSyntaxError(
        colon,
        'function parameters cannot be of a recursive variable type',
      );
    }

    this.consume(
      TokenType.RIGHT_PAREN,
      errorMessage({
        expected: ')',
        end: 'function parameters',
      }),
    );

    return { name, type };
  }

  type(minBP: number): TypeParsingResult {
    let left: TypeParsingResult;

    if (this.check(TokenType.NUMBER)) {
      /**
       * @case number type
       */

      this.advance();

      left = typeResult(Real());
    } else if (this.check(TokenType.IDENTIFIER)) {
      /**
       * @case recursive variable type-and-effect
       */

      left = typeAndEffectResult(
        RecursiveVar({
          name: this.advance().lexeme,
        }),
      );
    } else if (this.check(TokenType.LEFT_PAREN)) {
      this.advance();

      left = this.type(0);

      if (this.check(TokenType.COMMA)) {
        /**
         * @case tuple
         */

        const types = [normalizeTypeResult(left)];

        while (this.match(TokenType.COMMA) && !this.isAtEnd()) {
          const another = this.type(0);

          types.push(normalizeTypeResult(another));
        }

        this.consume(
          TokenType.RIGHT_PAREN,
          errorMessage({
            expected: ')',
            after: 'function argument',
          }),
        );

        left = typeResult(
          Product({
            typeEffects: types,
          }),
        );
      } else {
        this.consume(
          TokenType.RIGHT_PAREN,
          errorMessage({
            expected: ')',
            end: 'type grouping',
          }),
        );
      }
    } else if (this.checkMany(...typePrefixOps)) {
      /**
       * @case prefix type operators
       */

      const prefixPower = BindingPower.type.prefix(
        this.advance().type as TypePrefixOpsType,
      );

      const variable = this.consume(
        TokenType.IDENTIFIER,
        errorMessage({
          expected: 'recursive type variable name',
          after: '`rec` keyword',
        }),
      );

      this.consume(
        TokenType.DOT,
        errorMessage({
          expected: '. (dot)',
          after: 'recursive variable',
        }),
      );

      const body = this.type(prefixPower[1]);

      left = typeResult(
        RecType({
          variable: variable.lexeme,
          body: normalizeTypeResult(body),
        }),
      );
    } else {
      throw this.makeSyntaxError(
        this.peek(),
        errorMessage({
          expected: 'a type',
        }),
      );
    }

    while (!this.isAtEnd()) {
      const op = this.peek();

      /**
       * @case postfix type operators
       */
      if (this.checkMany(...typePostfixOps)) {
        const postFixPower = BindingPower.type.postfix(
          op.type as TypePostfixOpsType,
        );

        if (postFixPower[0] < minBP) {
          break;
        }

        this.advance();

        if (op.type === TokenType.BANG) {
          if (left.kind === TypeParsingResultKind.TypeAndEffect) {
            throw this.makeSyntaxError(op, 'Cannot bang a type-and-effect');
          }

          this.consume(
            TokenType.LEFT_BRACKET,
            errorMessage({
              expected: '[',
              after: 'a bang modality',
            }),
          );

          const effect = this.check(TokenType.RIGHT_BRACKET)
            ? Senv()
            : this.senv();

          this.consume(
            TokenType.RIGHT_BRACKET,
            errorMessage({
              expected: ']',
              end: 'a sensitivity effect',
            }),
          );

          left = typeAndEffectResult(TypeEff(left.result, effect));
        }

        continue;
      }

      /**
       * @case infix type operators
       */
      if (this.checkMany(...typeInfixOps)) {
        const infixPower = BindingPower.type.infix(op.type as TypeInfixOpsType);

        if (infixPower[0] < minBP) {
          break;
        }

        this.advance();

        if (op.type === TokenType.ARROW) {
          const right = this.type(infixPower[1]);

          left = typeResult(
            Arrow({
              domain: normalizeTypeResult(left),
              codomain: normalizeTypeResult(right),
            }),
          );
        }

        continue;
      }

      break;
    }

    return left;
  }

  senv(): Senv {
    let s = Senv();

    const sens = this.sensitivity();
    const identifier = this.consume(
      TokenType.IDENTIFIER,
      errorMessage({
        expected: 'a sensitivity variable name',
      }),
    );

    s = SenvUtils.extend(s, identifier.lexeme, sens);

    while (this.check(TokenType.PLUS) && !this.isAtEnd()) {
      this.advance();

      const sens = this.sensitivity();
      const identifier = this.consume(
        TokenType.IDENTIFIER,
        errorMessage({
          expected: 'sensitivity variable name',
        }),
      );

      s = SenvUtils.extend(s, identifier.lexeme, sens);
    }

    return Senv(s);
  }

  sensitivity(): Sens {
    if (this.check(TokenType.QUESTION)) {
      /**
       * @case unknown sensitivity
       */

      this.advance();

      return UnknownSens();
    } else if (this.check(TokenType.NUMBERLIT)) {
      /**
       * @case fully-static sensitivity
       */

      return Sens(this.advance().literal as number);
    } else {
      /**
       * @case implicit unitary sensitivity
       */

      return Sens(1);
    }
  }

  synchronized<T>(parser: () => T): T | null {
    try {
      const parsed = parser();

      return parsed;
    } catch (error) {
      if (error.name === ParsingErrorKind.ParsingSyntaxError) {
        this.synchronize();
        this.failures.push(Failure(error.token, error.reason));
        return null;
      }

      throw error;
    }
  }

  /**
   * It discards tokens until a new statement is reached
   *
   * _Note: This is a best effort synchronization and is not meant to be perfect_
   */
  synchronize(): void {
    let current = this.advance();

    while (!this.isAtEnd()) {
      if (current.type === TokenType.SEMICOLON) {
        return;
      }

      switch (this.peek().type) {
        case TokenType.LET:
        case TokenType.SLET:
        case TokenType.PRINT:
        case TokenType.PRINTEV:
          return;
      }

      current = this.advance();
    }
  }

  makeSyntaxError(token: Token, message: string) {
    return new ParsingError(token, message);
  }

  consume(type: TokenType, message: string): Token {
    if (this.check(type)) {
      return this.advance();
    }

    throw this.makeSyntaxError(this.peek(), message);
  }

  advance(): Token {
    return this.tokens.pop() ?? this.eof;
  }

  checkMany(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        return true;
      }
    }

    return false;
  }

  peek(): Token {
    return last(this.tokens) ?? this.eof;
  }

  check(tokenType: TokenType): boolean {
    return this.peek().type === tokenType;
  }

  match(tokenType: TokenType): boolean {
    if (this.check(tokenType)) {
      this.advance();

      return true;
    }

    return false;
  }

  isAtEnd(): boolean {
    return this.check(TokenType.EOF);
  }
}

export const parse = (tokens: Token[]): Result<Statement[]> => {
  return new Parser(reverse(tokens)).parse();
};
