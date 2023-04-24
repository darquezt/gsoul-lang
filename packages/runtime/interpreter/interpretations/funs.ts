import { SenvUtils, TypeEff } from '@gsoul-lang/core/utils';
import { factoryOf, KindedFactory } from '@gsoul-lang/core/utils/ADT';
import { Arrow } from '@gsoul-lang/core/utils/Type';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
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
import { Result } from '@badrap/result';
import { Kont, OkState, State, StepState } from '../cek';
import { InterpreterError, InterpreterTypeError } from '../errors';
import { zip } from 'ramda';
import { Evidence, EvidenceError } from '../../utils/Evidence';

export enum FunKontKind {
  ArgsKont = 'ArgsKont',
  FnKont = 'FnKont',
}

export type ArgsKont = {
  kind: FunKontKind.ArgsKont;
  state: State<{ expressions: Expression[] }>;
  paren: Token;
};
export const ArgsKont: KindedFactory<ArgsKont> = factoryOf(
  FunKontKind.ArgsKont,
);

export type FnKont = {
  kind: FunKontKind.FnKont;
  state: State<{
    value: Value<Closure>;
    nextArgs: Expression[];
    previousArgs: Value[];
  }>;
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
    ArgsKont({
      state: State({ expressions: term.args, values: [] }, store, kont),
      paren: term.paren,
    }),
  );
};

export const reduceFunArg = (
  term: Value,
  _store: Store,
  kont: ArgsKont,
): Result<StepState, InterpreterError> => {
  if (!simpleValueIsKinded(term, ExprKind.Closure)) {
    return Result.err(
      new InterpreterTypeError({
        reason: 'Callee must be a function',
        operator: kont.paren,
      }),
    );
  }

  if (kont.state.expressions.length === 0) {
    return Result.err(
      new InterpreterTypeError({
        reason: 'Not enough arguments',
        operator: kont.paren,
      }),
    );
  }

  const [nextArg, ...nextArgs] = kont.state.expressions;

  return OkState(
    { term: nextArg },
    kont.state.store,
    FnKont({
      state: State(
        { value: term, nextArgs, previousArgs: [] },
        kont.state.store,
        kont.state.kont,
      ),
      paren: kont.paren,
    }),
  );
};

export const reduceFunCall = (
  term: Value,
  _store: Store,
  kont: FnKont,
): Result<StepState, InterpreterError> => {
  if (kont.state.nextArgs.length > 0) {
    const [nextArg, ...nextArgs] = kont.state.nextArgs;

    return OkState(
      { term: nextArg },
      kont.state.store,
      FnKont({
        state: State(
          {
            value: kont.state.value,
            nextArgs,
            previousArgs: [...kont.state.previousArgs, term],
          },
          kont.state.store,
          kont.state.kont,
        ),
        paren: kont.paren,
      }),
    );
  }

  const ascrFun = kont.state.value;
  const closure = ascrFun.expression;

  const idomRes = EvidenceUtils.idom(ascrFun.evidence);

  if (!idomRes.isOk) {
    return Result.err(
      new InterpreterTypeError({
        reason: idomRes.error.message,
        operator: kont.paren,
      }),
    );
  }

  const args = [...kont.state.previousArgs, term];

  const argsEviRes = Result.all(
    zip(
      args.map((a) => a.evidence),
      idomRes.value,
    ).map(([ev, idom]) => EvidenceUtils.trans(ev, idom)),
  ) as unknown as Result<Evidence[], EvidenceError>;

  if (!argsEviRes.isOk) {
    return Result.err(
      new InterpreterTypeError({
        reason: argsEviRes.error.message,
        operator: kont.paren,
      }),
    );
  }

  const ascribedArgs = zip(
    argsEviRes.value,
    zip(args, closure.fun.binders),
  ).map(([evi, [arg, binder]]) =>
    AscribedValue({
      typeEff: binder.type,
      evidence: evi,
      expression: arg.expression,
    }),
  );

  const bodyEviRes = EvidenceUtils.icod(ascrFun.evidence);

  if (!bodyEviRes.isOk) {
    return Result.err(
      new InterpreterTypeError({
        reason: bodyEviRes.error.message,
        operator: kont.paren,
      }),
    );
  }

  // We can safely cast here because we know that the type of the function is an arrow
  // Otherwise, the evidence would not be valid
  const ascrFunTeff = ascrFun.typeEff as TypeEff<Arrow>;

  const codomain = ascrFunTeff.type.codomain as TypeEff;
  const bodyEffect = SenvUtils.add(ascrFunTeff.effect, codomain.effect);

  const body = Ascription({
    expression: closure.fun.body,
    evidence: bodyEviRes.value,
    typeEff: TypeEff(codomain.type, bodyEffect),
  });

  return OkState(
    { term: body },
    StoreUtils.extendMany(
      closure.store,
      closure.fun.binders.map((b) => b.name.lexeme),
      ascribedArgs,
    ),
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
