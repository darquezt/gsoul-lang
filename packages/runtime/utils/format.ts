import { cyan } from 'chalk';
import { SimpleValue } from '../elaboration/ast';

export const formatValue = (value: SimpleValue): string => {
  switch (value.kind) {
    case 'RealLiteral':
      return cyan(value.value);
    case 'BoolLiteral':
      return cyan(String(value.value));
    case 'NilLiteral':
      return cyan('nil');
    case 'Closure':
      return cyan('[Closure]');
  }
};
