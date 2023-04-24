import { Result } from '@badrap/result';
import { TypeEff, Senv, TypeEffUtils } from '@gsoul-lang/core/utils';
import WellFormed, {
  WellFormednessContext,
} from '@gsoul-lang/core/utils/lib/WellFormed';
import * as TypevarsSetUtils from '@gsoul-lang/core/utils/TypevarsSet';
import { PolyT, typeIsKinded, TypeKind } from '@gsoul-lang/core/utils/Type';
import { Poly, TCall } from '@gsoul-lang/parsing/lib/ast';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { expression } from '../checker';
import { TypeCheckingError, TypeCheckingTypeError } from '../utils/errors';
import { TypeCheckingRule, TypeCheckingResult } from '../utils/types';
import { TypeEffect } from '@gsoul-lang/core/utils/TypeEff';

export const poly: TypeCheckingRule<Poly> = (expr, ctx) => {
  const { expr: inner, typeVars } = expr;

  const [tenv, rset, typevarsSet] = ctx;

  const bodyTC = expression(inner, [
    tenv,
    rset,
    TypevarsSetUtils.extendAll(typevarsSet, ...typeVars.map((v) => v.lexeme)),
  ]);

  return bodyTC.map((bodyTC) => ({
    typeEff: TypeEff(
      PolyT({
        typeVars: typeVars.map((v) => v.lexeme),
        codomain: bodyTC.typeEff,
      }),
      Senv(),
    ),
    typings: bodyTC.typings,
  }));
};

const checkTappSenv =
  (ctx: WellFormednessContext, args: TypeEffect[], bracket: Token) =>
  (
    calleeTC: TypeCheckingResult,
  ): Result<TypeCheckingResult, TypeCheckingError> => {
    if (!args.every((teff) => WellFormed.TypeEffect(ctx, teff))) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: 'Arguments of type application are not valid',
          operator: bracket,
        }),
      );
    }

    return Result.ok(calleeTC);
  };

const checkTappCalleeType =
  (bracket: Token) =>
  (
    calleeTC: TypeCheckingResult,
  ): Result<TypeCheckingResult<TypeEff<PolyT>>, TypeCheckingError> => {
    if (!typeIsKinded(calleeTC.typeEff, TypeKind.PolyT)) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: 'Expression called is not a polymorphic expression',
          operator: bracket,
        }),
      );
    }

    return Result.ok(calleeTC as TypeCheckingResult<TypeEff<PolyT>>);
  };

const checkTappNumberArgs =
  (argsLength: number, bracket: Token) =>
  (
    calleeTC: TypeCheckingResult<TypeEff<PolyT>>,
  ): Result<TypeCheckingResult<TypeEff<PolyT>>, TypeCheckingError> => {
    if (calleeTC.typeEff.type.typeVars.length !== argsLength) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: 'Number of arguments does not match the number of parameters',
          operator: bracket,
        }),
      );
    }

    return Result.ok(calleeTC);
  };

export const tapp: TypeCheckingRule<TCall> = (expr, ctx) => {
  const calleeTC = expression(expr.callee, ctx)
    .chain(checkTappSenv([ctx[1]], expr.args, expr.bracket))
    .chain(checkTappCalleeType(expr.bracket))
    .chain(checkTappNumberArgs(expr.args.length, expr.bracket));

  return calleeTC.map((calleeTC) => ({
    typeEff: TypeEffUtils.PolysUtils.instance(calleeTC.typeEff, expr.args),
    typings: calleeTC.typings,
  }));
};
