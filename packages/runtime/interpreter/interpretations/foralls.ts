import { Senv, TypeEff, TypeEffUtils } from '@gsens-lang/core/utils';
import { factoryOf, KindedFactory } from '@gsens-lang/core/utils/ADT';
import { ForallT } from '@gsens-lang/core/utils/Type';
import { Token } from '@gsens-lang/parsing/lib/lexing';
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

export enum PolyKontKind {
  ForallKont = 'ForallKont',
  ForallSubstKont = 'ForallSubstKont',
}

export type ForallKont = {
  kind: PolyKontKind.ForallKont;
  state: State<{ senv: Senv }>;
  bracket: Token;
};
export const ForallKont: KindedFactory<ForallKont> = factoryOf(
  PolyKontKind.ForallKont,
);

export type ForallSubstKont = {
  kind: PolyKontKind.ForallSubstKont;
  state: State<{ name: string; senv: Senv }>;
};
export const ForallSubstKont: KindedFactory<ForallSubstKont> = factoryOf(
  PolyKontKind.ForallSubstKont,
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
      state: State({ senv: term.arg }, store, kont),
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
  const {
    sensVars: [svar, ...sensVars],
    expr: body,
  } = term.expression.forall;

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

  const newTypeEff = TypeEffUtils.ForallsUtils.instance(
    term.expression.forall.typeEff,
  );
  const newAscrTypeEff = TypeEffUtils.ForallsUtils.instance(
    term.typeEff as TypeEff<ForallT, Senv>,
  );

  const result = Ascription({
    evidence,
    expression:
      sensVars.length === 0
        ? body
        : Forall({
            sensVars,
            expr: body,
            typeEff: newTypeEff as TypeEff<ForallT, Senv>,
          }),
    typeEff: newAscrTypeEff,
  });

  return OkState(
    { term: result },
    term.expression.store,
    ForallSubstKont({
      state: {
        name: svar.lexeme,
        senv: kont.state.senv,
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
  const substitutedTerm = ExpressionUtils.subst(
    term,
    kont.state.name,
    kont.state.senv,
  );

  return OkState(
    {
      term: substitutedTerm,
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
        ...term,
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
