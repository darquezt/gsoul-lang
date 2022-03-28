import { TypeEffUtils } from '@gsens-lang/core/utils';
import { factoryOf, KindedFactory } from '@gsens-lang/core/utils/ADT';
import { Print, Value } from '../../elaboration/ast';
import { EvidenceUtils, Store } from '../../utils';
import { formatValue } from '../../utils/format';
import { Result } from '../../utils/Result';
import { Kont, OkState, StepState } from '../cek';
import { InterpreterError } from '../errors';

export enum PrintKontKind {
  PrintKont = 'PrintKont',
}

export type PrintKont = {
  kind: PrintKontKind.PrintKont;
  kont: Kont;
  showEvidence: boolean;
};
export const PrintKont: KindedFactory<PrintKont> = factoryOf(
  PrintKontKind.PrintKont,
);

export const reducePrintInnerExpression = (
  term: Print,
  store: Store,
  kont: Kont,
): Result<StepState, InterpreterError> => {
  return OkState(
    { term: term.expression },
    store,
    PrintKont({ kont, showEvidence: term.showEvidence }),
  );
};

export const printValueAndContinue = (
  term: Value,
  store: Store,
  kont: PrintKont,
): Result<StepState, InterpreterError> => {
  if (kont.showEvidence) {
    console.log(
      `${EvidenceUtils.format(term.evidence)} ${formatValue(
        term.expression,
      )} :: ${TypeEffUtils.format(term.typeEff)}`,
    );
  } else {
    console.log(formatValue(term.expression));
  }

  return OkState({ term }, store, kont.kont);
};
