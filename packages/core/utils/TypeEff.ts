import { Identifier, Senv } from './Senv';
import * as SenvUtils from './Senv';
import { Type, Arrow, ForallT, AProduct, RecType } from './Type';
import * as TypeUtils from './Type';
import { factoryOf, isKinded, KindedFactory } from './ADT';
import { identity, zip } from 'ramda';
import { Result } from '@badrap/result';
import { UndefinedMeetError } from './Sens';

export enum TypeEffectKind {
  TypeEff = 'TypeEff',
  RecursiveVar = 'RecursiveVar',
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

export type RecursiveVar = {
  kind: TypeEffectKind.RecursiveVar;
  name: string;
};
export const RecursiveVar: KindedFactory<RecursiveVar> = factoryOf(
  TypeEffectKind.RecursiveVar,
);

export type TypeEffect<T extends Type = Type, E extends Senv = Senv> =
  | TypeEff<T, E>
  | RecursiveVar;

type MapFuns<R> = {
  typeEff: (typeEff: TypeEff) => R;
  recVar: (typeEff: RecursiveVar) => R;
};
const match =
  <R>(funs: MapFuns<R>) =>
  (teff: TypeEffect) => {
    switch (teff.kind) {
      case TypeEffectKind.RecursiveVar:
        return funs.recVar(teff);
      case TypeEffectKind.TypeEff:
        return funs.typeEff(teff);
    }
  };

export const meet = (
  teff1: TypeEffect,
  teff2: TypeEffect,
): Result<TypeEffect, UndefinedMeetError> => {
  if (
    isKinded(teff1, TypeEffectKind.RecursiveVar) &&
    isKinded(teff2, TypeEffectKind.RecursiveVar)
  ) {
    if (teff1.name !== teff2.name) {
      return Result.err(new UndefinedMeetError());
    }

    return Result.ok(teff1);
  }

  if (
    isKinded(teff1, TypeEffectKind.TypeEff) &&
    isKinded(teff2, TypeEffectKind.TypeEff)
  ) {
    const typeMeet = TypeUtils.meet(teff1.type, teff2.type);
    const senvMeet = SenvUtils.meet(teff1.effect, teff2.effect);

    return Result.all([typeMeet, senvMeet]).map(([type, senv]) =>
      TypeEff(type, senv),
    );
  }

  return Result.err(
    new UndefinedMeetError('Uncompatible type-and-effect constructors'),
  );
};

export const subst = <TE extends TypeEffect>(
  typeEff: TE,
  name: Identifier,
  effect: Senv,
): TypeEffect & { kind: TE['kind'] } => {
  return match<TypeEffect & { kind: TE['kind'] }>({
    recVar: identity,
    typeEff: (teff) =>
      TypeEff(
        TypeUtils.subst(teff.type, name, effect),
        SenvUtils.subst(teff.effect, name, effect),
      ),
  })(typeEff);
};

export const substRecVar = (
  name: Identifier,
  substitution: TypeEff,
): ((teff: TypeEffect) => TypeEffect) =>
  match<TypeEffect>({
    recVar: (teff) => (teff.name === name ? substitution : teff),
    typeEff: (teff) =>
      TypeEff(
        TypeUtils.substRecVar(name, substitution)(teff.type),
        teff.effect,
      ),
  });

export const format = match<string>({
  recVar: (teff) => teff.name,
  typeEff: (teff) =>
    `${TypeUtils.format(teff.type)}@[${SenvUtils.format(teff.effect)}]`,
});

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
 * Utilities for working with product type-and-effects
 */
export const ProductUtils = {
  projection(index: number, teff: TypeEff<TypeUtils.Product, Senv>): TypeEff {
    const { type, effect } = teff.type.typeEffects[index] as TypeEff;

    return TypeEff(type, SenvUtils.add(effect, teff.effect));
  },
};

/**
 * unfold(rec alpha . t!E ! E2) =
 * unfold(rec alpha . alpha ! E2) =
 */

/**
 * Utilities for working with recursive type-and-effects
 */
export const RecursiveUtils = {
  unfold(teff: TypeEff<RecType, Senv>): TypeEff {
    const { variable, body } = teff.type;

    const substitution = TypeEff(teff.type, Senv());

    if (body.kind === TypeEffectKind.RecursiveVar) {
      throw new Error(
        'PANIC: body of a recursive type should not be a recursive var itself',
      );
    }

    const { type: bodyType, effect: bodyEffect } = body;

    return TypeEff(
      TypeUtils.substRecVar(variable, substitution)(bodyType),
      SenvUtils.add(teff.effect, bodyEffect),
    );
  },
};
