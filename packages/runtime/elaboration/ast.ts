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
  Atom,
  Bool,
  ForallT,
  Nil,
  PolyT,
  Real,
  RecType,
} from '@gsoul-lang/core/utils/Type';
import { factoryOf, isKinded } from '@gsoul-lang/core/utils/ADT';

import { Evidence, EvidenceUtils, Store, StoreUtils } from '../utils';
import { all, identity } from 'ramda';
import { ResourcesSet } from '@gsoul-lang/core/utils/ResourcesSet';
import { TypeEffect } from '@gsoul-lang/core/utils/TypeEff';
import { Directive } from '@gsoul-lang/core/utils/lib/TypeDirectives';

/**
 * Expressions
 */

export type Term<T, U extends TypeEffect = TypeEff> = T & { typeEff: U };

export enum ExprKind {
  RealLiteral = 'RealLiteral',
  BoolLiteral = 'BoolLiteral',
  NilLiteral = 'NilLiteral',
  AtomLiteral = 'AtomLiteral',
  Binary = 'Binary',
  NonLinearBinary = 'NonLinearBinary',
  Call = 'Call',
  SCall = 'SCall',
  TCall = 'TCall',
  Grouping = 'Grouping',
  Variable = 'Variable',
  Fun = 'Fun',
  Closure = 'Closure',
  Forall = 'Forall',
  Poly = 'Poly',
  SClosure = 'SClosure',
  TClosure = 'TClosure',
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
  FixPoint = 'FixPoint',
  Negate = 'Negate',
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

export type AtomLiteral = Term<
  { kind: ExprKind.AtomLiteral; name: Token },
  TypeEff<Atom, Senv>
>;
export const AtomLiteral = (
  params: Omit<AtomLiteral, 'kind' | 'typeEff'>,
): AtomLiteral => ({
  kind: ExprKind.AtomLiteral,
  typeEff: TypeEff(Atom({ name: params.name.lexeme }), Senv()),
  ...params,
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

export type TCall = Term<{
  kind: ExprKind.TCall;
  callee: Expression;
  args: TypeEffect[];
  bracket: Token;
}>;
export const TCall = factoryOf<TCall>(ExprKind.TCall);

export type Grouping = Term<
  {
    kind: ExprKind.Grouping;
    expression: Expression;
  },
  TypeEffect
>;
export const Grouping = factoryOf<Grouping>(ExprKind.Grouping);

export type Variable = Term<
  { kind: ExprKind.Variable; name: Token },
  TypeEffect
>;
export const Variable = factoryOf<Variable>(ExprKind.Variable);

export type Fun = Term<
  {
    kind: ExprKind.Fun;
    binders: Array<{ name: Token; type: TypeEffect }>;
    body: Expression;
  },
  TypeEff<Arrow>
>;
export const Fun = factoryOf<Fun>(ExprKind.Fun);

export type Forall = Term<
  {
    kind: ExprKind.Forall;
    sensVars: Token[];
    expr: Expression;
  },
  TypeEff<ForallT>
>;
export const Forall = factoryOf<Forall>(ExprKind.Forall);

export type Poly = Term<
  {
    kind: ExprKind.Poly;
    typeVars: Array<{
      identifier: Token;
      directives?: Directive[];
    }>;
    expr: Expression;
  },
  TypeEff<PolyT>
>;
export const Poly = factoryOf<Poly>(ExprKind.Poly);

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

export type TClosure = Term<{
  kind: ExprKind.TClosure;
  poly: Poly;
  store: Store;
}>;
export const TClosure = factoryOf<TClosure>(ExprKind.TClosure);

export type Ascription = Term<
  {
    kind: ExprKind.Ascription;
    evidence: Evidence;
    expression: Expression;
    typeEff: TypeEffect;
  },
  TypeEffect
>;
export const Ascription = factoryOf<Ascription>(ExprKind.Ascription);

export type AscribedValue<T extends SimpleValue = SimpleValue> = Term<
  {
    kind: ExprKind.Ascription;
    evidence: Evidence;
    expression: T;
    typeEff: TypeEffect;
  },
  TypeEffect
>;
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
  index: number;
  types: Type[];
  expression: Expression;
  injToken: Token;
}>;
export const Inj = factoryOf<Inj>(ExprKind.Inj);

export type Case = Term<{
  kind: ExprKind.Case;
  sum: Expression;
  branches: Array<{
    identifier: Token;
    body: Expression;
    name?: Token;
  }>;
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

export type Block = Term<
  {
    kind: ExprKind.Block;
    statements: Statement[];
    resources: ResourcesSet;
  },
  TypeEffect
>;
export const Block = factoryOf<Block>(ExprKind.Block);

export type Fold = Term<{
  kind: ExprKind.Fold;
  expression: Expression;
  recType: TypeEff<RecType, Senv>;
  foldToken: Token;
  dataTypeAlias?: string;
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

export type FixPoint = Term<{
  kind: ExprKind.FixPoint;
  name: Token;
  body: Expression;
}>;
export const FixPoint = factoryOf<FixPoint>(ExprKind.FixPoint);

export type Negate = Term<{
  kind: ExprKind.Negate;
  expression: Expression;
  token: Token;
}>;
export const Negate = factoryOf<Negate>(ExprKind.Negate);

export type SimpleValue =
  | RealLiteral
  | BoolLiteral
  | NilLiteral
  | AtomLiteral
  | Closure
  | SClosure
  | TClosure
  | ({ expressions: Value[] } & Tuple)
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
    ExprKind.AtomLiteral,
    ExprKind.Closure,
    ExprKind.SClosure,
    ExprKind.TClosure,
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
  | AtomLiteral
  | Binary
  | NonLinearBinary
  | Call
  | SCall
  | TCall
  | Grouping
  | Variable
  | Fun
  | Closure
  | Forall
  | SClosure
  | Poly
  | TClosure
  | Tuple
  | Projection
  | Pair
  | ProjFst
  | ProjSnd
  | Block
  | Ascription
  | Fold
  | Unfold
  | If
  | Inj
  | Case
  | FixPoint
  | Negate;

type ExprMapFns = {
  senvFn: (senv: Senv) => Senv;
  typeFn: (ty: Type) => Type;
  teffFn: <T extends TypeEffect>(teff: T) => TypeEffect & { kind: T['kind'] };
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

  switch (expr.kind) {
    case ExprKind.RealLiteral:
    case ExprKind.BoolLiteral:
    case ExprKind.NilLiteral:
    case ExprKind.AtomLiteral:
      return expr;
    case ExprKind.Negate:
      return Negate({
        ...expr,
        ...inductiveCall('expression', expr),
        typeEff: teffFn(expr.typeEff),
      });
    case ExprKind.Binary:
    case ExprKind.NonLinearBinary:
      return Binary({
        ...expr,
        ...inductiveCall('left', expr),
        ...inductiveCall('right', expr),
        typeEff: teffFn(expr.typeEff),
      });
    case ExprKind.Call:
      return Call({
        ...expr,
        ...inductiveCall('callee', expr),
        args: expr.args.map((arg) => map(arg, fns)),
        typeEff: teffFn(expr.typeEff),
      });
    case ExprKind.SCall:
      return SCall({
        ...expr,
        ...inductiveCall('callee', expr),
        args: expr.args.map(senvFn),
        typeEff: teffFn(expr.typeEff),
      });
    case ExprKind.TCall:
      return TCall({
        ...expr,
        ...inductiveCall('callee', expr),
        args: expr.args.map((arg) => teffFn(arg)),
        typeEff: teffFn(expr.typeEff),
      });
    case ExprKind.Grouping:
      return Grouping({
        ...expr,
        ...inductiveCall('expression', expr),
        typeEff: teffFn(expr.typeEff),
      });
    case ExprKind.Variable:
      return Variable({
        ...expr,
        typeEff: teffFn(expr.typeEff),
      });
    case ExprKind.Fun:
      return Fun({
        ...expr,
        ...inductiveCall('body', expr),
        binders: expr.binders.map((binder) => ({
          ...binder,
          type: teffFn(binder.type),
        })),
        typeEff: teffFn(expr.typeEff) as TypeEff<Arrow, Senv>,
      });
    case ExprKind.Closure: {
      const clos = Closure({
        ...expr,
        ...inductiveCall('fun', expr),
        store: storeFn(expr.store),
        typeEff: teffFn(expr.typeEff),
      });

      return clos;
    }
    case ExprKind.Forall:
      return Forall({
        ...expr,
        ...inductiveCall('expr', expr),
        typeEff: teffFn(expr.typeEff) as TypeEff<ForallT, Senv>,
      });
    case ExprKind.SClosure:
      return SClosure({
        ...expr,
        store: storeFn(expr.store),
        ...inductiveCall('forall', expr),
        typeEff: teffFn(expr.typeEff),
      });
    case ExprKind.Poly:
      return Poly({
        ...expr,
        ...inductiveCall('expr', expr),
        typeEff: teffFn(expr.typeEff) as TypeEff<PolyT, Senv>,
      });
    case ExprKind.TClosure:
      return TClosure({
        ...expr,
        ...inductiveCall('poly', expr),
        typeEff: teffFn(expr.typeEff),
      });
    case ExprKind.Block:
      return Block({
        ...expr,
        statements: expr.statements.map((s) => stmtFn(s)),
        typeEff: teffFn(expr.typeEff),
      });
    case ExprKind.Tuple:
      return Tuple({
        ...expr,
        expressions: expr.expressions.map((e) => map(e, fns)),
        typeEff: teffFn(expr.typeEff),
      });
    case ExprKind.Projection:
      return Projection({
        ...expr,
        ...inductiveCall('tuple', expr),
        typeEff: teffFn(expr.typeEff),
      });
    case ExprKind.Pair:
      return Pair({
        ...expr,
        ...inductiveCall('first', expr),
        ...inductiveCall('second', expr),
        typeEff: teffFn(expr.typeEff),
      });
    case ExprKind.ProjFst:
      return ProjFst({
        ...expr,
        ...inductiveCall('pair', expr),
        typeEff: teffFn(expr.typeEff),
      });
    case ExprKind.ProjSnd:
      return ProjSnd({
        ...expr,
        ...inductiveCall('pair', expr),
        typeEff: teffFn(expr.typeEff),
      });
    case ExprKind.Ascription:
      return Ascription({
        ...expr,
        ...inductiveCall('expression', expr),
        evidence: eviFn(expr.evidence),
        typeEff: teffFn(expr.typeEff),
      });
    case ExprKind.Fold:
      return Fold({
        ...expr,
        ...inductiveCall('expression', expr),
        recType: teffFn(expr.recType) as TypeEff<RecType, Senv>,
        typeEff: teffFn(expr.typeEff),
      });
    case ExprKind.Unfold:
      return Unfold({
        ...expr,
        ...inductiveCall('expression', expr),
        typeEff: teffFn(expr.typeEff),
      });
    case ExprKind.If:
      return If({
        ...expr,
        ...inductiveCall('condition', expr),
        ...inductiveCall('then', expr),
        ...inductiveCall('else', expr),
        typeEff: teffFn(expr.typeEff),
      });
    case ExprKind.Inj:
      return Inj({
        ...expr,
        ...inductiveCall('expression', expr),
        typeEff: teffFn(expr.typeEff),
      });
    case ExprKind.Case:
      return Case({
        ...expr,
        ...inductiveCall('sum', expr),
        branches: expr.branches.map((branch) => ({
          ...branch,
          body: map(branch.body, fns),
        })),
        typeEff: teffFn(expr.typeEff),
      });
    case ExprKind.FixPoint:
      return FixPoint({
        ...expr,
        ...inductiveCall('body', expr),
        typeEff: teffFn(expr.typeEff),
      });
  }
};

const subst = (expr: Expression, name: string, senv: Senv): Expression => {
  return map(expr, {
    senvFn: (s: Senv) => SenvUtils.subst(s, name, senv),
    typeFn: (ty: Type) => TypeUtils.subst(ty, name, senv),
    teffFn: (teff) => TypeEffUtils.subst(teff, name, senv),
    eviFn: (evi: Evidence) => EvidenceUtils.subst(evi, name, senv),
    storeFn: (store: Store) => StoreUtils.subst(store, name, senv),
    stmtFn: (stmt: Statement) => substStmt(stmt, name, senv),
  });
};

const substTypevar = (
  expr: Expression,
  name: string,
  teff: TypeEffect,
): Expression => {
  return map(expr, {
    senvFn: identity,
    typeFn: (ty: Type) => TypeUtils.substTypevar(name, teff)(ty),
    teffFn: (target) => TypeEffUtils.substTypevar(name, teff)(target),
    eviFn: (evi: Evidence) => EvidenceUtils.substTypevar(evi, name, teff),
    storeFn: (store: Store) => StoreUtils.substTypevar(store, name, teff),
    stmtFn: (stmt: Statement) => substTypevarStmt(stmt, name, teff),
  });
};

const deleteResources = (
  expr: Expression,
  resources: ResourcesSet,
): Expression => {
  return map(expr, {
    senvFn: (s: Senv) => SenvUtils.deleteResources(s, resources),
    typeFn: (ty: Type) => TypeUtils.deleteResources(ty, resources),
    teffFn: (teff) => TypeEffUtils.deleteResources(teff, resources),
    eviFn: (evi: Evidence) => EvidenceUtils.deleteResources(evi, resources),
    storeFn: (store: Store) => StoreUtils.deleteResources(store, resources),
    stmtFn: (stmt: Statement) => deleteResourcesStmt(stmt, resources),
  });
};

export const ExpressionUtils = {
  subst,
  substTypevar,
  deleteResources,
};

/**
 * Statements
 */

export enum StmtKind {
  ExprStmt = 'ExprStmt',
  PrintStmt = 'PrintStmt',
  VarStmt = 'VarStmt',
  DefStmt = 'DefStmt',
}

export type ExprStmt = Term<
  {
    kind: StmtKind.ExprStmt;
    expression: Expression;
  },
  TypeEffect
>;
export const ExprStmt = factoryOf<ExprStmt>(StmtKind.ExprStmt);

// export type DefStmt = Term<
//   {
//     kind: StmtKind.DefStmt;
//     name: Token;
//     resourceParams?: Token[];
//     typeParams?: Array<{
//       identifier: Token;
//       directives?: Directive[];
//     }>;
//     binders: Array<{ name: Token; type: TypeEffect }>;
//     body: Expression;
//     colon: Token;
//     returnType: TypeEffect;
//   },
//   TypeEffect
// >;
// export const DefStmt = factoryOf<DefStmt>(StmtKind.DefStmt);

export type VarStmt = Term<
  {
    kind: StmtKind.VarStmt;
    name: Token;
    assignment: Expression;
  },
  TypeEffect
>;
export const VarStmt = factoryOf<VarStmt>(StmtKind.VarStmt);

export type PrintStmt = Term<
  {
    kind: StmtKind.PrintStmt;
    expression: Expression;
    showEvidence: boolean;
  },
  TypeEffect
>;
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
    // case StmtKind.DefStmt: {
    //   if (stmt.resourceParams?.some((p) => p.lexeme === name)) {
    //     return stmt;
    //   }

    //   return DefStmt({
    //     ...stmt,
    //     binders: stmt.binders.map((binder) => ({
    //       ...binder,
    //       type: TypeEffUtils.subst(binder.type, name, senv),
    //     })),
    //     body: ExpressionUtils.subst(stmt.body, name, senv),
    //     returnType: TypeEffUtils.subst(stmt.returnType, name, senv),
    //     typeEff,
    //   });
    // }
  }
};

const substTypevarStmt = (
  stmt: Statement,
  name: string,
  teff: TypeEffect,
): Statement => {
  const typeEff = TypeEffUtils.substTypevar(name, teff)(stmt.typeEff);

  switch (stmt.kind) {
    case StmtKind.ExprStmt:
      return ExprStmt({
        ...stmt,
        expression: ExpressionUtils.substTypevar(stmt.expression, name, teff),
        typeEff,
      });
    case StmtKind.PrintStmt:
      return PrintStmt({
        ...stmt,
        expression: ExpressionUtils.substTypevar(stmt.expression, name, teff),
        typeEff,
      });
    case StmtKind.VarStmt:
      return VarStmt({
        ...stmt,
        assignment: ExpressionUtils.substTypevar(stmt.assignment, name, teff),
        typeEff,
      });
    // case StmtKind.DefStmt: {
    //   if (stmt.typeParams?.some((p) => p.identifier.lexeme === name)) {
    //     return stmt;
    //   }

    //   return DefStmt({
    //     ...stmt,
    //     binders: stmt.binders.map((binder) => ({
    //       ...binder,
    //       type: TypeEffUtils.substTypevar(name, teff)(binder.type),
    //     })),
    //     body: ExpressionUtils.substTypevar(stmt.body, name, teff),
    //     returnType: TypeEffUtils.substTypevar(name, teff)(stmt.returnType),
    //     typeEff,
    //   });
    // }
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
    // case StmtKind.DefStmt: {
    //   if (stmt.resourceParams?.some((p) => resources.includes(p.lexeme))) {
    //     return stmt;
    //   }

    //   return DefStmt({
    //     ...stmt,
    //     binders: stmt.binders.map((binder) => ({
    //       ...binder,
    //       type: TypeEffUtils.deleteResources(binder.type, resources),
    //     })),
    //     body: ExpressionUtils.deleteResources(stmt.body, resources),
    //     returnType: TypeEffUtils.deleteResources(stmt.returnType, resources),
    //     typeEff,
    //   });
    // }
  }
};
