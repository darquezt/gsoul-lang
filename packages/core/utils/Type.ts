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

export type PolySenv = {
  kind: 'PolySenv';
  identifier: Identifier;
  typeEff: TypeEff;
};
export const PolySenv: KindedFactory<PolySenv> = factoryOf<PolySenv>(
  'PolySenv',
);

export type Type = Real | Bool | Nil | Arrow | PolySenv;

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
    case 'PolySenv':
      return PolySenv({
        identifier: ty.identifier,
        typeEff: TypeEffUtils.subst(ty.typeEff, name, senv),
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
      )})`;
    case 'PolySenv':
      return chalk`forall {green ${ty.identifier}} . ${TypeEffUtils.format(
        ty.typeEff,
      )}`;
  }
};
