import * as chalk from 'chalk';
import { TypeEffUtils } from '.';
import {
  factoryOf,
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
  domain: TypeEff;
  codomain: TypeEff;
};
export const Arrow: KindedFactory<Arrow> = factoryOf<Arrow>('Arrow');

export type ForallT = {
  kind: 'ForallT';
  sensVars: Identifier[];
  codomain: TypeEff;
};
export const ForallT: KindedFactory<ForallT> = factoryOf<ForallT>('ForallT');

export type Type = Real | Bool | Nil | Arrow | ForallT;

// U T I L S

export const subst = (ty: Type, name: Identifier, senv: Senv): Type => {
  switch (ty.kind) {
    case 'Real':
    case 'Nil':
    case 'Bool':
      return ty;
    case 'Arrow':
      return Arrow({
        domain: TypeEffUtils.subst(ty.domain, name, senv),
        codomain: TypeEffUtils.subst(ty.codomain, name, senv),
      });
    case 'ForallT':
      return ForallT({
        sensVars: ty.sensVars,
        codomain: TypeEffUtils.subst(ty.codomain, name, senv),
      });
  }
};

export const format = (ty: Type): string => {
  switch (ty.kind) {
    case 'Real':
      return chalk.yellow('Number');
    case 'Bool':
    case 'Nil':
      return chalk.yellow(ty.kind);
    case 'Arrow':
      return chalk`${TypeEffUtils.format(ty.domain)} -> ${TypeEffUtils.format(
        ty.codomain,
      )}`;
    case 'ForallT':
      return chalk`forall {green ${ty.sensVars.join(
        ' ',
      )}} . ${TypeEffUtils.format(ty.codomain)}`;
  }
};
