import * as chalk from 'chalk';
import { map, mergeWith, omit } from 'ramda';
import { Sens } from './Sens';
import * as SensUtils from './Sens';

export type Identifier = string;

export type Senv = Record<Identifier, Sens>;
export const Senv = (map: Senv = {}): Senv => map;

export const access = (senv: Senv, name: Identifier): Sens => {
  const sens = senv[name];

  if (!sens) {
    return Sens(0);
  }

  return sens;
};

export const add = (a: Senv, b: Senv): Senv => {
  return mergeWith(
    (asens: Sens, bsens: Sens) => SensUtils.add(asens, bsens),
    a,
    b,
  );
};

export const scale = (senv: Senv, factor: number): Senv => {
  return map((sens) => SensUtils.scale(sens, factor), senv);
};

export const scaleInf = (senv: Senv): Senv => {
  return scale(senv, SensUtils.MAX_SENS);
};

export const scaleBySens = (senv: Senv, sens: Sens): Senv => {
  return map((s) => SensUtils.mult(s, sens), senv);
};

export const extend = (senv: Senv, name: Identifier, sens: Sens): Senv => {
  return {
    ...senv,
    [name]: sens,
  };
};

export const subst = (senv: Senv, name: Identifier, effect: Senv): Senv => {
  const xSens = access(senv, name);
  const withoutX = omit([name], senv);
  const scaledEffect = scaleBySens(effect, xSens);

  return add(withoutX, scaledEffect);
};

export const isEmpty = (senv: Senv): boolean => Object.keys(senv).length === 0;

export const format = (senv: Senv): string => {
  if (Object.keys(senv).length === 0) {
    return '';
  }

  const senvString = Object.entries(senv)
    .map(([variable, sens]) => `${SensUtils.format(sens)}${variable}`)
    .join(' + ');

  return chalk.green(senvString);
};
