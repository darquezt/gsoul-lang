import { Result } from '@badrap/result';
import {
  SenvUtils,
  TypeEff,
  Senv,
  Sens,
  TypeEnvUtils,
} from '@gsoul-lang/core/utils';
import { ExprStmt, PrintStmt, VarStmt, Ascription, Expression } from '../ast';
import { expression } from '../elaboration';
import {
  ElaborationError,
  ElaborationDependencyError,
  ElaborationSubtypingError,
} from '../errors';
import { ElaborationContext, Stateful } from '../types';
import * as past from '@gsoul-lang/parsing/lib/ast';
import { interior } from '../../utils/Evidence';
import { Token } from '@gsoul-lang/parsing/lib/lexing';

export const exprStmt = (
  stmt: past.ExprStmt,
  ctx: ElaborationContext,
): Result<Stateful<ExprStmt>, ElaborationError> => {
  const exprElaboration = expression(stmt.expression, ctx);

  if (!exprElaboration.isOk) {
    return Result.err(exprElaboration.error);
  }

  const { value: expr } = exprElaboration;

  return Result.ok(
    Stateful(
      ExprStmt({
        expression: expr,
        typeEff: expr.typeEff,
      }),
      ctx,
    ),
  );
};

export const printStmt = (
  stmt: past.PrintStmt,
  ctx: ElaborationContext,
): Result<Stateful<PrintStmt>, ElaborationError> => {
  const exprElaboration = expression(stmt.expression, ctx);

  if (!exprElaboration.isOk) {
    return Result.err(exprElaboration.error);
  }

  const { value: expr } = exprElaboration;

  return Result.ok(
    Stateful(
      PrintStmt({
        expression: expr,
        typeEff: expr.typeEff,
        showEvidence: stmt.showEvidence,
      }),
      ctx,
    ),
  );
};

const checkAssignmentType =
  (colon: Token, type?: TypeEff) =>
  (expr: Expression): Result<Expression, ElaborationError> => {
    if (!type) {
      return Result.ok(expr);
    }

    const evidence = interior(expr.typeEff, type);

    if (evidence.isErr) {
      return Result.err(
        new ElaborationSubtypingError({
          reason: 'Expression type is not a subtype of the declared type',
          operator: colon,
        }),
      );
    }

    return Result.ok(
      Ascription({
        expression: expr,
        typeEff: type,
        evidence: evidence.value,
      }),
    );
  };

export const varStmt = (
  stmt: past.VarStmt,
  ctx: ElaborationContext,
): Result<Stateful<VarStmt>, ElaborationError> => {
  const exprElaboration = expression(stmt.assignment, ctx).chain(
    checkAssignmentType(stmt.colon ?? stmt.name, stmt.type),
  );

  if (!exprElaboration.isOk) {
    return Result.err(exprElaboration.error);
  }

  let expr = exprElaboration.value;

  if (stmt.resource) {
    if (!SenvUtils.isEmpty(expr.typeEff.effect)) {
      return Result.err(
        new ElaborationDependencyError({
          reason: 'Resources cannot depend on other resources',
          variable: stmt.name,
        }),
      );
    }

    const typeEff = TypeEff(
      expr.typeEff.type,
      Senv({ [stmt.name.lexeme]: new Sens(1) }),
    );

    expr = Ascription({
      expression: expr,
      typeEff: typeEff,
      evidence: [expr.typeEff, typeEff],
    });
  }

  const [tenv, rset] = ctx;

  return Result.ok(
    Stateful(
      VarStmt({
        name: stmt.name,
        assignment: expr,
        typeEff: expr.typeEff,
      }),
      [TypeEnvUtils.extend(tenv, stmt.name.lexeme, expr.typeEff), rset],
    ),
  );
};
