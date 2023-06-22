import { Result } from '@badrap/result';
import * as chalk from 'chalk';

// export type Sens = Readonly<[number, number]>;
export class Sens {
  private readonly 0: number;
  private readonly 1: number;

  constructor(public min?: number, public max?: number) {
    if (isUndefined(min) && isUndefined(max)) {
      this[0] = 0;
      this[1] = MAX_SENS;
    } else if (isUndefined(min) && !isUndefined(max)) {
      this[0] = 0;
      this[1] = max;
    } else if (!isUndefined(min) && isUndefined(max)) {
      this[0] = min;
      this[1] = min;
    } else {
      this[0] = min as number;
      this[1] = max as number;
    }
  }

  *[Symbol.iterator](): Generator<number, void, unknown> {
    yield this[0];
    yield this[1];
  }

  plus(another: Sens): Sens {
    return new Sens(this[0] + another[0], this[1] + another[1]);
  }

  times(another: Sens): Sens {
    return new Sens(
      multiplyBounds(this[0], another[0]),
      multiplyBounds(this[1], another[1]),
    );
  }

  meet(another: Sens): Result<Sens, UndefinedMeetError> {
    if (another[0] > this[1] || this[0] > another[1]) {
      return Result.err(new UndefinedMeetError());
    }

    return Result.ok(
      new Sens(Math.max(this[0], another[0]), Math.min(this[1], another[1])),
    );
  }

  sjoin(another: Sens): Sens {
    return new Sens(
      maxBounds(this[0], another[0]),
      maxBounds(this[1], another[1]),
    );
  }

  smeet(another: Sens): Sens {
    return new Sens(
      Math.min(this[0], another[0]),
      Math.min(this[1], another[1]),
    );
  }

  scaleBy(factor: number): Sens {
    return new Sens(
      multiplyBounds(this[0], factor),
      multiplyBounds(this[1], factor),
    );
  }

  format(): string {
    const lowerString = this[0] === MAX_SENS ? '*' : String(this[0]);
    const upperString = this[1] === MAX_SENS ? '*' : String(this[1]);

    if (lowerString === upperString) {
      if (lowerString === '1') {
        return '';
      }

      return lowerString;
    }

    if (this[0] === 0 && this[1] === MAX_SENS) {
      return '?';
    }

    return `${lowerString}..${upperString}`;
  }
}

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

// export const new Sens = (lower: number, upper: number): Sens => ({
//   0: lower,
//   1: upper,
//   *[Symbol.iterator]() {
//     yield lower;
//     yield upper;
//   },
//   plus(another) {
//     return new Sens(lower + another[0], upper + another[1]);
//   },
//   times(another) {
//     return new Sens(
//       multiplyBounds(lower, another[0]),
//       multiplyBounds(upper, another[1]),
//     );
//   },
//   meet(another: Sens) {
//     if (another[0] > upper || lower > another[1]) {
//       return Result.err(new UndefinedMeetError());
//     }

//     return Result.ok(
//       new Sens(Math.max(lower, another[0]), Math.min(upper, another[1])),
//     );
//   },
//   sjoin(another) {
//     return new Sens(maxBounds(lower, another[0]), maxBounds(upper, another[1]));
//   },
//   smeet(another) {
//     return new Sens(Math.min(lower, another[0]), Math.min(upper, another[1]));
//   },
//   scaleBy(factor) {
//     return new Sens(
//       multiplyBounds(lower, factor),
//       multiplyBounds(upper, factor),
//     );
//   },
//   format() {
//     const lowerString = lower === MAX_SENS ? '∞' : String(lower);
//     const upperString = upper === MAX_SENS ? '∞' : String(upper);

//     if (lowerString === upperString) {
//       return lowerString;
//     }

//     if (lower === 0 && upper === MAX_SENS) {
//       return chalk.magenta('?');
//     }

//     return `[${lowerString},${upperString}]`;
//   },
// });

// export const Sens = (lower?: number, upper?: number): Sens => {};

export const UNKNOWN_SENS = new Sens(0, MAX_SENS);

export const UnknownSens = (): Sens => {
  return UNKNOWN_SENS;
};

export const MaxSens = (): Sens => {
  return new Sens(MAX_SENS, MAX_SENS);
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
  return new Sens(addBounds(a[0], b[0]), addBounds(a[1], b[1]));
};

/**
 * @deprecated
 */
export const mult = (a: Sens, b: Sens): Sens => {
  return new Sens(multiplyBounds(a[0], b[0]), multiplyBounds(a[1], b[1]));
};

export class UndefinedMeetError extends Error {}

/**
 * @deprecated
 */
export const meet = (a: Sens, b: Sens): Result<Sens, UndefinedMeetError> => {
  if (b[0] > a[1] || a[0] > b[1]) {
    return Result.err(new UndefinedMeetError());
  }

  return Result.ok(new Sens(Math.max(a[0], b[0]), Math.min(a[1], b[1])));
};

/**
 * @deprecated
 */
export const sjoin = (a: Sens, b: Sens): Sens => {
  return new Sens(maxBounds(a[0], b[0]), maxBounds(a[1], b[1]));
};

/**
 * @deprecated
 */
export const scale = (sens: Sens, factor: number): Sens =>
  new Sens(multiplyBounds(sens[0], factor), multiplyBounds(sens[1], factor));

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
