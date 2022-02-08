import { cyan } from 'chalk';
import { ExprKind, SimpleValue } from '../elaboration/ast';

export const formatValue = (value: SimpleValue): string => {
  switch (value.kind) {
    case ExprKind.RealLiteral:
      return cyan(value.value);
    case ExprKind.BoolLiteral:
      return cyan(String(value.value));
    case ExprKind.NilLiteral:
      return cyan('nil');
    case ExprKind.Closure:
      return cyan('[Closure]');
  }
};
