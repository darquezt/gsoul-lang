import { TypeEff } from '@gsoul-lang/core/utils';
import { factoryOf, KindedFactory } from '@gsoul-lang/core/utils/ADT';
import { Ascription, SimpleValue, Value } from '../../elaboration/ast';
import { Evidence, EvidenceUtils, Store } from '../../utils';
import { Result } from '@badrap/result';
import { Kont, OkState, State, StepState } from '../cek';
import { InterpreterError, InterpreterEvidenceError } from '../errors';
import { format } from '../../utils/Evidence';

export enum AscrKontKind {
  AscrKont = 'AscrKont',
}

export type AscrKont = {
  kind: AscrKontKind.AscrKont;
  state: State<{ typeEff: TypeEff; evidence: Evidence }>;
};
export const AscrKont: KindedFactory<AscrKont> = factoryOf(
  AscrKontKind.AscrKont,
);

export const reduceAscrInnerExpression = (
  term: Ascription,
  store: Store,
  kont: Kont,
): Result<StepState, InterpreterError> => {
  return OkState(
    { term: term.expression },
    store,
    AscrKont({
      state: State(
        {
          typeEff: term.typeEff,
          evidence: term.evidence,
        },
        store,
        kont,
      ),
    }),
  );
};

export const reconstructValueAscription = (
  term: SimpleValue,
  _store: Store,
  kont: AscrKont,
): Result<StepState, InterpreterError> => {
  return OkState(
    {
      term: Ascription({
        evidence: kont.state.evidence,
        expression: term,
        typeEff: kont.state.typeEff,
      }),
    },
    kont.state.store,
    kont.state.kont,
  );
};

export const reduceDoubleAscription = (
  term: Value,
  _store: Store,
  kont: AscrKont,
): Result<StepState, InterpreterError> => {
  const evidenceRes = EvidenceUtils.trans(term.evidence, kont.state.evidence);

  if (!evidenceRes.isOk) {
    console.log(format(term.evidence));
    console.log(format(kont.state.evidence));
    console.log('ascr failed');

    return Result.err(
      new InterpreterEvidenceError({
        reason: evidenceRes.error.message,
      }),
    );
  }

  return OkState(
    {
      term: Ascription({
        evidence: evidenceRes.value,
        expression: term.expression,
        typeEff: kont.state.typeEff,
      }),
    },
    kont.state.store,
    kont.state.kont,
  );
};
