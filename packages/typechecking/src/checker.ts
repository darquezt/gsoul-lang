import {
  Ascription,
  Binary,
  Block,
  Call,
  Expression,
  ExprKind,
  ExprStmt,
  Forall,
  Fun,
  Literal,
  NonLinearBinary,
  Print,
  SCall,
  Statement,
  StmtKind,
  Tuple,
  Variable,
  VarStmt,
} from '@gsens-lang/parsing/lib/ast';
import {
  Sens,
  Senv,
  SenvUtils,
  TypeEnv,
  TypeEnvUtils,
  TypeEff,
  TypeEffUtils,
} from '@gsens-lang/core/utils';
import {
  Arrow,
  Bool,
  ForallT,
  MProduct,
  Nil,
  Real,
} from '@gsens-lang/core/utils/Type';
import { isKinded } from '@gsens-lang/core/utils/ADT';

import { isSubTypeEff } from './subtyping';
import { Token } from '@gsens-lang/parsing/lib/lexing';
import { TypeAssoc, TypeAssocs, TypingSeeker } from './utils/typingSeeker';

export type PureSuccess = {
  success: true;
  typeEff: TypeEff;
  typings: TypeAssocs;
};
export const PureSuccess = (
  te: TypeEff,
  typings: TypeAssocs = [],
): PureSuccess => ({
  success: true,
  typeEff: te,
  typings,
});

export type StatefulSuccess = {
  success: true;
  typeEff: TypeEff;
  tenv: TypeEnv;
  typings: TypeAssocs;
};
export const StatefulSuccess = (
  te: TypeEff,
  tenv: TypeEnv,
  typings: TypeAssocs = [],
): StatefulSuccess => ({
  success: true,
  typeEff: te,
  tenv,
  typings,
});

export type TypeCheckingSuccess = {
  success: true;
  typeEff: TypeEff;
  typings: TypingSeeker;
};
export const TypeCheckingSuccess = (
  te: TypeEff,
  typings: TypingSeeker,
): TypeCheckingSuccess => ({
  success: true,
  typeEff: te,
  typings,
});

export type Failure = { token: Token; success: false; reason?: string };
export const Failure = (token: Token, reason?: string): Failure => ({
  success: false,
  reason,
  token,
});

export type TypeCheckingResult = TypeCheckingSuccess | Failure;
export type PureResult = PureSuccess | Failure;
export type StatefulResult = StatefulSuccess | Failure;

const realLit = (expr: Literal): PureResult => ({
  success: true,
  typeEff: TypeEff(Real(), Senv()),
  typings: [[expr.token, TypeEff(Real(), Senv())]],
});

const boolLit = (expr: Literal): PureResult => ({
  success: true,
  typeEff: TypeEff(Bool(), Senv()),
  typings: [[expr.token, TypeEff(Bool(), Senv())]],
});

const nilLit = (expr: Literal): PureResult => ({
  success: true,
  typeEff: TypeEff(Nil(), Senv()),
  typings: [[expr.token, TypeEff(Nil(), Senv())]],
});

const variable = (variable: Variable, tenv: TypeEnv): PureResult => {
  const typeFromTenv = tenv[variable.name.lexeme];

  if (!typeFromTenv) {
    return Failure(
      variable.name,
      `Variable ${variable.name.lexeme} is not in scope`,
    );
  }

  return PureSuccess(typeFromTenv, [[variable.name, typeFromTenv]]);
};

const binary = (expr: Binary, tenv: TypeEnv): PureResult => {
  const lTC = expression(expr.left, tenv);

  if (!lTC.success) {
    return lTC;
  } else if (!isKinded(lTC.typeEff.type, 'Real')) {
    return Failure(
      expr.operator,
      'Expected real expression on the left-hand side of + operation',
    );
  }

  const rTC = expression(expr.right, tenv);

  if (!rTC.success) {
    return rTC;
  } else if (!isKinded(rTC.typeEff.type, 'Real')) {
    return Failure(
      expr.operator,
      'Expected real expression on the right-hand side of + operation',
    );
  }

  return PureSuccess(
    TypeEff(Real(), SenvUtils.add(lTC.typeEff.effect, rTC.typeEff.effect)),
    lTC.typings.concat(rTC.typings),
  );
};

const nonLinearBinary = (expr: NonLinearBinary, tenv: TypeEnv): PureResult => {
  const lTC = expression(expr.left, tenv);

  if (!lTC.success) {
    return lTC;
  } else if (!isKinded(lTC.typeEff.type, 'Real')) {
    return Failure(
      expr.operator,
      'Expected real expression on the left-hand side of + operation',
    );
  }

  const rTC = expression(expr.right, tenv);

  if (!rTC.success) {
    return rTC;
  } else if (!isKinded(rTC.typeEff.type, 'Real')) {
    return Failure(
      expr.operator,
      'Expected real expression on the right-hand side of + operation',
    );
  }

  const addedEffect = SenvUtils.add(lTC.typeEff.effect, rTC.typeEff.effect);

  return PureSuccess(
    TypeEff(Real(), SenvUtils.scaleInf(addedEffect)),
    lTC.typings.concat(rTC.typings),
  );
};

const fun = (expr: Fun, tenv: TypeEnv): PureResult => {
  const { binder, body } = expr;

  const varName = binder.name.lexeme;

  const bodyTC = expression(
    body,
    TypeEnvUtils.extend(tenv, varName, binder.type),
  );

  if (!bodyTC.success) {
    return bodyTC;
  }

  return PureSuccess(
    TypeEff(
      Arrow({
        domain: binder.type,
        codomain: bodyTC.typeEff,
      }),
      Senv(),
    ),
    bodyTC.typings,
  );
};

const forall = (expr: Forall, tenv: TypeEnv): PureResult => {
  const { expr: inner, sensVars } = expr;

  const bodyTC = expression(inner, tenv);

  if (!bodyTC.success) {
    return bodyTC;
  }

  return PureSuccess(
    TypeEff(
      ForallT({
        sensVars: sensVars.map((v) => v.lexeme),
        codomain: bodyTC.typeEff,
      }),
      Senv(),
    ),
    bodyTC.typings,
  );
};

const app = (expr: Call, tenv: TypeEnv): PureResult => {
  const calleeTC = expression(expr.callee, tenv);

  if (!calleeTC.success) {
    return calleeTC;
  }

  const calleeType = calleeTC.typeEff.type;

  if (calleeType.kind !== 'Arrow') {
    return Failure(expr.paren, 'Expression called is not a function');
  }

  const argTC = expression(expr.arg, tenv);

  if (!argTC.success) {
    return argTC;
  }

  const calleeArgType = calleeType.domain;

  const argType = argTC.typeEff;

  if (!isSubTypeEff(argType, calleeArgType)) {
    return Failure(
      expr.paren,
      'Argument type is not subtype of the expected type in the function',
    );
  }

  const returnEffect = SenvUtils.add(
    calleeTC.typeEff.effect,
    argTC.typeEff.effect,
  );

  return PureSuccess(
    TypeEff(calleeType.codomain.type, returnEffect),
    calleeTC.typings.concat(argTC.typings),
  );
};

const sapp = (expr: SCall, tenv: TypeEnv): PureResult => {
  const calleeTC = expression(expr.callee, tenv);

  if (!calleeTC.success) {
    return calleeTC;
  }

  const calleeType = calleeTC.typeEff.type;

  if (calleeType.kind !== 'ForallT') {
    return Failure(
      expr.bracket,
      'Expression called is not a sensitive quantification',
    );
  }

  const {
    sensVars: [svar, ...sensVars],
    codomain,
  } = calleeType;

  const returnTypeEff =
    sensVars.length === 0
      ? TypeEffUtils.subst(codomain, svar, expr.arg)
      : TypeEff(
          ForallT({
            sensVars,
            codomain: TypeEffUtils.subst(codomain, svar, expr.arg),
          }),
          calleeTC.typeEff.effect,
        );

  return PureSuccess(returnTypeEff, calleeTC.typings);
};

const ascription = (expr: Ascription, tenv: TypeEnv): PureResult => {
  const innerTC = expression(expr.expression, tenv);

  if (!innerTC.success) {
    return innerTC;
  }

  if (!isSubTypeEff(innerTC.typeEff, expr.typeEff)) {
    return Failure(
      expr.ascriptionToken,
      'Expression type-and-effect is not a subtype of the ascription type-and-effect',
    );
  }

  return PureSuccess(expr.typeEff, innerTC.typings);
};

const printExpr = (expr: Print, tenv: TypeEnv): PureResult => {
  const exprTC = expression(expr.expression, tenv);

  if (!exprTC.success) {
    return exprTC;
  }

  return PureSuccess(
    exprTC.typeEff,
    [[expr.token, exprTC.typeEff] as TypeAssoc].concat(exprTC.typings),
  );
};

const block = (expr: Block, tenv: TypeEnv): PureResult => {
  let result = TypeEff(Nil(), Senv()) as TypeEff;
  let currentTenv = tenv;
  const typings: TypeAssocs = [];

  for (const decl of expr.statements) {
    const declTC = statement(decl, currentTenv);

    if (!declTC.success) {
      return declTC;
    }

    typings.push(...declTC.typings);

    result = declTC.typeEff;
    currentTenv = declTC.tenv;
  }

  return PureSuccess(result, typings);
};

const tuple = (expr: Tuple, tenv: TypeEnv): PureResult => {
  const firstTC = expression(expr.first, tenv);

  if (!firstTC.success) {
    return firstTC;
  }

  const secondTC = expression(expr.second, tenv);

  if (!secondTC.success) {
    return secondTC;
  }

  return PureSuccess(
    TypeEff(
      MProduct({
        first: firstTC.typeEff,
        second: secondTC.typeEff,
      }),
      Senv(),
    ),
    firstTC.typings.concat(secondTC.typings),
  );
};

export const expression = (
  expr: Expression,
  tenv: TypeEnv = {},
): PureResult => {
  switch (expr.kind) {
    case ExprKind.Binary:
      return binary(expr, tenv);
    case ExprKind.Call:
      return app(expr, tenv);
    case ExprKind.SCall:
      return sapp(expr, tenv);
    case ExprKind.NonLinearBinary:
      return nonLinearBinary(expr, tenv);
    case ExprKind.Variable:
      return variable(expr, tenv);
    case ExprKind.Fun:
      return fun(expr, tenv);
    case ExprKind.Forall:
      return forall(expr, tenv);
    case ExprKind.Literal: {
      const { value } = expr;
      if (typeof value === 'number') {
        return realLit(expr);
      } else if (typeof value === 'boolean') {
        return boolLit(expr);
      }
      return nilLit(expr);
    }
    case ExprKind.Ascription:
      return ascription(expr, tenv);
    case ExprKind.Grouping:
      return expression(expr.expression, tenv);
    case ExprKind.Print:
      return printExpr(expr, tenv);
    case ExprKind.Block:
      return block(expr, tenv);
    case ExprKind.Tuple:
      return tuple(expr, tenv);
  }
};

const exprStmt = (stmt: ExprStmt, tenv: TypeEnv): StatefulResult => {
  const exprTC = expression(stmt.expression, tenv);

  if (!exprTC.success) {
    return exprTC;
  }

  return StatefulSuccess(exprTC.typeEff, tenv, exprTC.typings);
};

const varStmt = (stmt: VarStmt, tenv: TypeEnv): StatefulResult => {
  const exprTC = expression(stmt.assignment, tenv);

  if (!exprTC.success) {
    return exprTC;
  }

  if (stmt.resource && !SenvUtils.isEmpty(exprTC.typeEff.effect)) {
    return Failure(stmt.name, 'A resource cannot depend on other resources');
  }

  const typeEff = stmt.resource
    ? TypeEff(exprTC.typeEff.type, Senv({ [stmt.name.lexeme]: Sens(1) }))
    : exprTC.typeEff;

  return StatefulSuccess(
    exprTC.typeEff,
    TypeEnvUtils.extend(tenv, stmt.name.lexeme, typeEff),
    [[stmt.name, typeEff] as TypeAssoc].concat(exprTC.typings),
  );
};

export const statement = (
  stmt: Statement,
  tenv: TypeEnv = {},
): StatefulResult => {
  switch (stmt.kind) {
    case StmtKind.ExprStmt:
      return exprStmt(stmt, tenv);
    case StmtKind.VarStmt:
      return varStmt(stmt, tenv);
  }
};

export const typeCheck = (statements: Statement[]): TypeCheckingResult => {
  const tc = expression(Block({ statements }));

  if (!tc.success) {
    return tc;
  }

  const typings = new TypingSeeker(tc.typings);

  return TypeCheckingSuccess(tc.typeEff, typings);
};
