import { CommandModule } from 'yargs';
import { readFileSync } from 'fs';

import { run as runCommand, formatValue } from '@gsens-lang/runtime';
import { parse } from '@gsens-lang/parsing';
import { syntaxError } from '../lib/errors';

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
              number: failure.token.line,
              content: lines[failure.token.line - 1],
            },
            failure.reason,
          ),
        );
      });
    } else {
      const value = runCommand(statements);

      console.log(formatValue(value.expression));
    }
  } catch (e) {
    console.error(e);
  }
};

const run: CommandModule = {
  command: ['run <file>', '$0 <file>'],
  describe: 'Run a gsens file',
  builder: {
    file: {
      describe: 'Name of the file to run',
      type: 'string',
      default: 'index.gsens',
    },
  },
  handler: (argv) => runHandler(argv.file as string),
};

export default run;
