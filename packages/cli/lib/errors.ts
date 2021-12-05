import { ElaborationError } from '@gsens-lang/runtime/elaboration/errors';
import { InterpreterError } from '@gsens-lang/runtime/interpreter/errors';
import * as chalk from 'chalk';

const formatFileName = (name: string, line?: number, col?: number) =>
  chalk.gray(`(at ${name}${line && col ? `:${line}:${col}` : ''})`);

const formatError = (name: string, reason: string) => chalk`
{bgRed ${name}}: ${reason}`;

const arrows = (padding: number, length = 1) => {
  const spaces = Array(padding).fill(' ').join('');
  const arrows = Array(length).fill('^').join('');

  return chalk.yellow(`${spaces}${arrows}`);
};

export const syntaxError = (
  line: { line: number; content: string; col: number; errorLength: number },
  file: string,
  reason?: string,
): string => chalk`
${line.content}
${arrows(line.col - 1, line.errorLength)}
{bgRed Syntax Error}${reason ? ` : ${reason}` : ''}
  ${formatFileName(file, line.line, line.col)}`;

interface ErrorMeta {
  lines: string[];
  file: string;
}

export const runtimeError = (
  error: ElaborationError | InterpreterError,
  { lines, file }: ErrorMeta,
): string => {
  switch (error.kind) {
    case 'InterpreterReferenceError':
      return chalk`
${lines[error.variable.line - 1]}
${arrows(error.variable.col - 1, error.variable.lexeme.length)}
${formatError('Reference error', error.reason)}
  ${formatFileName(file, error.variable.line, error.variable.col)}`;

    case 'InterpreterTypeError':
      return chalk`
${lines[error.operator.line - 1]}
${arrows(error.operator.col - 1, error.operator.lexeme.length)}
${formatError('Type error', error.reason)}
  ${formatFileName(file, error.operator.line, error.operator.col)}`;

    case 'InterpreterEvidenceError':
      return chalk`${formatError('Type error', error.reason)}`;

    case 'ElaborationReferenceError':
      return chalk`
${lines[error.variable.line - 1]}
${arrows(error.variable.col - 1, error.variable.lexeme.length)}
${formatError('Reference error', error.reason)}
  ${formatFileName(file, error.variable.line, error.variable.col)}`;

    case 'ElaborationTypeError':
      return chalk`
${lines[error.operator.line - 1]}
${arrows(error.operator.col - 1, error.operator.lexeme.length)}
${formatError('Type error', error.reason)}
${formatFileName(file, error.operator.line, error.operator.col)}`;

    case 'ElaborationDependencyError':
      return chalk`
${lines[error.variable.line - 1]}
${arrows(error.variable.col - 1, error.variable.lexeme.length)}
${formatError('Resource dependency error', error.reason)}
  ${formatFileName(file, error.variable.line, error.variable.col)}`;

    case 'ElaborationSubtypingError':
      return chalk`
${lines[error.operator.line - 1]}
${arrows(error.operator.col - 1, error.operator.lexeme.length)}
${formatError('Subtyping error', error.reason)}
  ${formatFileName(file, error.operator.line, error.operator.col)}`;

    default:
      return chalk`
{bgRed *${error.kind}*}: ${error.reason}
  ${formatFileName(file)}`;
  }
};
