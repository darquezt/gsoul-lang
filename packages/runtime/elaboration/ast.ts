import { Token } from '@gsens-lang/parsing/lib/lexing';
import { Senv, TypeEff } from '@gsens-lang/core/utils';
import { Arrow, Bool, Nil, Real } from '@gsens-lang/core/utils/Type';
import { factoryOf, isKinded } from '@gsens-lang/core/utils/ADT';

import { Evidence, Store } from '../utils';

/**
 * Expressions
 */

export type Term<T, U extends TypeEff = TypeEff> = T & { typeEff: U };

export enum ExprKind {
  RealLiteral = 'RealLiteral',
  BoolLiteral = 'BoolLiteral',
  NilLiteral = 'NilLiteral',
  Binary = 'Binary',
  NonLinearBinary = 'NonLinearBinary',
  Call = 'Call',
  Grouping = 'Grouping',
  Variable = 'Variable',
  Fun = 'Fun',
  Closure = 'Closure',
  Ascription = 'Ascription',
  Print = 'Print',
  Block = 'Block',
}

export type RealLiteral = Term<
  { kind: ExprKind.RealLiteral; value: number },
  TypeEff<Real, Senv>
>;
export const RealLiteral = (
  params: Omit<RealLiteral, 'kind' | 'typeEff'>,
): RealLiteral => ({
  kind: ExprKind.RealLiteral,
  typeEff: TypeEff(Real(), Senv()),
  ...params,
});

export type BoolLiteral = Term<
  { kind: ExprKind.BoolLiteral; value: boolean },
  TypeEff<Bool, Senv>
>;
export const BoolLiteral = (
  params: Omit<BoolLiteral, 'kind' | 'typeEff'>,
): BoolLiteral => ({
  kind: ExprKind.BoolLiteral,
  typeEff: TypeEff(Bool(), Senv()),
  ...params,
});

export type NilLiteral = Term<
  { kind: ExprKind.NilLiteral; value: null },
  TypeEff<Nil, Senv>
>;
export const NilLiteral = (): NilLiteral => ({
  kind: ExprKind.NilLiteral,
  typeEff: TypeEff(Nil(), Senv()),
  value: null,
});

export type Binary = Term<{
  kind: ExprKind.Binary;
  operator: Token;
  left: Expression;
  right: Expression;
}>;
export const Binary = factoryOf<Binary>(ExprKind.Binary);

export type NonLinearBinary = Term<{
  kind: ExprKind.NonLinearBinary;
  operator: Token;
  left: Expression;
  right: Expression;
}>;
export const NonLinearBinary = factoryOf<NonLinearBinary>(
  ExprKind.NonLinearBinary,
);

export type Call = Term<{
  kind: ExprKind.Call;
  callee: Expression;
  arg: Expression;
  paren: Token;
}>;
export const Call = factoryOf<Call>(ExprKind.Call);

export type Grouping = Term<{
  kind: ExprKind.Grouping;
  expression: Expression;
}>;
export const Grouping = factoryOf<Grouping>(ExprKind.Grouping);

export type Variable = Term<{ kind: ExprKind.Variable; name: Token }>;
export const Variable = factoryOf<Variable>(ExprKind.Variable);

export type Fun = Term<
  {
    kind: ExprKind.Fun;
    binder: { name: Token; type: TypeEff };
    body: Expression;
  },
  TypeEff<Arrow, Senv>
>;
export const Fun = factoryOf<Fun>(ExprKind.Fun);

export type Closure = Term<{
  kind: ExprKind.Closure;
  fun: Fun;
  store: Store;
}>;
export const Closure = factoryOf<Closure>(ExprKind.Closure);

export type Ascription = Term<{
  kind: ExprKind.Ascription;
  evidence: Evidence;
  expression: Expression;
  typeEff: TypeEff;
}>;
export const Ascription = factoryOf<Ascription>(ExprKind.Ascription);

export type AscribedValue<T extends SimpleValue = SimpleValue> = Term<{
  kind: ExprKind.Ascription;
  evidence: Evidence;
  expression: T;
  typeEff: TypeEff;
}>;
export const AscribedValue = <T extends SimpleValue>(
  params: Omit<AscribedValue<T>, 'kind'>,
): AscribedValue<T> => ({
  kind: ExprKind.Ascription,
  ...params,
});

export type SimpleValue = RealLiteral | BoolLiteral | NilLiteral | Closure;

export const isSimpleValue = (expr: Expression): expr is SimpleValue => {
  return [
    ExprKind.RealLiteral,
    ExprKind.BoolLiteral,
    ExprKind.NilLiteral,
    ExprKind.Closure,
  ].some((kind) => kind === expr.kind);
};

export type Print = Term<{
  kind: ExprKind.Print;
  expression: Expression;
  showEvidence: boolean;
}>;
export const Print = factoryOf<Print>(ExprKind.Print);

export type Block = Term<{ kind: ExprKind.Block; statements: Statement[] }>;
export const Block = factoryOf<Block>(ExprKind.Block);

export type Value<T extends SimpleValue = SimpleValue> = AscribedValue<T>;

export const isValue = (expr: Expression): expr is Value => {
  if (expr.kind !== ExprKind.Ascription) {
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
  | Print
  | Block
  | Ascription;

/**
 * Statements
 */

export enum StmtKind {
  ExprStmt = 'ExprStmt',
  VarStmt = 'VarStmt',
}

export type ExprStmt = Term<{
  kind: StmtKind.ExprStmt;
  expression: Expression;
}>;
export const ExprStmt = factoryOf<ExprStmt>(StmtKind.ExprStmt);

export type VarStmt = Term<{
  kind: StmtKind.VarStmt;
  name: Token;
  assignment: Expression;
}>;
export const VarStmt = factoryOf<VarStmt>(StmtKind.VarStmt);

export type Statement = ExprStmt | VarStmt;
