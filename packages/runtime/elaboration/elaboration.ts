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
import { initialEvidence, interior } from '../utils/Evidence';
import { Err, Ok, Result } from '../utils/Result';
import {
  ElaborationDependencyError,
  ElaborationError,
  ElaborationReferenceError,
  ElaborationSubtypingError,
  ElaborationTypeError,
  ElaborationUnsupportedExpressionError,
} from './errors';

export type Stateful<T> = {
  term: T;
  tenv: TypeEnv;
};
export const Stateful = <T>(term: T, tenv: TypeEnv): Stateful<T> => ({
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

const variable = (
  variable: past.Variable,
  tenv: TypeEnv,
): Result<Variable, ElaborationReferenceError> => {
  const typeFromTenv = tenv[variable.name.lexeme];

  if (!typeFromTenv) {
    return Err(
      ElaborationReferenceError({
        reason: `Variable ${variable.name.lexeme} is not in scope`,
        variable: variable.name,
      }),
    );
  }

  return Ok(
    Variable({
      name: variable.name,
      typeEff: typeFromTenv,
    }),
  );
};

const binary = (
  expr: past.Binary,
  tenv: TypeEnv,
): Result<Binary, ElaborationError> => {
  const leftElaboration = expression(expr.left, tenv);

  if (!leftElaboration.success) {
    return leftElaboration;
  }

  const { result: left } = leftElaboration;

  const rightElaboration = expression(expr.right, tenv);

  if (!rightElaboration.success) {
    return rightElaboration;
  }

  const { result: right } = rightElaboration;

  if (left.typeEff.type.kind !== right.typeEff.type.kind) {
    return Err(
      ElaborationTypeError({
        reason: 'Operands types do not match',
        operator: expr.operator,
      }),
    );
  }

  return Ok(
    Binary({
      operator: expr.operator,
      left,
      right,
      typeEff: TypeEff(
        left.typeEff.type,
        SenvUtils.add(left.typeEff.effect, right.typeEff.effect),
      ),
    }),
  );
};

const nonLinearBinary = (
  expr: past.NonLinearBinary,
  tenv: TypeEnv,
): Result<NonLinearBinary, ElaborationError> => {
  const leftElaboration = expression(expr.left, tenv);

  if (!leftElaboration.success) {
    return leftElaboration;
  }

  const { result: left } = leftElaboration;

  const rightElaboration = expression(expr.right, tenv);

  if (!rightElaboration.success) {
    return rightElaboration;
  }

  const { result: right } = rightElaboration;

  if (left.typeEff.type.kind !== right.typeEff.type.kind) {
    return Err(
      ElaborationTypeError({
        reason: 'Operands types do not match',
        operator: expr.operator,
      }),
    );
  }

  return Ok(
    NonLinearBinary({
      operator: expr.operator,
      left,
      right,
      typeEff: TypeEff(
        left.typeEff.type,
        SenvUtils.scaleInf(
          SenvUtils.add(left.typeEff.effect, right.typeEff.effect),
        ),
      ),
    }),
  );
};

const fun = (
  expr: past.Fun,
  tenv: TypeEnv,
): Result<Ascription, ElaborationError> => {
  const varName = expr.binder.name.lexeme;

  const bodyElaboration = statement(
    expr.body,
    TypeEnvUtils.extend(
      tenv,
      varName,
      TypeEff(expr.binder.type, Senv({ [varName]: Sens(1) })),
    ),
  );

  if (!bodyElaboration.success) {
    return bodyElaboration;
  }

  const {
    result: { term: body },
  } = bodyElaboration;

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

  return Ok(
    Ascription({
      expression: lambda,
      evidence,
      typeEff: lambda.typeEff,
    }),
  );
};

const app = (
  expr: past.Call,
  tenv: TypeEnv,
): Result<Call, ElaborationError> => {
  const calleeElaboration = expression(expr.callee, tenv);

  if (!calleeElaboration.success) {
    return calleeElaboration;
  }

  const { result: callee } = calleeElaboration;

  const calleeType = callee.typeEff.type;

  if (calleeType.kind !== 'Arrow') {
    return Err(
      ElaborationTypeError({
        reason: 'Expression called is not a function',
        operator: expr.paren,
      }),
    );
  }

  const argElaboration = expression(expr.arg, tenv);

  if (!argElaboration.success) {
    return argElaboration;
  }

  const { result: arg } = argElaboration;

  const calleeArgType = calleeType.binder.type;

  const argTypeEff = TypeEff(calleeArgType, arg.typeEff.effect);

  const evidence = interior(arg.typeEff, argTypeEff);

  if (!evidence.success) {
    return Err(
      ElaborationSubtypingError({
        reason:
          'Argument type is not subtype of the expected type in the function',
        operator: expr.paren,
        superType: argTypeEff,
        type: arg.typeEff,
      }),
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

  return Ok(
    Call({
      callee,
      arg: Ascription({
        evidence: evidence.result,
        typeEff: argTypeEff,
        expression: arg,
      }),
      paren: expr.paren,
      typeEff: TypeEff(calleeType.returnTypeEff.type, returnEffect),
    }),
  );
};

const ascription = (
  expr: past.Ascription,
  tenv: TypeEnv,
): Result<Ascription, ElaborationError> => {
  const innerElaboration = expression(expr.expression, tenv);

  if (!innerElaboration.success) {
    return innerElaboration;
  }

  const { result: inner } = innerElaboration;

  const evidence = interior(inner.typeEff, expr.typeEff);

  if (!evidence.success) {
    return Err(
      ElaborationSubtypingError({
        reason:
          'Expression type-and-effect is not a subtype of the ascription type-and-effect',
        operator: expr.ascriptionToken,
        superType: expr.typeEff,
        type: inner.typeEff,
      }),
    );
  }

  return Ok(
    Ascription({
      expression: inner,
      evidence: evidence.result,
      typeEff: expr.typeEff,
    }),
  );
};

export const expression = (
  expr: past.Expression,
  tenv: TypeEnv = {},
): Result<Expression, ElaborationError> => {
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
        return Ok(realLit(expr));
      } else if (typeof expr.value === 'boolean') {
        return Ok(boolLit(expr));
      } else if (expr.value === null) {
        return Ok(unitLit());
      }
      return Err(
        ElaborationUnsupportedExpressionError({
          reason: 'Literal type not handled',
        }),
      );
    }
    case 'Ascription':
      return ascription(expr, tenv);
    case 'Grouping':
      return expression(expr.expression, tenv);
  }
};

const printStmt = (
  stmt: past.Print,
  tenv: TypeEnv,
): Result<Stateful<Print>, ElaborationError> => {
  const exprElaboration = expression(stmt.expression, tenv);

  if (!exprElaboration.success) {
    return exprElaboration;
  }

  const { result: expr } = exprElaboration;

  return Ok(
    Stateful(
      Print({
        expression: expr,
        typeEff: expr.typeEff,
        showEvidence: stmt.showEvidence,
      }),
      tenv,
    ),
  );
};

const exprStmt = (
  stmt: past.ExprStmt,
  tenv: TypeEnv,
): Result<Stateful<ExprStmt>, ElaborationError> => {
  const exprElaboration = expression(stmt.expression, tenv);

  if (!exprElaboration.success) {
    return exprElaboration;
  }

  const { result: expr } = exprElaboration;

  return Ok(
    Stateful(
      ExprStmt({
        expression: expr,
        typeEff: expr.typeEff,
      }),
      tenv,
    ),
  );
};

const varStmt = (
  stmt: past.VarStmt,
  tenv: TypeEnv,
): Result<Stateful<VarStmt>, ElaborationError> => {
  const exprElaboration = expression(stmt.assignment, tenv);

  if (!exprElaboration.success) {
    return exprElaboration;
  }

  let expr = exprElaboration.result;

  if (stmt.resource) {
    if (!SenvUtils.isEmpty(expr.typeEff.effect)) {
      return Err(
        ElaborationDependencyError({
          reason: 'Resources cannot depend on other resources',
          variable: stmt.name,
        }),
      );
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

  return Ok(
    Stateful(
      VarStmt({
        name: stmt.name,
        assignment: expr,
        typeEff: expr.typeEff,
      }),
      TypeEnvUtils.extend(tenv, stmt.name.lexeme, expr.typeEff),
    ),
  );
};

const block = (
  stmt: past.Block,
  tenv: TypeEnv,
): Result<Stateful<Block>, ElaborationError> => {
  let result = TypeEff<Type, Senv>(Nil(), Senv());
  let currentTenv = tenv;
  const statements: Statement[] = [];

  for (const decl of stmt.statements) {
    const stmtElaboration = statement(decl, currentTenv);

    if (!stmtElaboration.success) {
      return stmtElaboration;
    }

    const { result: stmt } = stmtElaboration;

    result = stmt.term.typeEff;
    currentTenv = stmt.tenv;

    statements.push(stmt.term);
  }

  return Ok(
    Stateful(
      Block({
        statements,
        typeEff: result,
      }),
      tenv,
    ),
  );
};

export const statement = (
  stmt: past.Statement,
  tenv: TypeEnv = {},
): Result<Stateful<Statement>, ElaborationError> => {
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
export const elaborate = (
  stmts: past.Statement[],
): Result<Statement, ElaborationError> => {
  const block = past.Block({
    statements: stmts,
  });

  const result = statement(block, TypeEnv());

  if (!result.success) {
    return result;
  }

  return Ok(result.result.term);
};
