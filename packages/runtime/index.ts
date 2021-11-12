import { Program } from '@gsens-lang/parsing/ast';
import { Value } from './elaboration/ast';
import { elaborate } from './elaboration/elaboration';
import { ElaborationError } from './elaboration/errors';
import { evaluate } from './interpreter/cek';
import { InterpreterError } from './interpreter/errors';
import { Result } from './utils/Result';

export const run = (
  program: Program,
): Result<Value, InterpreterError | ElaborationError> => {
  const elaboration = elaborate(program);

  if (!elaboration.success) {
    return elaboration;
  }

  const value = evaluate(elaboration.result);

  return value;
};

export { formatValue } from './utils/format';
