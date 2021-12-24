type Kinded<T> = { kind: T };
/**
 * A discriminator function for kinded unions
 *
 * @param t a kinded element
 * @param kind a kind
 * @returns whether `t` is of kind `kind`
 */
export const isKinded = <T extends Kinded<string>, Kind extends T['kind']>(
  t: T,
  kind: Kind,
): t is T & { kind: Kind } => {
  return t.kind === kind;
};

export type KindedFactory<T extends Kinded<string>> = (
  params: Omit<T, 'kind'>,
) => T;

/**
 * It creates a function that creates inhabitants, e.g. objects, of a certain kinded type, without the necessity of expliciting the kind during the object creation.
 *
 * @param kind The kind of the type
 * @returns A factory for creating inhabitants of the type
 */
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
/**
 * Analogous to `factoryOf` but for types that have no parameters, e.g. no fields.
 *
 * @param kind The kind of the type
 * @returns A factory for creating inhabitants of the type
 */
export const singletonFactoryOf = <Kind extends string>(
  kind: Kind,
) => (): Kinded<Kind> => ({ kind });
