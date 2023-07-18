import { TypeEffUtils } from '@gsoul-lang/core/utils';
import { factoryOf, KindedFactory } from '@gsoul-lang/core/utils/ADT';
import { PrintStmt, Value } from '../../elaboration/ast';
import { EvidenceUtils, Store } from '../../utils';
import { formatValue } from '../../utils/format';
import { Result } from '@badrap/result';
import { Kont, OkState, State, StepState } from '../cek';
import { InterpreterError } from '../errors';

export enum PrintKontKind {
  PrintKont = 'PrintKont',
}

export type PrintKont = {
  kind: PrintKontKind.PrintKont;
  state: State<{
    showEvidence: boolean;
  }>;
};
export const PrintKont: KindedFactory<PrintKont> = factoryOf(
  PrintKontKind.PrintKont,
);

export const reducePrintInnerExpression = (
  term: PrintStmt,
  store: Store,
  kont: Kont,
): Result<StepState, InterpreterError> => {
  return OkState(
    { term: term.expression },
    store,
    PrintKont({
      state: State({ showEvidence: term.showEvidence }, store, kont),
    }),
  );
};

export const printValueAndContinue = (
  term: Value,
  _store: Store,
  kont: PrintKont,
): Result<StepState, InterpreterError> => {
  if (kont.state.showEvidence) {
    console.log(
      `${EvidenceUtils.format(term.evidence)} ${formatValue(
        term.expression,
      )} :: ${TypeEffUtils.format(term.typeEff)}`,
    );
  } else {
    console.log(formatValue(term.expression));
  }

  return OkState({ term }, kont.state.store, kont.state.kont);
};
