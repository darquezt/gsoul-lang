import { Result } from '@badrap/result';
import { zip } from 'ramda';
import { Type, TypeEff } from '..';
import { isKinded } from '../ADT';
import { UndefinedMeetError } from '../Sens';
import { access, extend, Senv } from '../Senv';
import { Arrow, ForallT, Product, RecType, TypeKind } from '../Type';
import { TypeEffect, TypeEffectKind } from '../TypeEff';

const senvMeet = (a: Senv, b: Senv): Result<Senv, UndefinedMeetError> => {
  const senv1Keys = Object.keys(a);
  const senv2Keys = Object.keys(b);
  const keys = [...senv1Keys, ...senv2Keys];

  let result = Senv();

  for (const x of keys) {
    const sensMeetRes = access(a, x).meet(access(b, x));

    if (!sensMeetRes.isOk) {
      return Result.err(new UndefinedMeetError());
    }

    result = extend(result, x, sensMeetRes.value);
  }

  return Result.ok(result);
};

const typeMeet = (ty1: Type, ty2: Type): Result<Type, UndefinedMeetError> => {
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

    return Result.all([
      typeEffectMeet(dom1, dom2),
      typeEffectMeet(cod1, cod2),
    ]).map(([dom, cod]) =>
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
      return Result.err(new UndefinedMeetError());
    }

    return typeEffectMeet(body1, body2).map((body) =>
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
      return Result.err(new UndefinedMeetError());
    }

    const variablesAreEqual = zip(sensVars1, sensVars2).reduce(
      (acc, [x1, x2]) => x1 === x2 && acc,
      true,
    );

    if (!variablesAreEqual) {
      return Result.err(new UndefinedMeetError());
    }

    return typeEffectMeet(cod1, cod2).map((codomain) =>
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
      return Result.err(new UndefinedMeetError());
    }

    const allMeets: Result<TypeEffect, UndefinedMeetError>[] = zip(
      teffs1,
      teffs2,
    ).map(([teff1, teff2]) => typeEffectMeet(teff1, teff2));

    // Bypass to the shitty typing of Result.all
    const allMeetsResult = Result.all(allMeets) as unknown as Result<
      TypeEffect[],
      UndefinedMeetError
    >;

    const result = allMeetsResult.map((teffs) => {
      return Product({
        typeEffects: teffs,
      });
    });

    return result;
  }

  return Result.err(new UndefinedMeetError());
};

const typeEffectMeet = (
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
    const tyMeet = typeMeet(teff1.type, teff2.type);
    const effMeet = senvMeet(teff1.effect, teff2.effect);

    return Result.all([tyMeet, effMeet]).map(([type, senv]) =>
      TypeEff(type, senv),
    );
  }

  return Result.err(
    new UndefinedMeetError('Uncompatible type-and-effect constructors'),
  );
};

const Meet = {
  Senv: senvMeet,
  Type: typeMeet,
  TypeEffect: typeEffectMeet,
};

export default Meet;
