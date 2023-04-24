const mapSet = <T, U>(set: Set<T>, fn: (value: T) => U): Set<U> => {
  return new Set(Array.from(set).map((x) => fn(x)));
};

const filterSet = <T>(set: Set<T>, fn: (value: T) => boolean): Set<T> => {
  return new Set(Array.from(set).filter((x) => fn(x)));
};

const unionSet = <T>(set1: Set<T>, set2: Set<T>): Set<T> => {
  return new Set([...set1, ...set2]);
};

const intersectSet = <T>(set1: Set<T>, set2: Set<T>): Set<T> => {
  return new Set(Array.from(set1).filter((x) => set2.has(x)));
};

const differenceSet = <T>(set1: Set<T>, set2: Set<T>): Set<T> => {
  return new Set(Array.from(set1).filter((x) => !set2.has(x)));
};

const sizeSet = <T>(set: Set<T>): number => {
  return set.size;
};

const splitSet = <T>(
  set: Set<T>,
  fn: (value: T) => boolean,
): [Set<T>, Set<T>] => {
  const set1 = new Set<T>();
  const set2 = new Set<T>();

  for (const x of set) {
    if (fn(x)) {
      set1.add(x);
    } else {
      set2.add(x);
    }
  }

  return [set1, set2];
};

const SetOps = {
  map: mapSet,
  filter: filterSet,
  union: unionSet,
  intersect: intersectSet,
  difference: differenceSet,
  size: sizeSet,
  split: splitSet,
};

export default SetOps;
