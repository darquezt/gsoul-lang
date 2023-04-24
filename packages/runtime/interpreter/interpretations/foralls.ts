import { Senv, TypeEff, TypeEffUtils } from '@gsoul-lang/core/utils';
import { factoryOf, KindedFactory } from '@gsoul-lang/core/utils/ADT';
import { ForallT } from '@gsoul-lang/core/utils/Type';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import {
  Ascribed,
  Ascription,
  ExpressionUtils,
  ExprKind,
  Forall,
  SCall,
  SClosure,
  simpleValueIsKinded,
  Value,
} from '../../elaboration/ast';
import { EvidenceUtils, Store } from '../../utils';
import { Result } from '@badrap/result';
import { Kont, OkState, State, StepState } from '../cek';
import { InterpreterError, InterpreterTypeError } from '../errors';
import { zip } from 'ramda';

export enum ForallKontKind {
  ForallKont = 'ForallKont',
  ForallSubstKont = 'ForallSubstKont',
}

export type ForallKont = {
  kind: ForallKontKind.ForallKont;
  state: State<{ args: Senv[] }>;
  bracket: Token;
};
export const ForallKont: KindedFactory<ForallKont> = factoryOf(
  ForallKontKind.ForallKont,
);

export type ForallSubstKont = {
  kind: ForallKontKind.ForallSubstKont;
  state: State<{ variables: string[]; args: Senv[] }>;
};
export const ForallSubstKont: KindedFactory<ForallSubstKont> = factoryOf(
  ForallKontKind.ForallSubstKont,
);

export const reduceForallCallee = (
  term: SCall,
  store: Store,
  kont: Kont,
): Result<StepState, InterpreterError> => {
  return OkState(
    { term: term.callee },
    store,
    ForallKont({
      state: State({ args: term.args }, store, kont),
      bracket: term.bracket,
    }),
  );
};

export const reduceForallBody = (
  term: Value,
  _store: Store,
  kont: ForallKont,
): Result<StepState, InterpreterError> => {
  if (!simpleValueIsKinded(term, ExprKind.SClosure)) {
    return Result.err(
      new InterpreterTypeError({
        reason:
          'Only polymorphic quantifications can be instantiated with sensitivity environments',
        operator: kont.bracket,
      }),
    );
  }
  const { sensVars, expr } = term.expression.forall;

  const evidenceRes = EvidenceUtils.iscod(term.evidence);

  if (!evidenceRes.isOk) {
    return Result.err(
      new InterpreterTypeError({
        reason: evidenceRes.error.message,
        operator: kont.bracket,
      }),
    );
  }

  const evidence = evidenceRes.value;

  const newAscrTypeEff = TypeEffUtils.ForallsUtils.scod(
    term.typeEff as TypeEff<ForallT, Senv>,
  );

  const result = Ascription({
    evidence,
    expression: expr,
    typeEff: newAscrTypeEff,
  });

  return OkState(
    { term: result },
    term.expression.store,
    ForallSubstKont({
      state: {
        variables: sensVars.map((s) => s.lexeme),
        args: kont.state.args,
        store: kont.state.store,
        kont: kont.state.kont,
      },
    }),
  );
};

export const reduceForallSubstitutedBody = (
  term: Value,
  _store: Store,
  kont: ForallSubstKont,
): Result<StepState, InterpreterError> => {
  const body = zip(kont.state.variables, kont.state.args).reduce(
    (acc, [svar, effect]) => ExpressionUtils.subst(acc, svar, effect),
    term,
  );

  return OkState(
    {
      term: body,
    },
    kont.state.store,
    kont.state.kont,
  );
};

export const forallClosureCreation = (
  term: Ascribed<Forall>,
  store: Store,
  kont: Kont,
): Result<StepState, InterpreterError> => {
  return OkState(
    {
      term: Ascription({
        evidence: term.evidence,
        typeEff: term.typeEff,
        expression: SClosure({
          forall: term.expression,
          typeEff: term.expression.typeEff,
          store,
        }),
      }),
    },
    store,
    kont,
  );
};
