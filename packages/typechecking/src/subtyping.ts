import { Sens, Senv, SenvUtils, Type } from '@gsoul-lang/core/utils';
import RecursivePolarityCheck, {
  RecursivePolarityMode,
} from '@gsoul-lang/core/utils/lib/RecursivePolarityCheck';
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

/**
 * @deprecated
 */
class UnsupportedSubtypingError extends Error {}

export const isSubType = (type1: Type, type2: Type): boolean => {
  if (type1.kind !== type2.kind) {
    return false;
  }
  if (type1.kind === 'Real' && type2.kind === 'Real') {
    return true;
  }
  if (type1.kind === 'Bool' && type2.kind === 'Bool') {
    return true;
  }
  if (type1.kind === 'Nil' && type2.kind === 'Nil') {
    return true;
  }
  if (type1.kind === 'Arrow' && type2.kind === 'Arrow') {
    if (type1.domain.length !== type2.domain.length) {
      return false;
    }

    const argSubtyping = !zip(type2.domain, type1.domain)
      .map(([d2, d1]) => isSubTypeEff(d2, d1))
      .includes(false);
    const bodySubtyping = isSubTypeEff(type1.codomain, type2.codomain);

    return argSubtyping && bodySubtyping;
  }
  if (type1.kind === 'ForallT' && type2.kind === 'ForallT') {
    return isSubTypeEff(type1.codomain, type2.codomain);
  }
  if (type1.kind === 'MProduct' && type2.kind === 'MProduct') {
    const firstSubtyping = isSubTypeEff(type2.first, type1.first);
    const secondSubtyping = isSubTypeEff(type1.second, type2.second);

    return firstSubtyping && secondSubtyping;
  }

  if (type1.kind === 'RecType' && type2.kind === 'RecType') {
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
  }

  throw new UnsupportedSubtypingError(
    `We are sorry, gsens does not support subtyping between these types yet (${type1.kind}, ${type2.kind})`,
  );
};

export const isSubTypeEff = (te1: TypeEffect, te2: TypeEffect): boolean => {
  if (
    te1.kind === TypeEffectKind.RecursiveVar &&
    te2.kind === TypeEffectKind.RecursiveVar
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
