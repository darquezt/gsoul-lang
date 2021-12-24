type ErrorParams = {
  expected?: string;
  after?: string;
  before?: string;
  beginning?: string;
  end?: string;
};

export const errorMessage = ({
  expected,
  after,
  before,
  beginning,
  end,
}: ErrorParams = {}): string => {
  const base = expected ? `Expected ${expected}` : 'Unexpected token';

  if (after) {
    return `${base} after ${after}`;
  }

  if (before) {
    return `${base} before ${before}`;
  }

  if (beginning) {
    return `${base} at the beginning of ${beginning}`;
  }

  if (end) {
    return `${base} at the end of ${end}`;
  }

  return base;
};
