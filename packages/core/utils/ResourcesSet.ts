type Identifier = string;

export type ResourcesSet = Array<Identifier>;
export const ResourcesSet = (ids: Array<Identifier> = []): ResourcesSet => ids;

export const extend = (rset: ResourcesSet, id: Identifier): ResourcesSet => [
  ...rset,
  id,
];

export const extendAll = (
  rset: ResourcesSet,
  ...resources: Identifier[]
): ResourcesSet => rset.concat(resources);

export const contains = (rset: ResourcesSet, id: Identifier): boolean =>
  rset.includes(id);
