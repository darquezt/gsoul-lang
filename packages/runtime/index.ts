import { Program } from '@gsens-lang/parsing/ast';
import { Value } from './ast';
import { elaborate } from './elaboration';
import { evaluate } from './interpreter/cek';

export const run = (program: Program): Value => {
  const elaboration = elaborate(program);
  const value = evaluate(elaboration);

  return value;
};

export { formatValue } from './utils/format';
