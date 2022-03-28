import { factoryOf, KindedFactory } from '@gsens-lang/core/utils/ADT';
import { Block, NilLiteral, Statement, Value } from '../../elaboration/ast';
import { Store } from '../../utils';
import { Result } from '../../utils/Result';
import { Kont, OkState, State, StepState } from '../cek';
import { InterpreterError } from '../errors';

export enum BlockKontKind {
  BlockKont = 'BlockKont',
}

export type BlockKont = {
  kind: BlockKontKind.BlockKont;
  state: State<{ statements: Statement[] }>;
};
export const BlockKont: KindedFactory<BlockKont> = factoryOf(
  BlockKontKind.BlockKont,
);

export const reduceFirstBlockStatement = (
  term: Block,
  store: Store,
  kont: Kont,
): Result<StepState, InterpreterError> => {
  if (term.statements.length === 0) {
    return OkState({ term: NilLiteral() }, store, kont);
  }

  const [firstStmt, ...restStmts] = term.statements;

  return OkState(
    { term: firstStmt },
    store,
    BlockKont({
      state: State({ statements: restStmts }, store, kont),
    }),
  );
};

export const reduceNextBlockStatement = (
  term: Value,
  store: Store,
  kont: BlockKont,
): Result<StepState, InterpreterError> => {
  const { statements } = kont.state;

  // When all the statements in the block have finished evaluating
  // we restore the store and the kont
  if (statements.length === 0) {
    return OkState({ term }, kont.state.store, kont.state.kont);
  }

  // If there are more statements, we drop the value of the current one
  // and follow evaluating the next one

  const [nextStmt, ...restStmts] = statements;

  return OkState(
    { term: nextStmt },
    store,
    BlockKont({
      state: State(
        { statements: restStmts },
        kont.state.store,
        kont.state.kont,
      ),
    }),
  );
};
