import { Result } from '@badrap/result';
import { TypeEff } from '@gsoul-lang/core/utils';
import { liftSenvOp } from '@gsoul-lang/core/utils/lib/LiftSenvOp';
import SJoin from '@gsoul-lang/core/utils/lib/SJoin';
import { If } from '../ast';
import { expression } from '../elaboration';
import { ElaborationError, ElaborationTypeError } from '../errors';
import * as past from '@gsoul-lang/parsing/lib/ast';
import { ElaborationContext } from '../types';

export const ifExpr = (
  expr: past.If,
  ctx: ElaborationContext,
): Result<If, ElaborationError> => {
  const conditionElaboration = expression(expr.condition, ctx);
  const thenElaboration = expression(expr.then, ctx);
  const elseElaboration = expression(expr.else, ctx);

  return Result.all([
    conditionElaboration,
    thenElaboration,
    elseElaboration,
  ]).chain(([condition, then, els]) => {
    const bodyTypeEff = SJoin.TypeEffect(then.typeEff, els.typeEff);

    if (!bodyTypeEff.isOk) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'Branches of if expression have incompatible types',
          operator: expr.ifToken,
        }),
      );
    }

    const resultTypeEff = liftSenvOp(SJoin.Senv)(
      bodyTypeEff.value as TypeEff,
      condition.typeEff.effect,
    );

    return Result.ok(
      If({
        ifToken: expr.ifToken,
        condition,
        then,
        else: els,
        typeEff: resultTypeEff,
      }),
    );
  });
};
