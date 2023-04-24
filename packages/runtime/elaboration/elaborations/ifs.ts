import { Result } from '@badrap/result';
import { TypeEff } from '@gsoul-lang/core/utils';
import { liftSenvOp } from '@gsoul-lang/core/utils/lib/LiftSenvOp';
import SJoin from '@gsoul-lang/core/utils/lib/SJoin';
import { Expression, If } from '../ast';
import { expression } from '../elaboration';
import { ElaborationError, ElaborationTypeError } from '../errors';
import * as past from '@gsoul-lang/parsing/lib/ast';
import { ElaborationContext } from '../types';
import {
  checkTypeEffConcreteness,
  ConcreteTypeEff,
} from '../utils/auxiliaryCheckers';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { typeIsKinded, TypeKind } from '@gsoul-lang/core/utils/Type';

const checkIfConditionType =
  (token: Token) =>
  (
    expr: Expression & ConcreteTypeEff,
  ): Result<Expression & ConcreteTypeEff, ElaborationError> => {
    if (!typeIsKinded(expr.typeEff, TypeKind.Bool)) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'Condition of if expression must be of type Bool',
          operator: token,
        }),
      );
    }

    return Result.ok(expr);
  };

export const ifExpr = (
  expr: past.If,
  ctx: ElaborationContext,
): Result<If, ElaborationError> => {
  const conditionElaboration = expression(expr.condition, ctx)
    .chain(
      checkTypeEffConcreteness(
        expr.ifToken,
        'Condition of if expression may not have a correct type',
      ),
    )
    .chain(checkIfConditionType(expr.ifToken));
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
