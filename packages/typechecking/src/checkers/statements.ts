import { Result } from '@badrap/result';
import {
  Sens,
  Senv,
  SenvUtils,
  TypeEff,
  TypeEnvUtils,
} from '@gsoul-lang/core/utils';
import * as ResourcesSetUtils from '@gsoul-lang/core/utils/ResourcesSet';
import { TypeEffect, TypeEffectKind } from '@gsoul-lang/core/utils/TypeEff';
import {
  DefStmt,
  ExprStmt,
  PrintStmt,
  VarStmt,
} from '@gsoul-lang/parsing/lib/ast';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { expression } from '../checker';
import { isSubTypeEff } from '../subtyping';
import {
  TypeCheckingDependencyError,
  TypeCheckingError,
  TypeCheckingSubtypingError,
  TypeCheckingTypeError,
} from '../utils/errors';
import {
  TypeCheckingResult,
  TypeCheckingContext,
  StatefulTypeCheckingRule,
} from '../utils/types';
import { TypeAssoc } from '../utils/typingSeeker';
import { Arrow, ForallT, PolyT } from '@gsoul-lang/core/utils/Type';
import * as TypevarsSetUtils from '@gsoul-lang/core/utils/TypevarsSet';

const toStateful = (
  result: Result<TypeCheckingResult, TypeCheckingError>,
  ctx: TypeCheckingContext,
) =>
  result.chain((tc) =>
    Result.ok({
      typeEff: tc.typeEff,
      typings: tc.typings,
      ctx,
    }),
  );

export const exprStmt: StatefulTypeCheckingRule<ExprStmt> = (stmt, ctx) => {
  const exprTC = expression(stmt.expression, ctx);

  return toStateful(exprTC, ctx);
};

export const printStmt: StatefulTypeCheckingRule<PrintStmt> = (stmt, ctx) => {
  const exprTC = expression(stmt.expression, ctx);

  return toStateful(exprTC, ctx);
};

const checkAssignmentType =
  (colon: Token, type?: TypeEff) =>
  (
    exprTC: TypeCheckingResult,
  ): Result<TypeCheckingResult, TypeCheckingError> => {
    if (!type) {
      return Result.ok(exprTC);
    }

    if (!isSubTypeEff(exprTC.typeEff, type)) {
      return Result.err(
        new TypeCheckingSubtypingError({
          reason: 'Expression type is not a subtype of the declared type',
          operator: colon,
        }),
      );
    }

    return Result.ok({
      typeEff: type,
      typings: exprTC.typings,
    });
  };

const resourcifyIfNecessary =
  (resource: boolean, name: Token) =>
  (
    exprTC: TypeCheckingResult,
  ): Result<TypeCheckingResult, TypeCheckingError> => {
    if (!resource) {
      return Result.ok(exprTC);
    }

    const originalTypeEff = exprTC.typeEff;

    if (originalTypeEff.kind !== TypeEffectKind.TypeEff) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: 'Resource must have a concrete type-and-effect',
          operator: name,
        }),
      );
    }

    if (!SenvUtils.isEmpty(originalTypeEff.effect)) {
      return Result.err(
        new TypeCheckingDependencyError({
          reason: 'Resources cannot depend on other resources',
          variable: name,
        }),
      );
    }

    const typeEff = TypeEff(
      originalTypeEff.type,
      Senv({ [name.lexeme]: new Sens(1) }),
    );

    return Result.ok({
      typeEff,
      typings: exprTC.typings,
    });
  };

export const varStmt: StatefulTypeCheckingRule<VarStmt> = (stmt, ctx) => {
  const exprTC = expression(stmt.assignment, ctx)
    .chain(checkAssignmentType(stmt.colon ?? stmt.name, stmt.type))
    .chain(resourcifyIfNecessary(stmt.resource, stmt.name));

  return exprTC.map((exprTC) => {
    const [tenv, rset, ...rest] = ctx;

    const newTenv = TypeEnvUtils.extend(tenv, stmt.name.lexeme, exprTC.typeEff);
    const newRset = stmt.resource
      ? ResourcesSetUtils.extend(rset, stmt.name.lexeme)
      : rset;

    return {
      typeEff: exprTC.typeEff,
      typings: [[stmt.name, stmt.type ?? exprTC.typeEff] as TypeAssoc].concat(
        exprTC.typings,
      ),
      ctx: [newTenv, newRset, ...rest],
    };
  });
};

const checkReturnSubtyping =
  (returnType: TypeEffect, colon: Token) =>
  (
    bodyTC: TypeCheckingResult<TypeEffect>,
  ): Result<TypeCheckingResult, TypeCheckingError> => {
    if (!isSubTypeEff(bodyTC.typeEff, returnType)) {
      return Result.err(
        new TypeCheckingSubtypingError({
          reason: 'Body type is not a subtype of the declared return type',
          operator: colon,
        }),
      );
    }

    return Result.ok(bodyTC);
  };

export const defStmt: StatefulTypeCheckingRule<DefStmt> = (stmt, ctx) => {
  const resourceParams = stmt.resourceParams?.map((param) => param.lexeme);
  const typeParams = stmt.typeParams?.map((param) => ({
    identifier: param.identifier.lexeme,
    directives: param.directives,
  }));

  const arrowTypeEff = TypeEff(
    Arrow({
      domain: stmt.binders.map((b) => b.type),
      codomain: stmt.returnType,
    }),
    Senv(),
  );

  const forallTypeEff = resourceParams
    ? TypeEff(
        ForallT({
          sensVars: resourceParams,
          codomain: arrowTypeEff,
        }),
        Senv(),
      )
    : arrowTypeEff;

  const polyTypeEff = typeParams
    ? TypeEff(
        PolyT({
          typeVars: typeParams,
          codomain: forallTypeEff,
        }),
        Senv(),
      )
    : forallTypeEff;

  const bodyTC = expression(stmt.body, [
    TypeEnvUtils.extendAll(
      ctx[0],
      [stmt.name.lexeme, polyTypeEff],
      ...stmt.binders.map<[string, TypeEffect]>((b) => [b.name.lexeme, b.type]),
    ),
    ResourcesSetUtils.extendAll(ctx[1], ...(resourceParams ?? [])),
    TypevarsSetUtils.extendAll(
      ctx[2],
      ...(typeParams ?? []).map((tp) => tp.identifier),
    ),
  ]).chain(checkReturnSubtyping(stmt.returnType, stmt.colon));

  return bodyTC.map((bodyTC) => {
    const [tenv, ...rest] = ctx;

    const newTenv = TypeEnvUtils.extend(tenv, stmt.name.lexeme, polyTypeEff);

    return {
      typeEff: polyTypeEff,
      typings: [[stmt.name, polyTypeEff] as TypeAssoc].concat(bodyTC.typings),
      ctx: [newTenv, ...rest],
    };
  });
};
