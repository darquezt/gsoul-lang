import { TypeEff } from '@gsens-lang/core/utils';
import { factoryOf, KindedFactory } from '@gsens-lang/core/utils/ADT';
import { Ascription, Value } from '../../elaboration/ast';
import { Evidence, EvidenceUtils, Store } from '../../utils';
import { Err, Result } from '../../utils/Result';
import { Kont, OkState, State, StepState } from '../cek';
import { InterpreterError, InterpreterEvidenceError } from '../errors';

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

export const reduceDoubleAscription = (
  term: Value,
  _store: Store,
  kont: AscrKont,
): Result<StepState, InterpreterError> => {
  const evidenceRes = EvidenceUtils.trans(term.evidence, kont.state.evidence);

  if (!evidenceRes.success) {
    return Err(
      InterpreterEvidenceError({
        reason: evidenceRes.error.reason,
      }),
    );
  }

  return OkState(
    {
      term: Ascription({
        evidence: evidenceRes.result,
        expression: term.expression,
        typeEff: kont.state.typeEff,
      }),
    },
    kont.state.store,
    kont.state.kont,
  );
};
