import { Senv, TypeEff, TypeEffUtils } from '@gsens-lang/core/utils';
import { factoryOf, KindedFactory } from '@gsens-lang/core/utils/ADT';
import { AProduct } from '@gsens-lang/core/utils/Type';
import { Token } from '@gsens-lang/parsing/lib/lexing';
import {
  Ascription,
  Expression,
  ExprKind,
  Pair,
  ProjFst,
  ProjSnd,
  simpleValueIsKinded,
  Value,
} from '../../elaboration/ast';
import { EvidenceUtils } from '../../utils';
import { initialEvidence } from '../../utils/Evidence';
import { Err } from '../../utils/Result';
import { Kont, OkState, State, StepReducer } from '../cek';
import { InterpreterEvidenceError, InterpreterTypeError } from '../errors';

export enum PairKontKind {
  PairSecondKont = 'PairSecondKont',
  PairFirstKont = 'PairFirstKont',
  PairFirstProjKont = 'PairFirstProjKont',
  PairSecondProjKont = 'PairSecondProjKont',
}

export type PairSecondKont = {
  kind: PairKontKind.PairSecondKont;
  state: State<{ second: Expression; typeEff: TypeEff }>;
};
export const PairSecondKont: KindedFactory<PairSecondKont> = factoryOf(
  PairKontKind.PairSecondKont,
);

export type PairFirstKont = {
  kind: PairKontKind.PairFirstKont;
  state: State<{ first: Value; typeEff: TypeEff }>;
};
export const PairFirstKont: KindedFactory<PairFirstKont> = factoryOf(
  PairKontKind.PairFirstKont,
);

export type PairFirstProjKont = {
  kind: PairKontKind.PairFirstProjKont;
  state: State<{ projToken: Token }>;
};
export const PairFirstProjKont: KindedFactory<PairFirstProjKont> = factoryOf(
  PairKontKind.PairFirstProjKont,
);

export type PairSecondProjKont = {
  kind: PairKontKind.PairSecondProjKont;
  state: State<{ projToken: Token }>;
};
export const PairSecondProjKont: KindedFactory<PairSecondProjKont> = factoryOf(
  PairKontKind.PairSecondProjKont,
);

export const reduceFirstPairComponent: StepReducer<Pair, Kont> = (
  term,
  store,
  kont,
) => {
  return OkState(
    {
      term: term.first,
    },
    store,
    PairSecondKont({
      state: { second: term.second, typeEff: term.typeEff, store, kont },
    }),
  );
};

export const reduceSecondPairComponent: StepReducer<Value, PairSecondKont> = (
  term,
  store,
  kont,
) => {
  return OkState(
    {
      term: kont.state.second,
    },
    kont.state.store,
    PairFirstKont({
      state: {
        first: term,
        typeEff: kont.state.typeEff,
        store,
        kont: kont.state.kont,
      },
    }),
  );
};

export const producePairValue: StepReducer<Value, PairFirstKont> = (
  term,
  _store,
  kont,
) => {
  return OkState(
    {
      term: Ascription({
        evidence: initialEvidence(kont.state.typeEff),
        expression: Pair({
          first: kont.state.first,
          second: term,
          typeEff: kont.state.typeEff,
        }),
        typeEff: kont.state.typeEff,
      }),
    },
    kont.state.store,
    kont.state.kont,
  );
};

export const reducePairAndFirstProj: StepReducer<ProjFst, Kont> = (
  term,
  store,
  kont,
) => {
  return OkState(
    {
      term: term.pair,
    },
    store,
    PairFirstProjKont({ state: { projToken: term.projToken, store, kont } }),
  );
};

export const reducePairAndSecondProj: StepReducer<ProjSnd, Kont> = (
  term,
  store,
  kont,
) => {
  return OkState(
    {
      term: term.pair,
    },
    store,
    PairSecondProjKont({ state: { projToken: term.projToken, store, kont } }),
  );
};

export const projectFirstPairComponent: StepReducer<
  Value,
  PairFirstProjKont
> = (term, _store, kont) => {
  if (!simpleValueIsKinded(term, ExprKind.Pair)) {
    return Err(
      InterpreterTypeError({
        reason: 'Callee must be a function',
        operator: kont.state.projToken,
      }),
    );
  }

  const evidenceResult = EvidenceUtils.ifirst(term.evidence);

  if (!evidenceResult.success) {
    return Err(
      InterpreterEvidenceError({
        reason: evidenceResult.error.reason,
      }),
    );
  }

  const evidence = evidenceResult.result;

  const typeEff = TypeEffUtils.AdditiveProductsUtils.firstProjection(
    term.typeEff as TypeEff<AProduct, Senv>,
  );

  return OkState(
    {
      term: Ascription({
        evidence,
        expression: term.expression.first,
        typeEff,
      }),
    },
    kont.state.store,
    kont.state.kont,
  );
};

export const projectSecondPairComponent: StepReducer<
  Value,
  PairSecondProjKont
> = (term, _store, kont) => {
  if (!simpleValueIsKinded(term, ExprKind.Pair)) {
    return Err(
      InterpreterTypeError({
        reason: 'Callee must be a function',
        operator: kont.state.projToken,
      }),
    );
  }

  const evidenceResult = EvidenceUtils.isecond(term.evidence);

  if (!evidenceResult.success) {
    return Err(
      InterpreterEvidenceError({
        reason: evidenceResult.error.reason,
      }),
    );
  }

  const evidence = evidenceResult.result;

  const typeEff = TypeEffUtils.AdditiveProductsUtils.secondProjection(
    term.typeEff as TypeEff<AProduct, Senv>,
  );

  return OkState(
    {
      term: Ascription({
        evidence,
        expression: term.expression.second,
        typeEff,
      }),
    },
    kont.state.store,
    kont.state.kont,
  );
};
