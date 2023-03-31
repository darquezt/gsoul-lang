import { Result } from '@badrap/result';
import { TypeEff, Senv, TypeEffUtils } from '@gsoul-lang/core/utils';
import { AProduct, typeIsKinded, TypeKind } from '@gsoul-lang/core/utils/Type';
import { Pair, ProjFst, ProjSnd } from '@gsoul-lang/parsing/lib/ast';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { expression } from '../checker';
import { TypeCheckingError, TypeCheckingTypeError } from '../utils/errors';
import { TypeCheckingRule, TypeCheckingResult } from '../utils/types';

export const pair: TypeCheckingRule<Pair> = (expr, ctx) => {
  const fstTC = expression(expr.first, ctx);

  const sndTC = expression(expr.second, ctx);

  return Result.all([fstTC, sndTC]).map(([first, second]) => ({
    typeEff: TypeEff(
      AProduct({
        first: first.typeEff,
        second: second.typeEff,
      }),
      Senv(),
    ),
    typings: first.typings.concat(second.typings),
  }));
};

const checkProjCalleeType =
  (token: Token) =>
  (
    pairTC: TypeCheckingResult,
  ): Result<TypeCheckingResult<AProduct>, TypeCheckingError> => {
    if (!typeIsKinded(pairTC.typeEff, TypeKind.AProduct)) {
      return Result.err(
        new TypeCheckingTypeError({
          reason: 'Expression being projected must be a pair',
          operator: token,
        }),
      );
    }

    return Result.ok(pairTC as TypeCheckingResult<AProduct>);
  };

export const projFst: TypeCheckingRule<ProjFst> = (expr, ctx) => {
  const pairTC = expression(expr.pair, ctx).chain(
    checkProjCalleeType(expr.projToken),
  );

  return pairTC.map((pair) => ({
    typeEff: TypeEffUtils.AdditiveProductsUtils.firstProjection(pair.typeEff),
    typings: pair.typings,
  }));
};

export const projSnd: TypeCheckingRule<ProjSnd> = (expr, ctx) => {
  const pairTC = expression(expr.pair, ctx).chain(
    checkProjCalleeType(expr.projToken),
  );

  return pairTC.map((pair) => ({
    typeEff: TypeEffUtils.AdditiveProductsUtils.secondProjection(pair.typeEff),
    typings: pair.typings,
  }));
};
