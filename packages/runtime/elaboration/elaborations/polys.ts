import { Result } from '@badrap/result';
import { TypeEff, Senv, TypeEffUtils } from '@gsoul-lang/core/utils';
import { PolyT, typeIsKinded, TypeKind } from '@gsoul-lang/core/utils/Type';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { initialEvidence } from '../../utils/Evidence';
import { Ascription, Expression, Poly, TCall } from '../ast';
import { expression } from '../elaboration';
import { ElaborationError, ElaborationTypeError } from '../errors';
import * as past from '@gsoul-lang/parsing/lib/ast';
import { ElaborationContext } from '../types';
import * as TypevarsSetUtils from '@gsoul-lang/core/utils/TypevarsSet';
import WellFormed, {
  WellFormednessContext,
} from '@gsoul-lang/core/utils/lib/WellFormed';
import { TypeEffect } from '@gsoul-lang/core/utils/TypeEff';
import {
  Directive,
  PureDirective,
} from '@gsoul-lang/core/utils/lib/TypeDirectives';
import { zip } from 'ramda';
import { ConcreteTypeEff } from '../utils/auxiliaryCheckers';

export const poly = (
  expr: past.Poly,
  [tenv, rset, tvars]: ElaborationContext,
): Result<Ascription, ElaborationError> => {
  const bodyElaboration = expression(expr.expr, [
    tenv,
    rset,
    TypevarsSetUtils.extendAll(
      tvars,
      ...expr.typeVars.map((v) => v.identifier.lexeme),
    ),
  ]);

  return bodyElaboration.map((body) => {
    const lambda = Poly({
      typeVars: expr.typeVars,
      expr: body,
      typeEff: TypeEff(
        PolyT({
          typeVars: expr.typeVars.map((v) => ({
            identifier: v.identifier.lexeme,
            directives: v.directives,
          })),
          codomain: body.typeEff,
        }),
        Senv(),
      ),
    });

    const evidence = initialEvidence(lambda.typeEff);

    return Ascription({
      expression: lambda,
      evidence,
      typeEff: lambda.typeEff,
    });
  });
};

const checkTappArgWellFormedness =
  (ctx: WellFormednessContext, args: TypeEffect[], operator: Token) =>
  (callee: Expression): Result<Expression, ElaborationError> => {
    if (!args.every((arg) => WellFormed.TypeEffect(ctx, arg))) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'Type argument is not well-formed',
          operator,
        }),
      );
    }

    return Result.ok(callee);
  };

const checkTypeApplicationCalleeType =
  (operator: Token) =>
  (
    callee: Expression,
  ): Result<Expression & ConcreteTypeEff<TypeEff<PolyT>>, ElaborationError> => {
    if (!typeIsKinded(callee.typeEff, TypeKind.PolyT)) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'Expression called is not a type quantification',
          operator,
        }),
      );
    }

    return Result.ok(callee as Expression & ConcreteTypeEff<TypeEff<PolyT>>);
  };

const checkTappArgumentsNumber =
  (operator: Token, argsNumber: number) =>
  (
    callee: Expression & ConcreteTypeEff<TypeEff<PolyT>>,
  ): Result<Expression & ConcreteTypeEff<TypeEff<PolyT>>, ElaborationError> => {
    if (callee.typeEff.type.typeVars.length !== argsNumber) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'Wrong number of type arguments',
          operator,
        }),
      );
    }

    return Result.ok(callee);
  };

const checkTappDirectives =
  (token: Token, args: TypeEffect[]) =>
  (
    callee: Expression & ConcreteTypeEff<TypeEff<PolyT>>,
  ): Result<Expression, ElaborationError> => {
    for (const [tvar, arg] of zip(callee.typeEff.type.typeVars, args)) {
      const { directives } = tvar;

      if (!directives) {
        continue;
      }

      for (const dir of directives) {
        if (dir === Directive.Pure && !PureDirective.TypeEff(arg)) {
          return Result.err(
            new ElaborationTypeError({
              reason: 'Type argument is not pure',
              operator: token,
            }),
          );
        }
      }
    }

    return Result.ok(callee);
  };

export const tapp = (
  expr: past.TCall,
  ctx: ElaborationContext,
): Result<TCall, ElaborationError> => {
  const calleeElaboration = expression(expr.callee, ctx)
    .chain(checkTappArgWellFormedness([ctx[1]], expr.args, expr.bracket))
    .chain(checkTypeApplicationCalleeType(expr.bracket))
    .chain(checkTappArgumentsNumber(expr.bracket, expr.args.length))
    .chain(checkTappDirectives(expr.bracket, expr.args));

  return calleeElaboration.map((callee) => {
    const typeEff = TypeEffUtils.PolysUtils.instance(
      callee.typeEff as TypeEff<PolyT, Senv>,
      expr.args,
    );

    return TCall({
      callee,
      args: expr.args,
      bracket: expr.bracket,
      typeEff,
    });
  });
};
