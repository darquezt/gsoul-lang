import { CommandModule } from 'yargs';
import { readFileSync } from 'fs';

import { run as runCommmand } from '@gsens-lang/runtime';
import { parse } from '@gsens-lang/parsing';

const runHandler = (file: string) => {
  try {
    const contents = readFileSync(file, { encoding: 'utf-8' });

    const { result: statements } = parse(contents);

    const value = runCommmand(statements);

    console.log(value);
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
