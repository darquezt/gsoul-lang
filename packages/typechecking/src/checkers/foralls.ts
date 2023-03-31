import { Result } from '@badrap/result';
import { TypeEff, Senv, TypeEffUtils } from '@gsoul-lang/core/utils';
import { ForallT, typeIsKinded, TypeKind } from '@gsoul-lang/core/utils/Type';
import { Forall, SCall } from '@gsoul-lang/parsing/lib/ast';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { expression } from '../checker';
import { TypeCheckingError, TypeCheckingTypeError } from '../utils/errors';
import { TypeCheckingRule, TypeCheckingResult } from '../utils/types';

export const forall: TypeCheckingRule<Forall> = (expr, ctx) => {
  const { expr: inner, sensVars } = expr;

  const bodyTC = expression(inner, ctx);

  return bodyTC.map((bodyTC) => ({
    typeEff: TypeEff(
      ForallT({
        sensVars: sensVars.map((v) => v.lexeme),
        codomain: bodyTC.typeEff,
      }),
      Senv(),
    ),
    typings: bodyTC.typings,
  }));
};

const checkSappCalleeType =
  (bracket: Token) =>
  (
    calleeTC: TypeCheckingResult,
  ): Result<TypeCheckingResult<ForallT>, TypeCheckingError> => {
    if (!typeIsKinded(calleeTC.typeEff, TypeKind.ForallT)) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: 'Expression called is not a sensitive quantification',
          operator: bracket,
        }),
      );
    }

    return Result.ok(calleeTC as TypeCheckingResult<ForallT>);
  };

const checkSappNumberArgs =
  (argsLength: number, bracket: Token) =>
  (
    calleeTC: TypeCheckingResult<ForallT>,
  ): Result<TypeCheckingResult<ForallT>, TypeCheckingError> => {
    if (calleeTC.typeEff.type.sensVars.length !== argsLength) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: 'Number of arguments does not match the number of parameters',
          operator: bracket,
        }),
      );
    }

    return Result.ok(calleeTC);
  };

export const sapp: TypeCheckingRule<SCall> = (expr, ctx) => {
  const calleeTC = expression(expr.callee, ctx)
    .chain(checkSappCalleeType(expr.bracket))
    .chain(checkSappNumberArgs(expr.args.length, expr.bracket));

  return calleeTC.map((calleeTC) => ({
    typeEff: TypeEffUtils.ForallsUtils.instance(calleeTC.typeEff, expr.args),
    typings: calleeTC.typings,
  }));
};
