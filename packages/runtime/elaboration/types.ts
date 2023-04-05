import { TypeEnv } from '@gsoul-lang/core/utils';
import { ResourcesSet } from '@gsoul-lang/core/utils/ResourcesSet';

export type ElaborationContext = [TypeEnv, ResourcesSet];

export type Stateful<T> = {
  term: T;
  ctx: ElaborationContext;
};
export const Stateful = <T>(term: T, ctx: ElaborationContext): Stateful<T> => ({
  term,
  ctx,
});
