import { Result } from '@badrap/result';
import { Arrow, ForallT, Product, RecType, Sum, Type, TypeKind } from '../Type';
import { Senv } from '../Senv';
import { TypeEff, TypeEffect, TypeEffectKind } from '../TypeEff';
import { Sens } from '../Sens';
import { mergeWith, zip } from 'ramda';
import { isKinded } from '../ADT';
import SMeet from './SMeet';

export class UndefinedSJoinError extends Error {}

const senvSJoin = (senv1: Senv, senv2: Senv): Senv => {
  return mergeWith(
    (asens: Sens, bsens: Sens) => asens.sjoin(bsens),
    senv1,
    senv2,
  );
};

const typeSJoin = (ty1: Type, ty2: Type): Result<Type, UndefinedSJoinError> => {
  if (isKinded(ty1, TypeKind.Real) && isKinded(ty2, TypeKind.Real)) {
    return Result.ok(ty1);
  }

  if (isKinded(ty1, TypeKind.Nil) && isKinded(ty2, TypeKind.Nil)) {
    return Result.ok(ty1);
  }

  if (isKinded(ty1, TypeKind.Bool) && isKinded(ty2, TypeKind.Bool)) {
    return Result.ok(ty1);
  }

  if (isKinded(ty1, TypeKind.Arrow) && isKinded(ty2, TypeKind.Arrow)) {
    const { domain: dom1, codomain: cod1 } = ty1;
    const { domain: dom2, codomain: cod2 } = ty2;

    if (dom1.length !== dom2.length) {
      return Result.err(
        new UndefinedSJoinError(
          'function types have uncompatible number of arguments',
        ),
      );
    }

    const domsMeet = Result.all(
      zip(dom1, dom2).map(([d1, d2]) => SMeet.TypeEffect(d1, d2)),
    ) as unknown as Result<TypeEffect[], UndefinedSJoinError>;

    return Result.all([domsMeet, typeEffectSJoin(cod1, cod2)]).map(
      ([dom, cod]) =>
        Arrow({
          domain: dom,
          codomain: cod,
        }),
    );
  }

  if (isKinded(ty1, TypeKind.RecType) && isKinded(ty2, TypeKind.RecType)) {
    const { variable, body: body1 } = ty1;
    const { variable: variable2, body: body2 } = ty2;

    if (variable !== variable2) {
      return Result.err(new UndefinedSJoinError());
    }

    return typeEffectSJoin(body1, body2).map((body) =>
      RecType({
        variable,
        body,
      }),
    );
  }

  if (isKinded(ty1, TypeKind.ForallT) && isKinded(ty2, TypeKind.ForallT)) {
    const { sensVars: sensVars1, codomain: cod1 } = ty1;
    const { sensVars: sensVars2, codomain: cod2 } = ty2;

    if (sensVars1.length !== sensVars2.length) {
      return Result.err(new UndefinedSJoinError());
    }

    const variablesAreEqual = zip(sensVars1, sensVars2).reduce(
      (acc, [x1, x2]) => x1 === x2 && acc,
      true,
    );

    if (!variablesAreEqual) {
      return Result.err(new UndefinedSJoinError());
    }

    return typeEffectSJoin(cod1, cod2).map((codomain) =>
      ForallT({
        sensVars: sensVars1,
        codomain,
      }),
    );
  }

  if (isKinded(ty1, TypeKind.Product) && isKinded(ty2, TypeKind.Product)) {
    const { typeEffects: teffs1 } = ty1;
    const { typeEffects: teffs2 } = ty2;

    if (teffs1.length !== teffs2.length) {
      return Result.err(new UndefinedSJoinError());
    }

    const allMeets: Result<TypeEffect, UndefinedSJoinError>[] = zip(
      teffs1,
      teffs2,
    ).map(([teff1, teff2]) => typeEffectSJoin(teff1, teff2));

    // Bypass to the shitty typing of Result.all
    const allMeetsResult = Result.all(allMeets) as unknown as Result<
      TypeEffect[],
      UndefinedSJoinError
    >;

    const result = allMeetsResult.map((teffs) => {
      return Product({
        typeEffects: teffs,
      });
    });

    return result;
  }

  if (isKinded(ty1, TypeKind.Sum) && isKinded(ty2, TypeKind.Sum)) {
    const { left: left1, right: right1 } = ty1;
    const { left: left2, right: right2 } = ty2;

    const leftMeet = typeEffectSJoin(left1, left2);
    const rightMeet = typeEffectSJoin(right1, right2);

    // Bypass to the shitty typing of Result.all

    const result = Result.all([leftMeet, rightMeet]).map(([left, right]) => {
      return Sum({
        left,
        right,
      });
    });

    return result;
  }

  return Result.err(new UndefinedSJoinError());
};

const typeEffectSJoin = (
  teff1: TypeEffect,
  teff2: TypeEffect,
): Result<TypeEffect, UndefinedSJoinError> => {
  if (
    isKinded(teff1, TypeEffectKind.RecursiveVar) &&
    isKinded(teff2, TypeEffectKind.RecursiveVar)
  ) {
    if (teff1.name !== teff2.name) {
      return Result.err(new UndefinedSJoinError());
    }

    return Result.ok(teff1);
  }

  if (
    isKinded(teff1, TypeEffectKind.TypeEff) &&
    isKinded(teff2, TypeEffectKind.TypeEff)
  ) {
    const tyMeet = typeSJoin(teff1.type, teff2.type);
    const effMeet = senvSJoin(teff1.effect, teff2.effect);

    return tyMeet.map((type) => TypeEff(type, effMeet));
  }

  return Result.err(
    new UndefinedSJoinError('Uncompatible type-and-effect constructors'),
  );
};

const SJoin = {
  Senv: senvSJoin,
  Type: typeSJoin,
  TypeEffect: typeEffectSJoin,
};

export default SJoin;
