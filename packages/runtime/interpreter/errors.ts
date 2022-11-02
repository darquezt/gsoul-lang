import { Token } from '@gsens-lang/parsing/lib/lexing';

export enum InterpreterErrorKind {
  InterpreterReferenceError = 'InterpreterReferenceError',
  InterpreterTypeError = 'InterpreterTypeError',
  InterpreterEvidenceError = 'InterpreterEvidenceError',
  InterpreterUnsupportedOperator = 'InterpreterUnsupportedOperator',
  InterpreterUnsupportedExpression = 'InterpreterUnsupportedExpression',
}

export class InterpreterReferenceError extends Error {
  variable: Token;
  name = InterpreterErrorKind.InterpreterReferenceError as const;

  constructor({ reason, variable }: { reason: string; variable: Token }) {
    super(reason);
    this.variable = variable;
  }
}

export class InterpreterTypeError extends Error {
  operator: Token;
  name = InterpreterErrorKind.InterpreterTypeError as const;

  constructor({ reason, operator }: { reason: string; operator: Token }) {
    super(reason);
    this.operator = operator;
  }
}

export class InterpreterEvidenceError extends Error {
  name = InterpreterErrorKind.InterpreterEvidenceError as const;

  constructor({ reason }: { reason: string }) {
    super(reason);
  }
}

/**
 * @deprecated This should not be used at all but it is a workaround while the language is still in development
 */
export class InterpreterUnsupportedOperator extends Error {
  name = InterpreterErrorKind.InterpreterUnsupportedOperator as const;
  operator: Token;

  constructor({ reason, operator }: { reason: string; operator: Token }) {
    super(reason);
    this.operator = operator;
  }
}

/**
 * @deprecated This should not be used at all but it is a workaround while the language is still in development
 */
export class InterpreterUnsupportedExpression extends Error {
  name = InterpreterErrorKind.InterpreterUnsupportedExpression as const;

  constructor({ reason }: { reason: string }) {
    super(reason);
  }
}

export type InterpreterError =
  | InterpreterReferenceError
  | InterpreterTypeError
  | InterpreterEvidenceError
  | InterpreterUnsupportedExpression
  | InterpreterUnsupportedOperator;
