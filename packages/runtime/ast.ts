import Token from '@gsens-lang/parsing/lexing/Token';
import { Senv, Type, TypeEff } from '@gsens-lang/core/utils';
import { Arrow, Bool, Nil, Real } from '@gsens-lang/core/utils/Type';
import { factoryOf, isKinded } from '@gsens-lang/core/utils/ADT';

import { Evidence, Store } from './utils';

/**
 * Expressions
 */

export type Term<T, U extends TypeEff = TypeEff> = T & { typeEff: U };

export type RealLiteral = Term<
  { kind: 'RealLiteral'; value: number },
  TypeEff<Real, Senv>
>;
export const RealLiteral = (
  params: Omit<RealLiteral, 'kind' | 'typeEff'>,
): RealLiteral => ({
  kind: 'RealLiteral',
  typeEff: TypeEff(Real(), Senv()),
  ...params,
});

export type BoolLiteral = Term<
  { kind: 'BoolLiteral'; value: boolean },
  TypeEff<Bool, Senv>
>;
export const BoolLiteral = (
  params: Omit<BoolLiteral, 'kind' | 'typeEff'>,
): BoolLiteral => ({
  kind: 'BoolLiteral',
  typeEff: TypeEff(Bool(), Senv()),
  ...params,
});

export type NilLiteral = Term<
  { kind: 'NilLiteral'; value: null },
  TypeEff<Nil, Senv>
>;
export const NilLiteral = (): NilLiteral => ({
  kind: 'NilLiteral',
  typeEff: TypeEff(Nil(), Senv()),
  value: null,
});

export type Binary = Term<{
  kind: 'Binary';
  operator: Token;
  left: Expression;
  right: Expression;
}>;
export const Binary = factoryOf<Binary>('Binary');

export type NonLinearBinary = Term<{
  kind: 'NonLinearBinary';
  operator: Token;
  left: Expression;
  right: Expression;
}>;
export const NonLinearBinary = factoryOf<NonLinearBinary>('NonLinearBinary');

export type Call = Term<{
  kind: 'Call';
  callee: Expression;
  arg: Expression;
  paren: Token;
}>;
export const Call = factoryOf<Call>('Call');

export type Grouping = Term<{ kind: 'Grouping'; expression: Expression }>;
export const Grouping = factoryOf<Grouping>('Grouping');

export type Variable = Term<{ kind: 'Variable'; name: Token }>;
export const Variable = factoryOf<Variable>('Variable');

export type Fun = Term<
  {
    kind: 'Fun';
    binder: { name: Token; type: Type };
    body: Statement;
  },
  TypeEff<Arrow, Senv>
>;
export const Fun = factoryOf<Fun>('Fun');

export type Closure = Term<{
  kind: 'Closure';
  fun: Fun;
  store: Store;
}>;
export const Closure = factoryOf<Closure>('Closure');

export type Ascription = Term<{
  kind: 'Ascription';
  evidence: Evidence;
  expression: Expression;
  typeEff: TypeEff;
}>;
export const Ascription = factoryOf<Ascription>('Ascription');

export type AscribedValue<T extends SimpleValue = SimpleValue> = Term<{
  kind: 'Ascription';
  evidence: Evidence;
  expression: T;
  typeEff: TypeEff;
}>;
export const AscribedValue = <T extends SimpleValue>(
  params: Omit<AscribedValue<T>, 'kind'>,
): AscribedValue<T> => ({
  kind: 'Ascription',
  ...params,
});

export type SimpleValue = RealLiteral | BoolLiteral | NilLiteral | Closure;

export const isSimpleValue = (expr: Expression): expr is SimpleValue => {
  switch (expr.kind) {
    case 'RealLiteral':
    case 'BoolLiteral':
    case 'NilLiteral':
    case 'Closure':
      return true;
    default:
      return false;
  }
};

export type Value<T extends SimpleValue = SimpleValue> = AscribedValue<T>;

export const isValue = (expr: Expression): expr is Value => {
  if (expr.kind !== 'Ascription') {
    return false;
  }

  return isSimpleValue(expr.expression);
};

export const simpleValueIsKinded = <T extends SimpleValue, K extends T['kind']>(
  value: Value<T>,
  kind: K,
): value is Value<T & { kind: K }> => {
  return isKinded(value.expression, kind);
};

export const ascribedValueToExpr = (val: AscribedValue): Ascription =>
  Ascription({
    evidence: val.evidence,
    expression: val.expression,
    typeEff: val.typeEff,
  });

export type Expression =
  | RealLiteral
  | BoolLiteral
  | NilLiteral
  | Binary
  | NonLinearBinary
  | Call
  | Grouping
  | Variable
  | Fun
  | Closure
  | Ascription;

/**
 * Statements
 */

export type ExprStmt = Term<{ kind: 'ExprStmt'; expression: Expression }>;
export const ExprStmt = factoryOf<ExprStmt>('ExprStmt');

export type Print = Term<{
  kind: 'Print';
  expression: Expression;
  showEvidence: boolean;
}>;
export const Print = factoryOf<Print>('Print');

export type Block = Term<{ kind: 'Block'; statements: Statement[] }>;
export const Block = factoryOf<Block>('Block');

export type VarStmt = Term<{
  kind: 'VarStmt';
  name: Token;
  assignment: Expression;
}>;
export const VarStmt = factoryOf<VarStmt>('VarStmt');

export type Statement = ExprStmt | Print | Block | VarStmt;
