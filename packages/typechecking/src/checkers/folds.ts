import { Result } from '@badrap/result';
import { TypeEff, TypeEffUtils } from '@gsoul-lang/core/utils';
import WellFormed, {
  WellFormednessContext,
} from '@gsoul-lang/core/utils/lib/WellFormed';
import { RecType, typeIsKinded, TypeKind } from '@gsoul-lang/core/utils/Type';
import { Fold, Unfold } from '@gsoul-lang/parsing/lib/ast';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { expression } from '../checker';
import { isSubTypeEff } from '../subtyping';
import {
  TypeCheckingError,
  TypeCheckingSubtypingError,
  TypeCheckingTypeError,
} from '../utils/errors';
import { TypeCheckingResult, TypeCheckingRule } from '../utils/types';

const checkFoldBodyType =
  (ctx: WellFormednessContext, typeEff: TypeEff, token: Token) =>
  (
    bodyTC: TypeCheckingResult,
  ): Result<TypeCheckingResult, TypeCheckingError> => {
    if (!WellFormed.TypeEffect(ctx, typeEff)) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: 'Type of folded expression is not valid',
          operator: token,
        }),
      );
    }

    return Result.ok(bodyTC);
  };

const checkFoldBodySubtyping =
  (unfolded: TypeEff, token: Token) =>
  (
    bodyTC: TypeCheckingResult,
  ): Result<TypeCheckingResult, TypeCheckingError> => {
    if (!isSubTypeEff(bodyTC.typeEff, unfolded)) {
      return Result.err(
        new TypeCheckingSubtypingError({
          reason:
            'Expression type-and-effect is not a subtype of the unfolded type-and-effect',
          operator: token,
        }),
      );
    }

    return Result.ok(bodyTC);
  };

export const fold: TypeCheckingRule<Fold> = (expr, ctx) => {
  const typeEff = expr.recType;

  const unfolded = TypeEffUtils.RecursiveUtils.unfold(typeEff);

  const bodyTC = expression(expr.expression, ctx)
    .chain(checkFoldBodyType([ctx[1]], typeEff, expr.foldToken))
    .chain(checkFoldBodySubtyping(unfolded, expr.foldToken));

  return bodyTC.map((body) => ({
    typeEff,
    typings: body.typings,
  }));
};

const checkUnfoldBodyType =
  (token: Token) =>
  (
    bodyTC: TypeCheckingResult,
  ): Result<TypeCheckingResult<RecType>, TypeCheckingError> => {
    if (!typeIsKinded(bodyTC.typeEff, TypeKind.RecType)) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: 'Expression being unfolded must be a fold',
          operator: token,
        }),
      );
    }

    return Result.ok(bodyTC as TypeCheckingResult<RecType>);
  };

export const unfold: TypeCheckingRule<Unfold> = (expr, ctx) => {
  const bodyTC = expression(expr.expression, ctx).chain(
    checkUnfoldBodyType(expr.unfoldToken),
  );

  return bodyTC.map((body) => ({
    typeEff: TypeEffUtils.RecursiveUtils.unfold(body.typeEff),
    typings: body.typings,
  }));
};
