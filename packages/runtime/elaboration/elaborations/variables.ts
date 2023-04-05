import { Result } from '@badrap/result';
import * as past from '@gsoul-lang/parsing/lib/ast';
import { Variable } from '../ast';
import { ElaborationReferenceError } from '../errors';
import { ElaborationContext } from '../types';

export const variable = (
  variable: past.Variable,
  [tenv]: ElaborationContext,
): Result<Variable, ElaborationReferenceError> => {
  const typeFromTenv = tenv[variable.name.lexeme];

  if (!typeFromTenv) {
    return Result.err(
      new ElaborationReferenceError({
        reason: `Variable ${variable.name.lexeme} is not in scope`,
        variable: variable.name,
      }),
    );
  }

  return Result.ok(
    Variable({
      name: variable.name,
      typeEff: typeFromTenv,
    }),
  );
};
