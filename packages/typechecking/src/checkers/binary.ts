import { Result } from '@badrap/result';
import { SenvUtils, TypeEff } from '@gsoul-lang/core/utils';
import { Bool, Real } from '@gsoul-lang/core/utils/Type';
import { Binary, NonLinearBinary } from '@gsoul-lang/parsing/lib/ast';
import { Token, TokenType } from '@gsoul-lang/parsing/lib/lexing';
import { expression } from '../checker';
import { TypeCheckingError, TypeCheckingTypeError } from '../utils/errors';
import { TypeCheckingResult, TypeCheckingRule } from '../utils/types';

const checkSameTypeOperands =
  (operator: Token) =>
  ([left, right]: [TypeCheckingResult, TypeCheckingResult]): Result<
    [TypeCheckingResult, TypeCheckingResult],
    TypeCheckingError
  > => {
    if (left.typeEff.type !== right.typeEff.type) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: 'Operands of binary operation must be of the same type',
          operator,
        }),
      );
    }

    return Result.ok([left, right]);
  };

export const binary: TypeCheckingRule<Binary> = (expr, ctx) => {
  const lTC = expression(expr.left, ctx);

  const rTC = expression(expr.right, ctx);

  return Result.all([lTC, rTC])
    .chain(checkSameTypeOperands(expr.operator))
    .map(([left, right]) => ({
      typeEff: left.typeEff,
      typings: [...left.typings, ...right.typings],
    }));
};

const checkSameType =
  (operator: Token) =>
  ([left, right]: [TypeCheckingResult, TypeCheckingResult]): Result<
    [TypeCheckingResult, TypeCheckingResult],
    TypeCheckingError
  > => {
    if (left.typeEff.type !== right.typeEff.type) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: 'Operands of binary operation must be of the same type',
          operator,
        }),
      );
    }

    return Result.ok([left, right]);
  };

const nonLinearOperatorsBool = [
  TokenType.GREATER,
  TokenType.GREATER_EQUAL,
  TokenType.LESS,
  TokenType.LESS_EQUAL,
  TokenType.EQUAL_EQUAL,
];
export const nonLinearBinary: TypeCheckingRule<NonLinearBinary> = (
  expr,
  ctx,
) => {
  const lTC = expression(expr.left, ctx);

  const rTC = expression(expr.right, ctx);

  const type = nonLinearOperatorsBool.includes(expr.operator.type)
    ? Bool()
    : Real();

  return Result.all([lTC, rTC])
    .chain(checkSameType(expr.operator))
    .map(([left, right]) => ({
      typeEff: TypeEff(
        type,
        SenvUtils.scaleInf(
          SenvUtils.add(left.typeEff.effect, right.typeEff.effect),
        ),
      ),
      typings: [...left.typings, ...right.typings],
    }));
};
