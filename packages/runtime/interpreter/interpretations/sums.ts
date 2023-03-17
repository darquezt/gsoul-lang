import { Result } from '@badrap/result';
import { Senv, Type, TypeEffUtils } from '@gsoul-lang/core/utils';
import { factoryOf, KindedFactory } from '@gsoul-lang/core/utils/ADT';
import SJoin from '@gsoul-lang/core/utils/lib/SJoin';
import { Sum } from '@gsoul-lang/core/utils/Type';
import { TypeEff } from '@gsoul-lang/core/utils/TypeEff';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import {
  AscribedValue,
  Ascription,
  Case,
  Expression,
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
  state: State<{ injToken: Token; type: Type; typeEff: TypeEff; index: 0 | 1 }>;
};
export const InjKont: KindedFactory<InjKont> = factoryOf(InjKontKind.InjKont);

export type CaseBranchesKont = {
  kind: InjKontKind.CaseBranchesKont;
  state: State<{
    left: Expression;
    right: Expression;
    leftIdentifier: Token;
    rightIdentifier: Token;
    caseToken: Token;
    typeEff: TypeEff;
  }>;
};
export const CaseBranchesKont: KindedFactory<CaseBranchesKont> = factoryOf(
  InjKontKind.CaseBranchesKont,
);

export const reduceInjection: StepReducer<Inj, Kont> = (term, store, kont) => {
  return OkState(
    {
      term: term.expression,
    },
    store,
    InjKont({
      state: {
        injToken: term.injToken,
        typeEff: term.typeEff,
        index: term.index,
        type: term.type,
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
  const { injToken, index, type, typeEff, store, kont: kont2 } = kont.state;
  return OkState(
    {
      term: Inj({
        type,
        index,
        injToken,
        typeEff,
        expression: value,
      }),
    },
    store,
    kont2,
  );
};

export const reduceCaseSum: StepReducer<Case, Kont> = (term, store, kont) => {
  return OkState(
    {
      term: term.sum,
    },
    store,
    CaseBranchesKont({
      state: {
        left: term.left,
        right: term.right,
        leftIdentifier: term.leftIdentifier,
        rightIdentifier: term.rightIdentifier,
        caseToken: term.caseToken,
        typeEff: term.typeEff,
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
  if (!simpleValueIsKinded(value, ExprKind.Inj)) {
    return Result.err(
      new InterpreterTypeError({
        reason: 'Expression being matched is not a sum',
        operator: kont.state.caseToken,
      }),
    );
  }

  const { left, right, leftIdentifier, rightIdentifier, caseToken, typeEff } =
    kont.state;

  const { expression } = value;

  const { index } = expression;

  const identifier = index === 0 ? leftIdentifier : rightIdentifier;

  const identifierTypeEff =
    index === 0
      ? TypeEffUtils.SumUtils.left(value.typeEff as TypeEff<Sum, Senv>)
      : TypeEffUtils.SumUtils.right(value.typeEff as TypeEff<Sum, Senv>);

  const identifierEvidence = Result.all([
    EvidenceUtils.ileft(value.evidence),
    EvidenceUtils.iright(value.evidence),
  ]).chain(([ileft, iright]) =>
    index === 0
      ? EvidenceUtils.trans(value.expression.expression.evidence, ileft)
      : EvidenceUtils.trans(value.expression.expression.evidence, iright),
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
      expression: value.expression,
      typeEff: identifierTypeEff,
    }),
  );

  const next = index === 0 ? left : right;

  const joinType = SJoin.TypeEffect(left.typeEff, right.typeEff);

  if (joinType.isErr) {
    return Result.err(
      new InterpreterTypeError({
        reason: 'Type mismatch',
        operator: caseToken,
      }),
    );
  }

  const bodyEvidence = (
    index === 0
      ? EvidenceUtils.interior(left.typeEff, joinType.value)
      : EvidenceUtils.interior(right.typeEff, joinType.value)
  ).chain((ev) => EvidenceUtils.joinEffect(ev, value.evidence));

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
