import { Sens, Senv, SenvUtils, Type, TypeEff } from '@gsens-lang/core/utils';

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
    const argSubtyping = isSubTypeEff(type2.domain, type1.domain);
    const bodySubtyping = isSubTypeEff(type1.codomain, type2.codomain);

    return argSubtyping && bodySubtyping;
  }

  return false;
};

export const isSubTypeEff = (te1: TypeEff, te2: TypeEff): boolean => {
  const subtyping = isSubType(te1.type, te2.type);
  const subsenving = isSubSenv(te1.effect, te2.effect);

  return subtyping && subsenving;
};
