import { Result } from '@badrap/result';
import {
  TypeEff,
  Senv,
  TypeEnvUtils,
  TypeEffUtils,
  Type,
} from '@gsoul-lang/core/utils';
import SJoin from '@gsoul-lang/core/utils/lib/SJoin';
import { Sum, typeIsKinded, TypeKind } from '@gsoul-lang/core/utils/Type';
import { Inj, Case, Expression, Ascription } from '../ast';
import { expression } from '../elaboration';
import { ElaborationError, ElaborationTypeError } from '../errors';
import * as past from '@gsoul-lang/parsing/lib/ast';
import { ElaborationContext } from '../types';
import WellFormed, {
  WellFormednessContext,
} from '@gsoul-lang/core/utils/lib/WellFormed';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import {
  checkTypeEffConcreteness,
  ConcreteTypeEff,
} from '../utils/auxiliaryCheckers';
import { all } from 'ramda';
import { initialEvidence } from '../../utils/Evidence';
import { isKinded } from '@gsoul-lang/core/utils/ADT';

const checkInjTypeWellFormed =
  (ctx: WellFormednessContext, types: Type[], token: Token) =>
  (expr: Expression): Result<Expression, ElaborationError> => {
    if (!all((type) => WellFormed.Type(ctx, type), types)) {
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
): Result<Ascription, ElaborationError> => {
  const bodyElaboration = expression(expr.expression, ctx).chain(
    checkInjTypeWellFormed([ctx[1]], expr.types, expr.injToken),
  );

  return bodyElaboration.map((body) => {
    const typeEffects = expr.types.map((type) => TypeEff(type, Senv()));

    const allTypeEffects = [
      ...typeEffects.slice(0, expr.index),
      body.typeEff,
      ...typeEffects.slice(expr.index),
    ];

    const typeEff = TypeEff(
      Sum({
        typeEffects: allTypeEffects,
      }),
      Senv(),
    );

    const evidence = initialEvidence(typeEff);

    return Ascription({
      evidence,
      typeEff,
      expression: Inj({
        types: expr.types,
        index: expr.index,
        expression: body,
        typeEff: TypeEff(
          Sum({
            typeEffects: allTypeEffects,
          }),
          Senv(),
        ),
        injToken: expr.injToken,
      }),
    });
  });
};

const checkCaseExpressionIsInjection =
  (token: Token) =>
  (
    expr: Expression & ConcreteTypeEff,
  ): Result<Expression & ConcreteTypeEff<TypeEff<Sum>>, ElaborationError> => {
    if (!isKinded(expr.typeEff.type, TypeKind.Sum)) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'Case expression is not an injection',
          operator: token,
        }),
      );
    }

    return Result.ok(expr as Expression & ConcreteTypeEff<TypeEff<Sum>>);
  };

const checkCaseBranchesExhaustiveness =
  (token: Token, numberOfBranches: number) =>
  (
    expression: Expression & ConcreteTypeEff<TypeEff<Sum>>,
  ): Result<Expression & ConcreteTypeEff<TypeEff<Sum>>, ElaborationError> => {
    if (expression.typeEff.type.typeEffects.length !== numberOfBranches) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'Case expression is not exhaustive',
          operator: token,
        }),
      );
    }

    return Result.ok(expression);
  };

const sortMatchBranches =
  (token: Token, branches: past.Case['branches']) =>
  (
    expression: Expression & ConcreteTypeEff<TypeEff<Sum>>,
  ): Result<past.Case['branches'], ElaborationError> => {
    if (!all((branch) => Boolean(branch.name), branches)) {
      return Result.ok(branches);
    }

    const newBranches: past.Case['branches'] = [];

    for (const product of expression.typeEff.type.typeEffects) {
      if (!typeIsKinded(product, TypeKind.Product)) {
        return Result.err(
          new ElaborationTypeError({
            reason: 'Expression matched is not well formed',
            operator: token,
          }),
        );
      }

      const constructorType = product.type.typeEffects[1];

      if (!typeIsKinded(constructorType, TypeKind.Atom)) {
        return Result.err(
          new ElaborationTypeError({
            reason: 'Expression matched is not well formed',
            operator: token,
          }),
        );
      }

      const constructorName = constructorType.type.name;

      const branch = branches.find(
        (branch) => branch.name?.lexeme === constructorName,
      );

      if (!branch) {
        return Result.err(
          new ElaborationTypeError({
            reason: `Match expression is not exhaustive. Case ${constructorName} is not handled.`,
            operator: token,
          }),
        );
      }

      newBranches.push(branch);
    }

    return Result.ok(newBranches);
  };

export const caseExpr = (
  expr: past.Case,
  ctx: ElaborationContext,
): Result<Case, ElaborationError> => {
  const sumElaboration = expression(expr.sum, ctx)
    .chain(
      checkTypeEffConcreteness(
        expr.caseToken,
        'Sum operand may not have a correct type',
      ),
    )
    .chain(checkCaseExpressionIsInjection(expr.caseToken))
    .chain(
      checkCaseBranchesExhaustiveness(expr.caseToken, expr.branches.length),
    );

  const [tenv, rset, ...rest] = ctx;

  const branchesElaboration = sumElaboration
    .chain(sortMatchBranches(expr.caseToken, expr.branches))
    .chain(
      (branches) =>
        Result.all(
          branches.map((branch, index) =>
            sumElaboration.chain((sum) =>
              expression(branch.body, [
                TypeEnvUtils.extend(
                  tenv,
                  branch.identifier.lexeme,
                  TypeEffUtils.SumUtils.projection(index, sum.typeEff),
                ),
                rset,
                ...rest,
              ]).map((body) => ({
                identifier: branch.identifier,
                body,
              })),
            ),
          ),
        ) as unknown as Result<Case['branches'], ElaborationError>,
    );

  return Result.all([sumElaboration, branchesElaboration]).chain(
    ([sum, branches]) => {
      const [first, second, ...restBranches] = branches;

      const bodyTypeEff = restBranches.reduce((acc, branch) => {
        return acc.chain((typeEff) =>
          SJoin.TypeEffect(typeEff, branch.body.typeEff),
        );
      }, SJoin.TypeEffect(first.body.typeEff, second.body.typeEff));

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
          branches,
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
