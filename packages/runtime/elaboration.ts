import * as past from '@gsens-lang/parsing/ast';
import {
  Sens,
  Senv,
  SenvUtils,
  Type,
  TypeEnv,
  TypeEnvUtils,
  TypeEff,
} from '@gsens-lang/core/utils';
import { Arrow, Nil } from '@gsens-lang/core/utils/Type';

import {
  Ascription,
  Binary,
  Block,
  BoolLiteral,
  Call,
  Expression,
  ExprStmt,
  Fun,
  NilLiteral,
  NonLinearBinary,
  Print,
  RealLiteral,
  Statement,
  Variable,
  VarStmt,
} from './ast';
import { initialEvidence, interior } from './utils/Evidence';

export class ElaborationError extends Error {}

export type StatefulResult<T> = {
  term: T;
  tenv: TypeEnv;
};
const StatefulResult = <T>(term: T, tenv: TypeEnv): StatefulResult<T> => ({
  term,
  tenv,
});

const realLit = (lit: past.Literal): Ascription => {
  const r = RealLiteral({
    value: lit.value as number,
  });

  const evidence = initialEvidence(r.typeEff);

  return Ascription({
    expression: r,
    evidence,
    typeEff: r.typeEff,
  });
};

const boolLit = (lit: past.Literal): Ascription => {
  const b = BoolLiteral({
    value: lit.value as boolean,
  });

  const evidence = initialEvidence(b.typeEff);

  return Ascription({
    expression: b,
    evidence,
    typeEff: b.typeEff,
  });
};

const unitLit = (): Ascription => {
  const nil = NilLiteral();
  const evidence = initialEvidence(nil.typeEff);

  return Ascription({
    expression: nil,
    evidence,
    typeEff: nil.typeEff,
  });
};

const variable = (variable: past.Variable, tenv: TypeEnv): Variable => {
  const typeFromTenv = tenv[variable.name.lexeme];

  if (!typeFromTenv) {
    throw new ElaborationError(
      `Variable ${variable.name.lexeme} is not in scope`,
    );
  }

  return Variable({
    name: variable.name,
    typeEff: typeFromTenv,
  });
};

const binary = (expr: past.Binary, tenv: TypeEnv): Binary => {
  const left = expression(expr.left, tenv);

  const right = expression(expr.right, tenv);

  if (left.typeEff.type.kind !== right.typeEff.type.kind) {
    throw new ElaborationError('Operands types do not match');
  }

  return Binary({
    operator: expr.operator,
    left,
    right,
    typeEff: TypeEff(
      left.typeEff.type,
      SenvUtils.add(left.typeEff.effect, right.typeEff.effect),
    ),
  });
};

const nonLinearBinary = (
  expr: past.NonLinearBinary,
  tenv: TypeEnv,
): NonLinearBinary => {
  const left = expression(expr.left, tenv);

  const right = expression(expr.right, tenv);

  if (left.typeEff.type.kind !== right.typeEff.type.kind) {
    throw new ElaborationError('Operands types do not match');
  }

  return NonLinearBinary({
    operator: expr.operator,
    left,
    right,
    typeEff: TypeEff(
      left.typeEff.type,
      SenvUtils.scaleInf(
        SenvUtils.add(left.typeEff.effect, right.typeEff.effect),
      ),
    ),
  });
};

const fun = (expr: past.Fun, tenv: TypeEnv): Ascription => {
  const varName = expr.binder.name.lexeme;

  const { term: body } = statement(
    expr.body,
    TypeEnvUtils.extend(
      tenv,
      varName,
      TypeEff(expr.binder.type, Senv({ [varName]: Sens(1) })),
    ),
  );

  const lambda = Fun({
    binder: expr.binder,
    body,
    typeEff: TypeEff(
      Arrow({
        binder: {
          identifier: varName,
          type: expr.binder.type,
        },
        returnTypeEff: body.typeEff,
      }),
      Senv(),
    ),
  });

  const evidence = initialEvidence(lambda.typeEff);

  return Ascription({
    expression: lambda,
    evidence,
    typeEff: lambda.typeEff,
  });
};

const app = (expr: past.Call, tenv: TypeEnv): Call => {
  const callee = expression(expr.callee, tenv);

  const calleeType = callee.typeEff.type;

  if (calleeType.kind !== 'Arrow') {
    throw new ElaborationError('Expression called is not a function');
  }

  const arg = expression(expr.arg, tenv);

  const calleeArgType = calleeType.binder.type;

  const evidence = interior(
    arg.typeEff,
    TypeEff(calleeArgType, arg.typeEff.effect),
  );

  if (!evidence) {
    throw new ElaborationError(
      'Argument type is not subtype of the expected type in the function',
    );
  }

  const returnEffect = SenvUtils.add(
    callee.typeEff.effect,
    SenvUtils.subst(
      calleeType.returnTypeEff.effect,
      calleeType.binder.identifier,
      arg.typeEff.effect,
    ),
  );

  return Call({
    callee,
    arg,
    paren: expr.paren,
    typeEff: TypeEff(calleeType.returnTypeEff.type, returnEffect),
  });
};

const ascription = (expr: past.Ascription, tenv: TypeEnv): Ascription => {
  const inner = expression(expr.expression, tenv);

  const evidence = interior(inner.typeEff, expr.typeEff);

  if (!evidence) {
    throw new ElaborationError(
      'Expression type-and-effect is not a subtype of the ascription type-and-effect',
    );
  }

  return Ascription({
    expression: inner,
    evidence,
    typeEff: expr.typeEff,
  });
};

export const expression = (
  expr: past.Expression,
  tenv: TypeEnv = {},
): Expression => {
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
      if (typeof expr.value === 'number') {
        return realLit(expr);
      } else if (typeof expr.value === 'boolean') {
        return boolLit(expr);
      } else if (expr.value === null) {
        return unitLit();
      }
      throw new ElaborationError('Literal type not handled');
    }
    case 'Ascription':
      return ascription(expr, tenv);
    case 'Grouping':
      return expression(expr.expression, tenv);
  }
};

const printStmt = (stmt: past.Print, tenv: TypeEnv): StatefulResult<Print> => {
  const expr = expression(stmt.expression, tenv);

  return StatefulResult(
    Print({
      expression: expr,
      typeEff: expr.typeEff,
      showEvidence: stmt.showEvidence,
    }),
    tenv,
  );
};

const exprStmt = (
  stmt: past.ExprStmt,
  tenv: TypeEnv,
): StatefulResult<ExprStmt> => {
  const expr = expression(stmt.expression, tenv);

  return StatefulResult(
    ExprStmt({
      expression: expr,
      typeEff: expr.typeEff,
    }),
    tenv,
  );
};

const varStmt = (
  stmt: past.VarStmt,
  tenv: TypeEnv,
): StatefulResult<VarStmt> => {
  let expr = expression(stmt.assignment, tenv);

  if (stmt.resource) {
    if (!SenvUtils.isEmpty(expr.typeEff.effect)) {
      throw new ElaborationError('Resources cannot depend on other resources');
    }

    const typeEff = TypeEff(
      expr.typeEff.type,
      Senv({ [stmt.name.lexeme]: Sens(1) }),
    );

    expr = Ascription({
      expression: expr,
      typeEff: typeEff,
      evidence: [expr.typeEff, typeEff],
    });
  }

  return StatefulResult(
    VarStmt({
      name: stmt.name,
      assignment: expr,
      typeEff: expr.typeEff,
    }),
    TypeEnvUtils.extend(tenv, stmt.name.lexeme, expr.typeEff),
  );
};

const block = (stmt: past.Block, tenv: TypeEnv): StatefulResult<Block> => {
  let result = TypeEff<Type, Senv>(Nil(), Senv());
  let currentTenv = tenv;
  const statements: Statement[] = [];

  for (const decl of stmt.statements) {
    const stmt = statement(decl, currentTenv);

    result = stmt.term.typeEff;
    currentTenv = stmt.tenv;

    statements.push(stmt.term);
  }

  return StatefulResult(
    Block({
      statements,
      typeEff: result,
    }),
    tenv,
  );
};

export const statement = (
  stmt: past.Statement,
  tenv: TypeEnv = {},
): StatefulResult<Statement> => {
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

/**
 * @throws {ElaborationError}
 */
export const elaborate = (stmts: past.Statement[]): Statement => {
  const block = past.Block({
    statements: stmts,
  });

  return statement(block, TypeEnv()).term;
};
