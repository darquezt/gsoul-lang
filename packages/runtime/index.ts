import { Program } from '@gsens-lang/parsing/ast';
import { Expression } from './ast';
import { elaborate } from './elaboration';
import { evaluate } from './interpreter/cek';

export const run = (program: Program): Expression => {
  const elaboration = elaborate(program);
  const value = evaluate(elaboration);

  return value;
};
