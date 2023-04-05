import {
  Block,
  Expression,
  ExprKind,
  Statement,
  StmtKind,
} from '@gsoul-lang/parsing/lib/ast';
import { TypeEnv, TypeEff } from '@gsoul-lang/core/utils';

import { TypingSeeker } from './utils/typingSeeker';
import { TypeCheckingError } from './utils/errors';
import { Result } from '@badrap/result';

import { StatefulTypeCheckingRule, TypeCheckingRule } from './utils/types';

// Checkers
import { boolLit, nilLit, realLit } from './checkers/literals';
import { ascription } from './checkers/ascriptions';
import { binary, nonLinearBinary } from './checkers/binary';
import { block } from './checkers/blocks';
import { fold, unfold } from './checkers/folds';
import { sapp, forall } from './checkers/foralls';
import { app, fun } from './checkers/funs';
import { ifExpr } from './checkers/ifs';
import { inj, caseExpr } from './checkers/injections';
import { pair, projFst, projSnd } from './checkers/pairs';
import { tuple, projection } from './checkers/tuples';
import { variable } from './checkers/variables';
import { exprStmt, varStmt, printStmt } from './checkers/statements';
import { ResourcesSet } from '@gsoul-lang/core/utils/ResourcesSet';

export const expression: TypeCheckingRule<Expression> = (expr, ctx) => {
  switch (expr.kind) {
    case ExprKind.Literal: {
      const { value } = expr;

      switch (typeof value) {
        case 'number':
          return realLit(expr, ctx);
        case 'boolean':
          return boolLit(expr, ctx);
        default:
          return nilLit(expr, ctx);
      }
    }
    case ExprKind.Binary:
      return binary(expr, ctx);
    case ExprKind.Call:
      return app(expr, ctx);
    case ExprKind.SCall:
      return sapp(expr, ctx);
    case ExprKind.NonLinearBinary:
      return nonLinearBinary(expr, ctx);
    case ExprKind.Variable:
      return variable(expr, ctx);
    case ExprKind.Fun:
      return fun(expr, ctx);
    case ExprKind.Forall:
      return forall(expr, ctx);
    case ExprKind.Ascription:
      return ascription(expr, ctx);
    case ExprKind.Grouping:
      return expression(expr.expression, ctx);
    case ExprKind.Block:
      return block(expr, ctx);
    case ExprKind.Tuple:
      return tuple(expr, ctx);
    case ExprKind.Projection:
      return projection(expr, ctx);
    case ExprKind.Pair:
      return pair(expr, ctx);
    case ExprKind.ProjFst:
      return projFst(expr, ctx);
    case ExprKind.ProjSnd:
      return projSnd(expr, ctx);
    case ExprKind.Fold:
      return fold(expr, ctx);
    case ExprKind.Unfold:
      return unfold(expr, ctx);
    case ExprKind.If:
      return ifExpr(expr, ctx);
    case ExprKind.Inj:
      return inj(expr, ctx);
    case ExprKind.Case:
      return caseExpr(expr, ctx);
  }
};

export const statement: StatefulTypeCheckingRule = (stmt, ctx) => {
  switch (stmt.kind) {
    case StmtKind.ExprStmt:
      return exprStmt(stmt, ctx);
    case StmtKind.VarStmt:
      return varStmt(stmt, ctx);
    case StmtKind.PrintStmt:
      return printStmt(stmt, ctx);
  }
};

export type TypeChecking = {
  typeEff: TypeEff;
  typings: TypingSeeker;
};

export const typeCheck = (
  statements: Statement[],
): Result<TypeChecking, TypeCheckingError> => {
  const tc = expression(Block({ statements }), [TypeEnv(), ResourcesSet()]);

  return tc.chain((tc) => {
    const typings = new TypingSeeker(tc.typings);

    return Result.ok({
      typeEff: tc.typeEff,
      typings,
    });
  });
};
