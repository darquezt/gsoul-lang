import { Result } from '@badrap/result';
import { TypeEff, Senv, TypeEffUtils } from '@gsoul-lang/core/utils';
import { Product, typeIsKinded, TypeKind } from '@gsoul-lang/core/utils/Type';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { prop } from 'ramda';
import { initialEvidence } from '../../utils/Evidence';
import { Ascription, Expression, Tuple, Projection } from '../ast';
import { expression } from '../elaboration';
import { ElaborationError, ElaborationTypeError } from '../errors';
import * as past from '@gsoul-lang/parsing/lib/ast';
import { ElaborationContext } from '../types';
import {
  checkTypeEffConcreteness,
  ConcreteTypeEff,
} from '../utils/auxiliaryCheckers';

export const tuple = (
  expr: past.Tuple,
  ctx: ElaborationContext,
): Result<Ascription, ElaborationError> => {
  const elaborations: Expression[] = [];

  for (const e of expr.expressions) {
    const eTC = expression(e, ctx);

    if (!eTC.isOk) {
      return Result.err(eTC.error);
    }

    elaborations.push(eTC.value);
  }

  const typeEff = TypeEff(
    Product({
      typeEffects: elaborations.map((e) => prop('typeEff', e)),
    }),
    Senv(),
  );

  const evidence = initialEvidence(typeEff);

  return Result.ok(
    Ascription({
      evidence,
      expression: Tuple({
        expressions: elaborations,
        typeEff,
      }),
      typeEff,
    }),
  );
};

const checkExpressionProjectedIsTuple =
  (operator: Token) =>
  (tuple: Expression): Result<Expression, ElaborationError> => {
    if (!typeIsKinded(tuple.typeEff, TypeKind.Product)) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'The expression being projected must be a tuple',
          operator,
        }),
      );
    }

    return Result.ok(tuple);
  };

const checkProjectionOutOfBounds =
  (index: number, operator: Token) =>
  (
    tuple: Expression & ConcreteTypeEff,
  ): Result<Expression, ElaborationError> => {
    if (index >= (tuple.typeEff.type as Product).typeEffects.length) {
      return Result.err(
        new ElaborationTypeError({
          reason: `Tuple has no ${index} element`,
          operator: operator,
        }),
      );
    }

    return Result.ok(tuple);
  };

export const projection = (
  expr: past.Projection,
  ctx: ElaborationContext,
): Result<Projection, ElaborationError> => {
  const tupleElaboration = expression(expr.tuple, ctx)
    .chain(
      checkTypeEffConcreteness(
        expr.projectToken,
        'The expression being projected must be a tuple',
      ),
    )
    .chain(checkExpressionProjectedIsTuple(expr.projectToken))
    .chain(checkProjectionOutOfBounds(expr.index, expr.projectToken));

  return tupleElaboration.map((tuple) =>
    Projection({
      tuple,
      index: expr.index,
      projectToken: expr.projectToken,
      typeEff: TypeEffUtils.ProductUtils.projection(
        expr.index,
        tuple.typeEff as TypeEff<Product, Senv>,
      ),
    }),
  );
};
