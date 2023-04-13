import { Token } from '@gsoul-lang/parsing/lib/lexing';
import {
  Senv,
  SenvUtils,
  Type,
  TypeEff,
  TypeEffUtils,
  TypeUtils,
} from '@gsoul-lang/core/utils';
import {
  Arrow,
  Bool,
  ForallT,
  Nil,
  Real,
  RecType,
} from '@gsoul-lang/core/utils/Type';
import { factoryOf, isKinded } from '@gsoul-lang/core/utils/ADT';

import { Evidence, EvidenceUtils, Store, StoreUtils } from '../utils';
import { all } from 'ramda';
import { ResourcesSet } from '@gsoul-lang/core/utils/ResourcesSet';

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
  Tuple = 'Tuple',
  Projection = 'Projection',
  Untup = 'Untup',
  Pair = 'Pair',
  ProjFst = 'ProjFst',
  ProjSnd = 'ProjSnd',
  Ascription = 'Ascription',
  Block = 'Block',
  Fold = 'Fold',
  Unfold = 'Unfold',
  If = 'If',
  Inj = 'Inj',
  Case = 'Case',
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
  args: Expression[];
  paren: Token;
}>;
export const Call = factoryOf<Call>(ExprKind.Call);

export type SCall = Term<{
  kind: ExprKind.SCall;
  callee: Expression;
  args: Senv[];
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
    binders: Array<{ name: Token; type: TypeEff }>;
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

export type Tuple = Term<{
  kind: ExprKind.Tuple;
  expressions: Expression[];
}>;
export const Tuple = factoryOf<Tuple>(ExprKind.Tuple);

export type Projection = Term<{
  kind: ExprKind.Projection;
  index: number;
  tuple: Expression;
  projectToken: Token;
}>;
export const Projection = factoryOf<Projection>(ExprKind.Projection);

export type Inj = Term<{
  kind: ExprKind.Inj;
  index: 0 | 1;
  type: Type;
  expression: Expression;
  injToken: Token;
}>;
export const Inj = factoryOf<Inj>(ExprKind.Inj);

export type Case = Term<{
  kind: ExprKind.Case;
  sum: Expression;
  leftIdentifier: Token;
  left: Expression;
  rightIdentifier: Token;
  right: Expression;
  caseToken: Token;
}>;
export const Case = factoryOf<Case>(ExprKind.Case);

// export type Untup = Term<{
//   kind: ExprKind.Untup;
//   identifiers: [Token, Token];
//   tuple: Expression;
//   body: Expression;
//   untupToken: Token;
// }>;
// export const Untup = factoryOf<Untup>(ExprKind.Untup);

export type Pair = Term<{
  kind: ExprKind.Pair;
  first: Expression;
  second: Expression;
}>;
export const Pair = factoryOf<Pair>(ExprKind.Pair);

export type ProjFst = Term<{
  kind: ExprKind.ProjFst;
  pair: Expression;
  projToken: Token;
}>;
export const ProjFst = factoryOf<ProjFst>(ExprKind.ProjFst);

export type ProjSnd = Term<{
  kind: ExprKind.ProjSnd;
  pair: Expression;
  projToken: Token;
}>;
export const ProjSnd = factoryOf<ProjSnd>(ExprKind.ProjSnd);

export type Block = Term<{
  kind: ExprKind.Block;
  statements: Statement[];
  resources: ResourcesSet;
}>;
export const Block = factoryOf<Block>(ExprKind.Block);

export type Fold = Term<{
  kind: ExprKind.Fold;
  expression: Expression;
  recType: TypeEff<RecType, Senv>;
  foldToken: Token;
}>;
export const Fold = factoryOf<Fold>(ExprKind.Fold);

export type Unfold = Term<{
  kind: ExprKind.Unfold;
  expression: Expression;
  unfoldToken: Token;
}>;
export const Unfold = factoryOf<Unfold>(ExprKind.Unfold);

export type If = Term<{
  kind: ExprKind.If;
  condition: Expression;
  then: Expression;
  else: Expression;
  ifToken: Token;
}>;
export const If = factoryOf<If>(ExprKind.If);

export type SimpleValue =
  | RealLiteral
  | BoolLiteral
  | NilLiteral
  | Closure
  | SClosure
  | (Tuple & { expressions: Value[] })
  | (Pair & { first: Value; second: Value })
  | (Fold & { expression: Value })
  | (Inj & { expression: Value });

export const isSimpleValue = (expr: Expression): expr is SimpleValue => {
  if (expr.kind === ExprKind.Tuple) {
    return all(isValue, expr.expressions);
  }
  if (expr.kind === ExprKind.Pair) {
    return isValue(expr.first) && isValue(expr.second);
  }
  if (expr.kind === ExprKind.Fold) {
    return isValue(expr.expression);
  }
  if (expr.kind === ExprKind.Inj) {
    return isValue(expr.expression);
  }

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

export type Ascribed<T extends Expression> = Ascription & { expression: T };

export const ascrExpressionIsKinded = <K extends Expression['kind']>(
  ascr: Ascription,
  kind: K,
): ascr is Ascribed<Expression & { kind: K }> => {
  return isKinded(ascr.expression, kind);
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
  | Tuple
  | Projection
  // | Untup
  | Pair
  | ProjFst
  | ProjSnd
  | Block
  | Ascription
  | Fold
  | Unfold
  | If
  | Inj
  | Case;

type ExprMapFns = {
  senvFn: (senv: Senv) => Senv;
  typeFn: (ty: Type) => Type;
  teffFn: (teff: TypeEff) => TypeEff;
  eviFn: (evi: Evidence) => Evidence;
  storeFn: (store: Store) => Store;
  stmtFn: (stmt: Statement) => Statement;
};
const map = (expr: Expression, fns: ExprMapFns): Expression => {
  const { senvFn, teffFn, eviFn, storeFn, stmtFn } = fns;
  const inductiveCall = <E extends Record<K, Expression>, K extends keyof E>(
    key: K,
    e: E,
  ) => {
    return { [key]: map(e[key], fns) };
  };

  const typeEff = teffFn(expr.typeEff);
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
        args: expr.args.map((arg) => map(arg, fns)),
        typeEff,
      });
    case ExprKind.SCall:
      return SCall({
        ...expr,
        ...inductiveCall('callee', expr),
        args: expr.args.map(senvFn),
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
        binders: expr.binders.map((binder) => ({
          ...binder,
          type: teffFn(binder.type),
        })),
        typeEff: typeEff as TypeEff<Arrow, Senv>,
      });
    case ExprKind.Closure: {
      const clos = Closure({
        ...expr,
        ...inductiveCall('fun', expr),
        store: storeFn(expr.store),
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
        store: storeFn(expr.store),
        ...inductiveCall('forall', expr),
        typeEff,
      });
    case ExprKind.Block:
      return Block({
        ...expr,
        statements: expr.statements.map((s) => stmtFn(s)),
        typeEff,
      });
    case ExprKind.Tuple:
      return Tuple({
        ...expr,
        expressions: expr.expressions.map((e) => map(e, fns)),
        typeEff,
      });
    case ExprKind.Projection:
      return Projection({
        ...expr,
        ...inductiveCall('tuple', expr),
        typeEff,
      });
    // case ExprKind.Untup:
    //   return Untup({
    //     ...expr,
    //     ...inductiveCall('tuple', expr),
    //     ...inductiveCall('body', expr),
    //     typeEff,
    //   });
    case ExprKind.Pair:
      return Pair({
        ...expr,
        ...inductiveCall('first', expr),
        ...inductiveCall('second', expr),
        typeEff,
      });
    case ExprKind.ProjFst:
      return ProjFst({
        ...expr,
        ...inductiveCall('pair', expr),
        typeEff,
      });
    case ExprKind.ProjSnd:
      return ProjSnd({
        ...expr,
        ...inductiveCall('pair', expr),
        typeEff,
      });
    case ExprKind.Ascription:
      return Ascription({
        ...expr,
        ...inductiveCall('expression', expr),
        evidence: eviFn(expr.evidence),
        typeEff,
      });
    case ExprKind.Fold:
      return Fold({
        ...expr,
        ...inductiveCall('expression', expr),
        recType: teffFn(expr.recType) as TypeEff<RecType, Senv>,
        typeEff,
      });
    case ExprKind.Unfold:
      return Unfold({
        ...expr,
        ...inductiveCall('expression', expr),
        typeEff,
      });
    case ExprKind.If:
      return If({
        ...expr,
        ...inductiveCall('condition', expr),
        ...inductiveCall('then', expr),
        ...inductiveCall('else', expr),
        typeEff,
      });
    case ExprKind.Inj:
      return Inj({
        ...expr,
        ...inductiveCall('expression', expr),
        typeEff,
      });
    case ExprKind.Case:
      return Case({
        ...expr,
        ...inductiveCall('sum', expr),
        ...inductiveCall('left', expr),
        ...inductiveCall('right', expr),
        typeEff,
      });
  }
};

const subst = (expr: Expression, name: string, senv: Senv): Expression => {
  return map(expr, {
    senvFn: (s: Senv) => SenvUtils.subst(s, name, senv),
    typeFn: (ty: Type) => TypeUtils.subst(ty, name, senv),
    teffFn: (teff: TypeEff) => TypeEffUtils.subst(teff, name, senv),
    eviFn: (evi: Evidence) => EvidenceUtils.subst(evi, name, senv),
    storeFn: (store: Store) => StoreUtils.subst(store, name, senv),
    stmtFn: (stmt: Statement) => substStmt(stmt, name, senv),
  });
};

const deleteResources = (
  expr: Expression,
  resources: ResourcesSet,
): Expression => {
  return map(expr, {
    senvFn: (s: Senv) => SenvUtils.deleteResources(s, resources),
    typeFn: (ty: Type) => TypeUtils.deleteResources(ty, resources),
    teffFn: (teff: TypeEff) => TypeEffUtils.deleteResources(teff, resources),
    eviFn: (evi: Evidence) => EvidenceUtils.deleteResources(evi, resources),
    storeFn: (store: Store) => StoreUtils.deleteResources(store, resources),
    stmtFn: (stmt: Statement) => deleteResourcesStmt(stmt, resources),
  });
};

export const ExpressionUtils = {
  subst,
  deleteResources,
};

/**
 * Statements
 */

export enum StmtKind {
  ExprStmt = 'ExprStmt',
  PrintStmt = 'PrintStmt',
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

export type PrintStmt = Term<{
  kind: StmtKind.PrintStmt;
  expression: Expression;
  showEvidence: boolean;
}>;
export const PrintStmt = factoryOf<PrintStmt>(StmtKind.PrintStmt);

export type Statement = ExprStmt | VarStmt | PrintStmt;

const substStmt = (stmt: Statement, name: string, senv: Senv): Statement => {
  const typeEff = TypeEffUtils.subst(stmt.typeEff, name, senv);

  switch (stmt.kind) {
    case StmtKind.ExprStmt:
      return ExprStmt({
        ...stmt,
        expression: ExpressionUtils.subst(stmt.expression, name, senv),
        typeEff,
      });
    case StmtKind.PrintStmt:
      return PrintStmt({
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

const deleteResourcesStmt = (
  stmt: Statement,
  resources: ResourcesSet,
): Statement => {
  const typeEff = TypeEffUtils.deleteResources(stmt.typeEff, resources);

  switch (stmt.kind) {
    case StmtKind.ExprStmt:
      return ExprStmt({
        ...stmt,
        expression: ExpressionUtils.deleteResources(stmt.expression, resources),
        typeEff,
      });
    case StmtKind.PrintStmt:
      return PrintStmt({
        ...stmt,
        expression: ExpressionUtils.deleteResources(stmt.expression, resources),
        typeEff,
      });
    case StmtKind.VarStmt:
      return VarStmt({
        ...stmt,
        assignment: ExpressionUtils.deleteResources(stmt.assignment, resources),
        typeEff,
      });
  }
};
