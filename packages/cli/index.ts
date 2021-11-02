import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import run from './commands/run';

console.log(process.argv);
console.log(
  yargs(hideBin(process.argv))
    .command(run)
    .help()
    .alias('h', 'help')
    .demandCommand(1, 'must provide a valid command')
    .completion().argv,
);
