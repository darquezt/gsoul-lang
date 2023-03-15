import * as chalk from 'chalk';
import { identity, zip } from 'ramda';
import { TypeEffUtils } from '.';
import {
  factoryOf,
  isKinded,
  KindedFactory,
  singletonFactoryOf,
  SingletonKindedFactory,
} from './ADT';
// import { BaseErr, Err, Ok, Result } from './Result';
import { Result } from '@badrap/result';
import { Identifier, Senv } from './Senv';
import { TypeEff, TypeEffect } from './TypeEff';
import { UndefinedMeetError } from './Sens';
import Meet from './lib/Meet';

export enum TypeKind {
  Real = 'Real',
  Bool = 'Bool',
  Nil = 'Nil',
  Arrow = 'Arrow',
  ForallT = 'ForallT',
  MProduct = 'MProduct',
  AProduct = 'AProduct',
  Product = 'Product',
  RecType = 'RecType',
}

export type Real = { kind: TypeKind.Real };
export const Real: SingletonKindedFactory<Real> = singletonFactoryOf(
  TypeKind.Real,
);

export type Bool = { kind: TypeKind.Bool };
export const Bool: SingletonKindedFactory<Bool> = singletonFactoryOf(
  TypeKind.Bool,
);

export type Nil = { kind: TypeKind.Nil };
export const Nil: SingletonKindedFactory<Nil> = singletonFactoryOf(
  TypeKind.Nil,
);

export type Arrow = {
  kind: TypeKind.Arrow;
  domain: TypeEffect[];
  codomain: TypeEffect;
};
export const Arrow: KindedFactory<Arrow> = factoryOf<Arrow>(TypeKind.Arrow);

export type ArrowPattern<D = TypeEffect, C = TypeEffect> = {
  kind: TypeKind.Arrow;
  domain: D;
  codomain: C;
};
export const ArrowPattern: KindedFactory<ArrowPattern> =
  factoryOf<ArrowPattern>(TypeKind.Arrow);

export type ForallT = {
  kind: TypeKind.ForallT;
  sensVars: Identifier[];
  codomain: TypeEffect;
};
export const ForallT: KindedFactory<ForallT> = factoryOf<ForallT>(
  TypeKind.ForallT,
);

export type Product = {
  kind: TypeKind.Product;
  typeEffects: TypeEffect[];
};
export const Product: KindedFactory<Product> = factoryOf<Product>(
  TypeKind.Product,
);

export type MProduct = {
  kind: TypeKind.MProduct;
  first: TypeEffect;
  second: TypeEffect;
};
export const MProduct: KindedFactory<MProduct> = factoryOf<MProduct>(
  TypeKind.MProduct,
);

export type AProduct = {
  kind: TypeKind.AProduct;
  first: TypeEffect;
  second: TypeEffect;
};
export const AProduct: KindedFactory<AProduct> = factoryOf<AProduct>(
  TypeKind.AProduct,
);

export type RecType = {
  kind: TypeKind.RecType;
  variable: Identifier;
  body: TypeEffect;
};
export const RecType: KindedFactory<RecType> = factoryOf<RecType>(
  TypeKind.RecType,
);

export type Type =
  | Real
  | Bool
  | Nil
  | Arrow
  | ForallT
  | MProduct
  | AProduct
  | Product
  | RecType;

// U T I L S

type MatchFuns<R> = {
  real: (ty: Real) => R;
  bool: (ty: Bool) => R;
  nil: (ty: Nil) => R;
  arrow: (ty: Arrow) => R;
  forall: (ty: ForallT) => R;
  mprod: (ty: MProduct) => R;
  aprod: (ty: AProduct) => R;
  prod: (ty: Product) => R;
  recursive: (ty: RecType) => R;
};
const match =
  <R>(funs: MatchFuns<R>) =>
  (ty: Type) => {
    switch (ty.kind) {
      case TypeKind.Real:
        return funs.real(ty);
      case TypeKind.Nil:
        return funs.nil(ty);
      case TypeKind.Bool:
        return funs.bool(ty);
      case TypeKind.Arrow:
        return funs.arrow(ty);
      case TypeKind.ForallT:
        return funs.forall(ty);
      case TypeKind.MProduct:
        return funs.mprod(ty);
      case TypeKind.AProduct:
        return funs.aprod(ty);
      case TypeKind.RecType:
        return funs.recursive(ty);
      case TypeKind.Product:
        return funs.prod(ty);
    }
  };

export const subst = (target: Type, name: Identifier, senv: Senv): Type => {
  const typeEffFn = (teff: TypeEffect) =>
    TypeEffUtils.subst<TypeEffect>(teff, name, senv);

  return match<Type>({
    real: identity,
    bool: identity,
    nil: identity,
    arrow: (ty) =>
      Arrow({
        domain: ty.domain.map(typeEffFn),
        codomain: typeEffFn(ty.codomain),
      }),
    forall: (ty) =>
      ForallT({
        sensVars: ty.sensVars,
        codomain: typeEffFn(ty.codomain),
      }),
    mprod: (ty) =>
      MProduct({
        first: typeEffFn(ty.first),
        second: typeEffFn(ty.second),
      }),
    aprod: (ty) =>
      AProduct({
        first: typeEffFn(ty.first),
        second: typeEffFn(ty.second),
      }),
    recursive: (ty) =>
      RecType({
        variable: ty.variable,
        body: typeEffFn(ty.body),
      }),
    prod: (ty) =>
      Product({
        typeEffects: ty.typeEffects.map(typeEffFn),
      }),
  })(target);
};

export const substRecVar = (
  name: string,
  substitution: TypeEff,
): ((ty: Type) => Type) => {
  const typeEffFn = TypeEffUtils.substRecVar(name, substitution);

  return match<Type>({
    real: identity,
    bool: identity,
    nil: identity,
    arrow: (ty) =>
      Arrow({
        domain: ty.domain.map(typeEffFn),
        codomain: typeEffFn(ty.codomain),
      }),
    forall: (ty) =>
      ForallT({
        sensVars: ty.sensVars,
        codomain: typeEffFn(ty.codomain),
      }),
    mprod: (ty) =>
      MProduct({
        first: typeEffFn(ty.first),
        second: typeEffFn(ty.second),
      }),
    aprod: (ty) =>
      AProduct({
        first: typeEffFn(ty.first),
        second: typeEffFn(ty.second),
      }),
    recursive: (ty) =>
      RecType({
        variable: ty.variable,
        body: ty.variable === name ? ty.body : typeEffFn(ty.body),
      }),
    prod: (ty) =>
      Product({
        typeEffects: ty.typeEffects.map(typeEffFn),
      }),
  });
};

export const meet = (
  ty1: Type,
  ty2: Type,
): Result<Type, UndefinedMeetError> => {
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
        new UndefinedMeetError(
          'function types have uncompatible number of arguments',
        ),
      );
    }

    const domsMeet = Result.all(
      zip(dom1, dom2).map(([d1, d2]) => Meet.TypeEffect(d1, d2)),
    ) as unknown as Result<TypeEffect[], UndefinedMeetError>;

    return Result.all([domsMeet, TypeEffUtils.meet(cod1, cod2)]).map(
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
      return Result.err(new UndefinedMeetError());
    }

    return TypeEffUtils.meet(body1, body2).map((body) =>
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

    return TypeEffUtils.meet(cod1, cod2).map((codomain) =>
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
    ).map(([teff1, teff2]) => TypeEffUtils.meet(teff1, teff2));

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

export const format: (ty: Type) => string = match<string>({
  real: () => chalk.yellow('Number'),
  bool: (ty) => chalk.yellow(ty.kind),
  nil: (ty) => chalk.yellow(ty.kind),
  arrow: (ty) =>
    chalk`(${ty.domain
      .map((d) => `${TypeEffUtils.format(d)}`)
      .join(', ')}) -> ${TypeEffUtils.format(ty.codomain)}`,
  forall: (ty) =>
    chalk`forall {green ${ty.sensVars.join(' ')}} . ${TypeEffUtils.format(
      ty.codomain,
    )}`,
  mprod: (ty) =>
    chalk`${TypeEffUtils.format(ty.first)} ⊗ ${TypeEffUtils.format(ty.second)}`,
  aprod: (ty) =>
    chalk`${TypeEffUtils.format(ty.first)} & ${TypeEffUtils.format(ty.second)}`,
  recursive: (ty) => `rectype ${ty.variable} . ${TypeEffUtils.format(ty.body)}`,
  prod: (ty) => `(${ty.typeEffects.map(TypeEffUtils.format).join(', ')})`,
});

export const typeIsKinded = <K extends Type['kind']>(
  teff: TypeEff,
  kind: K,
): teff is TypeEff<Type & { kind: K }, Senv> => {
  return isKinded(teff.type, kind);
};
