import { CommandModule } from 'yargs';
import { readFileSync } from 'fs';

import { run as runCommand, formatValue } from '@gsoul-lang/runtime';
import { parse } from '@gsoul-lang/parsing';
import { runtimeError, syntaxError } from '../lib/errors';

const runHandler = (file: string) => {
  try {
    const contents = readFileSync(file, { encoding: 'utf-8' });

    const { result: statements, failures } = parse(contents);

    if (failures.length > 0) {
      const lines = contents.split('\n');

      failures.forEach((failure) => {
        console.log(
          syntaxError(
            {
              line: failure.token.line,
              col: failure.token.col,
              errorLength: failure.token.lexeme.length,
              content: lines[failure.token.line - 1],
            },
            file,
            failure.reason,
          ),
        );
      });
    } else {
      const result = runCommand(statements);

      if (!result.isOk) {
        const lines = contents.split('\n');
        console.log(runtimeError(result.error, { file, lines }));
      } else {
        console.log(formatValue(result.value.expression));
      }
    }
  } catch (e) {
    console.error(e);
  }
};

const run: CommandModule = {
  command: ['run <file>', '$0 <file>'],
  describe: 'Run a gsoul file',
  builder: {
    file: {
      describe: 'Name of the file to run',
      type: 'string',
      default: 'index.gsoul',
    },
  },
  handler: (argv) => runHandler(argv.file as string),
};

export default run;
