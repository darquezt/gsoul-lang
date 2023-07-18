import { factoryOf, KindedFactory } from '@gsoul-lang/core/utils/ADT';
import { Value, VarStmt } from '../../elaboration/ast';
import { Store, StoreUtils } from '../../utils';
import { Result } from '@badrap/result';
import { Kont, OkState, State, StepState } from '../cek';
import { InterpreterError } from '../errors';

export enum DeclKontKind {
  VarDeclKont = 'VarDeclKont',
}

export type VarDeclKont = {
  kind: DeclKontKind.VarDeclKont;
  state: State<{ variable: string }>;
};
export const VarDeclKont: KindedFactory<VarDeclKont> = factoryOf(
  DeclKontKind.VarDeclKont,
);

export const reduceVarDeclInnerExpression = (
  term: VarStmt,
  store: Store,
  kont: Kont,
): Result<StepState, InterpreterError> => {
  return OkState(
    { term: term.assignment },
    store,
    VarDeclKont({
      state: State(
        {
          variable: term.name.lexeme,
        },
        store,
        kont,
      ),
    }),
  );
};

export const extendStoreAndContinue = (
  term: Value,
  _store: Store,
  kont: VarDeclKont,
): Result<StepState, InterpreterError> => {
  return OkState(
    { term },
    StoreUtils.extend(kont.state.store, kont.state.variable, term as Value),
    kont.state.kont,
  );
};
