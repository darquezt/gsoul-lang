import { Result } from '@badrap/result';
import * as chalk from 'chalk';

// export type Sens = Readonly<[number, number]>;
export type Sens = {
  0: number;
  1: number;
  [Symbol.iterator](this: Sens): Generator<number, void, unknown>;
  plus(another: Sens): Sens;
  times(another: Sens): Sens;
  meet(another: Sens): Result<Sens, UndefinedMeetError>;
  sjoin(another: Sens): Sens;
  scaleBy(factor: number): Sens;
  format(): string;
};

export const MAX_SENS = Infinity;

const isUndefined = (s?: number): s is undefined => !s && s !== 0;

const multiplyBounds = (a: number, b: number) => {
  if (a === 0 || b === 0) {
    return 0;
  }

  if (a === MAX_SENS || b === MAX_SENS) {
    return MAX_SENS;
  }

  return a * b;
};

export const makeSens = (lower: number, upper: number): Sens => ({
  0: lower,
  1: upper,
  *[Symbol.iterator]() {
    yield lower;
    yield upper;
  },
  plus(another) {
    return makeSens(lower + another[0], upper + another[1]);
  },
  times(another) {
    return makeSens(
      multiplyBounds(lower, another[0]),
      multiplyBounds(upper, another[1]),
    );
  },
  meet(another: Sens) {
    if (another[0] > upper || lower > another[1]) {
      return Result.err(new UndefinedMeetError());
    }

    return Result.ok(
      makeSens(Math.max(lower, another[0]), Math.min(upper, another[1])),
    );
  },
  sjoin(another) {
    return makeSens(maxBounds(lower, another[0]), maxBounds(upper, another[1]));
  },
  scaleBy(factor) {
    return makeSens(
      multiplyBounds(lower, factor),
      multiplyBounds(upper, factor),
    );
  },
  format() {
    const lowerString = lower === MAX_SENS ? '∞' : String(lower);
    const upperString = upper === MAX_SENS ? '∞' : String(upper);

    if (lowerString === upperString) {
      return lowerString;
    }

    if (lower === 0 && upper === MAX_SENS) {
      return chalk.magenta('?');
    }

    return `[${lowerString},${upperString}]`;
  },
});

export const Sens = (lower?: number, upper?: number): Sens => {
  if (isUndefined(lower) && isUndefined(upper)) {
    return UNKNOWN_SENS;
  } else if (isUndefined(lower) && !isUndefined(upper)) {
    return makeSens(0, upper);
  } else if (!isUndefined(lower) && isUndefined(upper)) {
    return makeSens(lower, lower);
  }

  return makeSens(lower as number, upper as number);
};

export const UNKNOWN_SENS = makeSens(0, MAX_SENS);

export const UnknownSens = (): Sens => {
  return UNKNOWN_SENS;
};

export const MaxSens = (): Sens => {
  return makeSens(MAX_SENS, MAX_SENS);
};

const addBounds = (a: number, b: number): number => {
  if (a === MAX_SENS || b === MAX_SENS) {
    return MAX_SENS;
  }

  return a + b;
};

const maxBounds = (a: number, b: number): number => {
  if (a === MAX_SENS || b === MAX_SENS) {
    return MAX_SENS;
  }

  return Math.max(a, b);
};

/**
 * @deprecated
 */
export const add = (a: Sens, b: Sens): Sens => {
  return makeSens(addBounds(a[0], b[0]), addBounds(a[1], b[1]));
};

/**
 * @deprecated
 */
export const mult = (a: Sens, b: Sens): Sens => {
  return makeSens(multiplyBounds(a[0], b[0]), multiplyBounds(a[1], b[1]));
};

export class UndefinedMeetError extends Error {}

/**
 * @deprecated
 */
export const meet = (a: Sens, b: Sens): Result<Sens, UndefinedMeetError> => {
  if (b[0] > a[1] || a[0] > b[1]) {
    return Result.err(new UndefinedMeetError());
  }

  return Result.ok(makeSens(Math.max(a[0], b[0]), Math.min(a[1], b[1])));
};

/**
 * @deprecated
 */
export const sjoin = (a: Sens, b: Sens): Sens => {
  return makeSens(maxBounds(a[0], b[0]), maxBounds(a[1], b[1]));
};

/**
 * @deprecated
 */
export const scale = (sens: Sens, factor: number): Sens =>
  makeSens(multiplyBounds(sens[0], factor), multiplyBounds(sens[1], factor));

/**
 * @deprecated
 */
export const format = ([s1, s2]: Sens): string => {
  const s1String = s1 === MAX_SENS ? '∞' : String(s1);
  const s2String = s2 === MAX_SENS ? '∞' : String(s2);

  if (s1String === s2String) {
    return s1String;
  }

  if (s1 === 0 && s2 === MAX_SENS) {
    return chalk.magenta('?');
  }

  return `[${s1String},${s2String}]`;
};
