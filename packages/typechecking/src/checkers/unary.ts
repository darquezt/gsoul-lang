import { Negate } from '@gsoul-lang/parsing/lib/ast';
import { TypeCheckingResult, TypeCheckingRule } from '../utils/types';
import { expression } from '../checker';
import { Result } from '@badrap/result';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { TypeEffect } from '@gsoul-lang/core/utils/TypeEff';
import { TypeCheckingError, TypeCheckingTypeError } from '../utils/errors';
import { Bool, TypeKind, typeIsKinded } from '@gsoul-lang/core/utils/Type';

const checkExpressionIsBoolean =
  (token: Token) =>
  (
    exprTC: TypeCheckingResult<TypeEffect>,
  ): Result<TypeCheckingResult<TypeEffect<Bool>>, TypeCheckingError> => {
    if (!typeIsKinded(exprTC.typeEff, TypeKind.Bool)) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: 'Cannot negate a non-boolean expression',
          operator: token,
        }),
      );
    }

    return Result.ok(exprTC as TypeCheckingResult<TypeEffect<Bool>>);
  };

export const negate: TypeCheckingRule<Negate> = (expr, ctx) => {
  const exprTC = expression(expr.expression, ctx).chain(
    checkExpressionIsBoolean(expr.token),
  );

  return exprTC.map((tc) => ({
    typeEff: tc.typeEff,
    typings: tc.typings,
  }));
};
