import { Token } from '@gsoul-lang/parsing/lib/lexing';
import { Kont, OkState, State, StepState } from '../cek';
import { KindedFactory, factoryOf } from '@gsoul-lang/core/utils/ADT';
import { Ascription, FixPoint, Value } from '../../elaboration/ast';
import { Store, StoreUtils } from '../../utils';
import { Result } from '@badrap/result';
import { InterpreterError } from '../errors';
import { initialEvidence } from '../../utils/Evidence';

export enum FixPointKontKind {
  FixPointKont = 'FixPointKont',
}

export type FixPointKont = {
  kind: FixPointKontKind.FixPointKont;
  state: State<{ fixToken: Token }>;
};
export const FixPointKont: KindedFactory<FixPointKont> = factoryOf(
  FixPointKontKind.FixPointKont,
);

export const reduceFixPoint = (
  term: FixPoint,
  store: Store,
  kont: Kont,
): Result<StepState, InterpreterError> => {
  const evidence = initialEvidence(term.typeEff);

  const substitution = Ascription({
    evidence,
    expression: term,
    typeEff: term.typeEff,
  });

  return OkState(
    { term: term.body },
    StoreUtils.extend(store, term.name.lexeme, substitution),
    FixPointKont({
      state: State({ fixToken: term.name }, store, kont),
    }),
  );
};

export const restoreStoreAndKont = (
  term: Value,
  _store: Store,
  kont: FixPointKont,
): Result<StepState, InterpreterError> => {
  return OkState({ term }, kont.state.store, kont.state.kont);
};
