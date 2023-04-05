import { Result } from '@badrap/result';
import {
  TypeEff,
  Senv,
  TypeEnvUtils,
  TypeEffUtils,
  Type,
} from '@gsoul-lang/core/utils';
import SJoin from '@gsoul-lang/core/utils/lib/SJoin';
import WellFormed, {
  WellFormednessContext,
} from '@gsoul-lang/core/utils/lib/WellFormed';
import { Sum, typeIsKinded, TypeKind } from '@gsoul-lang/core/utils/Type';
import { Inj, Case } from '@gsoul-lang/parsing/lib/ast';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { expression } from '../checker';
import { TypeCheckingError, TypeCheckingTypeError } from '../utils/errors';
import { TypeCheckingRule, TypeCheckingResult } from '../utils/types';

const checkInjCalleeType =
  (ctx: WellFormednessContext, type: Type, token: Token) =>
  (
    exprTC: TypeCheckingResult,
  ): Result<TypeCheckingResult, TypeCheckingError> => {
    if (!WellFormed.Type(ctx, type)) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: 'Type of the injection is not valid',
          operator: token,
        }),
      );
    }

    return Result.ok(exprTC);
  };

export const inj: TypeCheckingRule<Inj> = (expr, ctx) => {
  const exprTC = expression(expr.expression, ctx).chain(
    checkInjCalleeType([ctx[1]], expr.type, expr.injToken),
  );

  return exprTC.map((exprTC) => ({
    typeEff: TypeEff(
      Sum({
        left: expr.index === 0 ? exprTC.typeEff : TypeEff(expr.type, Senv()),
        right: expr.index === 1 ? exprTC.typeEff : TypeEff(expr.type, Senv()),
      }),
      Senv(),
    ),
    typings: exprTC.typings,
  }));
};

const checkCaseCalleeType =
  (token: Token) =>
  (
    sumTC: TypeCheckingResult,
  ): Result<TypeCheckingResult<Sum>, TypeCheckingError> => {
    if (!typeIsKinded(sumTC.typeEff, TypeKind.Sum)) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: 'Expression being matched must be a sum',
          operator: token,
        }),
      );
    }

    return Result.ok(sumTC as TypeCheckingResult<Sum>);
  };

export const caseExpr: TypeCheckingRule<Case> = (expr, ctx) => {
  const sumTC = expression(expr.sum, ctx).chain(
    checkCaseCalleeType(expr.caseToken),
  );

  const [tenv, rset] = ctx;

  const leftTC = sumTC.chain((sumTC) =>
    expression(expr.left, [
      TypeEnvUtils.extend(
        tenv,
        expr.leftIdentifier.lexeme,
        TypeEffUtils.SumUtils.left(sumTC.typeEff),
      ),
      rset,
    ]),
  );

  const rightTC = sumTC.chain((sumTC) =>
    expression(expr.right, [
      TypeEnvUtils.extend(
        tenv,
        expr.rightIdentifier.lexeme,
        TypeEffUtils.SumUtils.right(sumTC.typeEff),
      ),
      rset,
    ]),
  );

  return Result.all([sumTC, leftTC, rightTC]).chain(([sum, left, right]) => {
    const join = SJoin.TypeEffect(left.typeEff, right.typeEff);

    if (join.isErr) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: join.error.message,
          operator: expr.caseToken,
        }),
      );
    }

    return Result.ok({
      typeEff: TypeEffUtils.applySenvFunction(
        join.value as TypeEff,
        SJoin.Senv,
        sum.typeEff.effect,
      ),
      typings: sum.typings.concat(left.typings, right.typings),
    });
  });
};
