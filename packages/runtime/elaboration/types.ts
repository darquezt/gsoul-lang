import { TypeEnv } from '@gsoul-lang/core/utils';
import { ResourcesSet } from '@gsoul-lang/core/utils/ResourcesSet';
import { TypevarsSet } from '@gsoul-lang/core/utils/TypevarsSet';

export type ElaborationContext = [
  typeEnvironment: TypeEnv,
  resources: ResourcesSet,
  typeVariables: TypevarsSet,
];

export type Stateful<T> = {
  term: T;
  ctx: ElaborationContext;
};
export const Stateful = <T>(term: T, ctx: ElaborationContext): Stateful<T> => ({
  term,
  ctx,
});
