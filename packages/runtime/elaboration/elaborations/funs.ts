import { Result } from '@badrap/result';
import {
  TypeEff,
  TypeEnvUtils,
  Senv,
  TypeEffUtils,
} from '@gsoul-lang/core/utils';
import { Arrow, typeIsKinded, TypeKind } from '@gsoul-lang/core/utils/Type';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { zip } from 'ramda';
import { Evidence } from '../../utils';
import { initialEvidence, interior, EvidenceError } from '../../utils/Evidence';
import { Ascription, Fun, Expression, Call } from '../ast';
import { expression } from '../elaboration';
import {
  ElaborationError,
  ElaborationTypeError,
  ElaborationSubtypingError,
} from '../errors';
import * as past from '@gsoul-lang/parsing/lib/ast';
import { ElaborationContext } from '../types';
import { TypeEffect } from '@gsoul-lang/core/utils/TypeEff';

const checkReturnSubtyping =
  (colon?: Token, returnType?: TypeEffect) =>
  (expression: Expression): Result<Expression, ElaborationError> => {
    if (!returnType || !colon) {
      return Result.ok(expression);
    }

    const interiorResult = interior(expression.typeEff, returnType);

    if (!interiorResult.isOk) {
      return Result.err(
        new ElaborationSubtypingError({
          reason: 'Return type does not match function return type',
          operator: colon,
        }),
      );
    }

    return Result.ok(
      Ascription({
        expression,
        evidence: interiorResult.value,
        typeEff: returnType,
      }),
    );
  };

export const fun = (
  expr: past.Fun,
  [tenv, rset, ...rest]: ElaborationContext,
): Result<Ascription, ElaborationError> => {
  const extensions = expr.binders.map(
    (binder) => [binder.name.lexeme, binder.type] as [string, TypeEff],
  );

  const bodyElaboration = expression(expr.body, [
    TypeEnvUtils.extendAll(tenv, ...extensions),
    rset,
    ...rest,
  ]).chain(checkReturnSubtyping(expr.colon, expr.returnType));

  return bodyElaboration.map((body) => {
    const lambda = Fun({
      binders: expr.binders,
      body,
      typeEff: TypeEff(
        Arrow({
          domain: expr.binders.map((binder) => binder.type),
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

const checkApplicationCalleeType =
  (operator: Token) =>
  (callee: Expression): Result<Expression, ElaborationError> => {
    const calleeTypeEff = callee.typeEff;

    if (!typeIsKinded(calleeTypeEff, TypeKind.Arrow)) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'Expression called is not a function',
          operator,
        }),
      );
    }

    return Result.ok(callee);
  };

export const app = (
  expr: past.Call,
  ctx: ElaborationContext,
): Result<Call, ElaborationError> => {
  const calleeElaboration = expression(expr.callee, ctx).chain(
    checkApplicationCalleeType(expr.paren),
  );

  const argsElaboration = Result.all(
    expr.args.map((arg) => expression(arg, ctx)),
  ) as unknown as Result<Expression[], ElaborationError>;

  const evidenceResult = Result.all([calleeElaboration, argsElaboration]).chain(
    ([callee, args]) => {
      const calleeArgType = TypeEffUtils.ArrowsUtils.domain(
        callee.typeEff as TypeEff<Arrow, Senv>,
      );

      const inter = zip(args, calleeArgType).map(([arg, calleeArgType]) =>
        interior(arg.typeEff, calleeArgType),
      );

      const allInteriors = Result.all(inter) as unknown as Result<
        Evidence[],
        EvidenceError
      >;

      if (!allInteriors.isOk) {
        return Result.err(
          new ElaborationSubtypingError({
            reason:
              'Argument type is not subtype of the expected type in the function',
            operator: expr.paren,
          }),
        );
      }

      return Result.ok(allInteriors.value);
    },
  );

  return Result.all([calleeElaboration, argsElaboration, evidenceResult]).map(
    ([callee, arg, evidence]) => {
      const dom = TypeEffUtils.ArrowsUtils.domain(
        callee.typeEff as TypeEff<Arrow, Senv>,
      );

      return Call({
        callee,
        args: zip(arg, evidence).map(([arg, evidence], index) =>
          Ascription({
            evidence,
            typeEff: dom[index],
            expression: arg,
          }),
        ),
        paren: expr.paren,
        typeEff: TypeEffUtils.ArrowsUtils.codomain(
          callee.typeEff as TypeEff<Arrow, Senv>,
        ),
      });
    },
  );
};
