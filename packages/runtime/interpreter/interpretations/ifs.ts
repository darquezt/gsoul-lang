import { Result } from '@badrap/result';
import { TypeEff } from '@gsoul-lang/core/utils';
import { factoryOf, KindedFactory } from '@gsoul-lang/core/utils/ADT';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import {
  Ascription,
  Expression,
  ExprKind,
  If,
  simpleValueIsKinded,
  Value,
} from '../../elaboration/ast';
import { Store } from '../../utils';
import { interior } from '../../utils/Evidence';
import { Kont, OkState, State, StepState } from '../cek';
import {
  InterpreterError,
  InterpreterEvidenceError,
  InterpreterTypeError,
} from '../errors';

export enum IfKontKind {
  IfBranchesKont = 'IfBranchesKont',
}

export type IfBranchesKont = {
  kind: IfKontKind.IfBranchesKont;
  state: State<{
    then: Expression;
    else: Expression;
    ifToken: Token;
    ifTypeEffect: TypeEff;
  }>;
};
export const IfBranchesKont: KindedFactory<IfBranchesKont> = factoryOf(
  IfKontKind.IfBranchesKont,
);

export const reduceIfCondition = (
  term: If,
  store: Store,
  kont: Kont,
): Result<StepState, InterpreterError> => {
  return OkState(
    { term: term.condition },
    store,
    IfBranchesKont({
      state: {
        then: term.then,
        else: term.else,
        ifToken: term.ifToken,
        ifTypeEffect: term.typeEff,
        store: store,
        kont: kont,
      },
    }),
  );
};

export const reduceIfBranch = (
  term: Value,
  _store: Store,
  kont: IfBranchesKont,
): Result<StepState, InterpreterError> => {
  if (!simpleValueIsKinded(term, ExprKind.BoolLiteral)) {
    // This does not make sense
    return Result.err(
      new InterpreterTypeError({
        reason: 'Condition must be a boolean',
        operator: kont.state.ifToken,
      }),
    );
  }

  const nextTerm = term.expression.value ? kont.state.then : kont.state.else;

  const evidence = interior(nextTerm.typeEff, kont.state.ifTypeEffect);

  if (!evidence.isOk) {
    // This also does not make sense
    return Result.err(
      new InterpreterEvidenceError({
        reason: evidence.error.message,
      }),
    );
  }

  return OkState(
    {
      term: Ascription({
        evidence: evidence.value,
        expression: nextTerm,
        typeEff: kont.state.ifTypeEffect,
      }),
    },
    kont.state.store,
    kont.state.kont,
  );
};
