import { Result } from '@badrap/result';
import {
  TypeEff,
  Senv,
  TypeEnvUtils,
  TypeEffUtils,
  Type,
} from '@gsoul-lang/core/utils';
import SJoin from '@gsoul-lang/core/utils/lib/SJoin';
import { Sum } from '@gsoul-lang/core/utils/Type';
import { Inj, Case, Expression } from '../ast';
import { expression } from '../elaboration';
import { ElaborationError, ElaborationTypeError } from '../errors';
import * as past from '@gsoul-lang/parsing/lib/ast';
import { ElaborationContext } from '../types';
import WellFormed, {
  WellFormednessContext,
} from '@gsoul-lang/core/utils/lib/WellFormed';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { checkTypeEffConcreteness } from '../utils/auxiliaryCheckers';

const checkInjTypeWellFormed =
  (ctx: WellFormednessContext, type: Type, token: Token) =>
  (expr: Expression): Result<Expression, ElaborationError> => {
    if (!WellFormed.Type(ctx, type)) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'Type of the injection is not valid',
          operator: token,
        }),
      );
    }

    return Result.ok(expr);
  };

export const inj = (
  expr: past.Inj,
  ctx: ElaborationContext,
): Result<Inj, ElaborationError> => {
  const bodyElaboration = expression(expr.expression, ctx).chain(
    checkInjTypeWellFormed([ctx[1]], expr.type, expr.injToken),
  );

  return bodyElaboration.map((body) =>
    Inj({
      type: expr.type,
      index: expr.index,
      expression: body,
      typeEff: TypeEff(
        Sum({
          left: expr.index === 0 ? body.typeEff : TypeEff(expr.type, Senv()),
          right: expr.index === 1 ? body.typeEff : TypeEff(expr.type, Senv()),
        }),
        Senv(),
      ),
      injToken: expr.injToken,
    }),
  );
};

export const caseExpr = (
  expr: past.Case,
  ctx: ElaborationContext,
): Result<Case, ElaborationError> => {
  const sumElaboration = expression(expr.sum, ctx).chain(
    checkTypeEffConcreteness(
      expr.caseToken,
      'Sum operand may not have a correct type',
    ),
  );

  const [tenv, rset, ...rest] = ctx;

  const leftElaboration = sumElaboration.chain((sum) =>
    expression(expr.left, [
      TypeEnvUtils.extend(
        tenv,
        expr.leftIdentifier.lexeme,
        TypeEffUtils.SumUtils.left(sum.typeEff as TypeEff<Sum, Senv>),
      ),
      rset,
      ...rest,
    ]),
  );

  const rightElaboration = sumElaboration.chain((sum) =>
    expression(expr.right, [
      TypeEnvUtils.extend(
        tenv,
        expr.rightIdentifier.lexeme,
        TypeEffUtils.SumUtils.right(sum.typeEff as TypeEff<Sum, Senv>),
      ),
      rset,
      ...rest,
    ]),
  );

  return Result.all([sumElaboration, leftElaboration, rightElaboration]).chain(
    ([sum, left, right]) => {
      const bodyTypeEff = SJoin.TypeEffect(left.typeEff, right.typeEff);

      if (!bodyTypeEff.isOk) {
        return Result.err(
          new ElaborationTypeError({
            reason: 'Branches of case expression have incompatible types',
            operator: expr.caseToken,
          }),
        );
      }

      return Result.ok(
        Case({
          sum,
          leftIdentifier: expr.leftIdentifier,
          left: left,
          rightIdentifier: expr.rightIdentifier,
          right: right,
          typeEff: TypeEffUtils.applySenvFunction(
            bodyTypeEff.value as TypeEff,
            SJoin.Senv,
            sum.typeEff.effect,
          ),
          caseToken: expr.caseToken,
        }),
      );
    },
  );
};
