import { TypeEffect } from './TypeEff';

type Identifier = string;

export type TypeEnv = Record<Identifier, TypeEffect>;
export const TypeEnv = (map: Record<Identifier, TypeEffect> = {}): TypeEnv =>
  map;

export const extend = (
  tenv: TypeEnv,
  id: Identifier,
  typeEff: TypeEffect,
): TypeEnv => ({ ...tenv, [id]: typeEff });

export const extendAll = (
  tenv: TypeEnv,
  ...pairs: [Identifier, TypeEffect][]
): TypeEnv =>
  pairs.reduce((acc, [id, typeEff]) => extend(acc, id, typeEff), tenv);
