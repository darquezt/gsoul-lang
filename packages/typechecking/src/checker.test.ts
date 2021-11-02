import { scanTokens } from '@gsens-lang/parsing/lexing/lexing';
import { parse } from '@gsens-lang/parsing/parsing';
import { Senv, TypeEff, TypeEnv } from '@gsens-lang/core/utils';
import { Bool, Real } from '@gsens-lang/core/utils/Type';
import { StatefulResult, StatefulSuccess, typeCheck } from './checker';

const pipeline = (source: string): StatefulResult => {
  const tokens = scanTokens(source);
  const parsed = parse(tokens);

  return typeCheck(parsed.result);
};

test('test', () => {
  expect(pipeline('2 + 3;')).toStrictEqual(
    StatefulSuccess(TypeEff(Real(), Senv()), TypeEnv()),
  );
});

test('test', () => {
  expect(pipeline('2 + 3; { var x = 2; var y = x + 2; } true;')).toStrictEqual(
    StatefulSuccess(TypeEff(Bool(), Senv()), TypeEnv()),
  );
});
