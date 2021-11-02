type Kinded<T> = { kind: T };
export const isKinded = <T extends Kinded<string>, Kind extends T['kind']>(
  t: T,
  kind: Kind,
): t is T & { kind: Kind } => {
  return t.kind === kind;
};

export type KindedFactory<T extends Kinded<string>> = (
  params: Omit<T, 'kind'>,
) => T;
export const factoryOf = <
  T extends Kinded<string>,
  Kind extends T['kind'] = T['kind']
>(
  kind: Kind,
) => (params: Omit<T, 'kind'>): Kinded<Kind> & Omit<T, 'kind'> => ({
  kind,
  ...params,
});

export type SingletonKindedFactory<T extends Kinded<string>> = () => T;
export const singletonFactoryOf = <Kind extends string>(
  kind: Kind,
) => (): Kinded<Kind> => ({ kind });
