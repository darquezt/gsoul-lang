import { Result } from '@badrap/result';
import WellFormed, {
  WellFormednessContext,
} from '@gsoul-lang/core/utils/lib/WellFormed';
import { TypeEffect } from '@gsoul-lang/core/utils/TypeEff';
import { Ascription } from '@gsoul-lang/parsing/lib/ast';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { expression } from '../checker';
import { isSubTypeEff } from '../subtyping';
import { TypeCheckingError, TypeCheckingTypeError } from '../utils/errors';
import { TypeCheckingResult, TypeCheckingRule } from '../utils/types';

const checkAscriptionSubtyping =
  (typeEff: TypeEffect, token: Token) =>
  (
    exprTC: TypeCheckingResult,
  ): Result<TypeCheckingResult, TypeCheckingError> => {
    if (!isSubTypeEff(exprTC.typeEff, typeEff)) {
      return Result.err(
        new TypeCheckingTypeError({
          reason:
            'Expression type-and-effect is not a subtype of the ascription type-and-effect',
          operator: token,
        }),
      );
    }

    return Result.ok(exprTC);
  };

const checkAscriptionTypeIsValid =
  (ctx: WellFormednessContext, typeEff: TypeEffect, token: Token) =>
  (
    exprTC: TypeCheckingResult,
  ): Result<TypeCheckingResult, TypeCheckingError> => {
    if (!WellFormed.TypeEffect(ctx, typeEff)) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: 'Expression ascription type is not valid',
          operator: token,
        }),
      );
    }

    return Result.ok(exprTC);
  };

export const ascription: TypeCheckingRule<Ascription> = (expr, ctx) => {
  const innerTC = expression(expr.expression, ctx)
    .chain(
      checkAscriptionTypeIsValid([ctx[1]], expr.typeEff, expr.ascriptionToken),
    )
    .chain(checkAscriptionSubtyping(expr.typeEff, expr.ascriptionToken));

  return innerTC;
};
