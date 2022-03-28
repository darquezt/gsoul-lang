import { ascribedValueToExpr, Variable } from '../../elaboration/ast';
import { Store, StoreUtils } from '../../utils';
import { Err, Result } from '../../utils/Result';
import { Kont, OkState, StepState } from '../cek';
import { InterpreterError, InterpreterReferenceError } from '../errors';

export const reduceVariable = (
  term: Variable,
  store: Store,
  kont: Kont,
): Result<StepState, InterpreterError> => {
  const value = StoreUtils.get(store, term.name.lexeme);

  if (!value) {
    return Err(
      InterpreterReferenceError({
        reason: `Variable ${term.name.lexeme} is not defined`,
        variable: term.name,
      }),
    );
  }

  return OkState({ term: ascribedValueToExpr(value) }, store, kont);
};
