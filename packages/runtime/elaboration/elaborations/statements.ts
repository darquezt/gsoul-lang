import { Result } from '@badrap/result';
import {
  SenvUtils,
  TypeEff,
  Senv,
  Sens,
  TypeEnvUtils,
} from '@gsoul-lang/core/utils';
import {
  ExprStmt,
  PrintStmt,
  VarStmt,
  Ascription,
  Expression,
  FixPoint,
  Fun,
  Poly,
  Forall,
} from '../ast';
import { expression } from '../elaboration';
import {
  ElaborationError,
  ElaborationDependencyError,
  ElaborationSubtypingError,
  ElaborationTypeError,
} from '../errors';
import { ElaborationContext, Stateful } from '../types';
import * as past from '@gsoul-lang/parsing/lib/ast';
import { initialEvidence, interior } from '../../utils/Evidence';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import * as ResourcesSetUtils from '@gsoul-lang/core/utils/ResourcesSet';
import { isKinded } from '@gsoul-lang/core/utils/ADT';
import { TypeEffect, TypeEffectKind } from '@gsoul-lang/core/utils/TypeEff';
import { Arrow, ForallT, PolyT } from '@gsoul-lang/core/utils/Type';
import * as TypevarsSetUtils from '@gsoul-lang/core/utils/TypevarsSet';

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

  const [tenv, rset, ...rest] = ctx;

  if (stmt.resource) {
    if (!isKinded(expr.typeEff, TypeEffectKind.TypeEff)) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'Resources must have concrete type-and-effects',
          operator: stmt.name,
        }),
      );
    }

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

  const newTenv = TypeEnvUtils.extend(tenv, stmt.name.lexeme, expr.typeEff);
  const newRset = stmt.resource
    ? ResourcesSetUtils.extend(rset, stmt.name.lexeme)
    : rset;

  return Result.ok(
    Stateful(
      VarStmt({
        name: stmt.name,
        assignment: expr,
        typeEff: expr.typeEff,
      }),
      [newTenv, newRset, ...rest],
    ),
  );
};

export const defStmt = (
  stmt: past.DefStmt,
  ctx: ElaborationContext,
): Result<Stateful<VarStmt>, ElaborationError> => {
  const resourceParams = stmt.resourceParams?.map((rp) => rp.lexeme);
  const typeParams = stmt.typeParams?.map((tp) => ({
    identifier: tp.identifier.lexeme,
    directives: tp.directives,
  }));

  const arrowTypeEff = TypeEff(
    Arrow({
      domain: stmt.binders.map((b) => b.type),
      codomain: stmt.returnType,
    }),
    Senv(),
  );

  const polyTypeEff = typeParams
    ? TypeEff(
        PolyT({
          typeVars: typeParams,
          codomain: arrowTypeEff,
        }),
        Senv(),
      )
    : arrowTypeEff;

  const forallTypeEff = resourceParams
    ? TypeEff(
        ForallT({
          sensVars: resourceParams,
          codomain: polyTypeEff,
        }),
        Senv(),
      )
    : polyTypeEff;

  const bodyElaboration = expression(stmt.body, [
    // TypeEnvUtils.extend(ctx[0], stmt.name.lexeme, forallTypeEff),
    TypeEnvUtils.extendAll(
      ctx[0],
      [stmt.name.lexeme, forallTypeEff],
      ...stmt.binders.map<[string, TypeEffect]>((b) => [b.name.lexeme, b.type]),
    ),
    ResourcesSetUtils.extendAll(ctx[1], ...(resourceParams ?? [])),
    TypevarsSetUtils.extendAll(
      ctx[2],
      ...(typeParams ?? []).map((tp) => tp.identifier),
    ),
  ]);

  const assignment = bodyElaboration.map((expr) => {
    const lambdaEvidence = initialEvidence(arrowTypeEff);
    const lambda = Ascription({
      evidence: lambdaEvidence,
      expression: Fun({
        binders: stmt.binders,
        body: expr,
        typeEff: arrowTypeEff,
      }),
      typeEff: arrowTypeEff,
    });

    let poly = lambda;

    if (stmt.typeParams) {
      poly = Ascription({
        evidence: initialEvidence(polyTypeEff),
        expression: Poly({
          typeVars: stmt.typeParams,
          expr: lambda,
          typeEff: polyTypeEff as TypeEff<PolyT>,
        }),
        typeEff: polyTypeEff,
      });
    }

    let forall = poly;

    if (stmt.resourceParams) {
      forall = Ascription({
        evidence: initialEvidence(forallTypeEff),
        expression: Forall({
          sensVars: stmt.resourceParams,
          expr: poly,
          typeEff: forallTypeEff as TypeEff<ForallT>,
        }),
        typeEff: forallTypeEff,
      });
    }

    return Ascription({
      evidence: initialEvidence(forallTypeEff),
      expression: FixPoint({
        body: forall,
        typeEff: forallTypeEff,
        name: stmt.name,
      }),
      typeEff: forallTypeEff,
    });
  });

  return assignment.map((assignment) =>
    Stateful(
      VarStmt({
        name: stmt.name,
        assignment,
        typeEff: assignment.typeEff,
      }),
      [
        TypeEnvUtils.extend(ctx[0], stmt.name.lexeme, forallTypeEff),
        ctx[1],
        ctx[2],
      ],
    ),
  );
};
