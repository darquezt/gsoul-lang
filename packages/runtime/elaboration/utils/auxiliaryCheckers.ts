import { Result } from '@badrap/result';
import { TypeEff } from '@gsoul-lang/core/utils';
import { isKinded } from '@gsoul-lang/core/utils/ADT';
import { TypeEffectKind } from '@gsoul-lang/core/utils/TypeEff';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { Expression } from '../ast';
import { ElaborationError, ElaborationTypeError } from '../errors';

export type ConcreteTypeEff<T extends TypeEff = TypeEff> = {
  typeEff: T;
};

export const checkTypeEffConcreteness =
  (operator: Token, errorMessage: string) =>
  (
    expr: Expression,
  ): Result<Expression & ConcreteTypeEff, ElaborationError> => {
    if (!isKinded(expr.typeEff, TypeEffectKind.TypeEff)) {
      return Result.err(
        new ElaborationTypeError({
          reason: errorMessage,
          operator,
        }),
      );
    }

    return Result.ok(expr as Expression & ConcreteTypeEff);
  };
