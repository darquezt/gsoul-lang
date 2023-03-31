import { Result } from '@badrap/result';
import { Senv, Type, TypeEff, TypeEnv } from '@gsoul-lang/core/utils';
import { Expression, Statement } from '@gsoul-lang/parsing/lib/ast';
import { TypeCheckingError } from './errors';
import { TypeAssoc } from './typingSeeker';

export type TypeCheckingContext = [TypeEnv];

// Expression typechecking

export type TypeCheckingResult<R extends Type = Type> = {
  typeEff: TypeEff<R, Senv>;
  typings: TypeAssoc[];
};
export type TypeCheckingRule<
  E extends Expression = Expression,
  R extends Type = Type,
> = (
  expr: E,
  ctx: TypeCheckingContext,
) => Result<TypeCheckingResult<R>, TypeCheckingError>;

// Statement typechecking

export type StatefulTypeCheckingResult = TypeCheckingResult & {
  ctx: TypeCheckingContext;
};
export type StatefulTypeCheckingRule<S extends Statement = Statement> = (
  stmt: S,
  ctx: TypeCheckingContext,
) => Result<StatefulTypeCheckingResult, TypeCheckingError>;
