import { match, __ } from 'ts-pattern';

export type Sens = Readonly<[number, number]>;

export const MAX_SENS = 9007199254740991 as const;
export const UNKNOWN_SENS = [0, MAX_SENS] as const;

export type UnknownSens = typeof UNKNOWN_SENS;
export type MaxSens = [typeof MAX_SENS, typeof MAX_SENS];

export const Sens = (lower?: number, upper?: number): Sens => {
  if (!lower && !upper) {
    return UNKNOWN_SENS;
  } else if (!lower && upper) {
    return [0, upper];
  } else if (lower && !upper) {
    return [lower, lower];
  }

  return [lower as number, upper as number];
};

export const UnknownSens = (): UnknownSens => {
  return UNKNOWN_SENS;
};

export const MaxSens = (): MaxSens => {
  return [MAX_SENS, MAX_SENS];
};

const addBounds = (a: number, b: number): number => {
  return match([a, b])
    .with([MAX_SENS, __], () => MAX_SENS)
    .with([__, MAX_SENS], () => MAX_SENS)
    .otherwise(() => a + b);
};

export const add = (a: Sens, b: Sens): Sens => {
  return [addBounds(a[0], b[0]), addBounds(a[1], b[1])];
};

const multiplyBounds = (a: number, b: number) =>
  match([a, b])
    .with([0, MAX_SENS], () => 0)
    .with([MAX_SENS, 0], () => 0)
    .with([__, MAX_SENS], () => MAX_SENS)
    .with([MAX_SENS, __], () => MAX_SENS)
    .otherwise(() => a * b);

export const mult = (a: Sens, b: Sens): Sens => {
  return [multiplyBounds(a[0], b[0]), multiplyBounds(a[1], b[1])];
};

export const scale = (sens: Sens, factor: number): Sens => [
  multiplyBounds(sens[0], factor),
  multiplyBounds(sens[1], factor),
];
