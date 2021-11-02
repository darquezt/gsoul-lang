export type Parser<T> = (ctx: Context) => Result<T>;

export type Context = Readonly<{
  text: string;
  currentIndex: number;
}>;

export type Result<T> = Success<T> | Failure;

export type Success<T> = Readonly<{
  success: true;
  value: T;
  ctx: Context;
}>;

export type Failure = Readonly<{
  success: false;
  expected: string;
  ctx: Context;
}>;

export function success<T>(ctx: Context, value: T): Success<T> {
  return { ctx, value, success: true };
}

export function failure(ctx: Context, expected: string): Failure {
  return { ctx, expected, success: false };
}
