import { SenvUtils, TypeEff } from '@gsens-lang/core/utils';
import { factoryOf, isKinded, KindedFactory } from '@gsens-lang/core/utils/ADT';
import { Real } from '@gsens-lang/core/utils/Type';
import { Token, TokenType } from '@gsens-lang/parsing/lib/lexing';
import {
  AscribedValue,
  Binary,
  Expression,
  ExprKind,
  NonLinearBinary,
  RealLiteral,
  simpleValueIsKinded,
  Value,
} from '../../elaboration/ast';
import { EvidenceUtils, Store } from '../../utils';
import { Result } from '@badrap/result';
import { Kont, OkState, State, StepState } from '../cek';
import {
  InterpreterError,
  InterpreterEvidenceError,
  InterpreterTypeError,
  InterpreterUnsupportedOperator,
} from '../errors';

export enum BinaryKontKind {
  RightOpKont = 'RightOpKont',
  LeftOpKont = 'LeftOpKont',
  NLRightOpKont = 'NLRightOpKont',
  NLLeftOpKont = 'NLLeftOpKont',
}

export type RightOpKont = {
  kind: BinaryKontKind.RightOpKont;
  state: State<{ expression: Expression }>;
  op: Token;
};
export const RightOpKont: KindedFactory<RightOpKont> = factoryOf(
  BinaryKontKind.RightOpKont,
);

export type LeftOpKont = {
  kind: BinaryKontKind.LeftOpKont;
  state: State<{ value: Value }>;
  op: Token;
};
export const LeftOpKont: KindedFactory<LeftOpKont> = factoryOf(
  BinaryKontKind.LeftOpKont,
);

export type NLRightOpKont = {
  kind: BinaryKontKind.NLRightOpKont;
  state: State<{ expression: Expression }>;
  op: Token;
};
export const NLRightOpKont: KindedFactory<NLRightOpKont> = factoryOf(
  BinaryKontKind.NLRightOpKont,
);

export type NLLeftOpKont = {
  kind: BinaryKontKind.NLLeftOpKont;
  state: State<{ value: Value }>;
  op: Token;
};
export const NLLeftOpKont: KindedFactory<NLLeftOpKont> = factoryOf(
  BinaryKontKind.NLLeftOpKont,
);

export const reduceLeftOperand = (
  term: Binary,
  store: Store,
  kont: Kont,
): Result<StepState, InterpreterError> => {
  return OkState(
    { term: term.left },
    store,
    RightOpKont({
      state: State({ expression: term.right }, store, kont),
      op: term.operator,
    }),
  );
};

export const reduceRightOperand = (
  term: Value,
  store: Store,
  kont: RightOpKont,
): Result<StepState, InterpreterError> => {
  return OkState(
    { term: kont.state.expression },
    store,
    LeftOpKont({
      state: State({ value: term }, store, kont.state.kont),
      op: kont.op,
    }),
  );
};

export const reduceBinaryOperation = (
  term: Value,
  store: Store,
  kont: LeftOpKont,
): Result<StepState, InterpreterError> => {
  const inner = term.expression;
  if (kont.op.type === TokenType.PLUS) {
    if (!isKinded(inner, ExprKind.RealLiteral)) {
      return Result.err(
        new InterpreterTypeError({
          reason: `Left operand of ${kont.op.lexeme} must be a number`,
          operator: kont.op,
        }),
      );
    }

    const left = kont.state.value;

    if (!simpleValueIsKinded(left, ExprKind.RealLiteral)) {
      return Result.err(
        new InterpreterTypeError({
          reason: `Right operand of ${kont.op.lexeme} must be a number`,
          operator: kont.op,
        }),
      );
    }

    const innerSum = left.expression.value + inner.value;
    const sumEvidenceRes = EvidenceUtils.sum(left.evidence, term.evidence);

    if (!sumEvidenceRes.isOk) {
      return Result.err(
        new InterpreterEvidenceError({
          reason: sumEvidenceRes.error.message,
        }),
      );
    }

    const sum = AscribedValue({
      expression: RealLiteral({
        value: innerSum,
      }),
      evidence: sumEvidenceRes.value,
      typeEff: TypeEff(
        Real(),
        SenvUtils.add(left.typeEff.effect, term.typeEff.effect),
      ),
    });

    return OkState({ term: sum }, store, kont.state.kont);
  }

  return Result.err(
    new InterpreterUnsupportedOperator({
      reason: `We're sorry. GSens does not support the ${kont.op.lexeme} operator yet`,
      operator: kont.op,
    }),
  );
};

export const reduceNLLeftOperand = (
  term: NonLinearBinary,
  store: Store,
  kont: Kont,
): Result<StepState, InterpreterError> => {
  return OkState(
    { term: term.left },
    store,
    NLRightOpKont({
      state: State({ expression: term.right }, store, kont),
      op: term.operator,
    }),
  );
};

export const reduceNLRightOperand = (
  term: Value,
  store: Store,
  kont: NLRightOpKont,
): Result<StepState, InterpreterError> => {
  return OkState(
    { term: kont.state.expression },
    store,
    NLLeftOpKont({
      state: State({ value: term }, store, kont.state.kont),
      op: kont.op,
    }),
  );
};

export const reduceNLBinaryOperation = (
  term: Value,
  store: Store,
  kont: NLLeftOpKont,
): Result<StepState, InterpreterError> => {
  const inner = term.expression;

  if (kont.op.type === TokenType.STAR) {
    if (!isKinded(inner, ExprKind.RealLiteral)) {
      return Result.err(
        new InterpreterTypeError({
          reason: `Left operand of ${kont.op.lexeme} must be a number`,
          operator: kont.op,
        }),
      );
    }

    const left = kont.state.value;

    if (!simpleValueIsKinded(left, ExprKind.RealLiteral)) {
      return Result.err(
        new InterpreterTypeError({
          reason: `Right operand of ${kont.op.lexeme} must be a number`,
          operator: kont.op,
        }),
      );
    }

    const innerProduct = left.expression.value * inner.value;

    const sumEvidenceRes = EvidenceUtils.sum(left.evidence, term.evidence);

    if (!sumEvidenceRes.isOk) {
      return Result.err(
        new InterpreterTypeError({
          reason: sumEvidenceRes.error.message,
          operator: kont.op,
        }),
      );
    }

    const sum = AscribedValue({
      expression: RealLiteral({
        value: innerProduct,
      }),
      evidence: EvidenceUtils.scaleInf(sumEvidenceRes.value),
      typeEff: TypeEff(
        Real(),
        SenvUtils.scaleInf(
          SenvUtils.add(left.typeEff.effect, term.typeEff.effect),
        ),
      ),
    });

    return OkState({ term: sum }, store, kont.state.kont);
  }

  return Result.err(
    new InterpreterUnsupportedOperator({
      reason: `We're sorry. GSens does not support the ${kont.op.lexeme} operator yet`,
      operator: kont.op,
    }),
  );
};
