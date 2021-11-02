import { TypeEff } from './TypeEff';

type Identifier = string;

export type TypeEnv = Record<Identifier, TypeEff>;
export const TypeEnv = (map: Record<Identifier, TypeEff> = {}): TypeEnv => map;

export const extend = (
  tenv: TypeEnv,
  id: Identifier,
  typeEff: TypeEff,
): TypeEnv => ({ ...tenv, [id]: typeEff });
