import Token from './lexing/Token';
import { TypeEff, TypeEffect } from '@gsoul-lang/core/utils/TypeEff';
import { factoryOf } from '@gsoul-lang/core/utils/ADT';
import { Senv, Type } from '@gsoul-lang/core/utils';
import { RecType } from '@gsoul-lang/core/utils/Type';
import { Directive } from '@gsoul-lang/core/utils/lib/TypeDirectives';

// ===================
// EXPRESSIONS
// ===================

type LiteralValue = number | boolean | null;

export enum ExprKind {
  Literal = 'Literal',
  AtomLiteral = 'AtomLiteral',
  Binary = 'Binary',
  NonLinearBinary = 'NonLinearBinary',
  Call = 'Call',
  SCall = 'SCall',
  Grouping = 'Grouping',
  Variable = 'Variable',
  Fun = 'Fun',
  Forall = 'Forall',
  Poly = 'Poly',
  TCall = 'TCall',
  Tuple = 'Tuple',
  Projection = 'Projection',
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

export type Literal = {
  kind: ExprKind.Literal;
  value: LiteralValue;
  token: Token;
};
export const Literal = factoryOf<Literal>(ExprKind.Literal);

export type AtomLiteral = {
  kind: ExprKind.AtomLiteral;
  name: Token;
};
export const AtomLiteral = factoryOf<AtomLiteral>(ExprKind.AtomLiteral);

export type Binary = {
  kind: ExprKind.Binary;
  operator: Token;
  left: Expression;
  right: Expression;
};
export const Binary = factoryOf<Binary>(ExprKind.Binary);

export type NonLinearBinary = {
  kind: ExprKind.NonLinearBinary;
  operator: Token;
  left: Expression;
  right: Expression;
};
export const NonLinearBinary = factoryOf<NonLinearBinary>(
  ExprKind.NonLinearBinary,
);

export type Call = {
  kind: ExprKind.Call;
  callee: Expression;
  args: Expression[];
  paren: Token;
};
export const Call = factoryOf<Call>(ExprKind.Call);

export type SCall = {
  kind: ExprKind.SCall;
  callee: Expression;
  args: Senv[];
  bracket: Token;
};
export const SCall = factoryOf<SCall>(ExprKind.SCall);

export type TCall = {
  kind: ExprKind.TCall;
  callee: Expression;
  args: TypeEffect[];
  bracket: Token;
};
export const TCall = factoryOf<TCall>(ExprKind.TCall);

export type Grouping = { kind: ExprKind.Grouping; expression: Expression };
export const Grouping = factoryOf<Grouping>(ExprKind.Grouping);

export type Variable = { kind: ExprKind.Variable; name: Token };
export const Variable = factoryOf<Variable>(ExprKind.Variable);

export type Fun = {
  kind: ExprKind.Fun;
  binders: Array<{ name: Token; type: TypeEffect }>;
  body: Expression;
  colon?: Token;
  returnType?: TypeEffect;
};
export const Fun = factoryOf<Fun>(ExprKind.Fun);

export type Forall = {
  kind: ExprKind.Forall;
  sensVars: Token[];
  expr: Expression;
};
export const Forall = factoryOf<Forall>(ExprKind.Forall);

export type Poly = {
  kind: ExprKind.Poly;
  typeVars: Array<{
    identifier: Token;
    directives?: Directive[];
  }>;
  expr: Expression;
};
export const Poly = factoryOf<Poly>(ExprKind.Poly);

export type Tuple = {
  kind: ExprKind.Tuple;
  expressions: Expression[];
  constructorToken: Token;
};
export const Tuple = factoryOf<Tuple>(ExprKind.Tuple);

export type Projection = {
  kind: ExprKind.Projection;
  index: number;
  tuple: Expression;
  projectToken: Token;
};
export const Projection = factoryOf<Projection>(ExprKind.Projection);

export type Pair = {
  kind: ExprKind.Pair;
  first: Expression;
  second: Expression;
  constructorToken: Token;
};
export const Pair = factoryOf<Pair>(ExprKind.Pair);

export type ProjFst = {
  kind: ExprKind.ProjFst;
  pair: Expression;
  projToken: Token;
};
export const ProjFst = factoryOf<ProjFst>(ExprKind.ProjFst);

export type ProjSnd = {
  kind: ExprKind.ProjSnd;
  pair: Expression;
  projToken: Token;
};
export const ProjSnd = factoryOf<ProjSnd>(ExprKind.ProjSnd);

export type Ascription = {
  kind: ExprKind.Ascription;
  expression: Expression;
  typeEff: TypeEffect;
  ascriptionToken: Token;
};
export const Ascription = factoryOf<Ascription>(ExprKind.Ascription);

export type Fold = {
  kind: ExprKind.Fold;
  expression: Expression;
  recType: TypeEff<RecType, Senv>;
  dataTypeAlias?: string;
  foldToken: Token;
};
export const Fold = factoryOf<Fold>(ExprKind.Fold);

export type Unfold = {
  kind: ExprKind.Unfold;
  expression: Expression;
  unfoldToken: Token;
};
export const Unfold = factoryOf<Unfold>(ExprKind.Unfold);

export type If = {
  kind: ExprKind.If;
  condition: Expression;
  then: Expression;
  else: Expression;
  ifToken: Token;
};
export const If = factoryOf<If>(ExprKind.If);

export type Inj = {
  kind: ExprKind.Inj;
  index: number;
  types: Type[];
  expression: Expression;
  injToken: Token;
};
export const Inj = factoryOf<Inj>(ExprKind.Inj);

export type Case = {
  kind: ExprKind.Case;
  sum: Expression;
  branches: Array<{
    identifier: Token;
    body: Expression;
    name?: Token;
  }>;
  caseToken: Token;
};
export const Case = factoryOf<Case>(ExprKind.Case);

export type Block = { kind: ExprKind.Block; statements: Statement[] };
export const Block = factoryOf<Block>(ExprKind.Block);

export type Expression =
  | Literal
  | AtomLiteral
  | Binary
  | NonLinearBinary
  | Call
  | SCall
  | TCall
  | Grouping
  | Variable
  | Fun
  | Forall
  | Poly
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
  | Case;

// ===================
// STATEMENTS
// ===================

export enum StmtKind {
  ExprStmt = 'ExprStmt',
  PrintStmt = 'PrintStmt',
  VarStmt = 'VarStmt',
  DefStmt = 'DefStmt',
  HelloWorldStmt = 'HelloWorldStmt',
}

export type ExprStmt = { kind: StmtKind.ExprStmt; expression: Expression };
export const ExprStmt = factoryOf<ExprStmt>(StmtKind.ExprStmt);

export type DefStmt = {
  kind: StmtKind.DefStmt;
  name: Token;
  resourceParams?: Token[];
  typeParams?: Array<{
    identifier: Token;
    directives?: Directive[];
  }>;
  binders: Array<{ name: Token; type: TypeEffect }>;
  body: Expression;
  colon: Token;
  returnType: TypeEffect;
};
export const DefStmt = factoryOf<DefStmt>(StmtKind.DefStmt);

export type VarStmt = {
  kind: StmtKind.VarStmt;
  name: Token;
  colon?: Token;
  type?: TypeEff;
  assignment: Expression;
  resource: boolean;
};
export const VarStmt = factoryOf<VarStmt>(StmtKind.VarStmt);

export type PrintStmt = {
  kind: StmtKind.PrintStmt;
  expression: Expression;
  token: Token;
  showEvidence: boolean;
};
export const PrintStmt = factoryOf<PrintStmt>(StmtKind.PrintStmt);

export type HelloWorldStmt = {
  kind: StmtKind.HelloWorldStmt;
};
export const HelloWorldStmt = factoryOf<HelloWorldStmt>(
  StmtKind.HelloWorldStmt,
);

export type Statement =
  | ExprStmt
  | PrintStmt
  | VarStmt
  | DefStmt
  | HelloWorldStmt;

export type Program = Statement[];

// UTILS

export const isExpr = (e: Statement | Expression): e is Expression => {
  return Object.values(ExprKind).some((kind) => kind === e.kind);
};

export const isStmt = (s: Statement | Expression): s is Statement => {
  return Object.values(StmtKind).some((kind) => kind === s.kind);
};
