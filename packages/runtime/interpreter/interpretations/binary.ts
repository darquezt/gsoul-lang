import { SenvUtils, TypeEff } from '@gsoul-lang/core/utils';
import { factoryOf, isKinded, KindedFactory } from '@gsoul-lang/core/utils/ADT';
import { Bool, Real } from '@gsoul-lang/core/utils/Type';
import { Token, TokenType } from '@gsoul-lang/parsing/lib/lexing';
import {
  AscribedValue,
  Binary,
  BoolLiteral,
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
  _store: Store,
  kont: RightOpKont,
): Result<StepState, InterpreterError> => {
  return OkState(
    { term: kont.state.expression },
    kont.state.store,
    LeftOpKont({
      state: State({ value: term }, kont.state.store, kont.state.kont),
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
  if (kont.op.type === TokenType.PLUS || kont.op.type === TokenType.MINUS) {
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

    const innerSum =
      kont.op.type === TokenType.PLUS
        ? left.expression.value + inner.value
        : left.expression.value - inner.value;

    const sumEvidenceRes = EvidenceUtils.sum(left.evidence, term.evidence);

    if (!sumEvidenceRes.isOk) {
      return Result.err(
        new InterpreterEvidenceError({
          reason: sumEvidenceRes.error.message,
        }),
      );
    }

    // We can safely cast here because we know that the type of the left and right operands are Real
    // Otherwise, the evidence would not be valid
    const leftTeff = left.typeEff as TypeEff;
    const rightTeff = term.typeEff as TypeEff;

    const sum = AscribedValue({
      expression: RealLiteral({
        value: innerSum,
      }),
      evidence: sumEvidenceRes.value,
      typeEff: TypeEff(
        Real(),
        SenvUtils.add(leftTeff.effect, rightTeff.effect),
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
  _store: Store,
  kont: NLRightOpKont,
): Result<StepState, InterpreterError> => {
  return OkState(
    { term: kont.state.expression },
    kont.state.store,
    NLLeftOpKont({
      state: State({ value: term }, kont.state.store, kont.state.kont),
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

    // We can safely cast here because we know that the type of the left and right operands are Real
    // Otherwise, the evidence would not be valid
    const leftTeff = left.typeEff as TypeEff;
    const rightTeff = term.typeEff as TypeEff;

    const sum = AscribedValue({
      expression: RealLiteral({
        value: innerProduct,
      }),
      evidence: EvidenceUtils.scaleInf(sumEvidenceRes.value),
      typeEff: TypeEff(
        Real(),
        SenvUtils.scaleInf(SenvUtils.add(leftTeff.effect, rightTeff.effect)),
      ),
    });

    return OkState({ term: sum }, kont.state.store, kont.state.kont);
  } else if (
    [
      TokenType.GREATER,
      TokenType.GREATER_EQUAL,
      TokenType.LESS,
      TokenType.LESS_EQUAL,
      TokenType.EQUAL_EQUAL,
    ].includes(kont.op.type)
  ) {
    // if (!isKinded(inner, ExprKind.RealLiteral)) {
    //   return Result.err(
    //     new InterpreterTypeError({
    //       reason: `Left operand of ${kont.op.lexeme} must be a number`,
    //       operator: kont.op,
    //     }),
    //   );
    // }

    const left = kont.state.value;

    // if (!simpleValueIsKinded(left, ExprKind.RealLiteral)) {
    //   return Result.err(
    //     new InterpreterTypeError({
    //       reason: `Right operand of ${kont.op.lexeme} must be a number`,
    //       operator: kont.op,
    //     }),
    //   );
    // }

    let innerResult: boolean;

    if (
      isKinded(inner, ExprKind.RealLiteral) &&
      simpleValueIsKinded(left, ExprKind.RealLiteral)
    ) {
      if (kont.op.type === TokenType.EQUAL_EQUAL) {
        innerResult = left.expression.value === inner.value;
      } else if (kont.op.type === TokenType.LESS_EQUAL) {
        innerResult = left.expression.value <= inner.value;
      } else if (kont.op.type === TokenType.GREATER) {
        innerResult = left.expression.value > inner.value;
      } else if (kont.op.type === TokenType.GREATER_EQUAL) {
        innerResult = left.expression.value >= inner.value;
      } else {
        // LESS
        innerResult = left.expression.value < inner.value;
      }
    } else if (
      isKinded(inner, ExprKind.AtomLiteral) &&
      simpleValueIsKinded(left, ExprKind.AtomLiteral)
    ) {
      if (kont.op.type === TokenType.EQUAL_EQUAL) {
        innerResult = left.expression.name.lexeme === inner.name.lexeme;
      } else {
        return Result.err(
          new InterpreterTypeError({
            reason: 'Unsupported comparison between atoms',
            operator: kont.op,
          }),
        );
      }
    } else {
      return Result.err(
        new InterpreterTypeError({
          reason: 'Operands must be either numbers or atoms',
          operator: kont.op,
        }),
      );
    }

    const sumEvidenceRes = EvidenceUtils.realComparison(
      left.evidence,
      term.evidence,
    );

    if (!sumEvidenceRes.isOk) {
      return Result.err(
        new InterpreterTypeError({
          reason: sumEvidenceRes.error.message,
          operator: kont.op,
        }),
      );
    }

    // We can safely cast here because we know that the type of the left and right operands are Real
    // Otherwise, the evidence would not be valid
    const leftTeff = left.typeEff as TypeEff;
    const rightTeff = term.typeEff as TypeEff;

    const sum = AscribedValue({
      expression: BoolLiteral({
        value: innerResult,
      }),
      evidence: sumEvidenceRes.value,
      typeEff: TypeEff(
        Bool(),
        SenvUtils.scaleInf(SenvUtils.add(leftTeff.effect, rightTeff.effect)),
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
