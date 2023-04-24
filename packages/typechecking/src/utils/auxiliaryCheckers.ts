import { Result } from '@badrap/result';
import { TypeEff } from '@gsoul-lang/core/utils';
import { TypeEffectKind } from '@gsoul-lang/core/utils/TypeEff';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { TypeCheckingError, TypeCheckingTypeError } from './errors';
import { TypeCheckingResult } from './types';

/**
 * Checks if the type effect of the expression is a type-and-effect tuple.
 */
export const checkTypeEffConcreteness =
  (operator: Token, errorMessage: string) =>
  (
    exprTC: TypeCheckingResult,
  ): Result<TypeCheckingResult<TypeEff>, TypeCheckingError> => {
    if (exprTC.typeEff.kind !== TypeEffectKind.TypeEff) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: errorMessage,
          operator,
        }),
      );
    }

    return Result.ok(exprTC as TypeCheckingResult<TypeEff>);
  };
