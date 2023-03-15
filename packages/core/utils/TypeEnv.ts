import { TypeEff } from './TypeEff';

type Identifier = string;

export type TypeEnv = Record<Identifier, TypeEff>;
export const TypeEnv = (map: Record<Identifier, TypeEff> = {}): TypeEnv => map;

export const extend = (
  tenv: TypeEnv,
  id: Identifier,
  typeEff: TypeEff,
): TypeEnv => ({ ...tenv, [id]: typeEff });

export const extendAll = (
  tenv: TypeEnv,
  ...pairs: [Identifier, TypeEff][]
): TypeEnv =>
  pairs.reduce((acc, [id, typeEff]) => extend(acc, id, typeEff), tenv);
