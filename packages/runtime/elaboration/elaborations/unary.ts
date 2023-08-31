import * as past from '@gsoul-lang/parsing/lib/ast';
import { Result } from '@badrap/result';
import { TypeEff } from '@gsoul-lang/core/utils';
import { Bool, TypeKind, typeIsKinded } from '@gsoul-lang/core/utils/Type';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { Expression, Negate } from '../ast';
import { expression } from '../elaboration';
import { ElaborationError, ElaborationTypeError } from '../errors';
import { ElaborationContext } from '../types';
import { ConcreteTypeEff } from '../utils/auxiliaryCheckers';

const checkExpressionIsBoolean =
  (token: Token) =>
  (
    exprElaboration: Expression,
  ): Result<Expression & ConcreteTypeEff<TypeEff<Bool>>, ElaborationError> => {
    if (!typeIsKinded(exprElaboration.typeEff, TypeKind.Bool)) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'Cannot negate a non-boolean expression',
          operator: token,
        }),
      );
    }

    return Result.ok(
      exprElaboration as Expression & ConcreteTypeEff<TypeEff<Bool>>,
    );
  };

export const negate = (
  expr: past.Negate,
  ctx: ElaborationContext,
): Result<Negate, ElaborationError> => {
  const exprElaboration = expression(expr.expression, ctx).chain(
    checkExpressionIsBoolean(expr.token),
  );

  return exprElaboration.map((inner) => {
    return Negate({
      expression: inner,
      token: expr.token,
      typeEff: inner.typeEff,
    });
  });
};
