import { Sens, Senv, SenvUtils, Type, TypeEff } from '@gsoul-lang/core/utils';
import { UnknownSens } from '@gsoul-lang/core/utils/Sens';
import {
  Arrow,
  Bool,
  Nil,
  Product,
  Real,
  RecType,
  Sum,
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
  Case,
  Expression,
  ExprStmt,
  Fold,
  Forall,
  Fun,
  Grouping,
  If,
  Inj,
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

const typePrefixOps = [TokenType.RECTYPE, TokenType.ARROW] as const;
type TypePrefixOpsType = typeof typePrefixOps[number];

const typeInfixOps = [TokenType.ARROW, TokenType.PLUS] as const;
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
    prefix(op: TypePrefixOpsType): [null, number] {
      switch (op) {
        case TokenType.RECTYPE:
          return [null, 7];
        case TokenType.ARROW:
          return [null, 9];
      }
    },
    infix(op: TypeInfixOpsType): [number, number] {
      switch (op) {
        case TokenType.ARROW:
          return [10, 9];
        case TokenType.PLUS:
          return [11, 12];
      }
    },
    postfix(op: TypePostfixOpsType): [number, null] {
      switch (op) {
        case TokenType.BANG:
          return [19, null];
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
          return [16, 15];
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

class TypeEnvironment {
  private types: Record<string, Type> = {};

  constructor(private parent?: TypeEnvironment) {}

  define(name: string, type: Type): void {
    this.types[name] = type;
  }

  get(name: string): Type | null {
    if (this.types[name]) {
      return this.types[name];
    }

    if (this.parent) {
      return this.parent.get(name);
    }

    return null;
  }
}

class Parser {
  eof: Token;
  program: Statement[] = [];
  failures: Failure[] = [];
  private typeEnvironment = new TypeEnvironment();

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

  private statement(): Statement | null {
    return this.synchronized(() => {
      if (this.check(TokenType.TYPE)) {
        /**
         * @case type declaration
         */

        return this.parseTypeDecl();
      }
      if (this.check(TokenType.LET)) {
        /**
         * @case let declaration
         */

        return this.parseLetStmt();
      }

      if (this.checkMany(TokenType.PRINT, TokenType.PRINTEV)) {
        /**
         * @case print statement
         */

        return this.parsePrintStmt();
      }

      /**
       * @case expression statement
       */

      return this.parseExpressionStmt();
    });
  }

  private parseTypeDecl(): null {
    this.advance();

    const name = this.consume(
      TokenType.IDENTIFIER,
      errorMessage({ expected: 'type name' }),
    );

    this.consume(
      TokenType.EQUAL,
      errorMessage({ expected: '=', after: 'type declaration' }),
    );

    const typeResult = this.type(0);

    if (typeResult.kind === TypeParsingResultKind.TypeAndEffect) {
      throw this.makeSyntaxError(
        name,
        'Only types without effect can be aliased',
      );
    }

    const ty = typeResult.result;

    this.consume(
      TokenType.SEMICOLON,
      errorMessage({ expected: ';', end: 'type declaration' }),
    );

    this.typeEnvironment.define(
      name.lexeme,
      Object.assign(ty, { alias: name.lexeme }),
    );

    return null;
  }

  private parseExpressionStmt(): ExprStmt {
    const expr = this.expression(0);

    this.consume(
      TokenType.SEMICOLON,
      errorMessage({ expected: ';', end: 'statement' }),
    );

    return ExprStmt({
      expression: expr,
    });
  }

  private parsePrintStmt(): PrintStmt {
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

  private parseLetStmt(): VarStmt {
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

  private expression(minBP: number): Expression {
    let left: Expression;

    if (this.check(TokenType.FALSE)) {
      /**
       * @case false literal
       */
      left = this.parseFalseExpr();
    } else if (this.check(TokenType.TRUE)) {
      /**
       * @case true literal
       */
      left = this.parseTrueExpr();
    } else if (this.check(TokenType.NILLIT)) {
      /**
       * @case nil literal
       */
      left = this.parseNilExpr();
    } else if (this.check(TokenType.NUMBERLIT)) {
      /**
       * @case number literal
       */
      left = this.parseNumberExpr();
    } else if (this.check(TokenType.IDENTIFIER)) {
      /**
       * @case variable
       */
      left = this.parseVariableExpr();
    } else if (this.check(TokenType.LEFT_PAREN)) {
      /**
       * @case grouping | tuple
       */
      left = this.parseTupleOrGroupingExpr();
    } else if (this.check(TokenType.FOLD)) {
      /**
       * @case fold
       */
      left = this.parseFoldExpr();
    } else if (this.check(TokenType.UNFOLD)) {
      /**
       * @case unfold
       */
      left = this.parseUnfoldExpr();
    } else if (this.check(TokenType.INL) || this.check(TokenType.INR)) {
      /**
       * @case inl | inr
       */
      left = this.parseInjExpr();
    } else if (this.check(TokenType.CASE)) {
      /**
       * @case case
       */
      left = this.parseCaseExpr();
    } else if (this.check(TokenType.LEFT_BRACE)) {
      /**
       * @case block
       */
      left = this.parseBlockExpr(this.typeEnvironment);
    } else if (this.checkMany(...prefixOps)) {
      /**
       * @case prefix operators
       */
      const op = this.advance() as Token & { type: PrefixOpType };

      const prefixPower = BindingPower.expr.prefix(op.type);

      switch (op.type) {
        case TokenType.FUN: {
          /**
           * @case lambda function
           */
          left = this.parseFunExpr(op, prefixPower);
          break;
        }

        case TokenType.FORALL: {
          /**
           * @case sensitivity abstraction
           */
          left = this.parseForallExpr(op, prefixPower);
          break;
        }
      }
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
      if (this.checkMany(...postfixOps)) {
        /**
         * @case postfix operators
         */

        const op = this.advance() as Token & { type: PostfixOpType };

        const postFixPower = BindingPower.expr.postfix(op.type);

        if (postFixPower[0] < minBP) {
          break;
        }

        switch (op.type) {
          case TokenType.LEFT_PAREN: {
            /**
             * @case function call
             */

            left = this.parseCallExpr(left, op);
            break;
          }

          case TokenType.AT: {
            /**
             * @case sensitivity function call
             */

            left = this.parseSensitivityCallExpr(left, op);
            break;
          }

          case TokenType.LEFT_BRACKET: {
            /**
             * @case tuple projection
             */

            left = this.parseTupleProjectionExpr(left, op);
            break;
          }

          case TokenType.COLON_COLON: {
            /**
             * @case ascription
             */

            left = this.parseAscriptionExpr(left, op);
            break;
          }
        }
      } else if (this.checkMany(...infixOps)) {
        /**
         * @case infix operators
         */

        const op = this.peek() as Token & { type: InfixOpType };

        const infixPower = BindingPower.expr.infix(op.type);

        if (infixPower[0] < minBP) {
          break;
        }

        this.advance();

        switch (op.type) {
          case TokenType.PLUS:
          case TokenType.MINUS: {
            /**
             * @case linear binary (+, -)
             */

            left = this.parseBinaryExpr(left, op, infixPower);
            break;
          }

          case TokenType.STAR:
          case TokenType.GREATER:
          case TokenType.GREATER_EQUAL:
          case TokenType.LESS:
          case TokenType.LESS_EQUAL:
          case TokenType.EQUAL_EQUAL: {
            /**
             * @case non-linear binary (*, <, etc)
             */

            left = this.parseNLBinaryExpr(left, op, infixPower);
            break;
          }

          case TokenType.QUESTION: {
            /**
             * @case ternary operator
             */

            left = this.parseIfExpr(left, op, infixPower);
            break;
          }
        }
      } else {
        break;
      }
    }

    return left;
  }

  private parseIfExpr(
    condition: Expression,
    op: Token,
    power: [number, number],
  ): If {
    const then = this.expression(0);

    this.consume(
      TokenType.COLON,
      errorMessage({
        expected: ':',
        after: 'then-expression in ternary operator',
      }),
    );

    const els = this.expression(power[1]);

    return If({
      condition,
      then,
      else: els,
      ifToken: op,
    });
  }

  private parseNLBinaryExpr(
    left: Expression,
    op: Token,
    power: [number, number],
  ): NonLinearBinary {
    const right = this.expression(power[1]);

    return NonLinearBinary({
      left,
      operator: op,
      right,
    });
  }

  private parseBinaryExpr(
    left: Expression,
    op: Token,
    power: [number, number],
  ): Binary {
    const right = this.expression(power[1]);

    return Binary({
      left,
      operator: op,
      right,
    });
  }

  private parseAscriptionExpr(left: Expression, op: Token): Ascription {
    const ascribedType = this.type(0);

    const typeEff = normalizeTypeResult(ascribedType);

    if (typeEff.kind === TypeEffectKind.RecursiveVar) {
      throw this.makeSyntaxError(
        op,
        'Ascriptions cannot be a recursive variable',
      );
    }

    return Ascription({
      expression: left,
      typeEff,
      ascriptionToken: op,
    });
  }

  private parseTupleProjectionExpr(left: Expression, op: Token): Projection {
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

    return Projection({
      index: index.literal as number,
      tuple: left,
      projectToken: op,
    });
  }

  private parseSensitivityCallExpr(callee: Expression, op: Token): SCall {
    const args = this.sensitivityCallArguments();

    return SCall({
      callee,
      args,
      bracket: op,
    });
  }

  private parseCallExpr(
    callee: Expression,
    op: Token & { type: PostfixOpType },
  ): Call {
    const arg: Expression[] = [];

    while (!this.isAtEnd() && !this.check(TokenType.RIGHT_PAREN)) {
      const another = this.expression(0);

      arg.push(another);

      if (this.check(TokenType.COMMA)) {
        this.advance();
      } else {
        break;
      }
    }

    this.consume(
      TokenType.RIGHT_PAREN,
      errorMessage({
        expected: ')',
        end: 'function call',
      }),
    );

    return Call({
      callee,
      args: arg,
      paren: op,
    });
  }

  private parseForallExpr(_op: Token, power: [null, number]): Forall {
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

    const body = this.expression(power[1]);

    return Forall({
      sensVars,
      expr: body,
    });
  }

  private parseBlockExpr(typeEnvironment: TypeEnvironment): Block {
    const previousTypeEnvironment = this.typeEnvironment;

    this.advance();

    try {
      this.typeEnvironment = typeEnvironment;

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

      return Block({
        statements,
      });
    } finally {
      this.typeEnvironment = previousTypeEnvironment;
    }
  }

  private parseFunExpr(_op: Token, power: [null, number]): Fun {
    const arg = this.functionParameters();

    this.consume(
      TokenType.FAT_ARROW,
      errorMessage({
        expected: '=>',
        after: 'function parameters',
      }),
    );

    const body = this.expression(power[1]);

    return Fun({
      binders: arg,
      body,
    });
  }

  private parseInjExpr(): Inj {
    const injToken = this.advance();

    this.consume(
      TokenType.LESS,
      errorMessage({
        expected: '<',
        after: `${injToken.lexeme} keyword`,
      }),
    );

    const typeResult = this.type(0);

    if (typeResult.kind !== TypeParsingResultKind.Type) {
      throw this.makeSyntaxError(
        injToken,
        'Injected type cannot have an effect',
      );
    }

    const type = typeResult.result;

    this.consume(
      TokenType.GREATER,
      errorMessage({
        expected: '>',
        after: 'injected type',
      }),
    );

    this.consume(
      TokenType.LEFT_PAREN,
      errorMessage({
        expected: '(',
        after: 'inj keyword',
      }),
    );

    const expression = this.expression(0);

    this.consume(
      TokenType.RIGHT_PAREN,
      errorMessage({
        expected: ')',
        after: 'injected expression',
      }),
    );

    return Inj({
      index: injToken.type === TokenType.INL ? 0 : 1,
      type,
      expression,
      injToken,
    });
  }

  private parseCaseExpr(): Case {
    const caseToken = this.advance();

    this.consume(
      TokenType.LEFT_PAREN,
      errorMessage({
        expected: '(',
        after: 'case keyword',
      }),
    );

    const sum = this.expression(0);

    this.consume(
      TokenType.RIGHT_PAREN,
      errorMessage({
        expected: ')',
        after: 'sum expression',
      }),
    );

    this.consume(
      TokenType.OF,
      errorMessage({
        expected: 'of',
        after: 'sum expression',
      }),
    );

    this.consume(
      TokenType.LEFT_BRACE,
      errorMessage({
        expected: '{',
        before: 'first branch',
      }),
    );

    this.consume(
      TokenType.INL,
      errorMessage({
        expected: 'inl',
        beginning: 'first branch',
      }),
    );

    this.consume(
      TokenType.LEFT_PAREN,
      errorMessage({
        expected: '(',
        after: 'inl keyword',
      }),
    );

    const leftIdentifier = this.consume(
      TokenType.IDENTIFIER,
      errorMessage({
        expected: 'an identifier',
        after: 'inl keyword',
      }),
    );

    this.consume(
      TokenType.RIGHT_PAREN,
      errorMessage({
        expected: ')',
        after: 'left identifier',
      }),
    );

    this.consume(
      TokenType.FAT_ARROW,
      errorMessage({
        expected: '=>',
        after: 'left identifier',
      }),
    );

    const leftExpression = this.expression(0);

    this.consume(
      TokenType.RIGHT_BRACE,
      errorMessage({
        expected: '}',
        after: 'left branch',
      }),
    );

    this.consume(
      TokenType.LEFT_BRACE,
      errorMessage({
        expected: '{',
        before: 'second branch',
      }),
    );

    this.consume(
      TokenType.INR,
      errorMessage({
        expected: 'inr',
        beginning: 'second branch',
      }),
    );

    this.consume(
      TokenType.LEFT_PAREN,
      errorMessage({
        expected: '(',
        after: 'inr keyword',
      }),
    );

    const rightIdentifier = this.consume(
      TokenType.IDENTIFIER,
      errorMessage({
        expected: 'an identifier',
        after: 'inr keyword',
      }),
    );

    this.consume(
      TokenType.RIGHT_PAREN,
      errorMessage({
        expected: ')',
        after: 'right identifier',
      }),
    );

    this.consume(
      TokenType.FAT_ARROW,
      errorMessage({
        expected: '=>',
        after: 'right identifier',
      }),
    );

    const rightExpression = this.expression(0);

    this.consume(
      TokenType.RIGHT_BRACE,
      errorMessage({
        expected: '}',
        after: 'right branch',
      }),
    );

    return Case({
      sum,
      leftIdentifier,
      left: leftExpression,
      rightIdentifier,
      right: rightExpression,
      caseToken,
    });
  }

  private parseUnfoldExpr(): Unfold {
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

    return Unfold({
      expression,
      unfoldToken: constructorToken,
    });
  }

  private parseFoldExpr(): Fold {
    const constructorToken = this.advance();

    this.consume(
      TokenType.LESS,
      errorMessage({
        expected: '<',
        after: 'fold keyword',
      }),
    );

    const typeResult = normalizeTypeResult(this.type(0));

    if (typeResult.kind === TypeEffectKind.RecursiveVar) {
      throw this.makeSyntaxError(
        constructorToken,
        errorMessage({
          expected: 'a recursive type',
        }),
      );
    }

    if (typeResult.type.kind !== TypeKind.RecType) {
      throw this.makeSyntaxError(
        constructorToken,
        errorMessage({
          expected: 'a recursive type',
        }),
      );
    }

    if (!SenvUtils.isEmpty(typeResult.effect)) {
      throw this.makeSyntaxError(
        constructorToken,
        'Recursive types cannot have effects',
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

    return Fold({
      expression,
      recType: typeResult as TypeEff<RecType, Senv>,
      foldToken: constructorToken,
    });
  }

  private parseTupleOrGroupingExpr(): Grouping | Tuple {
    let expr: Grouping | Tuple;

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

      expr = Tuple({
        expressions,
        constructorToken: paren,
      });
    } else {
      /**
       * @case grouping
       */

      expr = Grouping({
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

    return expr;
  }

  private parseVariableExpr(): Variable {
    return Variable({
      name: this.advance(),
    });
  }

  private parseNumberExpr(): Literal {
    const num = this.advance();

    return Literal({
      value: num.literal as number,
      token: num,
    });
  }

  private parseNilExpr(): Literal {
    return Literal({ value: null, token: this.advance() });
  }

  private parseTrueExpr(): Literal {
    return Literal({ value: true, token: this.advance() });
  }

  private parseFalseExpr(): Literal {
    return Literal({ value: false, token: this.advance() });
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

  private functionParameters(): Array<{ name: Token; type: TypeEff }> {
    this.consume(
      TokenType.LEFT_PAREN,
      errorMessage({
        expected: '(',
        beginning: 'function parameters',
      }),
    );

    const params: Array<{ name: Token; type: TypeEff }> = [];

    while (!this.isAtEnd() && !this.check(TokenType.RIGHT_PAREN)) {
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

      params.push({ name, type });

      if (this.check(TokenType.COMMA)) {
        this.advance();
      } else {
        break;
      }
    }

    this.consume(
      TokenType.RIGHT_PAREN,
      errorMessage({
        expected: ')',
        end: 'function parameters',
      }),
    );

    return params;
  }

  type(minBP: number): TypeParsingResult {
    let left: TypeParsingResult;

    if (this.check(TokenType.NUMBER)) {
      /**
       * @case number type
       */

      this.advance();

      left = typeResult(Real());
    } else if (this.check(TokenType.BOOL)) {
      /**
       * @case number type
       */

      this.advance();

      left = typeResult(Bool());
    } else if (this.check(TokenType.NIL)) {
      /**
       * @case number type
       */

      this.advance();

      left = typeResult(Nil());
    } else if (this.check(TokenType.IDENTIFIER)) {
      /**
       * @case recursive variable type-and-effect | type alias
       */

      const aliasedType = this.typeEnvironment.get(this.peek().lexeme);

      if (!aliasedType) {
        left = typeAndEffectResult(
          RecursiveVar({
            name: this.advance().lexeme,
          }),
        );
      } else {
        this.advance();

        left = typeResult(aliasedType);
      }
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

        if (this.check(TokenType.ARROW)) {
          const arrow = this.advance() as Token & {
            type: TypePrefixOpsType;
          };

          const prefixPower = BindingPower.type.prefix(arrow.type);

          const cod = this.type(prefixPower[1]);

          left = typeResult(
            Arrow({
              domain: types,
              codomain: normalizeTypeResult(cod),
            }),
          );
        } else {
          left = typeResult(
            Product({
              typeEffects: types,
            }),
          );
        }
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
              domain: [normalizeTypeResult(left)],
              codomain: normalizeTypeResult(right),
            }),
          );
        }

        if (op.type === TokenType.PLUS) {
          const right = this.type(infixPower[1]);

          left = typeResult(
            Sum({
              left: normalizeTypeResult(left),
              right: normalizeTypeResult(right),
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

      return new Sens(this.advance().literal as number);
    } else {
      /**
       * @case implicit unitary sensitivity
       */

      return new Sens(1);
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
