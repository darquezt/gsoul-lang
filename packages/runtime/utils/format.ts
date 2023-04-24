import { cyan } from 'chalk';
import { ExprKind, SimpleValue } from '../elaboration/ast';

export const formatValue = (value: SimpleValue): string => {
  switch (value.kind) {
    case ExprKind.RealLiteral:
      return cyan(value.value);
    case ExprKind.BoolLiteral:
      return cyan(String(value.value));
    case ExprKind.AtomLiteral:
      return cyan(`:${value.name.literal}`);
    case ExprKind.NilLiteral:
      return cyan('nil');
    case ExprKind.Closure:
      return cyan('[Closure]');
    case ExprKind.SClosure:
      return cyan('[SClosure]');
    case ExprKind.TClosure:
      return cyan('[TClosure]');
    case ExprKind.Pair:
      return cyan('[Pair]');
    case ExprKind.Tuple:
      return cyan('[Tuple]');
    case ExprKind.Fold:
      return cyan('[Fold]');
    case ExprKind.Inj:
      return cyan(`[Inj ${value.index}]`);
  }
};
