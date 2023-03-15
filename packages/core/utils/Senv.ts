import * as chalk from 'chalk';
import { map, mergeWith, omit } from 'ramda';
import { Sens } from './Sens';
import * as SensUtils from './Sens';
import { UndefinedMeetError } from './Sens';
import { Result } from '@badrap/result';

export type Identifier = string;

const InftySenvKind = '__Infty';
export type Senv = Record<Identifier, Sens>;
export const Senv = (map: Senv = {}): Senv => map;

/**
 * @returns A dummy senv with a special key to discriminate from a true senv
 */
export const MaxSenv = (): Senv =>
  Senv({ [InftySenvKind]: SensUtils.MaxSens() });

export const access = (senv: Senv, name: Identifier): Sens => {
  if (senv[InftySenvKind]) {
    return SensUtils.MaxSens();
  }

  const sens = senv[name];

  if (!sens) {
    return new Sens(0);
  }

  return sens;
};

export const add = (a: Senv, b: Senv): Senv => {
  return mergeWith((asens: Sens, bsens: Sens) => asens.plus(bsens), a, b);
};

export const meet = (a: Senv, b: Senv): Result<Senv, UndefinedMeetError> => {
  const senv1Keys = Object.keys(a);
  const senv2Keys = Object.keys(b);
  const keys = [...senv1Keys, ...senv2Keys];

  let result = Senv();

  for (const x of keys) {
    const sensMeetRes = SensUtils.meet(access(a, x), access(b, x));

    if (!sensMeetRes.isOk) {
      return Result.err(new UndefinedMeetError());
    }

    result = extend(result, x, sensMeetRes.value);
  }

  return Result.ok(result);
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

export const substTup = (
  senv: Senv,
  names: [Identifier, Identifier],
  latents: [Senv, Senv],
  effect: Senv,
): Senv => {
  const x1Sens = access(senv, names[0]);
  const x2Sens = access(senv, names[1]);
  const withoutX1X2 = omit(names, senv);
  const scaledEffect11 = scaleBySens(latents[0], x1Sens);
  const scaledEffect12 = scaleBySens(latents[1], x2Sens);
  const scaledEffect1 = scaleBySens(effect, SensUtils.sjoin(x1Sens, x2Sens));

  return add(
    withoutX1X2,
    add(scaledEffect11, add(scaledEffect12, scaledEffect1)),
  );
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
