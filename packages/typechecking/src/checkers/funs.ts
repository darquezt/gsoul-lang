import { Result } from '@badrap/result';
import {
  Senv,
  TypeEff,
  TypeEffUtils,
  TypeEnvUtils,
} from '@gsoul-lang/core/utils';
import { Arrow, typeIsKinded, TypeKind } from '@gsoul-lang/core/utils/Type';
import { Call, Fun } from '@gsoul-lang/parsing/lib/ast';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { expression } from '../checker';
import { isSubTypeEff } from '../subtyping';
import { TypeCheckingError, TypeCheckingTypeError } from '../utils/errors';
import { TypeCheckingResult, TypeCheckingRule } from '../utils/types';

export const fun: TypeCheckingRule<Fun> = (expr, ctx) => {
  const { binders, body } = expr;

  const extensions = binders.map(
    (b) => [b.name.lexeme, b.type] as [string, TypeEff],
  );

  const bodyTC = expression(body, [
    TypeEnvUtils.extendAll(ctx[0], ...extensions),
  ]);

  return bodyTC.map((bodyTC) => ({
    typeEff: TypeEff(
      Arrow({
        domain: binders.map((b) => b.type),
        codomain: bodyTC.typeEff,
      }),
      Senv(),
    ),
    typings: bodyTC.typings,
  }));
};

const checkApplicationCalleeType =
  (paren: Token) =>
  (
    calleeTC: TypeCheckingResult,
  ): Result<TypeCheckingResult<Arrow>, TypeCheckingError> => {
    if (!typeIsKinded(calleeTC.typeEff, TypeKind.Arrow)) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: 'Expression called is not a function',
          operator: paren,
        }),
      );
    }

    return Result.ok(calleeTC as TypeCheckingResult<Arrow>);
  };

const checkCalleeNumberArgs =
  (argsLength: number, paren: Token) =>
  (
    calleeTC: TypeCheckingResult<Arrow>,
  ): Result<TypeCheckingResult, TypeCheckingError> => {
    if (calleeTC.typeEff.type.domain.length !== argsLength) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: 'Number of arguments does not match the number of parameters',
          operator: paren,
        }),
      );
    }

    return Result.ok(calleeTC);
  };

const checkCallSubtyping =
  (paren: Token) =>
  ([calleeTC, argsTC]: [
    TypeCheckingResult<Arrow>,
    TypeCheckingResult[],
  ]): Result<
    [TypeCheckingResult<Arrow>, TypeCheckingResult[]],
    TypeCheckingError
  > => {
    const calleeTypeEff = calleeTC.typeEff;

    const subtypingCondition = argsTC.every((argTC, i) =>
      isSubTypeEff(
        argTC.typeEff,
        TypeEffUtils.ArrowsUtils.domain(calleeTypeEff)[i],
      ),
    );

    if (!subtypingCondition) {
      return Result.err(
        new TypeCheckingTypeError({
          reason:
            'Argument type is not subtype of the expected type in the function',
          operator: paren,
        }),
      );
    }

    return Result.ok([calleeTC, argsTC]);
  };

export const app: TypeCheckingRule<Call> = (expr, ctx) => {
  const calleeTC = expression(expr.callee, ctx)
    .chain(checkApplicationCalleeType(expr.paren))
    .chain(checkCalleeNumberArgs(expr.args.length, expr.paren));

  const argsTC = Result.all(
    expr.args.map((arg) => expression(arg, ctx)),
  ) as unknown as Result<TypeCheckingResult[], TypeCheckingError>;

  return Result.all([calleeTC, argsTC])
    .chain(checkCallSubtyping(expr.paren))
    .map(([calleeTC, argsTC]) => ({
      typeEff: TypeEffUtils.ArrowsUtils.codomain(calleeTC.typeEff),
      typings: calleeTC.typings.concat(...argsTC.map((argTC) => argTC.typings)),
    }));
};
