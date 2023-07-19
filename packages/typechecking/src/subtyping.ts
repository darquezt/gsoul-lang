import { Sens, Senv, SenvUtils, Type } from '@gsoul-lang/core/utils';
import Meet from '@gsoul-lang/core/utils/lib/Meet';
import RecursivePolarityCheck, {
  RecursivePolarityMode,
} from '@gsoul-lang/core/utils/lib/RecursivePolarityCheck';
import { TypeKind } from '@gsoul-lang/core/utils/Type';
import { TypeEffect, TypeEffectKind } from '@gsoul-lang/core/utils/TypeEff';
import { zip } from 'ramda';

export const isSubSens = (s1: Sens, s2: Sens): boolean => s1[0] <= s2[1];

export const isSubSenv = (senv1: Senv, senv2: Senv): boolean => {
  const senv1Keys = Object.keys(senv1);
  const senv2Keys = Object.keys(senv2);
  const keys = [...senv1Keys, ...senv2Keys];

  return keys.reduce(
    (acc, x) =>
      acc && isSubSens(SenvUtils.access(senv1, x), SenvUtils.access(senv2, x)),
    true,
  );
};

export const isSubType = (type1: Type, type2: Type): boolean => {
  if (type1.kind === TypeKind.Real && type2.kind === TypeKind.Real) {
    return true;
  }
  if (type1.kind === TypeKind.Bool && type2.kind === TypeKind.Bool) {
    return true;
  }
  if (type1.kind === TypeKind.Nil && type2.kind === TypeKind.Nil) {
    return true;
  }

  // Atoms
  if (type1.kind === TypeKind.Atom && type2.kind === TypeKind.Atom) {
    return type1.name === type2.name;
  }

  if (type1.kind === TypeKind.Arrow && type2.kind === TypeKind.Arrow) {
    if (type1.domain.length !== type2.domain.length) {
      return false;
    }

    const argSubtyping = !zip(type2.domain, type1.domain)
      .map(([d2, d1]) => isSubTypeEff(d2, d1))
      .includes(false);
    const bodySubtyping = isSubTypeEff(type1.codomain, type2.codomain);

    return argSubtyping && bodySubtyping;
  }
  if (type1.kind === TypeKind.ForallT && type2.kind === TypeKind.ForallT) {
    return isSubTypeEff(type1.codomain, type2.codomain);
  }
  if (type1.kind === TypeKind.MProduct && type2.kind === TypeKind.MProduct) {
    const firstSubtyping = isSubTypeEff(type2.first, type1.first);
    const secondSubtyping = isSubTypeEff(type1.second, type2.second);

    return firstSubtyping && secondSubtyping;
  }

  // Products
  if (type1.kind === TypeKind.Product && type2.kind === TypeKind.Product) {
    if (type1.typeEffects.length !== type2.typeEffects.length) {
      return false;
    }

    const typeEffectsSubtyping = !zip(type1.typeEffects, type2.typeEffects)
      .map(([f1, f2]) => isSubTypeEff(f1, f2))
      .includes(false);

    return typeEffectsSubtyping;
  }

  // Sums
  if (type1.kind === TypeKind.Sum && type2.kind === TypeKind.Sum) {
    if (type1.typeEffects.length !== type2.typeEffects.length) {
      return false;
    }

    const typeEffectsSubtyping = !zip(type1.typeEffects, type2.typeEffects)
      .map(([f1, f2]) => isSubTypeEff(f1, f2))
      .includes(false);

    return typeEffectsSubtyping;
  }

  if (type1.kind === TypeKind.RecType && type2.kind === TypeKind.RecType) {
    if (
      RecursivePolarityCheck.TypeEffect(
        type1.variable,
        RecursivePolarityMode.POSITIVE,
        type1.body,
        type2.body,
      )
    ) {
      return isSubTypeEff(type1.body, type2.body);
    }

    const bodyMeet = Meet.TypeEffect(type1.body, type2.body);

    return bodyMeet.isOk;
  }

  return false;
};

export const isSubTypeEff = (te1: TypeEffect, te2: TypeEffect): boolean => {
  if (
    te1.kind === TypeEffectKind.TypeVar &&
    te2.kind === TypeEffectKind.TypeVar
  ) {
    return te1.name === te2.name;
  }
  if (
    te1.kind === TypeEffectKind.TypeEff &&
    te2.kind === TypeEffectKind.TypeEff
  ) {
    const subtyping = isSubType(te1.type, te2.type);
    const subsenving = isSubSenv(te1.effect, te2.effect);

    return subtyping && subsenving;
  }

  return false;
};
