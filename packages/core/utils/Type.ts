import * as chalk from 'chalk';
import { TypeEffUtils } from '.';
import {
  factoryOf,
  isKinded,
  KindedFactory,
  singletonFactoryOf,
  SingletonKindedFactory,
} from './ADT';
import { Identifier, Senv } from './Senv';
import { TypeEff } from './TypeEff';

export enum TypeKind {
  Real = 'Real',
  Bool = 'Bool',
  Nil = 'Nil',
  Arrow = 'Arrow',
  ForallT = 'ForallT',
  MProduct = 'MProduct',
  AProduct = 'AProduct',
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
  domain: TypeEff;
  codomain: TypeEff;
};
export const Arrow: KindedFactory<Arrow> = factoryOf<Arrow>(TypeKind.Arrow);

export type ForallT = {
  kind: TypeKind.ForallT;
  sensVars: Identifier[];
  codomain: TypeEff;
};
export const ForallT: KindedFactory<ForallT> = factoryOf<ForallT>(
  TypeKind.ForallT,
);

export type MProduct = {
  kind: TypeKind.MProduct;
  first: TypeEff;
  second: TypeEff;
};
export const MProduct: KindedFactory<MProduct> = factoryOf<MProduct>(
  TypeKind.MProduct,
);

export type AProduct = {
  kind: TypeKind.AProduct;
  first: TypeEff;
  second: TypeEff;
};
export const AProduct: KindedFactory<AProduct> = factoryOf<AProduct>(
  TypeKind.AProduct,
);

export type Type = Real | Bool | Nil | Arrow | ForallT | MProduct | AProduct;

// U T I L S

export const map = (ty: Type, typeEffFn: (teff: TypeEff) => TypeEff): Type => {
  switch (ty.kind) {
    case TypeKind.Real:
    case TypeKind.Nil:
    case TypeKind.Bool:
      return ty;
    case TypeKind.Arrow:
      return Arrow({
        domain: typeEffFn(ty.domain),
        codomain: typeEffFn(ty.codomain),
      });
    case TypeKind.ForallT:
      return ForallT({
        sensVars: ty.sensVars,
        codomain: typeEffFn(ty.codomain),
      });
    case TypeKind.MProduct:
      return MProduct({
        first: typeEffFn(ty.first),
        second: typeEffFn(ty.second),
      });

    case TypeKind.AProduct:
      return AProduct({
        first: typeEffFn(ty.first),
        second: typeEffFn(ty.second),
      });
  }
};

export const subst = (ty: Type, name: Identifier, senv: Senv): Type => {
  return map(ty, (teff: TypeEff) => TypeEffUtils.subst(teff, name, senv));
};

export const substTup = (
  ty: Type,
  names: [Identifier, Identifier],
  latents: [Senv, Senv],
  effect: Senv,
): Type => {
  return map(ty, (teff: TypeEff) =>
    TypeEffUtils.substTup(teff, names, latents, effect),
  );
};

export const format = (ty: Type): string => {
  switch (ty.kind) {
    case TypeKind.Real:
      return chalk.yellow('Number');
    case TypeKind.Bool:
    case TypeKind.Nil:
      return chalk.yellow(ty.kind);
    case TypeKind.Arrow:
      return chalk`${TypeEffUtils.format(ty.domain)} -> ${TypeEffUtils.format(
        ty.codomain,
      )}`;
    case TypeKind.ForallT:
      return chalk`forall {green ${ty.sensVars.join(
        ' ',
      )}} . ${TypeEffUtils.format(ty.codomain)}`;
    case TypeKind.MProduct:
      return chalk`${TypeEffUtils.format(ty.first)} ⊗ ${TypeEffUtils.format(
        ty.second,
      )}`;
    case TypeKind.AProduct:
      return chalk`${TypeEffUtils.format(ty.first)} & ${TypeEffUtils.format(
        ty.second,
      )}`;
  }
};

export const typeIsKinded = <K extends Type['kind']>(
  teff: TypeEff,
  kind: K,
): teff is TypeEff<Type & { kind: K }, Senv> => {
  return isKinded(teff.type, kind);
};
