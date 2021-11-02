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
  binder: { identifier: Identifier; type: Type };
  returnTypeEff: TypeEff;
};
export const Arrow: KindedFactory<Arrow> = factoryOf<Arrow>('Arrow');

export type Type = Real | Bool | Nil | Arrow;

// U T I L S

// type FMapParams = {
//   real: () => Real;
//   bool: () => Bool;
//   nil: () => Nil;
//   arrow: (arrow: Arrow) => Arrow;
// };

// const fmap = (params: FMapParams) => (ty: Type): Type => {
//   const { real, bool, nil, arrow } = params;
//   switch (ty.kind) {
//     case 'Real':
//       return real();
//     case 'Bool':
//       return bool();
//     case 'Nil':
//       return nil();
//     case 'Arrow':
//       return Arrow({
//         binder: {
//           identifier: ty.binder.identifier,
//           type: fmap(params)(ty.binder.type),
//         },
//         retu
//       });
//   }
// };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const subst = (ty: Type, _name: Identifier, _senv: Senv): Type => {
  return ty;
};
