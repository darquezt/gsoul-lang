import { Result } from '@badrap/result';
import { Variable } from '@gsoul-lang/parsing/lib/ast';
import { TypeCheckingReferenceError } from '../utils/errors';
import { TypeCheckingRule } from '../utils/types';

export const variable: TypeCheckingRule<Variable> = (variable, [tenv]) => {
  const typeFromTenv = tenv[variable.name.lexeme];

  if (!typeFromTenv) {
    return Result.err(
      new TypeCheckingReferenceError({
        variable: variable.name,
        reason: `Variable ${variable.name.lexeme} is not in scope`,
      }),
    );
  }

  return Result.ok({
    typeEff: typeFromTenv,
    typings: [[variable.name, typeFromTenv]],
  });
};
