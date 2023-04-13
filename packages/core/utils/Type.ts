import * as chalk from 'chalk';
import { identity } from 'ramda';
import { TypeEffUtils } from '.';
import {
  factoryOf,
  isKinded,
  KindedFactory,
  singletonFactoryOf,
  SingletonKindedFactory,
} from './ADT';
// import { BaseErr, Err, Ok, Result } from './Result';
import { Identifier, Senv } from './Senv';
import { TypeEff, TypeEffect } from './TypeEff';

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
  Sum = 'Sum',
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

export type Sum = {
  kind: TypeKind.Sum;
  left: TypeEffect;
  right: TypeEffect;
};
export const Sum: KindedFactory<Sum> = factoryOf<Sum>(TypeKind.Sum);

export type RecType = {
  kind: TypeKind.RecType;
  variable: Identifier;
  body: TypeEffect;
};
export const RecType: KindedFactory<RecType> = factoryOf<RecType>(
  TypeKind.RecType,
);

export type Type = (
  | Real
  | Bool
  | Nil
  | Arrow
  | ForallT
  | MProduct
  | AProduct
  | Product
  | RecType
  | Sum
) & { alias?: string };

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
  sum: (ty: Sum) => R;
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
      case TypeKind.Sum:
        return funs.sum(ty);
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
    sum: (ty) =>
      Sum({
        left: typeEffFn(ty.left),
        right: typeEffFn(ty.right),
      }),
  })(target);
};

export const deleteResources = (ty: Type, resources: Identifier[]): Type => {
  const typeEffFn = (teff: TypeEffect) =>
    TypeEffUtils.deleteResources(teff, resources);

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
    sum: (ty) =>
      Sum({
        left: typeEffFn(ty.left),
        right: typeEffFn(ty.right),
      }),
  })(ty);
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
    sum: (ty) =>
      Sum({
        left: typeEffFn(ty.left),
        right: typeEffFn(ty.right),
      }),
  });
};

export const format: (ty: Type) => string = (ty) => {
  if (ty.alias) {
    return chalk`{yellow ${ty.alias}}`;
  }

  return match<string>({
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
      chalk`${TypeEffUtils.format(ty.first)} ⊗ ${TypeEffUtils.format(
        ty.second,
      )}`,
    aprod: (ty) =>
      chalk`${TypeEffUtils.format(ty.first)} & ${TypeEffUtils.format(
        ty.second,
      )}`,
    recursive: (ty) =>
      `rectype ${ty.variable} . ${TypeEffUtils.format(ty.body)}`,
    prod: (ty) => `(${ty.typeEffects.map(TypeEffUtils.format).join(', ')})`,
    sum: (ty) =>
      `(${TypeEffUtils.format(ty.left)} + ${TypeEffUtils.format(ty.right)})`,
  })(ty);
};

export const typeIsKinded = <K extends Type['kind']>(
  teff: TypeEff,
  kind: K,
): teff is TypeEff<Type & { kind: K }, Senv> => {
  return isKinded(teff.type, kind);
};
