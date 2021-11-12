import * as chalk from 'chalk';
import { SimpleValue } from '../elaboration/ast';

export const formatValue = (value: SimpleValue): string => {
  switch (value.kind) {
    case 'RealLiteral':
      return chalk.cyan(value.value);
    case 'BoolLiteral':
      return chalk.cyan(String(value.value));
    case 'NilLiteral':
      return chalk.cyan('nil');
    case 'Closure':
      return chalk.cyan('[Closure]');
  }
};
