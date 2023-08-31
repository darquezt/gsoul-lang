import { factoryOf, KindedFactory } from '@gsoul-lang/core/utils/ADT';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import {
  AscribedValue,
  Ascription,
  BoolLiteral,
  Negate,
  Value,
} from '../../elaboration/ast';
import { Kont, OkState, State, StepReducer } from '../cek';

export enum UnaryKontKind {
  NegateKont = 'NegateKont',
}

export type NegateKont = {
  kind: UnaryKontKind.NegateKont;
  state: State<{ op: Token }>;
};
export const NegateKont: KindedFactory<NegateKont> = factoryOf(
  UnaryKontKind.NegateKont,
);

export const reduceNegateInnerTerm: StepReducer<Negate, Kont> = (
  term,
  store,
  kont,
) => {
  return OkState(
    { term: term.expression },
    store,
    NegateKont({
      state: State({ op: term.token }, store, kont),
    }),
  );
};

export const computeNegation: StepReducer<Value, NegateKont> = (
  term,
  _store,
  kont,
) => {
  const boolValue = term as AscribedValue<BoolLiteral>;
  return OkState(
    {
      term: Ascription({
        expression: BoolLiteral({ value: !boolValue.expression.value }),
        typeEff: term.typeEff,
        evidence: term.evidence,
      }),
    },
    kont.state.store,
    kont.state.kont,
  );
};
