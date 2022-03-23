import Token from './lexing/Token';
import { TypeEff } from '@gsens-lang/core/utils/TypeEff';
import { factoryOf } from '@gsens-lang/core/utils/ADT';
import { Senv } from '@gsens-lang/core/utils';

// ===================
// EXPRESSIONS
// ===================

type LiteralValue = number | boolean | null;

export enum ExprKind {
  Literal = 'Literal',
  Binary = 'Binary',
  NonLinearBinary = 'NonLinearBinary',
  Call = 'Call',
  SCall = 'SCall',
  Grouping = 'Grouping',
  Variable = 'Variable',
  Fun = 'Fun',
  Forall = 'Forall',
  Tuple = 'Tuple',
  Ascription = 'Ascription',
  Print = 'Print',
  Block = 'Block',
}

export type Literal = {
  kind: ExprKind.Literal;
  value: LiteralValue;
  token: Token;
};
export const Literal = factoryOf<Literal>(ExprKind.Literal);

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
  arg: Expression;
  paren: Token;
};
export const Call = factoryOf<Call>(ExprKind.Call);

export type SCall = {
  kind: ExprKind.SCall;
  callee: Expression;
  arg: Senv;
  bracket: Token;
};
export const SCall = factoryOf<SCall>(ExprKind.SCall);

export type Grouping = { kind: ExprKind.Grouping; expression: Expression };
export const Grouping = factoryOf<Grouping>(ExprKind.Grouping);

export type Variable = { kind: ExprKind.Variable; name: Token };
export const Variable = factoryOf<Variable>(ExprKind.Variable);

export type Fun = {
  kind: ExprKind.Fun;
  binder: { name: Token; type: TypeEff };
  body: Expression;
};
export const Fun = factoryOf<Fun>(ExprKind.Fun);

export type Forall = {
  kind: ExprKind.Forall;
  sensVars: Token[];
  expr: Expression;
};
export const Forall = factoryOf<Forall>(ExprKind.Forall);

export type Tuple = {
  kind: ExprKind.Tuple;
  first: Expression;
  second: Expression;
  constructorToken: Token;
};
export const Tuple = factoryOf<Tuple>(ExprKind.Tuple);

export type Ascription = {
  kind: ExprKind.Ascription;
  expression: Expression;
  typeEff: TypeEff;
  ascriptionToken: Token;
};
export const Ascription = factoryOf<Ascription>(ExprKind.Ascription);

export type Print = {
  kind: ExprKind.Print;
  expression: Expression;
  token: Token;
  showEvidence: boolean;
};
export const Print = factoryOf<Print>(ExprKind.Print);

export type Block = { kind: ExprKind.Block; statements: Statement[] };
export const Block = factoryOf<Block>(ExprKind.Block);

export type Expression =
  | Literal
  | Binary
  | NonLinearBinary
  | Call
  | SCall
  | Grouping
  | Variable
  | Fun
  | Forall
  | Tuple
  | Block
  | Print
  | Ascription;

// ===================
// STATEMENTS
// ===================

export enum StmtKind {
  ExprStmt = 'ExprStmt',
  VarStmt = 'VarStmt',
}

export type ExprStmt = { kind: StmtKind.ExprStmt; expression: Expression };
export const ExprStmt = factoryOf<ExprStmt>(StmtKind.ExprStmt);

export type VarStmt = {
  kind: StmtKind.VarStmt;
  name: Token;
  assignment: Expression;
  resource: boolean;
};
export const VarStmt = factoryOf<VarStmt>(StmtKind.VarStmt);

export type Statement = ExprStmt | VarStmt;

export type Program = Statement[];

// UTILS

export const isExpr = (e: Statement | Expression): e is Expression => {
  return Object.values(ExprKind).some((kind) => kind === e.kind);
};

export const isStmt = (s: Statement | Expression): s is Statement => {
  return Object.values(StmtKind).some((kind) => kind === s.kind);
};
