import { Senv, TypeEff, TypeEffUtils } from '@gsoul-lang/core/utils';
import { factoryOf, KindedFactory } from '@gsoul-lang/core/utils/ADT';
import { Product } from '@gsoul-lang/core/utils/Type';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import {
  Ascription,
  Expression,
  ExprKind,
  Projection,
  simpleValueIsKinded,
  Tuple,
  Value,
} from '../../elaboration/ast';
import { EvidenceUtils } from '../../utils';
import { Result } from '@badrap/result';
import { Kont, OkState, State, StepReducer } from '../cek';
import { InterpreterEvidenceError, InterpreterTypeError } from '../errors';

export enum TupleKontKind {
  TupleNextComponentsKont = 'TupleNextComponentsKont',
  TuplePreviousComponentsKont = 'TuplePreviousComponentsKont',
  TupleProjKont = 'TupleProjKont',
  TupleSecondProjKont = 'TupleSecondProjKont',
}

export type TupleNextComponentsKont = {
  kind: TupleKontKind.TupleNextComponentsKont;
  state: State<{
    previousValues: Value[];
    nextComponents: Expression[];
    typeEff: TypeEff;
  }>;
};
export const TupleNextComponentsKont: KindedFactory<TupleNextComponentsKont> =
  factoryOf(TupleKontKind.TupleNextComponentsKont);

export type TupleProjKont = {
  kind: TupleKontKind.TupleProjKont;
  state: State<{ projToken: Token; index: number }>;
};
export const TupleProjKont: KindedFactory<TupleProjKont> = factoryOf(
  TupleKontKind.TupleProjKont,
);

export const reduceTuple: StepReducer<Tuple, Kont> = (term, store, kont) => {
  const [first, ...nextComponents] = term.expressions;

  return OkState(
    {
      term: first,
    },
    store,
    TupleNextComponentsKont({
      state: {
        store,
        kont,
        typeEff: term.typeEff,
        previousValues: [],
        nextComponents,
      },
    }),
  );
};

export const reduceNextTupleComponent: StepReducer<
  Value,
  TupleNextComponentsKont
> = (term, store, kont) => {
  const {
    state: { previousValues, nextComponents, typeEff },
  } = kont;

  if (nextComponents.length === 0) {
    return OkState(
      {
        term: Tuple({
          expressions: [...previousValues, term],
          typeEff,
        }),
      },
      kont.state.store,
      kont.state.kont,
    );
  }

  const [first, ...nextNextComponents] = nextComponents;

  return OkState(
    {
      term: first,
    },
    store,
    TupleNextComponentsKont({
      state: {
        previousValues: [...previousValues, term],
        nextComponents: nextNextComponents,
        typeEff,
        store: kont.state.store,
        kont: kont.state.kont,
      },
    }),
  );
};

export const reduceProjectionTuple: StepReducer<Projection, Kont> = (
  term,
  store,
  kont,
) => {
  return OkState(
    {
      term: term.tuple,
    },
    store,
    TupleProjKont({
      state: {
        kont,
        store,
        projToken: term.projectToken,
        index: term.index,
      },
    }),
  );
};

export const projectTuple: StepReducer<Value, TupleProjKont> = (
  term,
  _store,
  kont,
) => {
  if (!simpleValueIsKinded(term, ExprKind.Tuple)) {
    return Result.err(
      new InterpreterTypeError({
        reason: 'Callee must be a tuple',
        operator: kont.state.projToken,
      }),
    );
  }

  const { index } = kont.state;

  const evidenceResult = EvidenceUtils.iproj(index, term.evidence);

  if (!evidenceResult.isOk) {
    return Result.err(
      new InterpreterEvidenceError({
        reason: evidenceResult.error.message,
      }),
    );
  }

  const evidence = evidenceResult.value;

  const typeEff = TypeEffUtils.ProductUtils.projection(
    index,
    term.typeEff as TypeEff<Product, Senv>,
  );

  return OkState(
    {
      term: Ascription({
        evidence,
        expression: term.expression.expressions[index],
        typeEff,
      }),
    },
    kont.state.store,
    kont.state.kont,
  );
};
