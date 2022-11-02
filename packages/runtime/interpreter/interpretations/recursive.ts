import { Senv, TypeEff, TypeEffUtils } from '@gsoul-lang/core/utils';
import { factoryOf, KindedFactory } from '@gsoul-lang/core/utils/ADT';
import { RecType } from '@gsoul-lang/core/utils/Type';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import {
  Ascription,
  ExprKind,
  Fold,
  simpleValueIsKinded,
  Unfold,
  Value,
} from '../../elaboration/ast';
import { EvidenceUtils, Store } from '../../utils';
import { Result } from '@badrap/result';
import { Kont, OkState, State, StepState } from '../cek';
import { InterpreterError, InterpreterTypeError } from '../errors';

export enum RecursiveKontKind {
  UnfoldKont = 'UnfoldKont',
  FoldKont = 'FoldKont',
}

export type UnfoldKont = {
  kind: RecursiveKontKind.UnfoldKont;
  state: State<{
    unfoldToken: Token;
  }>;
};
export const UnfoldKont: KindedFactory<UnfoldKont> = factoryOf(
  RecursiveKontKind.UnfoldKont,
);

export type FoldKont = {
  kind: RecursiveKontKind.FoldKont;
  state: State<{
    foldToken: Token;
    foldRecType: RecType;
    foldTypeEff: TypeEff;
  }>;
};
export const FoldKont: KindedFactory<FoldKont> = factoryOf(
  RecursiveKontKind.FoldKont,
);

export const reduceFoldedExpression = (
  term: Fold,
  store: Store,
  kont: Kont,
): Result<StepState, InterpreterError> => {
  return OkState(
    { term: term.expression },
    store,
    FoldKont({
      state: State(
        {
          foldToken: term.foldToken,
          foldRecType: term.recType,
          foldTypeEff: term.typeEff,
        },
        store,
        kont,
      ),
    }),
  );
};

export const reduceFold = (
  term: Value,
  _store: Store,
  kont: FoldKont,
): Result<StepState, InterpreterError> => {
  return OkState(
    {
      term: Fold({
        expression: term,
        foldToken: kont.state.foldToken,
        recType: kont.state.foldRecType,
        typeEff: kont.state.foldTypeEff,
      }),
    },
    kont.state.store,
    kont.state.kont,
  );
};

export const reduceUnfoldedExpression = (
  term: Unfold,
  store: Store,
  kont: Kont,
): Result<StepState, InterpreterError> => {
  return OkState(
    { term: term.expression },
    store,
    UnfoldKont({
      state: State({ unfoldToken: term.unfoldToken }, store, kont),
    }),
  );
};

export const reduceUnfold = (
  term: Value,
  store: Store,
  kont: UnfoldKont,
): Result<StepState, InterpreterError> => {
  if (!simpleValueIsKinded(term, ExprKind.Fold)) {
    return Result.err(
      new InterpreterTypeError({
        reason: 'Unfolded expression must be a fold',
        operator: kont.state.unfoldToken,
      }),
    );
  }

  const evidence = EvidenceUtils.iunfold(term.evidence);

  if (!evidence.isOk) {
    return Result.err(
      new InterpreterTypeError({
        reason: evidence.error.message,
        operator: kont.state.unfoldToken,
      }),
    );
  }

  const typeEff = TypeEffUtils.RecursiveUtils.unfold(
    term.typeEff as TypeEff<RecType, Senv>,
  );

  return OkState(
    {
      term: Ascription({
        evidence: evidence.value,
        typeEff,
        expression: term.expression.expression,
      }),
    },
    store,
    kont.state.kont,
  );
};