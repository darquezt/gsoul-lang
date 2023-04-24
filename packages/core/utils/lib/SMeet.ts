import { Result } from '@badrap/result';
import {
  Arrow,
  ForallT,
  PolyT,
  Product,
  RecType,
  Sum,
  Type,
  TypeKind,
} from '../Type';
import { Senv } from '../Senv';
import { TypeEff, TypeEffect, TypeEffectKind } from '../TypeEff';
import { Sens } from '../Sens';
import { mergeWith, zip } from 'ramda';
import { isKinded } from '../ADT';
import SJoin from './SJoin';

export class UndefinedSMeetError extends Error {}

const senvSMeet = (senv1: Senv, senv2: Senv): Senv => {
  return mergeWith(
    (asens: Sens, bsens: Sens) => asens.sjoin(bsens),
    senv1,
    senv2,
  );
};

const typeSMeet = (ty1: Type, ty2: Type): Result<Type, UndefinedSMeetError> => {
  if (isKinded(ty1, TypeKind.Real) && isKinded(ty2, TypeKind.Real)) {
    return Result.ok(ty1);
  }

  if (isKinded(ty1, TypeKind.Nil) && isKinded(ty2, TypeKind.Nil)) {
    return Result.ok(ty1);
  }

  if (isKinded(ty1, TypeKind.Bool) && isKinded(ty2, TypeKind.Bool)) {
    return Result.ok(ty1);
  }

  if (isKinded(ty1, TypeKind.Atom) && isKinded(ty2, TypeKind.Atom)) {
    if (ty1.name === ty2.name) {
      return Result.ok(ty1);
    }

    return Result.err(new UndefinedSMeetError());
  }

  if (isKinded(ty1, TypeKind.Arrow) && isKinded(ty2, TypeKind.Arrow)) {
    const { domain: dom1, codomain: cod1 } = ty1;
    const { domain: dom2, codomain: cod2 } = ty2;

    if (dom1.length !== dom2.length) {
      return Result.err(
        new UndefinedSMeetError(
          'function types have uncompatible number of arguments',
        ),
      );
    }

    const domsMeet = Result.all(
      zip(dom1, dom2).map(([d1, d2]) => SJoin.TypeEffect(d1, d2)),
    ) as unknown as Result<TypeEffect[], UndefinedSMeetError>;

    return Result.all([domsMeet, typeEffectSMeet(cod1, cod2)]).map(
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
      return Result.err(new UndefinedSMeetError());
    }

    return typeEffectSMeet(body1, body2).map((body) =>
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
      return Result.err(new UndefinedSMeetError());
    }

    const variablesAreEqual = zip(sensVars1, sensVars2).reduce(
      (acc, [x1, x2]) => x1 === x2 && acc,
      true,
    );

    if (!variablesAreEqual) {
      return Result.err(new UndefinedSMeetError());
    }

    return typeEffectSMeet(cod1, cod2).map((codomain) =>
      ForallT({
        sensVars: sensVars1,
        codomain,
      }),
    );
  }

  if (isKinded(ty1, TypeKind.PolyT) && isKinded(ty2, TypeKind.PolyT)) {
    const { typeVars: typeVars1, codomain: cod1 } = ty1;
    const { typeVars: typeVars2, codomain: cod2 } = ty2;

    if (typeVars1.length !== typeVars2.length) {
      return Result.err(new UndefinedSMeetError());
    }

    const variablesAreEqual = zip(typeVars1, typeVars2).reduce(
      (acc, [x1, x2]) => x1 === x2 && acc,
      true,
    );

    if (!variablesAreEqual) {
      return Result.err(new UndefinedSMeetError());
    }

    return typeEffectSMeet(cod1, cod2).map((codomain) =>
      PolyT({
        typeVars: typeVars1,
        codomain,
      }),
    );
  }

  if (isKinded(ty1, TypeKind.Product) && isKinded(ty2, TypeKind.Product)) {
    const { typeEffects: teffs1 } = ty1;
    const { typeEffects: teffs2 } = ty2;

    if (teffs1.length !== teffs2.length) {
      return Result.err(new UndefinedSMeetError());
    }

    const allMeets: Result<TypeEffect, UndefinedSMeetError>[] = zip(
      teffs1,
      teffs2,
    ).map(([teff1, teff2]) => typeEffectSMeet(teff1, teff2));

    // Bypass to the shitty typing of Result.all
    const allMeetsResult = Result.all(allMeets) as unknown as Result<
      TypeEffect[],
      UndefinedSMeetError
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

    const leftMeet = typeEffectSMeet(left1, left2);
    const rightMeet = typeEffectSMeet(right1, right2);

    // Bypass to the shitty typing of Result.all

    const result = Result.all([leftMeet, rightMeet]).map(([left, right]) => {
      return Sum({
        left,
        right,
      });
    });

    return result;
  }

  return Result.err(new UndefinedSMeetError());
};

const typeEffectSMeet = (
  teff1: TypeEffect,
  teff2: TypeEffect,
): Result<TypeEffect, UndefinedSMeetError> => {
  if (
    isKinded(teff1, TypeEffectKind.TypeVar) &&
    isKinded(teff2, TypeEffectKind.TypeVar)
  ) {
    if (teff1.name !== teff2.name) {
      return Result.err(new UndefinedSMeetError());
    }

    return Result.ok(teff1);
  }

  if (
    isKinded(teff1, TypeEffectKind.TypeEff) &&
    isKinded(teff2, TypeEffectKind.TypeEff)
  ) {
    const tyMeet = typeSMeet(teff1.type, teff2.type);
    const effMeet = senvSMeet(teff1.effect, teff2.effect);

    return tyMeet.map((type) => TypeEff(type, effMeet));
  }

  return Result.err(
    new UndefinedSMeetError('Uncompatible type-and-effect constructors'),
  );
};

const SMeet = {
  Senv: senvSMeet,
  Type: typeSMeet,
  TypeEffect: typeEffectSMeet,
};

export default SMeet;
