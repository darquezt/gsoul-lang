import { Token } from '@gsens-lang/parsing/lib/lexing';
import { Senv, SenvUtils, TypeEff, TypeEffUtils } from '@gsens-lang/core/utils';
import { Arrow, Bool, ForallT, Nil, Real } from '@gsens-lang/core/utils/Type';
import { factoryOf, isKinded } from '@gsens-lang/core/utils/ADT';

import { Evidence, EvidenceUtils, Store, StoreUtils } from '../utils';

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
  SCall = 'SCall',
  Grouping = 'Grouping',
  Variable = 'Variable',
  Fun = 'Fun',
  Closure = 'Closure',
  Forall = 'Forall',
  SClosure = 'SClosure',
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

export type SCall = Term<{
  kind: ExprKind.SCall;
  callee: Expression;
  arg: Senv;
  bracket: Token;
}>;
export const SCall = factoryOf<SCall>(ExprKind.SCall);

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

export type Forall = Term<
  {
    kind: ExprKind.Forall;
    sensVars: Token[];
    expr: Expression;
  },
  TypeEff<ForallT, Senv>
>;
export const Forall = factoryOf<Forall>(ExprKind.Forall);

export type Closure = Term<{
  kind: ExprKind.Closure;
  fun: Fun;
  store: Store;
}>;
export const Closure = factoryOf<Closure>(ExprKind.Closure);

export type SClosure = Term<{
  kind: ExprKind.SClosure;
  forall: Forall;
  store: Store;
}>;
export const SClosure = factoryOf<SClosure>(ExprKind.SClosure);

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

export type Print = Term<{
  kind: ExprKind.Print;
  expression: Expression;
  showEvidence: boolean;
}>;
export const Print = factoryOf<Print>(ExprKind.Print);

export type Block = Term<{ kind: ExprKind.Block; statements: Statement[] }>;
export const Block = factoryOf<Block>(ExprKind.Block);

export type SimpleValue =
  | RealLiteral
  | BoolLiteral
  | NilLiteral
  | Closure
  | SClosure;

export const isSimpleValue = (expr: Expression): expr is SimpleValue => {
  return [
    ExprKind.RealLiteral,
    ExprKind.BoolLiteral,
    ExprKind.NilLiteral,
    ExprKind.Closure,
    ExprKind.SClosure,
  ].some((kind) => kind === expr.kind);
};

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
  | SCall
  | Grouping
  | Variable
  | Fun
  | Closure
  | Forall
  | SClosure
  | Print
  | Block
  | Ascription;

const subst = (expr: Expression, name: string, senv: Senv): Expression => {
  const inductiveCall = <E extends Record<K, Expression>, K extends keyof E>(
    key: K,
    e: E,
  ) => {
    return { [key]: subst(e[key], name, senv) };
  };

  const typeEff = TypeEffUtils.subst(expr.typeEff, name, senv);
  switch (expr.kind) {
    case ExprKind.RealLiteral:
    case ExprKind.BoolLiteral:
    case ExprKind.NilLiteral:
      return expr;
    case ExprKind.Binary:
    case ExprKind.NonLinearBinary:
      return Binary({
        ...expr,
        ...inductiveCall('left', expr),
        ...inductiveCall('right', expr),
        typeEff,
      });
    case ExprKind.Call:
      return Call({
        ...expr,
        ...inductiveCall('callee', expr),
        ...inductiveCall('arg', expr),
        typeEff,
      });
    case ExprKind.SCall:
      return SCall({
        ...expr,
        ...inductiveCall('callee', expr),
        arg: SenvUtils.subst(expr.arg, name, senv),
        typeEff,
      });
    case ExprKind.Grouping:
      return Grouping({
        ...expr,
        ...inductiveCall('expression', expr),
        typeEff,
      });
    case ExprKind.Variable:
      return Variable({
        ...expr,
        typeEff,
      });
    case ExprKind.Fun:
      return Fun({
        ...expr,
        ...inductiveCall('body', expr),
        binder: {
          ...expr.binder,
          type: TypeEffUtils.subst(expr.binder.type, name, senv),
        },
        typeEff: typeEff as TypeEff<Arrow, Senv>,
      });
    case ExprKind.Closure: {
      const clos = Closure({
        ...expr,
        ...inductiveCall('fun', expr),
        store: StoreUtils.subst(expr.store, name, senv),
        typeEff,
      });

      return clos;
    }
    case ExprKind.Forall:
      return Forall({
        ...expr,
        ...inductiveCall('expr', expr),
        typeEff: typeEff as TypeEff<ForallT, Senv>,
      });
    case ExprKind.SClosure:
      return SClosure({
        ...expr,
        store: StoreUtils.subst(expr.store, name, senv),
        ...inductiveCall('forall', expr),
        typeEff,
      });
    case ExprKind.Print:
      return Print({
        ...expr,
        ...inductiveCall('expression', expr),
        typeEff,
      });
    case ExprKind.Block:
      return Block({
        ...expr,
        statements: expr.statements.map((s) => substStmt(s, name, senv)),
        typeEff,
      });
    case ExprKind.Ascription:
      return Ascription({
        ...expr,
        ...inductiveCall('expression', expr),
        evidence: EvidenceUtils.subst(expr.evidence, name, senv),
        typeEff,
      });
  }
};

export const ExpressionUtils = {
  subst,
};

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

const substStmt = (stmt: Statement, name: string, senv: Senv): Statement => {
  const typeEff = TypeEffUtils.subst(stmt.typeEff, name, senv);

  switch (stmt.kind) {
    case StmtKind.ExprStmt:
      return ExprStmt({
        ...stmt,
        expression: ExpressionUtils.subst(stmt.expression, name, senv),
        typeEff,
      });
    case StmtKind.VarStmt:
      return VarStmt({
        ...stmt,
        assignment: ExpressionUtils.subst(stmt.assignment, name, senv),
        typeEff,
      });
  }
};
