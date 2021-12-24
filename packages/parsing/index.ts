import { Statement } from './lib/ast';
import { scanTokens } from './lib/lexing/lexing';
import { parse as parseTokens, Result } from './lib/parsing';

export { parse as parseTokens } from './lib/parsing';

export const parse = (code: string): Result<Statement[]> => {
  const tokens = scanTokens(code);

  return parseTokens(tokens);
};
