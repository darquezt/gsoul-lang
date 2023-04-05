import { Result } from '@badrap/result';
import { TypeEffUtils, TypeEff, Senv } from '@gsoul-lang/core/utils';
import { isKinded } from '@gsoul-lang/core/utils/ADT';
import { TypeKind, RecType } from '@gsoul-lang/core/utils/Type';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { interior, initialEvidence } from '../../utils/Evidence';
import { Ascription, Fold, Expression, Unfold } from '../ast';
import { expression } from '../elaboration';
import {
  ElaborationError,
  ElaborationSubtypingError,
  ElaborationTypeError,
} from '../errors';
import * as past from '@gsoul-lang/parsing/lib/ast';
import { ElaborationContext } from '../types';
import WellFormed, {
  WellFormednessContext,
} from '@gsoul-lang/core/utils/lib/WellFormed';

const checkFoldTypeWellFormed =
  (ctx: WellFormednessContext, type: TypeEff, operator: Token) =>
  (expr: Expression): Result<Expression, ElaborationError> => {
    if (!WellFormed.TypeEffect(ctx, type)) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'Fold type-and-effect is not well-formed',
          operator,
        }),
      );
    }

    return Result.ok(expr);
  };

export const fold = (
  expr: past.Fold,
  ctx: ElaborationContext,
): Result<Ascription, ElaborationError> => {
  const bodyElaboration = expression(expr.expression, ctx).chain(
    checkFoldTypeWellFormed([ctx[1]], expr.recType, expr.foldToken),
  );

  const bodyTypeEff = TypeEffUtils.RecursiveUtils.unfold(expr.recType);

  const bodyEvidenceResult = bodyElaboration.chain((body) => {
    const bodyEvidence = interior(body.typeEff, bodyTypeEff);

    if (!bodyEvidence.isOk) {
      return Result.err(
        new ElaborationSubtypingError({
          reason:
            'Body type-and-effect is not a subtype of the unfolded expression',
          operator: expr.foldToken,
        }),
      );
    }

    return Result.ok(bodyEvidence.value);
  });

  const typeEff = expr.recType;
  const evidence = initialEvidence(typeEff);

  return Result.all([bodyElaboration, bodyEvidenceResult]).map(
    ([body, bodyEvidence]) =>
      Ascription({
        expression: Fold({
          foldToken: expr.foldToken,
          expression: Ascription({
            evidence: bodyEvidence,
            expression: body,
            typeEff: bodyTypeEff,
          }),
          recType: expr.recType,
          typeEff,
        }),
        evidence,
        typeEff,
      }),
  );
};

const checkBodyIsUnfoldable =
  (operator: Token) =>
  (body: Expression): Result<Expression, ElaborationError> => {
    if (!isKinded(body.typeEff.type, TypeKind.RecType)) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'Cannot unfold an expression without a recursive type',
          operator,
        }),
      );
    }

    return Result.ok(body);
  };

export const unfold = (
  expr: past.Unfold,
  ctx: ElaborationContext,
): Result<Unfold, ElaborationError> => {
  const bodyElaboration = expression(expr.expression, ctx).chain(
    checkBodyIsUnfoldable(expr.unfoldToken),
  );

  return bodyElaboration.map((body) =>
    Unfold({
      expression: body,
      typeEff: TypeEffUtils.RecursiveUtils.unfold(
        body.typeEff as TypeEff<RecType, Senv>,
      ),
      unfoldToken: expr.unfoldToken,
    }),
  );
};
