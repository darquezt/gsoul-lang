import { Token } from '@gsoul-lang/parsing/lib/lexing';

export enum TypeCheckingErrorKind {
  TypeCheckingReferenceError = 'TypeCheckingReferenceError',
  TypeCheckingTypeError = 'TypeCheckingTypeError',
  TypeCheckingSubtypingError = 'TypeCheckingSubtypingError',
  TypeCheckingDependencyError = 'TypeCheckingDependencyError',
  TypeCheckingUnsupportedExpressionError = 'TypeCheckingUnsupportedExpressionError',
}

export class TypeCheckingReferenceError extends Error {
  token: Token;
  name = TypeCheckingErrorKind.TypeCheckingReferenceError as const;

  constructor({ reason, variable }: { reason: string; variable: Token }) {
    super(reason);
    this.token = variable;
  }
}

export class TypeCheckingTypeError extends Error {
  token: Token;
  name = TypeCheckingErrorKind.TypeCheckingTypeError as const;

  constructor({ reason, operator }: { reason: string; operator: Token }) {
    super(reason);
    this.token = operator;
  }
}

export class TypeCheckingSubtypingError extends Error {
  token: Token;
  name = TypeCheckingErrorKind.TypeCheckingSubtypingError as const;

  constructor({ reason, operator }: { reason: string; operator: Token }) {
    super(reason);
    this.token = operator;
  }
}

export class TypeCheckingDependencyError extends Error {
  token: Token;
  name = TypeCheckingErrorKind.TypeCheckingDependencyError as const;

  constructor({ reason, variable }: { reason: string; variable: Token }) {
    super(reason);
    this.token = variable;
  }
}

export type TypeCheckingError =
  | TypeCheckingReferenceError
  | TypeCheckingTypeError
  | TypeCheckingSubtypingError
  | TypeCheckingDependencyError;
