import {
  any,
  dropL,
  dropR,
  log,
  many,
  map,
  optional,
  regex,
  seq,
  str,
} from './combinators';
import { Context, Failure, Parser, Result } from './types';

type Identifier = string;

type Binder = { identifier: Identifier };

export type Term =
  | { kind: 'number'; value: number }
  | { kind: 'variable'; identifier: Identifier }
  | { kind: 'function'; binder: Binder; body: Term }
  | { kind: 'app'; fun: Term; arg: Term }
  | { kind: 'plus'; left: Term; right: Term }
  | { kind: 'leq'; left: Term; right: Term };

export type Program = Term;

const whitespace: Parser<void> = map(
  regex(/[\s|\t|\n]+/g, 'whitespace'),
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  () => {},
);

const numberLit: Parser<Term> = map(regex(/\d+/g, 'number'), (num) => ({
  kind: 'number',
  value: parseFloat(num),
}));

/**
 * args ::= term term*
 */
function args(ctx: Context): Result<Term[]> {
  return many(dropR(term, optional(whitespace)))(ctx);
}

const mapToApp = ([fun, [arg, ...rest]]: [Term, Term[]]): Term => {
  let appTerm: Term = { kind: 'app', fun, arg };

  rest.forEach((anotherArg) => {
    appTerm = { kind: 'app', fun: appTerm, arg: anotherArg };
  });

  return appTerm;
};
/**
 * app ::= '[' term args ']'
 */
function app(ctx: Context): Result<Term> {
  return map(
    seq([dropL(str('['), dropR(term, whitespace)), dropR(args, str(']'))]),
    mapToApp,
  )(ctx);
}

const mapToPlus = ([term1, term2]: Term[]): Term => ({
  kind: 'plus',
  left: term1,
  right: term2,
});
/**
 * plus ::= [+ term term]
 */
function plus(ctx: Context): Result<Term> {
  return map(
    seq([
      dropL(dropR(str('[+'), whitespace), dropR(term, whitespace)),
      dropR(term, str(']')),
    ]),
    mapToPlus,
  )(ctx);
}

const mapToLeq = ([term1, term2]: Term[]): Term => ({
  kind: 'leq',
  left: term1,
  right: term2,
});
/**
 * plus ::= [+ term term]
 */
function leq(ctx: Context): Result<Term> {
  return map(
    seq([
      dropL(dropR(str('[<='), whitespace), dropR(term, whitespace)),
      dropR(term, str(']')),
    ]),
    mapToLeq,
  )(ctx);
}

/**
 * senv ::= 
 */

/**
 * ty ::= 'Num' | 'Bool' | 'Fun' '<' ty ',' tyEff '>'
 */

/**
 * tyEff ::= ty '@' senv
 */

/**
 * identifier ::= /[a-zA-Z][a-zA-Z0-9]+/
 */

/**
 * binder ::= identifier ':' ty
 */

/**
 * fun ::= 'fun' '(' binder ')' '.' term
 */

/**
 * term ::= app | plus | leq | number
 */
const term: Parser<Term> = log(any([app, plus, leq, numberLit]), 'term');

export function parse(text: string): Program {
  const initialContext: Context = { text, currentIndex: 0 };

  const response = term(initialContext);

  if (response.success) {
    return response.value;
  }

  const failure = response as Failure;

  throw new Error(
    `[Syntax error]: Expected ${failure.expected} at position ${failure.ctx.currentIndex}`,
  );
}
