import { Program } from '@gsoul-lang/parsing/lib/ast';
import { Value } from './elaboration/ast';
import { elaborate } from './elaboration/elaboration';
import { ElaborationError } from './elaboration/errors';
import { evaluate } from './interpreter/cek';
import { InterpreterError } from './interpreter/errors';
import { Result } from '@badrap/result';

export const run = (
  program: Program,
): Result<Value, InterpreterError | ElaborationError> => {
  const elaboration = elaborate(program);

  if (!elaboration.isOk) {
    return Result.err(elaboration.error);
  }

  const value = evaluate(elaboration.value);

  return value;
};

export { InterpreterError, InterpreterErrorKind } from './interpreter/errors';
export { ElaborationError, ElaborationErrorKind } from './elaboration/errors';
export { formatValue } from './utils/format';
