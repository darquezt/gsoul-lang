import { Result } from '@badrap/result';
import {
  TypeEff,
  Senv,
  TypeEnvUtils,
  TypeEffUtils,
} from '@gsoul-lang/core/utils';
import SJoin from '@gsoul-lang/core/utils/lib/SJoin';
import { Sum, typeIsKinded, TypeKind } from '@gsoul-lang/core/utils/Type';
import { Inj, Case } from '@gsoul-lang/parsing/lib/ast';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { expression } from '../checker';
import { TypeCheckingError, TypeCheckingTypeError } from '../utils/errors';
import { TypeCheckingRule, TypeCheckingResult } from '../utils/types';

export const inj: TypeCheckingRule<Inj> = (expr, ctx) => {
  const exprTC = expression(expr.expression, ctx);

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

  const leftTC = sumTC.chain((sumTC) =>
    expression(expr.left, [
      TypeEnvUtils.extend(
        ctx[0],
        expr.leftIdentifier.lexeme,
        TypeEffUtils.SumUtils.left(sumTC.typeEff),
      ),
    ]),
  );

  const rightTC = sumTC.chain((sumTC) =>
    expression(expr.right, [
      TypeEnvUtils.extend(
        ctx[0],
        expr.rightIdentifier.lexeme,
        TypeEffUtils.SumUtils.right(sumTC.typeEff),
      ),
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
