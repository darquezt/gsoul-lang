import { TypeEff } from '@gsens-lang/core/utils';
import { factoryOf } from '@gsens-lang/core/utils/ADT';
import Token from '@gsens-lang/parsing/lexing/Token';

export type ElaborationReferenceError = {
  kind: 'ElaborationReferenceError';
  reason: string;
  variable: Token;
};
export const ElaborationReferenceError = factoryOf<ElaborationReferenceError>(
  'ElaborationReferenceError',
);

export type ElaborationTypeError = {
  kind: 'ElaborationTypeError';
  reason: string;
  operator: Token;
};
export const ElaborationTypeError = factoryOf<ElaborationTypeError>(
  'ElaborationTypeError',
);

export type ElaborationSubtypingError = {
  kind: 'ElaborationSubtypingError';
  reason: string;
  operator: Token;
  superType: TypeEff;
  type: TypeEff;
};
export const ElaborationSubtypingError = factoryOf<ElaborationSubtypingError>(
  'ElaborationSubtypingError',
);

export type ElaborationDependencyError = {
  kind: 'ElaborationDependencyError';
  reason: string;
  variable: Token;
};
export const ElaborationDependencyError = factoryOf<ElaborationDependencyError>(
  'ElaborationDependencyError',
);

/**
 * @deprecated This should not be used at all but it is a workaround while the language is still in development
 */
export type ElaborationUnsupportedExpressionError = {
  kind: 'ElaborationUnsupportedExpressionError';
  reason: string;
};
/**
 * @deprecated This should not be used at all but it is a workaround while the language is still in development
 */
export const ElaborationUnsupportedExpressionError = factoryOf<ElaborationUnsupportedExpressionError>(
  'ElaborationUnsupportedExpressionError',
);

export type ElaborationError =
  | ElaborationReferenceError
  | ElaborationTypeError
  | ElaborationSubtypingError
  | ElaborationDependencyError
  | ElaborationUnsupportedExpressionError;
