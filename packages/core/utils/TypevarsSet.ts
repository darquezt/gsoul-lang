type Identifier = string;

export type TypevarsSet = Array<Identifier>;
export const TypevarsSet = (ids: Array<Identifier> = []): TypevarsSet => ids;

export const extend = (rset: TypevarsSet, id: Identifier): TypevarsSet => [
  ...rset,
  id,
];

export const extendAll = (
  rset: TypevarsSet,
  ...resources: Identifier[]
): TypevarsSet => rset.concat(resources);

export const contains = (rset: TypevarsSet, id: Identifier): boolean =>
  rset.includes(id);
