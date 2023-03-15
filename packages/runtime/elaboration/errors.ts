import { Token } from '@gsoul-lang/parsing/lib/lexing';

export enum ElaborationErrorKind {
  ElaborationReferenceError = 'ElaborationReferenceError',
  ElaborationTypeError = 'ElaborationTypeError',
  ElaborationSubtypingError = 'ElaborationSubtypingError',
  ElaborationDependencyError = 'ElaborationDependencyError',
  ElaborationUnsupportedExpressionError = 'ElaborationUnsupportedExpressionError',
}

export class ElaborationReferenceError extends Error {
  variable: Token;
  name = ElaborationErrorKind.ElaborationReferenceError as const;

  constructor({ reason, variable }: { reason: string; variable: Token }) {
    super(reason);
    this.variable = variable;
  }
}

export class ElaborationTypeError extends Error {
  operator: Token;
  name = ElaborationErrorKind.ElaborationTypeError as const;

  constructor({ reason, operator }: { reason: string; operator: Token }) {
    super(reason);
    this.operator = operator;
  }
}

export class ElaborationSubtypingError extends Error {
  operator: Token;
  name = ElaborationErrorKind.ElaborationSubtypingError as const;

  constructor({ reason, operator }: { reason: string; operator: Token }) {
    super(reason);
    this.operator = operator;
  }
}

export class ElaborationDependencyError extends Error {
  variable: Token;
  name = ElaborationErrorKind.ElaborationDependencyError as const;

  constructor({ reason, variable }: { reason: string; variable: Token }) {
    super(reason);
    this.variable = variable;
  }
}

/**
 * @deprecated This should not be used at all but it is a workaround while the language is still in development
 */
export class ElaborationUnsupportedExpressionError extends Error {
  name = ElaborationErrorKind.ElaborationUnsupportedExpressionError as const;

  constructor({ reason }: { reason: string }) {
    super(reason);
  }
}

export type ElaborationError =
  | ElaborationReferenceError
  | ElaborationTypeError
  | ElaborationSubtypingError
  | ElaborationDependencyError
  | ElaborationUnsupportedExpressionError;
