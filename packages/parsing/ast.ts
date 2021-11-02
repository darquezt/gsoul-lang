import Token from './lexing/Token';
import { Type } from '@gsens-lang/core/utils/Type';
import { TypeEff } from '@gsens-lang/core/utils/TypeEff';
import { factoryOf } from '@gsens-lang/core/utils/ADT';

/**
 * Expressions
 */

type LiteralValue = number | boolean | null;

export type Literal = { kind: 'Literal'; value: LiteralValue };
export const Literal = factoryOf<Literal>('Literal');

export type Binary = {
  kind: 'Binary';
  operator: Token;
  left: Expression;
  right: Expression;
};
export const Binary = factoryOf<Binary>('Binary');

export type NonLinearBinary = {
  kind: 'NonLinearBinary';
  operator: Token;
  left: Expression;
  right: Expression;
};
export const NonLinearBinary = factoryOf<NonLinearBinary>('NonLinearBinary');

export type Call = {
  kind: 'Call';
  callee: Expression;
  arg: Expression;
  paren: Token;
};
export const Call = factoryOf<Call>('Call');

export type Grouping = { kind: 'Grouping'; expression: Expression };
export const Grouping = factoryOf<Grouping>('Grouping');

export type Variable = { kind: 'Variable'; name: Token };
export const Variable = factoryOf<Variable>('Variable');

export type Fun = {
  kind: 'Fun';
  binder: { name: Token; type: Type };
  body: Statement;
};
export const Fun = factoryOf<Fun>('Fun');

export type Ascription = {
  kind: 'Ascription';
  expression: Expression;
  typeEff: TypeEff;
};
export const Ascription = factoryOf<Ascription>('Ascription');

export type Expression =
  | Literal
  | Binary
  | NonLinearBinary
  | Call
  | Grouping
  | Variable
  | Fun
  | Ascription;

/**
 * Statements
 */

export type ExprStmt = { kind: 'ExprStmt'; expression: Expression };
export const ExprStmt = factoryOf<ExprStmt>('ExprStmt');

export type Print = { kind: 'Print'; expression: Expression };
export const Print = factoryOf<Print>('Print');

export type Block = { kind: 'Block'; statements: Statement[] };
export const Block = factoryOf<Block>('Block');

export type VarStmt = { kind: 'VarStmt'; name: Token; assignment: Expression };
export const VarStmt = factoryOf<VarStmt>('VarStmt');

export type Statement = ExprStmt | Print | Block | VarStmt;

export type Program = Statement[];
