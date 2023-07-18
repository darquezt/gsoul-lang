import { factoryOf, KindedFactory } from '@gsoul-lang/core/utils/ADT';
import { ExprStmt, Value } from '../../elaboration/ast';
import { Store } from '../../utils';
import { Result } from '@badrap/result';
import { Kont, OkState, State, StepState } from '../cek';
import { InterpreterError } from '../errors';

export enum ExprKontKind {
  ExprKont = 'ExprKont',
}

export type ExprKont = {
  kind: ExprKontKind.ExprKont;
  state: State<{
    dummy: true;
  }>;
};
export const ExprKont: KindedFactory<ExprKont> = factoryOf(
  ExprKontKind.ExprKont,
);

export const reduceExprInnerExpression = (
  term: ExprStmt,
  store: Store,
  kont: Kont,
): Result<StepState, InterpreterError> => {
  return OkState(
    { term: term.expression },
    store,
    ExprKont({
      state: State({ dummy: true }, store, kont),
    }),
  );
};

export const restoreState = (
  term: Value,
  _store: Store,
  kont: ExprKont,
): Result<StepState, InterpreterError> => {
  return OkState({ term }, kont.state.store, kont.state.kont);
};
