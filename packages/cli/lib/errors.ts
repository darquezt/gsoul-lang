import { ElaborationError } from '@gsens-lang/runtime/elaboration/errors';
import { InterpreterError } from '@gsens-lang/runtime/interpreter/errors';
import * as chalk from 'chalk';

const formatLine = (number: number, content: string) => chalk`
{gray line ${number}:} ${content}`;

const formatError = (name: string, reason: string) => chalk`
{bgRed ${name}}: ${reason}`;

export const syntaxError = (
  line: { number: number; content: string },
  reason?: string,
): string => chalk`
${formatLine(line.number, line.content)}

{bgRed Syntax Error}${reason ? ` : ${reason}` : ''}
`;

export const runtimeError = (
  lines: string[],
  error: ElaborationError | InterpreterError,
): string => {
  switch (error.kind) {
    case 'InterpreterReferenceError':
      return chalk`
${formatLine(error.variable.line, lines[error.variable.line - 1])}

${formatError('Reference error', error.reason)}`;

    case 'InterpreterTypeError':
      return chalk`
${formatLine(error.operator.line, lines[error.operator.line - 1])}

${formatError('Type error', error.reason)}`;

    case 'InterpreterEvidenceError':
      return chalk`${formatError('Type error', error.reason)}`;

    case 'ElaborationReferenceError':
      return chalk`
${formatLine(error.variable.line, lines[error.variable.line - 1])}

${formatError('Reference error', error.reason)}`;

    case 'ElaborationTypeError':
      return chalk`
${formatLine(error.operator.line, lines[error.operator.line - 1])}

${formatError('Type error', error.reason)}`;

    case 'ElaborationDependencyError':
      return chalk`
${formatLine(error.variable.line, lines[error.variable.line - 1])}

${formatError('Resource dependency error', error.reason)}`;

    case 'ElaborationSubtypingError':
      return chalk`
${formatLine(error.operator.line, lines[error.operator.line - 1])}

${formatError('Subtyping error', error.reason)}`;

    default:
      return chalk`{bgRed *${error.kind}*}: ${error.reason}`;
  }
};
