import { Identifier, Senv } from './Senv';
import * as SenvUtils from './Senv';
import { Type, Arrow, ForallT, PolyT, AProduct, RecType, Sum } from './Type';
import * as TypeUtils from './Type';
import { factoryOf, KindedFactory } from './ADT';
import { identity, zip } from 'ramda';

export enum TypeEffectKind {
  TypeEff = 'TypeEff',
  RecursiveVar = 'RecursiveVar',
  TypeVar = 'TypeVar',
}

export type TypeEff<T extends Type = Type, E extends Senv = Senv> = {
  kind: TypeEffectKind.TypeEff;
  type: T;
  effect: E;
};
export const TypeEff = <T extends Type = Type, E extends Senv = Senv>(
  type: T,
  effect: E,
): TypeEff<T, E> => ({
  kind: TypeEffectKind.TypeEff,
  type,
  effect,
});

export type TypeVar = {
  kind: TypeEffectKind.TypeVar;
  name: string;
};
export const TypeVar: KindedFactory<TypeVar> = factoryOf(
  TypeEffectKind.TypeVar,
);

export type TypeEffect<T extends Type = Type, E extends Senv = Senv> =
  | TypeEff<T, E>
  | TypeVar;

type MapFuns<R> = {
  typeEff: (typeEff: TypeEff) => R;
  typeVar: (typeEff: TypeVar) => R;
};
const match =
  <R>(funs: MapFuns<R>) =>
  (teff: TypeEffect) => {
    switch (teff.kind) {
      case TypeEffectKind.TypeEff:
        return funs.typeEff(teff);
      case TypeEffectKind.TypeVar:
        return funs.typeVar(teff);
    }
  };

export const subst = <TE extends TypeEffect>(
  typeEff: TE,
  name: Identifier,
  effect: Senv,
): TypeEffect & { kind: TE['kind'] } => {
  return match<TypeEffect & { kind: TE['kind'] }>({
    typeVar: identity,
    typeEff: (teff) =>
      TypeEff(
        TypeUtils.subst(teff.type, name, effect),
        SenvUtils.subst(teff.effect, name, effect),
      ),
  })(typeEff);
};

export const deleteResources = <TE extends TypeEffect>(
  teff: TE,
  resources: Identifier[],
): TypeEffect & { kind: TE['kind'] } => {
  return match<TypeEffect & { kind: TE['kind'] }>({
    typeVar: identity,
    typeEff: (teff) =>
      TypeEff(
        TypeUtils.deleteResources(teff.type, resources),
        SenvUtils.deleteResources(teff.effect, resources),
      ),
  })(teff);
};

export const substTypevar = (
  name: Identifier,
  substitution: TypeEffect,
): ((teff: TypeEffect) => TypeEffect) =>
  match<TypeEffect>({
    typeVar: (teff) => (teff.name === name ? substitution : teff),
    typeEff: (teff) =>
      TypeEff(
        TypeUtils.substTypevar(name, substitution)(teff.type),
        teff.effect,
      ),
  });

export const format = match<string>({
  typeVar: (teff) => teff.name,
  typeEff: (teff) => {
    return SenvUtils.isEmpty(teff.effect)
      ? TypeUtils.format(teff.type)
      : `${TypeUtils.format(teff.type)}[${SenvUtils.format(teff.effect)}]`;
  },
});

export const applySenvFunction = (
  teff: TypeEff,
  op: (eff: Senv, senv: Senv) => Senv,
  senv: Senv,
): TypeEff => TypeEff(teff.type, op(teff.effect, senv));

/**
 * Utilities for working with arrow type-and-effects
 */
export const ArrowsUtils = {
  domain(teff: TypeEff<Arrow, Senv>): TypeEff[] {
    return teff.type.domain as TypeEff[];
  },

  codomain(teff: TypeEff<Arrow, Senv>): TypeEff {
    const { type: codomainType, effect: codomainEffect } = teff.type
      .codomain as TypeEff;

    return TypeEff(codomainType, SenvUtils.add(codomainEffect, teff.effect));
  },
};

/**
 * Utilities for working with forall type-and-effects
 */
export const ForallsUtils = {
  scod(teff: TypeEff<ForallT, Senv>): TypeEff {
    const { codomain } = teff.type;

    return TypeEff(
      (codomain as TypeEff).type,
      SenvUtils.add((codomain as TypeEff).effect, teff.effect),
    );
  },
  instance(teff: TypeEff<ForallT, Senv>, args: Senv[]): TypeEff {
    const { sensVars } = teff.type;

    const instantiations = zip(sensVars, args);

    const payedCodomain = ForallsUtils.scod(teff);

    const result = instantiations.reduce(
      (acc, [svar, arg]) => subst(acc, svar, arg),
      payedCodomain,
    );

    return result;
  },
};

/**
 * Utilities for working with forall type-and-effects
 */
export const PolysUtils = {
  tcod(teff: TypeEff<PolyT, Senv>): TypeEff {
    const { codomain } = teff.type;

    return TypeEff(
      (codomain as TypeEff).type,
      SenvUtils.add((codomain as TypeEff).effect, teff.effect),
    );
  },
  instance(teff: TypeEff<PolyT, Senv>, args: TypeEffect[]): TypeEff {
    const { typeVars } = teff.type;

    const instantiations = zip(typeVars, args);

    const payedCodomain = PolysUtils.tcod(teff);

    const result = instantiations.reduce(
      (acc, [tvar, arg]) => substTypevar(tvar.identifier, arg)(acc),
      payedCodomain,
    );

    return result as TypeEff;
  },
};

/**
 * Utilities for working with additive product type-and-effects
 */
export const AdditiveProductsUtils = {
  firstProjection(teff: TypeEff<AProduct, Senv>): TypeEff {
    const { type: firstType, effect: firstEffect } = teff.type.first as TypeEff;

    return TypeEff(firstType, SenvUtils.add(firstEffect, teff.effect));
  },

  secondProjection(teff: TypeEff<AProduct, Senv>): TypeEff {
    const { type: secondType, effect: secondEffect } = teff.type
      .second as TypeEff;

    return TypeEff(secondType, SenvUtils.add(secondEffect, teff.effect));
  },
};

/**
 * Utilities for working with additive product type-and-effects
 */
export const SumUtils = {
  projection(index: number, teff: TypeEff<Sum, Senv>): TypeEff {
    const { type, effect } = teff.type.typeEffects[index] as TypeEff;

    return TypeEff(type, SenvUtils.add(effect, teff.effect));
  },
};

/**
 * Utilities for working with product type-and-effects
 */
export const ProductUtils = {
  projection(index: number, teff: TypeEff<TypeUtils.Product, Senv>): TypeEff {
    const { type, effect } = teff.type.typeEffects[index] as TypeEff;

    return TypeEff(type, SenvUtils.add(effect, teff.effect));
  },
};

/**
 * Utilities for working with recursive type-and-effects
 */
export const RecursiveUtils = {
  unfold(teff: TypeEff<RecType, Senv>): TypeEff {
    const { variable, body } = teff.type;

    const substitution = TypeEff(teff.type, Senv());

    if (body.kind !== TypeEffectKind.TypeEff) {
      throw new Error(
        'PANIC: body of a recursive type should be a type-and-effect tuple',
      );
    }

    const { type: bodyType, effect: bodyEffect } = body;

    return TypeEff(
      TypeUtils.substRecVar(variable, substitution)(bodyType),
      SenvUtils.add(teff.effect, bodyEffect),
    );
  },
};
