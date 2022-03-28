import * as past from '@gsens-lang/parsing/lib/ast';
import {
  Sens,
  Senv,
  SenvUtils,
  Type,
  TypeEnv,
  TypeEnvUtils,
  TypeEff,
  TypeEffUtils,
} from '@gsens-lang/core/utils';
import {
  AProduct,
  Arrow,
  ForallT,
  MProduct,
  Nil,
  typeIsKinded,
  TypeKind,
} from '@gsens-lang/core/utils/Type';

import {
  Ascription,
  Binary,
  Block,
  BoolLiteral,
  Call,
  Expression,
  ExpressionUtils,
  ExprStmt,
  Forall,
  Fun,
  NilLiteral,
  NonLinearBinary,
  Pair,
  Print,
  ProjFst,
  ProjSnd,
  RealLiteral,
  SCall,
  Statement,
  Tuple,
  Untup,
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

  const bodyElaboration = expression(
    expr.body,
    TypeEnvUtils.extend(tenv, varName, expr.binder.type),
  );

  if (!bodyElaboration.success) {
    return bodyElaboration;
  }

  const { result: body } = bodyElaboration;

  const lambda = Fun({
    binder: expr.binder,
    body,
    typeEff: TypeEff(
      Arrow({
        domain: expr.binder.type,
        codomain: body.typeEff,
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

const forall = (
  expr: past.Forall,
  tenv: TypeEnv,
): Result<Ascription, ElaborationError> => {
  const bodyElaboration = expression(expr.expr, tenv);

  if (!bodyElaboration.success) {
    return bodyElaboration;
  }

  const { result: body } = bodyElaboration;

  const lambda = Forall({
    sensVars: expr.sensVars,
    expr: body,
    typeEff: TypeEff(
      ForallT({
        sensVars: expr.sensVars.map((v) => v.lexeme),
        codomain: body.typeEff,
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

  const calleeTypeEff = callee.typeEff;

  if (!typeIsKinded(calleeTypeEff, TypeKind.Arrow)) {
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

  const calleeArgType = TypeEffUtils.ArrowsUtils.domain(calleeTypeEff);

  const evidence = interior(arg.typeEff, calleeArgType);

  if (!evidence.success) {
    return Err(
      ElaborationSubtypingError({
        reason:
          'Argument type is not subtype of the expected type in the function',
        operator: expr.paren,
        superType: calleeArgType,
        type: arg.typeEff,
      }),
    );
  }

  return Ok(
    Call({
      callee,
      arg: Ascription({
        evidence: evidence.result,
        typeEff: calleeArgType,
        expression: arg,
      }),
      paren: expr.paren,
      typeEff: TypeEffUtils.ArrowsUtils.codomain(calleeTypeEff),
    }),
  );
};

const sapp = (
  expr: past.SCall,
  tenv: TypeEnv,
): Result<SCall, ElaborationError> => {
  const calleeElaboration = expression(expr.callee, tenv);

  if (!calleeElaboration.success) {
    return calleeElaboration;
  }

  const { result: callee } = calleeElaboration;

  const calleeTypeEff = callee.typeEff;

  if (!typeIsKinded(calleeTypeEff, TypeKind.ForallT)) {
    return Err(
      ElaborationTypeError({
        reason: 'Expression called is not a sensitivity quantification',
        operator: expr.bracket,
      }),
    );
  }

  return Ok(
    SCall({
      callee,
      arg: expr.arg,
      bracket: expr.bracket,
      typeEff: TypeEffUtils.ForallsUtils.instance(calleeTypeEff, expr.arg),
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

const printExpr = (
  expr: past.Print,
  tenv: TypeEnv,
): Result<Print, ElaborationError> => {
  const exprElaboration = expression(expr.expression, tenv);

  if (!exprElaboration.success) {
    return exprElaboration;
  }

  const { result: inner } = exprElaboration;

  return Ok(
    Print({
      expression: inner,
      typeEff: inner.typeEff,
      showEvidence: expr.showEvidence,
    }),
  );
};

const block = (
  expr: past.Block,
  tenv: TypeEnv,
): Result<Block, ElaborationError> => {
  let result = TypeEff<Type, Senv>(Nil(), Senv());
  let currentTenv = tenv;
  const statements: Statement[] = [];

  for (const decl of expr.statements) {
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
    Block({
      statements,
      typeEff: result,
    }),
  );
};

const tuple = (
  expr: past.Tuple,
  tenv: TypeEnv,
): Result<Ascription, ElaborationError> => {
  const firstElaboration = expression(expr.first, tenv);

  if (!firstElaboration.success) {
    return firstElaboration;
  }

  const secondElaboration = expression(expr.second, tenv);

  if (!secondElaboration.success) {
    return secondElaboration;
  }

  const typeEff = TypeEff(
    MProduct({
      first: firstElaboration.result.typeEff,
      second: secondElaboration.result.typeEff,
    }),
    Senv(),
  );

  const evidence = initialEvidence(typeEff);

  return Ok(
    Ascription({
      evidence,
      expression: Tuple({
        first: firstElaboration.result,
        second: secondElaboration.result,
        typeEff,
      }),
      typeEff,
    }),
  );
};

const untup = (
  expr: past.Untup,
  tenv: TypeEnv,
): Result<Untup, ElaborationError> => {
  const tuplElaboration = expression(expr.tuple, tenv);

  if (!tuplElaboration.success) {
    return tuplElaboration;
  }

  const [x1, x2] = expr.identifiers;

  const bodyElaboration = expression(
    expr.body,
    TypeEnvUtils.extend(
      TypeEnvUtils.extend(
        tenv,
        x1.lexeme,
        TypeEff(
          tuplElaboration.result.typeEff.type,
          Senv({ [x1.lexeme]: Sens(1) }),
        ),
      ),
      x2.lexeme,
      TypeEff(
        tuplElaboration.result.typeEff.type,
        Senv({ [x2.lexeme]: Sens(1) }),
      ),
    ),
  );

  if (!bodyElaboration.success) {
    return bodyElaboration;
  }

  const tuplType = tuplElaboration.result.typeEff.type;

  if (tuplType.kind !== 'MProduct') {
    return Err(
      ElaborationTypeError({
        reason: 'The expression being unstructured is not a tuple',
        operator: expr.untupToken,
      }),
    );
  }

  const body = ExpressionUtils.substTup(
    bodyElaboration.result,
    [x1.lexeme, x2.lexeme],
    [tuplType.first.effect, tuplType.second.effect],
    tuplElaboration.result.typeEff.effect,
  );

  return Ok(
    Untup({
      body,
      tuple: tuplElaboration.result,
      typeEff: body.typeEff,
      identifiers: expr.identifiers,
      untupToken: expr.untupToken,
    }),
  );
};

const pair = (
  expr: past.Pair,
  tenv: TypeEnv,
): Result<Ascription, ElaborationError> => {
  const firstElaboration = expression(expr.first, tenv);

  if (!firstElaboration.success) {
    return firstElaboration;
  }

  const secondElaboration = expression(expr.second, tenv);

  if (!secondElaboration.success) {
    return secondElaboration;
  }

  const typeEff = TypeEff(
    AProduct({
      first: firstElaboration.result.typeEff,
      second: secondElaboration.result.typeEff,
    }),
    Senv(),
  );

  const evidence = initialEvidence(typeEff);

  return Ok(
    Ascription({
      evidence,
      expression: Pair({
        first: firstElaboration.result,
        second: secondElaboration.result,
        typeEff,
      }),
      typeEff,
    }),
  );
};

const projFst = (
  expr: past.ProjFst,
  tenv: TypeEnv,
): Result<ProjFst, ElaborationError> => {
  const pairElaboration = expression(expr.pair, tenv);

  if (!pairElaboration.success) {
    return pairElaboration;
  }

  const pairTypeEff = pairElaboration.result.typeEff;

  if (!typeIsKinded(pairTypeEff, TypeKind.AProduct)) {
    return Err(
      ElaborationTypeError({
        reason: 'The expression being projected must be a pair',
        operator: expr.projToken,
      }),
    );
  }

  return Ok(
    ProjFst({
      pair: pairElaboration.result,
      projToken: expr.projToken,
      typeEff: TypeEffUtils.AdditiveProductsUtils.firstProjection(pairTypeEff),
    }),
  );
};

const projSnd = (
  expr: past.ProjSnd,
  tenv: TypeEnv,
): Result<ProjSnd, ElaborationError> => {
  const pairElaboration = expression(expr.pair, tenv);

  if (!pairElaboration.success) {
    return pairElaboration;
  }

  const pairTypeEff = pairElaboration.result.typeEff;

  if (!typeIsKinded(pairTypeEff, TypeKind.AProduct)) {
    return Err(
      ElaborationTypeError({
        reason: 'The expression being projected must be a pair',
        operator: expr.projToken,
      }),
    );
  }

  return Ok(
    ProjSnd({
      pair: pairElaboration.result,
      projToken: expr.projToken,
      typeEff: TypeEffUtils.AdditiveProductsUtils.secondProjection(pairTypeEff),
    }),
  );
};

export const expression = (
  expr: past.Expression,
  tenv: TypeEnv = {},
): Result<Expression, ElaborationError> => {
  switch (expr.kind) {
    case past.ExprKind.Binary:
      return binary(expr, tenv);
    case past.ExprKind.Call:
      return app(expr, tenv);
    case past.ExprKind.SCall:
      return sapp(expr, tenv);
    case past.ExprKind.NonLinearBinary:
      return nonLinearBinary(expr, tenv);
    case past.ExprKind.Variable:
      return variable(expr, tenv);
    case past.ExprKind.Fun:
      return fun(expr, tenv);
    case past.ExprKind.Forall:
      return forall(expr, tenv);
    case past.ExprKind.Literal: {
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
    case past.ExprKind.Ascription:
      return ascription(expr, tenv);
    case past.ExprKind.Grouping:
      return expression(expr.expression, tenv);
    case past.ExprKind.Print:
      return printExpr(expr, tenv);
    case past.ExprKind.Block:
      return block(expr, tenv);
    case past.ExprKind.Tuple:
      return tuple(expr, tenv);
    case past.ExprKind.Untup:
      return untup(expr, tenv);
    case past.ExprKind.Pair:
      return pair(expr, tenv);
    case past.ExprKind.ProjFst:
      return projFst(expr, tenv);
    case past.ExprKind.ProjSnd:
      return projSnd(expr, tenv);
  }
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

export const statement = (
  stmt: past.Statement,
  tenv: TypeEnv = {},
): Result<Stateful<Statement>, ElaborationError> => {
  switch (stmt.kind) {
    case past.StmtKind.ExprStmt:
      return exprStmt(stmt, tenv);
    case past.StmtKind.VarStmt:
      return varStmt(stmt, tenv);
  }
};

/**
 * @throws {ElaborationError}
 */
export const elaborate = (
  stmts: past.Statement[],
): Result<Expression, ElaborationError> => {
  const block = past.Block({
    statements: stmts,
  });

  const result = expression(block, TypeEnv());

  if (!result.success) {
    return result;
  }

  return Ok(result.result);
};
