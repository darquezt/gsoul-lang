import { Value } from '../ast';

export type Identifier = string;

export type Store = Record<Identifier, Value>;
export const Store = (map: Record<Identifier, Value> = {}): Store => map;

export const extend = (store: Store, name: string, value: Value): Store => ({
  ...store,
  [name]: value,
});

export const get = (store: Store, name: string): Value | undefined =>
  store[name];
