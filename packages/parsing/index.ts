import { Statement } from './ast';
import { scanTokens } from './lexing/lexing';
import { parse as parseTokens, Result } from './parsing';

export const parse = (code: string): Result<Statement[]> => {
  const tokens = scanTokens(code);

  return parseTokens(tokens);
};
