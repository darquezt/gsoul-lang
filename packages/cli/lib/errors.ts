import * as chalk from 'chalk';

export const syntaxError = (
  line: { number: number; content: string },
  reason?: string,
): string => chalk`
{gray line ${line.number}:} ${line.content}

{bgRed Syntax Error}${reason ? ` : ${reason}` : ''}
`;
