import { cyan } from 'chalk';
import { ExprKind, SimpleValue, Tuple } from '../elaboration/ast';

const findDataTypeTuple = (
  value: SimpleValue,
): (SimpleValue & Tuple) | null => {
  if (value.kind === ExprKind.Tuple) {
    return value;
  }

  if (value.kind === ExprKind.Inj) {
    return findDataTypeTuple(value.expression.expression);
  }

  return null;
};

export const formatValue = (value: SimpleValue): string => {
  switch (value.kind) {
    case ExprKind.RealLiteral:
      return cyan(value.value);
    case ExprKind.BoolLiteral:
      return cyan(String(value.value));
    case ExprKind.AtomLiteral:
      return cyan(`:${value.name.lexeme}`);
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
      return `(${value.expressions
        .map((v) => formatValue(v.expression))
        .join(', ')})`;
    case ExprKind.Fold: {
      if (value.dataTypeAlias) {
        const tuple = findDataTypeTuple(value.expression.expression);

        const dataTuple = tuple
          ? {
              ...tuple,
              expressions: tuple.expressions.slice(2),
            }
          : tuple;

        return `${value.dataTypeAlias}${
          dataTuple ? formatValue(dataTuple) : '()'
        }`;
      }

      return cyan('[Fold]');
    }
    case ExprKind.Inj:
      return cyan(`[Inj ${value.index}]`);
  }
};
