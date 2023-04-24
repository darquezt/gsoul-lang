import { TypeEff, TypeEffUtils } from '@gsoul-lang/core/utils';
import { factoryOf, KindedFactory } from '@gsoul-lang/core/utils/ADT';
import { PolyT } from '@gsoul-lang/core/utils/Type';
import { Token } from '@gsoul-lang/parsing/lib/lexing';
import {
  Ascribed,
  Ascription,
  ExpressionUtils,
  ExprKind,
  Poly,
  simpleValueIsKinded,
  TCall,
  TClosure,
  Value,
} from '../../elaboration/ast';
import { EvidenceUtils, Store } from '../../utils';
import { Result } from '@badrap/result';
import { Kont, OkState, State, StepState } from '../cek';
import { InterpreterError, InterpreterTypeError } from '../errors';
import { zip } from 'ramda';
import { TypeEffect } from '@gsoul-lang/core/utils/TypeEff';

export enum PolyKontKind {
  PolyKont = 'PolyKont',
}

export type PolyKont = {
  kind: PolyKontKind.PolyKont;
  state: State<{ args: TypeEffect[] }>;
  bracket: Token;
};
export const PolyKont: KindedFactory<PolyKont> = factoryOf(
  PolyKontKind.PolyKont,
);

export const reducePolyCallee = (
  term: TCall,
  store: Store,
  kont: Kont,
): Result<StepState, InterpreterError> => {
  return OkState(
    { term: term.callee },
    store,
    PolyKont({
      state: State({ args: term.args }, store, kont),
      bracket: term.bracket,
    }),
  );
};

export const reducePolyBody = (
  term: Value,
  _store: Store,
  kont: PolyKont,
): Result<StepState, InterpreterError> => {
  if (!simpleValueIsKinded(term, ExprKind.TClosure)) {
    return Result.err(
      new InterpreterTypeError({
        reason: 'Only polymorphic expressions can be instantiated with types',
        operator: kont.bracket,
      }),
    );
  }
  const { typeVars, expr } = term.expression.poly;

  const evidenceRes = EvidenceUtils.iinst(term.evidence, kont.state.args);

  if (!evidenceRes.isOk) {
    return Result.err(
      new InterpreterTypeError({
        reason: evidenceRes.error.message,
        operator: kont.bracket,
      }),
    );
  }

  const evidence = evidenceRes.value;

  const newAscrTypeEff = TypeEffUtils.PolysUtils.instance(
    term.typeEff as TypeEff<PolyT>,
    kont.state.args,
  );

  const body = zip(typeVars, kont.state.args).reduce(
    (acc, [tvar, effect]) =>
      ExpressionUtils.substTypevar(acc, tvar.lexeme, effect),
    expr,
  );

  const result = Ascription({
    evidence,
    expression: body,
    typeEff: newAscrTypeEff,
  });

  return OkState({ term: result }, term.expression.store, kont.state.kont);
};

export const polyClosureCreation = (
  term: Ascribed<Poly>,
  store: Store,
  kont: Kont,
): Result<StepState, InterpreterError> => {
  return OkState(
    {
      term: Ascription({
        evidence: term.evidence,
        typeEff: term.typeEff,
        expression: TClosure({
          poly: term.expression,
          typeEff: term.expression.typeEff,
          store,
        }),
      }),
    },
    store,
    kont,
  );
};
