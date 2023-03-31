import { Result } from '@badrap/result';
import { SenvUtils, TypeEff } from '@gsoul-lang/core/utils';
import { isKinded } from '@gsoul-lang/core/utils/ADT';
import { Bool, Real, TypeKind } from '@gsoul-lang/core/utils/Type';
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

const checkRealType =
  (operator: Token) =>
  (tc: TypeCheckingResult): Result<TypeCheckingResult, TypeCheckingError> => {
    if (!isKinded(tc.typeEff.type, TypeKind.Real)) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: 'Expected number expression',
          operator,
        }),
      );
    }

    return Result.ok(tc);
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
  const lTC = expression(expr.left, ctx).chain(checkRealType(expr.operator));

  const rTC = expression(expr.right, ctx).chain(checkRealType(expr.operator));

  const type = nonLinearOperatorsBool.includes(expr.operator.type)
    ? Bool()
    : Real();

  return Result.all([lTC, rTC]).map(([left, right]) => ({
    typeEff: TypeEff(
      type,
      SenvUtils.scaleInf(
        SenvUtils.add(left.typeEff.effect, right.typeEff.effect),
      ),
    ),
    typings: [...left.typings, ...right.typings],
  }));
};
