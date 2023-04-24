import * as past from '@gsoul-lang/parsing/lib/ast';
import { Result } from '@badrap/result';
import { TypeEff, SenvUtils } from '@gsoul-lang/core/utils';
import { Bool, Real } from '@gsoul-lang/core/utils/Type';
import { TokenType } from '@gsoul-lang/parsing/lib/lexing';
import { Binary, NonLinearBinary } from '../ast';
import { expression } from '../elaboration';
import { ElaborationError, ElaborationTypeError } from '../errors';
import { ElaborationContext } from '../types';
import { checkTypeEffConcreteness } from '../utils/auxiliaryCheckers';

export const binary = (
  expr: past.Binary,
  ctx: ElaborationContext,
): Result<Binary, ElaborationError> => {
  const leftElaboration = expression(expr.left, ctx).chain(
    checkTypeEffConcreteness(
      expr.operator,
      'Left operand may not have a correct type',
    ),
  );

  const rightElaboration = expression(expr.right, ctx).chain(
    checkTypeEffConcreteness(
      expr.operator,
      'Right operand may not have a correct type',
    ),
  );

  return Result.all([leftElaboration, rightElaboration]).chain(
    ([left, right]) => {
      if (left.typeEff.type.kind !== right.typeEff.type.kind) {
        return Result.err(
          new ElaborationTypeError({
            reason: 'Operands types do not match',
            operator: expr.operator,
          }),
        );
      }

      return Result.ok(
        Binary({
          operator: expr.operator,
          left,
          right,
          typeEff: TypeEff(
            left.typeEff.type,
            SenvUtils.add(left.typeEff.effect, right.typeEff.effect),
          ),
        }),
      );
    },
  );
};

const nonLinearOperatorsBool = [
  TokenType.GREATER,
  TokenType.GREATER_EQUAL,
  TokenType.LESS,
  TokenType.LESS_EQUAL,
  TokenType.EQUAL_EQUAL,
];
export const nonLinearBinary = (
  expr: past.NonLinearBinary,
  ctx: ElaborationContext,
): Result<NonLinearBinary, ElaborationError> => {
  const leftElaboration = expression(expr.left, ctx).chain(
    checkTypeEffConcreteness(
      expr.operator,
      'Left operand may not have a correct type',
    ),
  );

  const rightElaboration = expression(expr.right, ctx).chain(
    checkTypeEffConcreteness(
      expr.operator,
      'Right operand may not have a correct type',
    ),
  );

  return Result.all([leftElaboration, rightElaboration]).chain(
    ([left, right]) => {
      if (left.typeEff.type.kind !== right.typeEff.type.kind) {
        return Result.err(
          new ElaborationTypeError({
            reason: 'Operands types do not match',
            operator: expr.operator,
          }),
        );
      }

      const type = nonLinearOperatorsBool.includes(expr.operator.type)
        ? Bool()
        : Real();

      return Result.ok(
        NonLinearBinary({
          operator: expr.operator,
          left,
          right,
          typeEff: TypeEff(
            type,
            SenvUtils.scaleInf(
              SenvUtils.add(left.typeEff.effect, right.typeEff.effect),
            ),
          ),
        }),
      );
    },
  );
};
