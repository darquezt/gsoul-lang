import { Result } from '@badrap/result';
import {
  Sens,
  Senv,
  SenvUtils,
  TypeEff,
  TypeEnvUtils,
} from '@gsoul-lang/core/utils';
import * as ResourcesSetUtils from '@gsoul-lang/core/utils/ResourcesSet';
import { TypeEffectKind } from '@gsoul-lang/core/utils/TypeEff';
import { ExprStmt, PrintStmt, VarStmt } from '@gsoul-lang/parsing/lib/ast';
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

    return Result.ok(exprTC);
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
      typings: [[stmt.name, exprTC.typeEff] as TypeAssoc].concat(
        exprTC.typings,
      ),
      ctx: [newTenv, newRset, ...rest],
    };
  });
};
