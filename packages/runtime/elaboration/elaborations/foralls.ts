import { Result } from '@badrap/result';
import { TypeEff, Senv, TypeEffUtils } from '@gsoul-lang/core/utils';
import { ForallT, typeIsKinded, TypeKind } from '@gsoul-lang/core/utils/Type';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { initialEvidence } from '../../utils/Evidence';
import { Ascription, Forall, Expression, SCall } from '../ast';
import { expression } from '../elaboration';
import { ElaborationError, ElaborationTypeError } from '../errors';
import * as past from '@gsoul-lang/parsing/lib/ast';
import { ElaborationContext } from '../types';
import * as ResourcesSetUtils from '@gsoul-lang/core/utils/ResourcesSet';
import WellFormed, {
  WellFormednessContext,
} from '@gsoul-lang/core/utils/lib/WellFormed';

export const forall = (
  expr: past.Forall,
  [tenv, rset]: ElaborationContext,
): Result<Ascription, ElaborationError> => {
  const bodyElaboration = expression(expr.expr, [
    tenv,
    ResourcesSetUtils.extendAll(rset, ...expr.sensVars.map((v) => v.lexeme)),
  ]);

  return bodyElaboration.map((body) => {
    const lambda = Forall({
      sensVars: expr.sensVars,
      expr: body,
      typeEff: TypeEff(
        ForallT({
          sensVars: expr.sensVars.map((v) => v.lexeme),
          codomain: body.typeEff,
        }),
        Senv(),
      ),
    });

    const evidence = initialEvidence(lambda.typeEff);

    return Ascription({
      expression: lambda,
      evidence,
      typeEff: lambda.typeEff,
    });
  });
};

const checkSappArgWellFormedness =
  (ctx: WellFormednessContext, args: Senv[], operator: Token) =>
  (callee: Expression): Result<Expression, ElaborationError> => {
    if (!args.every((arg) => WellFormed.Senv(ctx, arg))) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'Senv argument is not well-formed',
          operator,
        }),
      );
    }

    return Result.ok(callee);
  };
const checkSensitiveApplicationCalleeType =
  (operator: Token) =>
  (callee: Expression): Result<Expression, ElaborationError> => {
    if (!typeIsKinded(callee.typeEff, TypeKind.ForallT)) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'Expression called is not a sensitivity quantification',
          operator,
        }),
      );
    }

    return Result.ok(callee);
  };

export const sapp = (
  expr: past.SCall,
  ctx: ElaborationContext,
): Result<SCall, ElaborationError> => {
  const calleeElaboration = expression(expr.callee, ctx)
    .chain(checkSappArgWellFormedness([ctx[1]], expr.args, expr.bracket))
    .chain(checkSensitiveApplicationCalleeType(expr.bracket));

  return calleeElaboration.map((callee) => {
    return SCall({
      callee,
      args: expr.args,
      bracket: expr.bracket,
      typeEff: TypeEffUtils.ForallsUtils.instance(
        callee.typeEff as TypeEff<ForallT, Senv>,
        expr.args,
      ),
    });
  });
};
