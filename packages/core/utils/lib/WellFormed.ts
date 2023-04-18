import { ResourcesSet } from '../ResourcesSet';
import * as ResourcesSetUtils from '../ResourcesSet';
import { Senv } from '../Senv';
import { Type, TypeKind } from '../Type';
import { TypeEffect, TypeEffectKind } from '../TypeEff';

export type WellFormednessContext = [ResourcesSet];

const senvWellFormed = (ctx: WellFormednessContext, senv: Senv): boolean => {
  const [rset] = ctx;

  return Object.keys(senv).every((id) => ResourcesSetUtils.contains(rset, id));
};

const typeWellFormed = (ctx: WellFormednessContext, type: Type): boolean => {
  const [rset, ...rest] = ctx;

  switch (type.kind) {
    case TypeKind.Real:
    case TypeKind.Nil:
    case TypeKind.Bool:
    case TypeKind.Atom:
      return true;

    case TypeKind.Arrow:
      return (
        type.domain.every((d) => typeEffectWellFormed(ctx, d)) &&
        typeEffectWellFormed(ctx, type.codomain)
      );

    case TypeKind.Product:
      return type.typeEffects.every((typeEffect) =>
        typeEffectWellFormed(ctx, typeEffect),
      );

    case TypeKind.Sum:
      return (
        typeEffectWellFormed(ctx, type.left) &&
        typeEffectWellFormed(ctx, type.right)
      );

    case TypeKind.ForallT:
      return typeEffectWellFormed(
        [ResourcesSetUtils.extendAll(rset, ...type.sensVars), ...rest],
        type.codomain,
      );

    case TypeKind.RecType:
      return typeEffectWellFormed(ctx, type.body);

    case TypeKind.MProduct:
    case TypeKind.AProduct:
      return (
        typeEffectWellFormed(ctx, type.first) &&
        typeEffectWellFormed(ctx, type.second)
      );
  }
};

const typeEffectWellFormed = (
  ctx: WellFormednessContext,
  typeEffect: TypeEffect,
): boolean => {
  switch (typeEffect.kind) {
    case TypeEffectKind.RecursiveVar:
      return true;
    case TypeEffectKind.TypeEff:
      return (
        typeWellFormed(ctx, typeEffect.type) &&
        senvWellFormed(ctx, typeEffect.effect)
      );
  }
};

const WellFormed = {
  Senv: senvWellFormed,
  Type: typeWellFormed,
  TypeEffect: typeEffectWellFormed,
};

export default WellFormed;
