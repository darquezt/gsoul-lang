import { Result } from '@badrap/result';
import { TypeEff } from '@gsoul-lang/core/utils';
import { liftSenvOp } from '@gsoul-lang/core/utils/lib/LiftSenvOp';
import SJoin from '@gsoul-lang/core/utils/lib/SJoin';
import { Bool, typeIsKinded, TypeKind } from '@gsoul-lang/core/utils/Type';
import { If } from '@gsoul-lang/parsing/lib/ast';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { expression } from '../checker';
import { TypeCheckingError, TypeCheckingTypeError } from '../utils/errors';
import { TypeCheckingResult, TypeCheckingRule } from '../utils/types';

const checkIfConditionType =
  (token: Token) =>
  (
    conditionTC: TypeCheckingResult,
  ): Result<TypeCheckingResult<Bool>, TypeCheckingError> => {
    if (!typeIsKinded(conditionTC.typeEff, TypeKind.Bool)) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: 'Condition of if expression must be of type Bool',
          operator: token,
        }),
      );
    }

    return Result.ok(conditionTC as TypeCheckingResult<Bool>);
  };

export const ifExpr: TypeCheckingRule<If> = (expr, ctx) => {
  const conditionTC = expression(expr.condition, ctx).chain(
    checkIfConditionType(expr.ifToken),
  );

  const thenTC = expression(expr.then, ctx);

  const elseTC = expression(expr.else, ctx);

  return Result.all([conditionTC, thenTC, elseTC]).chain(
    ([condition, then, els]) => {
      const bodyType = SJoin.TypeEffect(then.typeEff, els.typeEff);

      if (!bodyType.isOk) {
        return Result.err(
          new TypeCheckingTypeError({
            reason: bodyType.error.message,
            operator: expr.ifToken,
          }),
        );
      }

      const resultType = liftSenvOp(SJoin.Senv)(
        bodyType.value as TypeEff,
        condition.typeEff.effect,
      );

      return Result.ok({
        typeEff: resultType,
        typings: condition.typings.concat(then.typings).concat(els.typings),
      });
    },
  );
};
