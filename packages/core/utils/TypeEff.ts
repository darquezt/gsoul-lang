import { Identifier, Senv } from './Senv';
import * as SenvUtils from './Senv';
import { Type } from './Type';
import * as TypeUtils from './Type';

export type TypeEff<T extends Type = Type, E extends Senv = Senv> = {
  type: T;
  effect: E;
};
export const TypeEff = <T extends Type = Type, E extends Senv = Senv>(
  type: T,
  effect: E,
): TypeEff<T, E> => ({
  type,
  effect,
});

export const subst = (
  typeEff: TypeEff,
  name: Identifier,
  effect: Senv,
): TypeEff => {
  return TypeEff(
    TypeUtils.subst(typeEff.type, name, effect),
    SenvUtils.subst(typeEff.effect, name, effect),
  );
};

export const format = (typeEff: TypeEff): string => {
  return `${TypeUtils.format(typeEff.type)}@[${SenvUtils.format(
    typeEff.effect,
  )}]`;
};
