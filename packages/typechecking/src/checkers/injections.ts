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
import { all } from 'ramda';
import { expression } from '../checker';
import { TypeCheckingError, TypeCheckingTypeError } from '../utils/errors';
import { TypeCheckingRule, TypeCheckingResult } from '../utils/types';

const checkInjCalleeType =
  (ctx: WellFormednessContext, types: Type[], token: Token) =>
  (
    exprTC: TypeCheckingResult,
  ): Result<TypeCheckingResult, TypeCheckingError> => {
    if (!all((type) => WellFormed.Type(ctx, type), types)) {
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
    checkInjCalleeType([ctx[1]], expr.types, expr.injToken),
  );

  return exprTC.map((exprTC) => {
    const typeEffects = expr.types.map((type) => TypeEff(type, Senv()));

    const allTypeEffects = [
      ...typeEffects.slice(0, expr.index),
      exprTC.typeEff,
      ...typeEffects.slice(expr.index),
    ];

    return {
      typeEff: TypeEff(
        Sum({
          typeEffects: allTypeEffects,
        }),
        Senv(),
      ),
      typings: exprTC.typings,
    };
  });
};

const checkCaseCalleeType =
  (token: Token) =>
  (
    sumTC: TypeCheckingResult,
  ): Result<TypeCheckingResult<TypeEff<Sum, Senv>>, TypeCheckingError> => {
    if (!typeIsKinded(sumTC.typeEff, TypeKind.Sum)) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: 'Expression being matched must be a sum',
          operator: token,
        }),
      );
    }

    return Result.ok(sumTC as TypeCheckingResult<TypeEff<Sum, Senv>>);
  };

export const caseExpr: TypeCheckingRule<Case> = (expr, ctx) => {
  const sumTC = expression(expr.sum, ctx).chain(
    checkCaseCalleeType(expr.caseToken),
  );

  const [tenv, rset, ...rest] = ctx;

  const branchesTC = Result.all(
    expr.branches.map((branch, index) =>
      sumTC.chain((sumTC) =>
        expression(branch.body, [
          TypeEnvUtils.extend(
            tenv,
            branch.identifier.lexeme,
            TypeEffUtils.SumUtils.projection(index, sumTC.typeEff),
          ),
          rset,
          ...rest,
        ]),
      ),
    ),
  ) as unknown as Result<TypeCheckingResult[], TypeCheckingError>;

  return Result.all([sumTC, branchesTC]).chain(([sum, branches]) => {
    const [first, second, ...restBranches] = branches;

    const join = restBranches.reduce((acc, branch) => {
      return acc.chain((typeEff) => SJoin.TypeEffect(typeEff, branch.typeEff));
    }, SJoin.TypeEffect(first.typeEff, second.typeEff));

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
      typings: sum.typings.concat(...branches.map((branch) => branch.typings)),
    });
  });
};
