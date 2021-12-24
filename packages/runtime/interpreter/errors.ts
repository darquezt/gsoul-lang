import { factoryOf } from '@gsens-lang/core/utils/ADT';
import { Token } from '@gsens-lang/parsing/lib/lexing';

export type InterpreterReferenceError = {
  kind: 'InterpreterReferenceError';
  reason: string;
  variable: Token;
};
export const InterpreterReferenceError = factoryOf<InterpreterReferenceError>(
  'InterpreterReferenceError',
);

export type InterpreterTypeError = {
  kind: 'InterpreterTypeError';
  reason: string;
  operator: Token;
};
export const InterpreterTypeError = factoryOf<InterpreterTypeError>(
  'InterpreterTypeError',
);

export type InterpreterEvidenceError = {
  kind: 'InterpreterEvidenceError';
  reason: string;
};
export const InterpreterEvidenceError = factoryOf<InterpreterEvidenceError>(
  'InterpreterEvidenceError',
);

/**
 * @deprecated This should not be used at all but it is a workaround while the language is still in development
 */
export type InterpreterUnsupportedOperator = {
  kind: 'InterpreterUnsupportedOperator';
  reason: string;
  operator: Token;
};
/**
 * @deprecated This should not be used at all but it is a workaround while the language is still in development
 */
export const InterpreterUnsupportedOperator = factoryOf<InterpreterUnsupportedOperator>(
  'InterpreterUnsupportedOperator',
);

/**
 * @deprecated This should not be used at all but it is a workaround while the language is still in development
 */
export type InterpreterUnsupportedExpression = {
  kind: 'InterpreterUnsupportedExpression';
  reason: string;
};
/**
 * @deprecated This should not be used at all but it is a workaround while the language is still in development
 */
export const InterpreterUnsupportedExpression = factoryOf<InterpreterUnsupportedExpression>(
  'InterpreterUnsupportedExpression',
);

export type InterpreterError =
  | InterpreterReferenceError
  | InterpreterTypeError
  | InterpreterEvidenceError
  | InterpreterUnsupportedExpression
  | InterpreterUnsupportedOperator;
