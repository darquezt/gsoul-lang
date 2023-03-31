import { Result } from '@badrap/result';
import { TypeEff, Senv, TypeEffUtils } from '@gsoul-lang/core/utils';
import { Product, typeIsKinded, TypeKind } from '@gsoul-lang/core/utils/Type';
import { Projection, Tuple } from '@gsoul-lang/parsing/lib/ast';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { expression } from '../checker';
import { TypeCheckingError, TypeCheckingTypeError } from '../utils/errors';
import { TypeCheckingRule, TypeCheckingResult } from '../utils/types';
import { TypeAssocs } from '../utils/typingSeeker';

export const tuple: TypeCheckingRule<Tuple> = (expr, ctx) => {
  const typings: TypeAssocs = [];

  const expressionsTC = Result.all(
    expr.expressions.map((e) => expression(e, ctx)),
  ) as unknown as Result<TypeCheckingResult[], TypeCheckingError>;

  return expressionsTC.map((eTC) => ({
    typeEff: TypeEff(
      Product({
        typeEffects: eTC.map((e) => e.typeEff),
      }),
      Senv(),
    ),
    typings: typings.concat(...eTC.map((e) => e.typings)),
  }));
};

const checkProjectionCalleeType =
  (token: Token) =>
  (
    tupleTC: TypeCheckingResult,
  ): Result<TypeCheckingResult<Product>, TypeCheckingError> => {
    if (!typeIsKinded(tupleTC.typeEff, TypeKind.Product)) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: 'Expression being projected must be a tuple',
          operator: token,
        }),
      );
    }

    return Result.ok(tupleTC as TypeCheckingResult<Product>);
  };

const checkProjectionIndex =
  (index: number, token: Token) =>
  (
    tupleTC: TypeCheckingResult<Product>,
  ): Result<TypeCheckingResult<Product>, TypeCheckingError> => {
    if (tupleTC.typeEff.type.typeEffects.length <= index) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: 'Tuple does not have that many elements',
          operator: token,
        }),
      );
    }

    return Result.ok(tupleTC);
  };

export const projection: TypeCheckingRule<Projection> = (expr, ctx) => {
  const tupleTC = expression(expr.tuple, ctx)
    .chain(checkProjectionCalleeType(expr.projectToken))
    .chain(checkProjectionIndex(expr.index, expr.projectToken));

  return tupleTC.map((tupleTC) => ({
    typeEff: TypeEffUtils.ProductUtils.projection(expr.index, tupleTC.typeEff),
    typings: tupleTC.typings,
  }));
};
