import {
  Ascription,
  Binary,
  Block,
  Call,
  Expression,
  ExprStmt,
  Fun,
  Literal,
  NonLinearBinary,
  Print,
  Statement,
  Variable,
  VarStmt,
} from '@gsens-lang/parsing/ast';
import {
  Sens,
  Senv,
  SenvUtils,
  TypeEnv,
  TypeEnvUtils,
  TypeEff,
} from '@gsens-lang/core/utils';
import { Arrow, Bool, Nil, Real } from '@gsens-lang/core/utils/Type';
import { isKinded } from '@gsens-lang/core/utils/ADT';

import { isSubType, isSubTypeEff } from './subtyping';
import Token from '@gsens-lang/parsing/lexing/Token';
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

  const bodyTC = statement(
    body,
    TypeEnvUtils.extend(
      tenv,
      varName,
      TypeEff(binder.type, Senv({ [varName]: Sens(1) })),
    ),
  );

  if (!bodyTC.success) {
    return bodyTC;
  }

  return PureSuccess(
    TypeEff(
      Arrow({
        binder: {
          identifier: varName,
          type: binder.type,
        },
        returnTypeEff: bodyTC.typeEff,
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

  const calleeArgType = calleeType.binder.type;

  const argType = argTC.typeEff.type;

  if (!isSubType(calleeArgType, argType)) {
    return Failure(
      expr.paren,
      'Argument type is not subtype of the expected type in the function',
    );
  }

  const returnEffect = SenvUtils.add(
    calleeTC.typeEff.effect,
    SenvUtils.subst(
      calleeType.returnTypeEff.effect,
      calleeType.binder.identifier,
      argTC.typeEff.effect,
    ),
  );

  return PureSuccess(
    TypeEff(calleeType.returnTypeEff.type, returnEffect),
    calleeTC.typings.concat(argTC.typings),
  );
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

export const expression = (
  expr: Expression,
  tenv: TypeEnv = {},
): PureResult => {
  switch (expr.kind) {
    case 'Binary':
      return binary(expr, tenv);
    case 'Call':
      return app(expr, tenv);
    case 'NonLinearBinary':
      return nonLinearBinary(expr, tenv);
    case 'Variable':
      return variable(expr, tenv);
    case 'Fun':
      return fun(expr, tenv);
    case 'Literal': {
      const { value } = expr;
      if (typeof value === 'number') {
        return realLit(expr);
      } else if (typeof value === 'boolean') {
        return boolLit(expr);
      }
      return nilLit(expr);
    }
    case 'Ascription':
      return ascription(expr, tenv);
    case 'Grouping':
      return expression(expr.expression, tenv);
  }
};

const printStmt = (stmt: Print, tenv: TypeEnv): StatefulResult => {
  const exprTC = expression(stmt.expression, tenv);

  if (!exprTC.success) {
    return exprTC;
  }

  return StatefulSuccess(
    exprTC.typeEff,
    tenv,
    [[stmt.token, exprTC.typeEff] as TypeAssoc].concat(exprTC.typings),
  );
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

  return StatefulSuccess(
    exprTC.typeEff,
    TypeEnvUtils.extend(tenv, stmt.name.lexeme, exprTC.typeEff),
    [[stmt.name, exprTC.typeEff] as TypeAssoc].concat(exprTC.typings),
  );
};

const block = (stmt: Block, tenv: TypeEnv): StatefulResult => {
  let result = TypeEff(Nil(), Senv()) as TypeEff;
  let currentTenv = tenv;
  const typings: TypeAssocs = [];

  for (const decl of stmt.statements) {
    const declTC = statement(decl, currentTenv);

    if (!declTC.success) {
      return declTC;
    }

    typings.push(...declTC.typings);

    result = declTC.typeEff;
    currentTenv = declTC.tenv;
  }

  return StatefulSuccess(result, tenv, typings);
};

export const statement = (
  stmt: Statement,
  tenv: TypeEnv = {},
): StatefulResult => {
  switch (stmt.kind) {
    case 'Print':
      return printStmt(stmt, tenv);
    case 'ExprStmt':
      return exprStmt(stmt, tenv);
    case 'VarStmt':
      return varStmt(stmt, tenv);
    case 'Block':
      return block(stmt, tenv);
  }
};

export const typeCheck = (statements: Statement[]): TypeCheckingResult => {
  const tc = statement(Block({ statements }));

  if (!tc.success) {
    return tc;
  }

  const typings = new TypingSeeker(tc.typings);

  return TypeCheckingSuccess(tc.typeEff, typings);
};
