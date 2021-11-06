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

const RealKind = 'Real';
export type Real = { kind: typeof RealKind };
export const Real: SingletonKindedFactory<Real> = singletonFactoryOf('Real');

const BoolKind = 'Bool';
export type Bool = { kind: typeof BoolKind };
export const Bool: SingletonKindedFactory<Bool> = singletonFactoryOf('Bool');

const NilKind = 'Nil';
export type Nil = { kind: typeof NilKind };
export const Nil: SingletonKindedFactory<Nil> = singletonFactoryOf('Nil');

export type Arrow = {
  kind: 'Arrow';
  binder: { identifier: Identifier; type: Type };
  returnTypeEff: TypeEff;
};
export const Arrow: KindedFactory<Arrow> = factoryOf<Arrow>('Arrow');

export type Type = Real | Bool | Nil | Arrow;

// U T I L S

export const subst = (ty: Type, name: Identifier, senv: Senv): Type => {
  if (isKinded(ty, 'Real') || isKinded(ty, 'Nil') || isKinded(ty, 'Bool')) {
    return ty;
  }

  return Arrow({
    binder: {
      identifier: ty.binder.identifier,
      type: subst(ty.binder.type, name, senv),
    },
    returnTypeEff: TypeEffUtils.subst(ty.returnTypeEff, name, senv),
  });
};

export const format = (ty: Type): string => {
  switch (ty.kind) {
    case 'Real':
      return chalk.yellow('Number');
    case 'Bool':
    case 'Nil':
      return chalk.yellow(ty.kind);
    case 'Arrow':
      return chalk`(${ty.binder.identifier}:${format(
        ty.binder.type,
      )} -> ${TypeEffUtils.format(ty.returnTypeEff)})`;
  }
};
