import { Result } from '@badrap/result';
import { TypeEff, Senv, TypeEffUtils } from '@gsoul-lang/core/utils';
import { AProduct, typeIsKinded, TypeKind } from '@gsoul-lang/core/utils/Type';
import { initialEvidence } from '../../utils/Evidence';
import { Ascription, Pair, ProjFst, ProjSnd } from '../ast';
import { expression } from '../elaboration';
import { ElaborationError, ElaborationTypeError } from '../errors';
import * as past from '@gsoul-lang/parsing/lib/ast';
import { ElaborationContext } from '../types';

export const pair = (
  expr: past.Pair,
  ctx: ElaborationContext,
): Result<Ascription, ElaborationError> => {
  const firstElaboration = expression(expr.first, ctx);

  const secondElaboration = expression(expr.second, ctx);

  return Result.all([firstElaboration, secondElaboration]).map(
    ([first, second]) => {
      const typeEff = TypeEff(
        AProduct({
          first: first.typeEff,
          second: second.typeEff,
        }),
        Senv(),
      );

      const evidence = initialEvidence(typeEff);

      return Ascription({
        evidence,
        expression: Pair({
          first,
          second,
          typeEff,
        }),
        typeEff,
      });
    },
  );
};

export const projFst = (
  expr: past.ProjFst,
  ctx: ElaborationContext,
): Result<ProjFst, ElaborationError> => {
  const pairElaboration = expression(expr.pair, ctx).chain((pair) => {
    if (!typeIsKinded(pair.typeEff, TypeKind.AProduct)) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'The expression being projected must be a pair',
          operator: expr.projToken,
        }),
      );
    }

    return Result.ok(pair);
  });

  return pairElaboration.map((pair) =>
    ProjFst({
      pair,
      projToken: expr.projToken,
      typeEff: TypeEffUtils.AdditiveProductsUtils.firstProjection(
        pair.typeEff as TypeEff<AProduct, Senv>,
      ),
    }),
  );
};

export const projSnd = (
  expr: past.ProjSnd,
  ctx: ElaborationContext,
): Result<ProjSnd, ElaborationError> => {
  const pairElaboration = expression(expr.pair, ctx).chain((pair) => {
    if (!typeIsKinded(pair.typeEff, TypeKind.AProduct)) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'The expression being projected must be a pair',
          operator: expr.projToken,
        }),
      );
    }

    return Result.ok(pair);
  });

  return pairElaboration.map((pair) =>
    ProjSnd({
      pair,
      projToken: expr.projToken,
      typeEff: TypeEffUtils.AdditiveProductsUtils.firstProjection(
        pair.typeEff as TypeEff<AProduct, Senv>,
      ),
    }),
  );
};
