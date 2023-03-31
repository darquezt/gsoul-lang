import { Result } from '@badrap/result';
import { TypeEff } from '@gsoul-lang/core/utils';
import { Ascription } from '@gsoul-lang/parsing/lib/ast';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { expression } from '../checker';
import { isSubTypeEff } from '../subtyping';
import { TypeCheckingError, TypeCheckingTypeError } from '../utils/errors';
import { TypeCheckingResult, TypeCheckingRule } from '../utils/types';

const checkAscriptionSubtyping =
  (typeEff: TypeEff, token: Token) =>
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

export const ascription: TypeCheckingRule<Ascription> = (expr, ctx) => {
  const innerTC = expression(expr.expression, ctx).chain(
    checkAscriptionSubtyping(expr.typeEff, expr.ascriptionToken),
  );

  return innerTC;
};
