import { Result } from '@badrap/result';
import { Type, TypeEff } from '..';
import { Senv } from '../Senv';

type SenvOp = (senv1: Senv, senv2: Senv) => Senv;

export const liftSenvOp =
  (op: SenvOp) =>
  <T extends Type>(typeEff: TypeEff<T, Senv>, senv: Senv): TypeEff<T, Senv> =>
    TypeEff(typeEff.type, op(typeEff.effect, senv));

type SenvResultOp<E extends Error> = (
  senv1: Senv,
  senv2: Senv,
) => Result<Senv, E>;

export const liftSenvResultOp =
  <E extends Error>(op: SenvResultOp<E>) =>
  <T extends Type>(
    typeEff: TypeEff<T, Senv>,
    senv: Senv,
  ): Result<TypeEff<T, Senv>, E> =>
    op(typeEff.effect, senv).map((effect) => TypeEff(typeEff.type, effect));
