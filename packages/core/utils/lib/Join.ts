import { Result } from '@badrap/result';
import { zip } from 'ramda';
import { Type, TypeEff } from '..';
import { isKinded } from '../ADT';
import { access, extend, Senv } from '../Senv';
import {
  Arrow,
  ForallT,
  PolyT,
  Product,
  RecType,
  Sum,
  TypeKind,
} from '../Type';
import { TypeEffect, TypeEffectKind } from '../TypeEff';
import { UndefinedJoinError } from '../Sens';

const senvJoin = (a: Senv, b: Senv): Senv => {
  const senv1Keys = Object.keys(a);
  const senv2Keys = Object.keys(b);
  const keys = [...senv1Keys, ...senv2Keys];

  let result = Senv();

  for (const x of keys) {
    const sensJoinRes = access(a, x).join(access(b, x));

    result = extend(result, x, sensJoinRes);
  }

  return result;
};

const typeJoin = (ty1: Type, ty2: Type): Result<Type, UndefinedJoinError> => {
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

    return Result.err(new UndefinedJoinError());
  }

  if (isKinded(ty1, TypeKind.Arrow) && isKinded(ty2, TypeKind.Arrow)) {
    const { domain: dom1, codomain: cod1 } = ty1;
    const { domain: dom2, codomain: cod2 } = ty2;

    if (dom1.length !== dom2.length) {
      return Result.err(
        new UndefinedJoinError(
          'function types have uncompatible number of arguments',
        ),
      );
    }

    const domsJoin = Result.all(
      zip(dom1, dom2).map(([d1, d2]) => Join.TypeEffect(d1, d2)),
    ) as unknown as Result<TypeEffect[], UndefinedJoinError>;

    return Result.all([domsJoin, typeEffectJoin(cod1, cod2)]).map(
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
      return Result.err(new UndefinedJoinError());
    }

    return typeEffectJoin(body1, body2).map((body) =>
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
      return Result.err(new UndefinedJoinError());
    }

    const variablesAreEqual = zip(sensVars1, sensVars2).reduce(
      (acc, [x1, x2]) => x1 === x2 && acc,
      true,
    );

    if (!variablesAreEqual) {
      return Result.err(new UndefinedJoinError());
    }

    return typeEffectJoin(cod1, cod2).map((codomain) =>
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
      return Result.err(new UndefinedJoinError());
    }

    const variablesAreEqual = zip(typeVars1, typeVars2).reduce(
      (acc, [x1, x2]) => x1 === x2 && acc,
      true,
    );

    if (!variablesAreEqual) {
      return Result.err(new UndefinedJoinError());
    }

    return typeEffectJoin(cod1, cod2).map((codomain) =>
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
      return Result.err(new UndefinedJoinError());
    }

    const allJoins: Result<TypeEffect, UndefinedJoinError>[] = zip(
      teffs1,
      teffs2,
    ).map(([teff1, teff2]) => typeEffectJoin(teff1, teff2));

    // Bypass to the shitty typing of Result.all
    const allJoinsResult = Result.all(allJoins) as unknown as Result<
      TypeEffect[],
      UndefinedJoinError
    >;

    const result = allJoinsResult.map((teffs) => {
      return Product({
        typeEffects: teffs,
      });
    });

    return result;
  }

  if (isKinded(ty1, TypeKind.Sum) && isKinded(ty2, TypeKind.Sum)) {
    const { typeEffects: teffs1 } = ty1;
    const { typeEffects: teffs2 } = ty2;

    if (teffs1.length !== teffs2.length) {
      return Result.err(new UndefinedJoinError());
    }

    const allJoins: Result<TypeEffect, UndefinedJoinError>[] = zip(
      teffs1,
      teffs2,
    ).map(([teff1, teff2]) => typeEffectJoin(teff1, teff2));

    // Bypass to the shitty typing of Result.all
    const allJoinsResult = Result.all(allJoins) as unknown as Result<
      TypeEffect[],
      UndefinedJoinError
    >;

    const result = allJoinsResult.map((teffs) => {
      return Sum({
        typeEffects: teffs,
      });
    });

    return result;
  }

  return Result.err(new UndefinedJoinError());
};

const typeEffectJoin = (
  teff1: TypeEffect,
  teff2: TypeEffect,
): Result<TypeEffect, UndefinedJoinError> => {
  if (
    isKinded(teff1, TypeEffectKind.TypeVar) &&
    isKinded(teff2, TypeEffectKind.TypeVar)
  ) {
    if (teff1.name !== teff2.name) {
      return Result.err(new UndefinedJoinError());
    }

    return Result.ok(teff1);
  }

  if (
    isKinded(teff1, TypeEffectKind.TypeEff) &&
    isKinded(teff2, TypeEffectKind.TypeEff)
  ) {
    const tyJoin = typeJoin(teff1.type, teff2.type);
    const effJoin = senvJoin(teff1.effect, teff2.effect);

    return Result.all([tyJoin]).map(([type]) => TypeEff(type, effJoin));
  }

  return Result.err(
    new UndefinedJoinError('Uncompatible type-and-effect constructors'),
  );
};

const Join = {
  Senv: senvJoin,
  Type: typeJoin,
  TypeEffect: typeEffectJoin,
};

export default Join;
