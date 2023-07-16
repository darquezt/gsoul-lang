import { Senv } from '@gsoul-lang/core/utils';
import { TypeEffect } from '@gsoul-lang/core/utils/TypeEff';
import { Expression, ExpressionUtils } from '../elaboration/ast';

export type Identifier = string;

export type Store = Record<Identifier, Expression>;
export const Store = (map: Record<Identifier, Expression> = {}): Store => map;

export const extend = (
  store: Store,
  name: string,
  value: Expression,
): Store => ({
  ...store,
  [name]: value,
});

export const extendMany = (
  store: Store,
  names: string[],
  values: Expression[],
): Store => {
  return names.reduce(
    (storep, name, i) => extend(storep, name, values[i]),
    store,
  );
};

export const subst = (store: Store, name: string, senv: Senv): Store => {
  return Object.keys(store).reduce(
    (storep, id) =>
      extend(
        storep,
        id,
        ExpressionUtils.subst(get(store, id) as Expression, name, senv),
      ),
    {},
  );
};

export const substTypevar = (
  store: Store,
  name: string,
  teff: TypeEffect,
): Store => {
  return Object.keys(store).reduce(
    (storep, id) =>
      extend(
        storep,
        id,
        ExpressionUtils.substTypevar(
          get(store, id) as Expression,
          name,
          teff,
        ) as Expression,
      ),
    {},
  );
};

export const deleteResources = (store: Store, resources: string[]): Store => {
  return Object.keys(store).reduce(
    (storep, id) =>
      extend(
        storep,
        id,
        ExpressionUtils.deleteResources(
          get(store, id) as Expression,
          resources,
        ) as Expression,
      ),
    {},
  );
};

// export const substTup = (
//   store: Store,
//   names: [string, string],
//   latents: [Senv, Senv],
//   senv: Senv,
// ): Store => {
//   return Object.keys(store).reduce(
//     (storep, id) =>
//       extend(
//         storep,
//         id,
//         ExpressionUtils.substTup(
//           get(store, id) as Expression,
//           names,
//           latents,
//           senv,
//         ) as Expression,
//       ),
//     {},
//   );
// };

export const get = (store: Store, name: string): Expression | undefined =>
  store[name];
