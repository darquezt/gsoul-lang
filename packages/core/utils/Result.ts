export type Ok<T> = {
  success: true;
  result: T;
};
export const Ok = <T>(result: T): Ok<T> => ({
  success: true,
  result,
});

export type BaseErr = { reason: string };
export type Err<E extends BaseErr> = {
  success: false;
  error: E;
};
export const Err = <E extends BaseErr>(error: E): Err<E> => ({
  success: false,
  error,
});

export type Result<T, E extends BaseErr> = Ok<T> | Err<E>;
