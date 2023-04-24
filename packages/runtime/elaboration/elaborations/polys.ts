import { Result } from '@badrap/result';
import { TypeEff, Senv, TypeEffUtils } from '@gsoul-lang/core/utils';
import { PolyT, typeIsKinded, TypeKind } from '@gsoul-lang/core/utils/Type';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { initialEvidence } from '../../utils/Evidence';
import { Ascription, Expression, Poly, TCall } from '../ast';
import { expression } from '../elaboration';
import { ElaborationError, ElaborationTypeError } from '../errors';
import * as past from '@gsoul-lang/parsing/lib/ast';
import { ElaborationContext } from '../types';
import * as TypevarsSetUtils from '@gsoul-lang/core/utils/TypevarsSet';
import WellFormed, {
  WellFormednessContext,
} from '@gsoul-lang/core/utils/lib/WellFormed';
import { TypeEffect } from '@gsoul-lang/core/utils/TypeEff';

export const poly = (
  expr: past.Poly,
  [tenv, rset, tvars]: ElaborationContext,
): Result<Ascription, ElaborationError> => {
  const bodyElaboration = expression(expr.expr, [
    tenv,
    rset,
    TypevarsSetUtils.extendAll(tvars, ...expr.typeVars.map((v) => v.lexeme)),
  ]);

  return bodyElaboration.map((body) => {
    const lambda = Poly({
      typeVars: expr.typeVars,
      expr: body,
      typeEff: TypeEff(
        PolyT({
          typeVars: expr.typeVars.map((v) => v.lexeme),
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

const checkTappArgWellFormedness =
  (ctx: WellFormednessContext, args: TypeEffect[], operator: Token) =>
  (callee: Expression): Result<Expression, ElaborationError> => {
    if (!args.every((arg) => WellFormed.TypeEffect(ctx, arg))) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'Type argument is not well-formed',
          operator,
        }),
      );
    }

    return Result.ok(callee);
  };
const checkTypeApplicationCalleeType =
  (operator: Token) =>
  (callee: Expression): Result<Expression, ElaborationError> => {
    if (!typeIsKinded(callee.typeEff, TypeKind.PolyT)) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'Expression called is not a type quantification',
          operator,
        }),
      );
    }

    return Result.ok(callee);
  };

export const tapp = (
  expr: past.TCall,
  ctx: ElaborationContext,
): Result<TCall, ElaborationError> => {
  const calleeElaboration = expression(expr.callee, ctx)
    .chain(checkTappArgWellFormedness([ctx[1]], expr.args, expr.bracket))
    .chain(checkTypeApplicationCalleeType(expr.bracket));

  return calleeElaboration.map((callee) => {
    const typeEff = TypeEffUtils.PolysUtils.instance(
      callee.typeEff as TypeEff<PolyT, Senv>,
      expr.args,
    );

    return TCall({
      callee,
      args: expr.args,
      bracket: expr.bracket,
      typeEff,
    });
  });
};
