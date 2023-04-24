import { Result } from '@badrap/result';
import { TypeEnv } from '@gsoul-lang/core/utils';
import { ResourcesSet } from '@gsoul-lang/core/utils/ResourcesSet';
import { TypeEffect } from '@gsoul-lang/core/utils/TypeEff';
import { TypevarsSet } from '@gsoul-lang/core/utils/TypevarsSet';
import { Expression, Statement } from '@gsoul-lang/parsing/lib/ast';
import { TypeCheckingError } from './errors';
import { TypeAssoc } from './typingSeeker';

export type TypeCheckingContext = [
  typeEnvironment: TypeEnv,
  resources: ResourcesSet,
  typevars: TypevarsSet,
];

// Expression typechecking

export type TypeCheckingResult<R extends TypeEffect = TypeEffect> = {
  typeEff: R;
  typings: TypeAssoc[];
};
export type TypeCheckingRule<
  E extends Expression = Expression,
  R extends TypeEffect = TypeEffect,
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
