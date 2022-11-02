import { Senv } from '@gsens-lang/core/utils';
import { ExpressionUtils, Value } from '../elaboration/ast';

export type Identifier = string;

export type Store = Record<Identifier, Value>;
export const Store = (map: Record<Identifier, Value> = {}): Store => map;

export const extend = (store: Store, name: string, value: Value): Store => ({
  ...store,
  [name]: value,
});

export const subst = (store: Store, name: string, senv: Senv): Store => {
  return Object.keys(store).reduce(
    (storep, id) =>
      extend(
        storep,
        id,
        ExpressionUtils.subst(get(store, id) as Value, name, senv) as Value,
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
//           get(store, id) as Value,
//           names,
//           latents,
//           senv,
//         ) as Value,
//       ),
//     {},
//   );
// };

export const get = (store: Store, name: string): Value | undefined =>
  store[name];
