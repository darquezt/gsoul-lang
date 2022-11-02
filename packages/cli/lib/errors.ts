import {
  ElaborationError,
  ElaborationErrorKind,
  InterpreterError,
  InterpreterErrorKind,
} from '@gsoul-lang/runtime';
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
  switch (error.name) {
    case InterpreterErrorKind.InterpreterReferenceError:
      return chalk`
${lines[error.variable.line - 1]}
${arrows(error.variable.col - 1, error.variable.lexeme.length)}
${formatError('Reference error', error.message)}
  ${formatFileName(file, error.variable.line, error.variable.col)}`;

    case InterpreterErrorKind.InterpreterTypeError:
      return chalk`
${lines[error.operator.line - 1]}
${arrows(error.operator.col - 1, error.operator.lexeme.length)}
${formatError('Type error', error.message)}
  ${formatFileName(file, error.operator.line, error.operator.col)}`;

    case InterpreterErrorKind.InterpreterEvidenceError:
      return chalk`${formatError('Type error', error.message)}`;

    case ElaborationErrorKind.ElaborationReferenceError:
      return chalk`
${lines[error.variable.line - 1]}
${arrows(error.variable.col - 1, error.variable.lexeme.length)}
${formatError('Reference error', error.message)}
  ${formatFileName(file, error.variable.line, error.variable.col)}`;

    case ElaborationErrorKind.ElaborationTypeError:
      return chalk`
${lines[error.operator.line - 1]}
${arrows(error.operator.col - 1, error.operator.lexeme.length)}
${formatError('Type error', error.message)}
${formatFileName(file, error.operator.line, error.operator.col)}`;

    case ElaborationErrorKind.ElaborationDependencyError:
      return chalk`
${lines[error.variable.line - 1]}
${arrows(error.variable.col - 1, error.variable.lexeme.length)}
${formatError('Resource dependency error', error.message)}
  ${formatFileName(file, error.variable.line, error.variable.col)}`;

    case ElaborationErrorKind.ElaborationSubtypingError:
      console.log(
        JSON.stringify(error.type, null, 2),
        JSON.stringify(error.superType, null, 2),
      );
      return chalk`
${lines[error.operator.line - 1]}
${arrows(error.operator.col - 1, error.operator.lexeme.length)}
${formatError('Subtyping error', error.message)}
  ${formatFileName(file, error.operator.line, error.operator.col)}`;

    default:
      return chalk`
{bgRed *${error.name}*}: ${error.message}
  ${formatFileName(file)}`;
  }
};
