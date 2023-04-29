import { Result } from '@badrap/result';
import { Senv, TypeEffUtils } from '@gsoul-lang/core/utils';
import { factoryOf, KindedFactory } from '@gsoul-lang/core/utils/ADT';
import { Sum } from '@gsoul-lang/core/utils/Type';
import { TypeEff } from '@gsoul-lang/core/utils/TypeEff';
import {
  AscribedValue,
  Ascription,
  Case,
  ExprKind,
  Inj,
  simpleValueIsKinded,
  Value,
} from '../../elaboration/ast';
import { EvidenceUtils, StoreUtils } from '../../utils';
import { Kont, OkState, State, StepReducer } from '../cek';
import { InterpreterTypeError } from '../errors';

export enum InjKontKind {
  InjKont = 'InjKont',
  CaseBranchesKont = 'CaseBranchesKont',
}

export type InjKont = {
  kind: InjKontKind.InjKont;
  state: State<{ injMeta: Omit<Inj, 'expression'> }>;
};
export const InjKont: KindedFactory<InjKont> = factoryOf(InjKontKind.InjKont);

export type CaseBranchesKont = {
  kind: InjKontKind.CaseBranchesKont;
  state: State<{
    caseMeta: Omit<Case, 'sum'>;
  }>;
};
export const CaseBranchesKont: KindedFactory<CaseBranchesKont> = factoryOf(
  InjKontKind.CaseBranchesKont,
);

export const reduceInjection: StepReducer<Inj, Kont> = (term, store, kont) => {
  const { expression, ...injMeta } = term;

  return OkState(
    {
      term: expression,
    },
    store,
    InjKont({
      state: {
        injMeta,
        store,
        kont,
      },
    }),
  );
};

export const produceInjValue: StepReducer<Value, InjKont> = (
  value,
  _store,
  kont,
) => {
  const { injMeta, store, kont: kont2 } = kont.state;
  return OkState(
    {
      term: Inj({
        ...injMeta,
        expression: value,
      }),
    },
    store,
    kont2,
  );
};

export const reduceCaseSum: StepReducer<Case, Kont> = (term, store, kont) => {
  const { sum, ...caseMeta } = term;

  return OkState(
    {
      term: sum,
    },
    store,
    CaseBranchesKont({
      state: {
        caseMeta,
        store,
        kont,
      },
    }),
  );
};

export const reduceCaseBranch: StepReducer<Value, CaseBranchesKont> = (
  value,
  _store,
  kont,
) => {
  const {
    caseMeta: { branches, caseToken, typeEff },
  } = kont.state;

  if (!simpleValueIsKinded(value, ExprKind.Inj)) {
    return Result.err(
      new InterpreterTypeError({
        reason: 'Expression being matched is not a sum',
        operator: caseToken,
      }),
    );
  }

  const { expression } = value;

  const { index } = expression;

  const identifier = branches[index].identifier;

  const identifierTypeEff = TypeEffUtils.SumUtils.projection(
    index,
    value.typeEff as TypeEff<Sum, Senv>,
  );

  const identifierEvidence = EvidenceUtils.isumproj(
    index,
    value.evidence,
  ).chain((evi) =>
    EvidenceUtils.trans(value.expression.expression.evidence, evi),
  );

  if (identifierEvidence.isErr) {
    return Result.err(
      new InterpreterTypeError({
        reason: 'Evidence mismatch',
        operator: caseToken,
      }),
    );
  }

  const newStore = StoreUtils.extend(
    kont.state.store,
    identifier.lexeme,
    AscribedValue({
      evidence: identifierEvidence.value,
      expression: value.expression.expression.expression,
      typeEff: identifierTypeEff,
    }),
  );

  const next = branches[index].body;

  const bodyEvidence = EvidenceUtils.interior(next.typeEff, typeEff);

  if (bodyEvidence.isErr) {
    return Result.err(
      new InterpreterTypeError({
        reason: 'Evidence mismatch',
        operator: caseToken,
      }),
    );
  }

  return OkState(
    {
      term: Ascription({
        typeEff,
        evidence: bodyEvidence.value,
        expression: next,
      }),
    },
    newStore,
    kont.state.kont,
  );
};
