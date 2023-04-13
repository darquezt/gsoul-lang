import { Result } from '@badrap/result';
import { interior } from '../../utils/Evidence';
import { Ascription, Expression } from '../ast';
import { expression } from '../elaboration';
import { ElaborationError, ElaborationSubtypingError } from '../errors';
import * as past from '@gsoul-lang/parsing/lib/ast';
import { ElaborationContext } from '../types';
import WellFormed, {
  WellFormednessContext,
} from '@gsoul-lang/core/utils/lib/WellFormed';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { TypeEffect } from '@gsoul-lang/core/utils/TypeEff';

const checkAscriptionWellFormed =
  (ctx: WellFormednessContext, token: Token, typeEff: TypeEffect) =>
  (expr: Expression): Result<Expression, ElaborationError> => {
    if (!WellFormed.TypeEffect(ctx, typeEff)) {
      return Result.err(
        new ElaborationSubtypingError({
          reason: 'Expression is not ascribed to a well-formed type-and-effect',
          operator: token,
        }),
      );
    }

    return Result.ok(expr);
  };

export const ascription = (
  expr: past.Ascription,
  ctx: ElaborationContext,
): Result<Ascription, ElaborationError> => {
  const innerElaboration = expression(expr.expression, ctx).chain(
    checkAscriptionWellFormed([ctx[1]], expr.ascriptionToken, expr.typeEff),
  );

  return innerElaboration.chain((inner) => {
    const evidence = interior(inner.typeEff, expr.typeEff);

    if (!evidence.isOk) {
      return Result.err(
        new ElaborationSubtypingError({
          reason:
            'Expression type-and-effect is not a subtype of the ascription type-and-effect',
          operator: expr.ascriptionToken,
        }),
      );
    }

    return Result.ok(
      Ascription({
        expression: inner,
        evidence: evidence.value,
        typeEff: expr.typeEff,
      }),
    );
  });
};
