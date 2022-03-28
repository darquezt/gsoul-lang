import { Identifier, Senv } from './Senv';
import * as SenvUtils from './Senv';
import { Type, Arrow, ForallT, AProduct } from './Type';
import * as TypeUtils from './Type';

export type TypeEff<T extends Type = Type, E extends Senv = Senv> = {
  type: T;
  effect: E;
};
export const TypeEff = <T extends Type = Type, E extends Senv = Senv>(
  type: T,
  effect: E,
): TypeEff<T, E> => ({
  type,
  effect,
});

export const subst = (
  typeEff: TypeEff,
  name: Identifier,
  effect: Senv,
): TypeEff => {
  return TypeEff(
    TypeUtils.subst(typeEff.type, name, effect),
    SenvUtils.subst(typeEff.effect, name, effect),
  );
};

export const substTup = (
  typeEff: TypeEff,
  names: [Identifier, Identifier],
  latents: [Senv, Senv],
  effect: Senv,
): TypeEff => {
  return TypeEff(
    TypeUtils.substTup(typeEff.type, names, latents, effect),
    SenvUtils.substTup(typeEff.effect, names, latents, effect),
  );
};

export const format = (typeEff: TypeEff): string => {
  return `${TypeUtils.format(typeEff.type)}@[${SenvUtils.format(
    typeEff.effect,
  )}]`;
};

export const ArrowsUtils = {
  domain(teff: TypeEff<Arrow, Senv>): TypeEff {
    return teff.type.domain;
  },

  codomain(teff: TypeEff<Arrow, Senv>): TypeEff {
    const { type: codomainType, effect: codomainEffect } = teff.type.codomain;

    return TypeEff(codomainType, SenvUtils.add(codomainEffect, teff.effect));
  },
};

export const ForallsUtils = {
  instance(teff: TypeEff<ForallT, Senv>, senv?: Senv): TypeEff {
    const {
      sensVars: [svar, ...sensVars],
      codomain,
    } = teff.type;

    const { type: codomainType, effect: codomainEffect } =
      sensVars.length === 0
        ? codomain
        : TypeEff(
            ForallT({
              sensVars,
              codomain: codomain,
            }),
            Senv(),
          );

    const payedCodomain = TypeEff(
      codomainType,
      SenvUtils.add(codomainEffect, teff.effect),
    );

    return senv ? subst(payedCodomain, svar, senv) : payedCodomain;
  },
};

export const AdditiveProductsUtils = {
  firstProjection(teff: TypeEff<AProduct, Senv>): TypeEff {
    const { type: firstType, effect: firstEffect } = teff.type.first;

    return TypeEff(firstType, SenvUtils.add(firstEffect, teff.effect));
  },

  secondProjection(teff: TypeEff<AProduct, Senv>): TypeEff {
    const { type: secondType, effect: secondEffect } = teff.type.second;

    return TypeEff(secondType, SenvUtils.add(secondEffect, teff.effect));
  },
};
