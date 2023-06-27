import * as past from '@gsoul-lang/parsing/lib/ast';
import { TypeEnv } from '@gsoul-lang/core/utils';

import { Expression, Statement } from './ast';
import { Result } from '@badrap/result';
import {
  ElaborationError,
  ElaborationUnsupportedExpressionError,
} from './errors';

import { ascription } from './elaborations/ascriptions';
import { binary, nonLinearBinary } from './elaborations/binaries';
import { block } from './elaborations/blocks';
import { fold, unfold } from './elaborations/folds';
import { sapp, forall } from './elaborations/foralls';
import { app, fun } from './elaborations/funs';
import { ifExpr } from './elaborations/ifs';
import { inj, caseExpr } from './elaborations/injections';
import { realLiteral, boolLiteral, unitLiteral } from './elaborations/literals';
import { pair, projFst, projSnd } from './elaborations/pairs';
import { tuple, projection } from './elaborations/tuples';
import { variable } from './elaborations/variables';
import { atomLiteral } from './elaborations/atoms';
import { ElaborationContext, Stateful } from './types';
import {
  exprStmt,
  varStmt,
  printStmt,
  defStmt,
} from './elaborations/statements';
import { ResourcesSet } from '@gsoul-lang/core/utils/ResourcesSet';
import { TypevarsSet } from '@gsoul-lang/core/utils/TypevarsSet';
import { poly, tapp } from './elaborations/polys';

export const expression = (
  expr: past.Expression,
  ctx: ElaborationContext,
): Result<Expression, ElaborationError> => {
  switch (expr.kind) {
    case past.ExprKind.Binary:
      return binary(expr, ctx);
    case past.ExprKind.Call:
      return app(expr, ctx);
    case past.ExprKind.SCall:
      return sapp(expr, ctx);
    case past.ExprKind.TCall:
      return tapp(expr, ctx);
    case past.ExprKind.NonLinearBinary:
      return nonLinearBinary(expr, ctx);
    case past.ExprKind.Variable:
      return variable(expr, ctx);
    case past.ExprKind.Fun:
      return fun(expr, ctx);
    case past.ExprKind.Forall:
      return forall(expr, ctx);
    case past.ExprKind.Poly:
      return poly(expr, ctx);
    case past.ExprKind.Literal: {
      if (typeof expr.value === 'number') {
        return Result.ok(realLiteral(expr));
      } else if (typeof expr.value === 'boolean') {
        return Result.ok(boolLiteral(expr));
      } else if (expr.value === null) {
        return Result.ok(unitLiteral());
      }
      return Result.err(
        new ElaborationUnsupportedExpressionError({
          reason: 'Literal type not handled',
        }),
      );
    }
    case past.ExprKind.AtomLiteral:
      return Result.ok(atomLiteral(expr));
    case past.ExprKind.Ascription:
      return ascription(expr, ctx);
    case past.ExprKind.Grouping:
      return expression(expr.expression, ctx);
    case past.ExprKind.Block:
      return block(expr, ctx);
    case past.ExprKind.Tuple:
      return tuple(expr, ctx);
    case past.ExprKind.Projection:
      return projection(expr, ctx);
    case past.ExprKind.Pair:
      return pair(expr, ctx);
    case past.ExprKind.ProjFst:
      return projFst(expr, ctx);
    case past.ExprKind.ProjSnd:
      return projSnd(expr, ctx);
    case past.ExprKind.Fold:
      return fold(expr, ctx);
    case past.ExprKind.Unfold:
      return unfold(expr, ctx);
    case past.ExprKind.If:
      return ifExpr(expr, ctx);
    case past.ExprKind.Inj:
      return inj(expr, ctx);
    case past.ExprKind.Case:
      return caseExpr(expr, ctx);
  }
};

export const statement = (
  stmt: past.Statement,
  ctx: ElaborationContext,
): Result<Stateful<Statement>, ElaborationError> => {
  switch (stmt.kind) {
    case past.StmtKind.ExprStmt:
      return exprStmt(stmt, ctx);
    case past.StmtKind.VarStmt:
      return varStmt(stmt, ctx);
    case past.StmtKind.PrintStmt:
      return printStmt(stmt, ctx);
    case past.StmtKind.DefStmt:
      return defStmt(stmt, ctx);
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

  const result = expression(block, [TypeEnv(), ResourcesSet(), TypevarsSet()]);

  if (!result.isOk) {
    return result;
  }

  return Result.ok(result.value);
};
