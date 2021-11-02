import { Failure, failure, Parser, Result, success } from './types';

export function str(match: string): Parser<string> {
  return (ctx) => {
    const endIndex = ctx.currentIndex + match.length;

    const text = ctx.text.substring(ctx.currentIndex, endIndex);

    if (text === match) {
      return success({ ...ctx, currentIndex: endIndex }, match);
    } else {
      return failure(ctx, match);
    }
  };
}

export function seq<T1, T2>(
  parsers: [Parser<T1>, Parser<T2>],
): Parser<[T1, T2]>;
export function seq<T1, T2, T3>(
  parsers: [Parser<T1>, Parser<T2>, Parser<T3>],
): Parser<[T1, T2, T3]>;
export function seq<T1, T2, T3, T4>(
  parsers: [Parser<T1>, Parser<T2>, Parser<T3>, Parser<T4>],
): Parser<[T1, T2, T3, T4]>;
export function seq<T1, T2, T3, T4, T5>(
  parsers: [Parser<T1>, Parser<T2>, Parser<T3>, Parser<T4>, Parser<T5>],
): Parser<[T1, T2, T3, T4, T5]>;
export function seq<T1, T2, T3, T4, T5, T6>(
  parsers: [
    Parser<T1>,
    Parser<T2>,
    Parser<T3>,
    Parser<T4>,
    Parser<T5>,
    Parser<T6>,
  ],
): Parser<[T1, T2, T3, T4, T5, T6]>;
export function seq<T>(parsers: Parser<T>[]): Parser<T[]> {
  return (ctx) => {
    const values: T[] = [];
    let currentCtx = ctx;

    for (const parser of parsers) {
      const response = parser(currentCtx);

      if (!response.success) {
        return response as Failure;
      }

      values.push(response.value);
      currentCtx = response.ctx;
    }

    return success(currentCtx, values);
  };
}

export function regex(re: RegExp, expected: string): Parser<string> {
  return (ctx) => {
    re.lastIndex = ctx.currentIndex;
    const response = re.exec(ctx.text);

    if (response?.index === ctx.currentIndex) {
      const match = response[0];
      const endIndex = ctx.currentIndex + match.length;
      return success({ ...ctx, currentIndex: endIndex }, match);
    }

    return failure(ctx, expected);
  };
}

export function any<T>(parsers: Parser<T>[]): Parser<T> {
  return (ctx) => {
    let fail: Result<T> | null = null;
    for (const parser of parsers) {
      const response = parser(ctx);

      if (response.success) {
        return response;
      }

      fail = response;
    }

    return fail as Failure;
  };
}

export function optional<T>(parser: Parser<T>): Parser<T | null> {
  return any([parser, (ctx) => success(ctx, null)]);
}

export function many<T>(parser: Parser<T>): Parser<T[]> {
  return (ctx) => {
    const values: T[] = [];
    let currentCtx = ctx;

    while (currentCtx.currentIndex < ctx.text.length) {
      const response = parser(currentCtx);

      if (!response.success) {
        break;
      }

      values.push(response.value);
      currentCtx = response.ctx;
    }

    return success(currentCtx, values);
  };
}

export function map<A, B>(parser: Parser<A>, fn: (val: A) => B): Parser<B> {
  return (ctx) => {
    const response = parser(ctx);

    if (!response.success) {
      return response as Failure;
    }

    return success(response.ctx, fn(response.value));
  };
}

export function dropL<A, B>(drop: Parser<A>, parser: Parser<B>): Parser<B> {
  return (ctx) => {
    const responseDrop = drop(ctx);

    if (!responseDrop.success) {
      return responseDrop as Failure;
    }

    const response = parser(responseDrop.ctx);

    return response;
  };
}

export function dropR<A, B>(parser: Parser<A>, drop: Parser<B>): Parser<A> {
  return (ctx) => {
    const response = parser(ctx);

    if (!response.success) {
      return response;
    }

    const responseDrop = drop(response.ctx);

    if (!responseDrop.success) {
      return responseDrop as Failure;
    }

    return {
      ...response,
      ctx: responseDrop.ctx,
    };
  };
}

export function log<T>(parser: Parser<T>, name: string): Parser<T> {
  return (ctx) => {
    console.log('[Parser]: Calling', name, 'with context:', ctx);

    return parser(ctx);
  };
}
