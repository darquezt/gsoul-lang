import { SenvUtils, TypeEff } from '@gsens-lang/core/utils';
import { factoryOf, KindedFactory } from '@gsens-lang/core/utils/ADT';
import { Arrow } from '@gsens-lang/core/utils/Type';
import { Token } from '@gsens-lang/parsing/lib/lexing';
import {
  Ascribed,
  AscribedValue,
  Ascription,
  Call,
  Closure,
  Expression,
  ExprKind,
  Fun,
  simpleValueIsKinded,
  Value,
} from '../../elaboration/ast';
import { EvidenceUtils, Store, StoreUtils } from '../../utils';
import { Err, Result } from '../../utils/Result';
import { Kont, OkState, State, StepState } from '../cek';
import { InterpreterError, InterpreterTypeError } from '../errors';

export enum FunKontKind {
  ArgKont = 'ArgKont',
  FnKont = 'FnKont',
}

export type ArgKont = {
  kind: FunKontKind.ArgKont;
  state: State<{ expression: Expression }>;
  paren: Token;
};
export const ArgKont: KindedFactory<ArgKont> = factoryOf(FunKontKind.ArgKont);

export type FnKont = {
  kind: FunKontKind.FnKont;
  state: State<{ value: Value<Closure> }>;
  paren: Token;
};
export const FnKont: KindedFactory<FnKont> = factoryOf(FunKontKind.FnKont);

export const reduceFunCallee = (
  term: Call,
  store: Store,
  kont: Kont,
): Result<StepState, InterpreterError> => {
  return OkState(
    { term: term.callee },
    store,
    ArgKont({
      state: State({ expression: term.arg }, store, kont),
      paren: term.paren,
    }),
  );
};

export const reduceFunArg = (
  term: Value,
  store: Store,
  kont: ArgKont,
): Result<StepState, InterpreterError> => {
  if (!simpleValueIsKinded(term, ExprKind.Closure)) {
    return Err(
      InterpreterTypeError({
        reason: 'Callee must be a function',
        operator: kont.paren,
      }),
    );
  }

  return OkState(
    { term: kont.state.expression },
    kont.state.store,
    FnKont({
      state: State({ value: term }, store, kont.state.kont),
      paren: kont.paren,
    }),
  );
};

export const reduceFunCall = (
  term: Value,
  _store: Store,
  kont: FnKont,
): Result<StepState, InterpreterError> => {
  const ascrFun = kont.state.value;
  const closure = ascrFun.expression;

  const idomRes = EvidenceUtils.idom(ascrFun.evidence);

  if (!idomRes.success) {
    return Err(
      InterpreterTypeError({
        reason: idomRes.error.reason,
        operator: kont.paren,
      }),
    );
  }

  const argEviRes = EvidenceUtils.trans(term.evidence, idomRes.result);

  if (!argEviRes.success) {
    return Err(
      InterpreterTypeError({
        reason: argEviRes.error.reason,
        operator: kont.paren,
      }),
    );
  }

  const arg = AscribedValue({
    typeEff: closure.fun.binder.type,
    evidence: argEviRes.result,
    expression: term.expression,
  });

  const bodyEviRes = EvidenceUtils.icod(ascrFun.evidence);

  if (!bodyEviRes.success) {
    return Err(
      InterpreterTypeError({
        reason: bodyEviRes.error.reason,
        operator: kont.paren,
      }),
    );
  }

  const codomain = (ascrFun.typeEff.type as Arrow).codomain;
  const bodyEffect = SenvUtils.add(ascrFun.typeEff.effect, codomain.effect);

  const body = Ascription({
    expression: closure.fun.body,
    evidence: bodyEviRes.result,
    typeEff: TypeEff(codomain.type, bodyEffect),
  });

  return OkState(
    { term: body },
    StoreUtils.extend(closure.store, closure.fun.binder.name.lexeme, arg),
    kont.state.kont,
  );
};

export const funClosureCreation = (
  term: Ascribed<Fun>,
  store: Store,
  kont: Kont,
): Result<StepState, InterpreterError> => {
  return OkState(
    {
      term: Ascription({
        ...term,
        expression: Closure({
          fun: term.expression,
          typeEff: term.expression.typeEff,
          store,
        }),
      }),
    },
    store,
    kont,
  );
};
