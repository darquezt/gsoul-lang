import {
  factoryOf,
  isKinded,
  KindedFactory,
  singletonFactoryOf,
  SingletonKindedFactory,
} from '@gsens-lang/core/utils/ADT';
import {
  Expression,
  ascribedValueToExpr,
  Ascription,
  isSimpleValue,
  AscribedValue,
  Statement,
  NilLiteral,
  isValue,
  Closure,
  Value,
  simpleValueIsKinded,
  RealLiteral,
} from '../elaboration/ast';
import { Store, StoreUtils, Evidence, EvidenceUtils } from '../utils';
import { TypeEff } from '@gsens-lang/core/utils/TypeEff';
import Token from '@gsens-lang/parsing/lexing/Token';
import TokenType from '@gsens-lang/parsing/lexing/TokenType';
import { Real } from '@gsens-lang/core/utils/Type';
import { SenvUtils, TypeEffUtils } from '@gsens-lang/core/utils';
import { formatValue } from '../utils/format';
import {
  InterpreterError,
  InterpreterEvidenceError,
  InterpreterReferenceError,
  InterpreterTypeError,
  InterpreterUnsupportedExpression,
  InterpreterUnsupportedOperator,
} from './errors';
import { Err, Ok, Result } from '../utils/Result';

type EmptyKont = {
  kind: 'EmptyKont';
};
const EmptyKont: SingletonKindedFactory<EmptyKont> = singletonFactoryOf(
  'EmptyKont',
);

type ArgKont = {
  kind: 'ArgKont';
  state: State<{ expression: Expression }>;
  paren: Token;
};
const ArgKont: KindedFactory<ArgKont> = factoryOf('ArgKont');

type FnKont = {
  kind: 'FnKont';
  state: State<{ value: Value<Closure> }>;
  paren: Token;
};
const FnKont: KindedFactory<FnKont> = factoryOf('FnKont');

type RightOpKont = {
  kind: 'RightOpKont';
  state: State<{ expression: Expression }>;
  op: Token;
};
const RightOpKont: KindedFactory<RightOpKont> = factoryOf('RightOpKont');

type LeftOpKont = {
  kind: 'LeftOpKont';
  state: State<{ value: Value }>;
  op: Token;
};
const LeftOpKont: KindedFactory<LeftOpKont> = factoryOf('LeftOpKont');

type NLRightOpKont = {
  kind: 'NLRightOpKont';
  state: State<{ expression: Expression }>;
  op: Token;
};
const NLRightOpKont: KindedFactory<NLRightOpKont> = factoryOf('NLRightOpKont');

type NLLeftOpKont = {
  kind: 'NLLeftOpKont';
  state: State<{ value: Value }>;
  op: Token;
};
const NLLeftOpKont: KindedFactory<NLLeftOpKont> = factoryOf('NLLeftOpKont');

type AscrKont = {
  kind: 'AscrKont';
  state: State<{ typeEff: TypeEff; evidence: Evidence }>;
};
const AscrKont: KindedFactory<AscrKont> = factoryOf('AscrKont');

/**
 * Statement konts
 */

type BlockKont = {
  kind: 'BlockKont';
  state: State<{ statements: Statement[] }>;
};
const BlockKont: KindedFactory<BlockKont> = factoryOf('BlockKont');

type PrintKont = {
  kind: 'PrintKont';
  kont: Kont;
  showEvidence: boolean;
};
const PrintKont: KindedFactory<PrintKont> = factoryOf('PrintKont');

type VarKont = {
  kind: 'VarKont';
  state: State<{ variable: string }>;
};
const VarKont: KindedFactory<VarKont> = factoryOf('VarKont');

// type AscrKont = {
//   kind: 'AscrKont';
//   typeEff: TypeEff;
//   evidence: Evidence;
//   kont: Kont;
// };
// const AscrKont: KindedFactory<AscrKont> = factoryOf('AscrKont');

type Kont =
  | EmptyKont
  | RightOpKont
  | LeftOpKont
  | NLRightOpKont
  | NLLeftOpKont
  | ArgKont
  | FnKont
  | AscrKont
  | BlockKont
  | VarKont
  | PrintKont;

type State<T> = T & {
  store: Store;
  kont: Kont;
};
const State = <T>(t: T, store: Store, kont: Kont): State<T> => ({
  ...t,
  store,
  kont,
});

const OkState = <T>(t: T, store: Store, kont: Kont): Ok<State<T>> =>
  Ok({
    ...t,
    store,
    kont,
  });

type StepState = State<{ term: Expression | Statement }>;

const inject = (term: Expression | Statement): StepState => {
  return State({ term }, Store(), EmptyKont());
};

const step = ({
  term,
  store,
  kont,
}: StepState): Result<StepState, InterpreterError> => {
  switch (term.kind) {
    case 'Binary': {
      return OkState(
        { term: term.left },
        store,
        RightOpKont({
          state: State({ expression: term.right }, store, kont),
          op: term.operator,
        }),
      );
    }

    case 'NonLinearBinary': {
      return OkState(
        { term: term.left },
        store,
        NLRightOpKont({
          state: State({ expression: term.right }, store, kont),
          op: term.operator,
        }),
      );
    }

    case 'Variable': {
      const value = StoreUtils.get(store, term.name.lexeme);

      if (!value) {
        return Err(
          InterpreterReferenceError({
            reason: `Variable ${term.name.lexeme} is not defined`,
            variable: term.name,
          }),
        );
      }

      return OkState({ term: ascribedValueToExpr(value) }, store, kont);
    }

    case 'Call': {
      return OkState(
        { term: term.callee },
        store,
        ArgKont({
          state: State({ expression: term.arg }, store, kont),
          paren: term.paren,
        }),
      );
    }

    case 'Ascription': {
      const inner = term.expression;

      // Expression finished evaluating
      if (isSimpleValue(inner)) {
        switch (kont.kind) {
          case 'RightOpKont': {
            return OkState(
              { term: kont.state.expression },
              store,
              LeftOpKont({
                state: State({ value: term as Value }, store, kont.state.kont),
                op: kont.op,
              }),
            );
          }

          case 'NLRightOpKont': {
            return OkState(
              { term: kont.state.expression },
              store,
              NLLeftOpKont({
                state: State({ value: term as Value }, store, kont.state.kont),
                op: kont.op,
              }),
            );
          }

          case 'LeftOpKont': {
            if (kont.op.type === TokenType.PLUS) {
              if (!isKinded(inner, 'RealLiteral')) {
                return Err(
                  InterpreterEvidenceError({
                    reason: `Left operand of ${kont.op.lexeme} must be a number`,
                  }),
                );
              }

              const left = kont.state.value;

              if (!simpleValueIsKinded(left, 'RealLiteral')) {
                return Err(
                  InterpreterEvidenceError({
                    reason: `Right operand of ${kont.op.lexeme} must be a number`,
                  }),
                );
              }

              const innerSum = left.expression.value + inner.value;
              const sumEvidenceRes = EvidenceUtils.sum(
                left.evidence,
                term.evidence,
              );

              if (!sumEvidenceRes.success) {
                return Err(
                  InterpreterEvidenceError({
                    reason: sumEvidenceRes.error.reason,
                  }),
                );
              }

              const sum = AscribedValue({
                expression: RealLiteral({
                  value: innerSum,
                }),
                evidence: sumEvidenceRes.result,
                typeEff: TypeEff(
                  Real(),
                  SenvUtils.add(left.typeEff.effect, term.typeEff.effect),
                ),
              });

              return OkState({ term: sum }, store, kont.state.kont);
            }

            return Err(
              InterpreterUnsupportedOperator({
                reason: `We're sorry. GSens does not support the ${kont.op.lexeme} operator yet`,
                operator: kont.op,
              }),
            );
          }

          case 'NLLeftOpKont': {
            if (kont.op.type === TokenType.STAR) {
              if (!isKinded(inner, 'RealLiteral')) {
                return Err(
                  InterpreterTypeError({
                    reason: `Left operand of ${kont.op.lexeme} must be a number`,
                    operator: kont.op,
                  }),
                );
              }

              const left = kont.state.value;

              if (!simpleValueIsKinded(left, 'RealLiteral')) {
                return Err(
                  InterpreterTypeError({
                    reason: `Right operand of ${kont.op.lexeme} must be a number`,
                    operator: kont.op,
                  }),
                );
              }

              const innerProduct = left.expression.value * inner.value;

              const sumEvidenceRes = EvidenceUtils.sum(
                left.evidence,
                term.evidence,
              );

              if (!sumEvidenceRes.success) {
                return Err(
                  InterpreterTypeError({
                    reason: sumEvidenceRes.error.reason,
                    operator: kont.op,
                  }),
                );
              }

              const sum = AscribedValue({
                expression: RealLiteral({
                  value: innerProduct,
                }),
                evidence: EvidenceUtils.scaleInf(sumEvidenceRes.result),
                typeEff: TypeEff(
                  Real(),
                  SenvUtils.scaleInf(
                    SenvUtils.add(left.typeEff.effect, term.typeEff.effect),
                  ),
                ),
              });

              return OkState({ term: sum }, store, kont.state.kont);
            }

            return Err(
              InterpreterUnsupportedOperator({
                reason: `We're sorry. GSens does not support the ${kont.op.lexeme} operator yet`,
                operator: kont.op,
              }),
            );
          }

          case 'ArgKont': {
            if (isKinded(inner, 'Closure')) {
              return OkState(
                { term: kont.state.expression },
                kont.state.store,
                FnKont({
                  state: State(
                    { value: term as Value<Closure> },
                    store,
                    kont.state.kont,
                  ),
                  paren: kont.paren,
                }),
              );
            }
            break; // TODO: Handle this case
          }

          case 'FnKont': {
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

            const argEviRes = EvidenceUtils.trans(
              term.evidence,
              EvidenceUtils.subst(
                idomRes.result,
                closure.fun.binder.name.lexeme,
                term.typeEff.effect,
              ),
            );

            if (!argEviRes.success) {
              return Err(
                InterpreterTypeError({
                  reason: argEviRes.error.reason,
                  operator: kont.paren,
                }),
              );
            }

            const arg = AscribedValue({
              typeEff: TypeEff(closure.fun.binder.type, term.typeEff.effect),
              evidence: argEviRes.result,
              expression: inner,
            });

            return OkState(
              { term: closure.fun.body }, // TODO: Ascribe it!
              StoreUtils.extend(
                closure.store,
                closure.fun.binder.name.lexeme,
                arg,
              ),
              kont.state.kont,
            );
          }

          case 'AscrKont': {
            const evidenceRes = EvidenceUtils.trans(
              term.evidence,
              kont.state.evidence,
            );

            if (!evidenceRes.success) {
              return Err(
                InterpreterEvidenceError({
                  reason: evidenceRes.error.reason,
                }),
              );
            }

            return OkState(
              {
                term: Ascription({
                  evidence: evidenceRes.result,
                  expression: inner,
                  typeEff: kont.state.typeEff,
                }),
              },
              kont.state.store,
              kont.state.kont,
            );
          }

          case 'BlockKont': {
            const { statements } = kont.state;

            // When all the statements in the block have finished evaluating
            // we restore the store and the kont
            if (statements.length === 0) {
              return OkState({ term }, kont.state.store, kont.state.kont);
            }

            // If there are more statements, we drop the value of the current one
            // and follow evaluating the next one

            const [nextStmt, ...restStmts] = statements;

            return OkState(
              { term: nextStmt },
              store,
              BlockKont({
                state: State(
                  { statements: restStmts },
                  kont.state.store,
                  kont.state.kont,
                ),
              }),
            );
          }

          case 'PrintKont': {
            if (kont.showEvidence) {
              console.log(
                `${EvidenceUtils.format(term.evidence)} ${formatValue(
                  inner,
                )} :: ${TypeEffUtils.format(term.typeEff)}`,
              );
            } else {
              console.log(formatValue(inner));
            }

            return OkState({ term }, store, kont.kont);
          }

          case 'VarKont': {
            return OkState(
              { term },
              StoreUtils.extend(store, kont.state.variable, term as Value),
              kont.state.kont,
            );
          }
        }
      }

      // Closure creation
      if (isKinded(inner, 'Fun')) {
        return OkState(
          {
            term: Ascription({
              ...term,
              expression: Closure({
                fun: inner,
                typeEff: inner.typeEff,
                store,
              }),
            }),
          },
          store,
          kont,
        );
      }

      return OkState(
        { term: inner },
        store,
        AscrKont({
          state: State(
            {
              typeEff: term.typeEff,
              evidence: term.evidence,
            },
            store,
            kont,
          ),
        }),
      );
    }

    /**
     * Statements
     */

    case 'Block': {
      if (term.statements.length === 0) {
        return OkState({ term: NilLiteral() }, store, kont);
      }

      const [firstStmt, ...restStmts] = term.statements;

      return OkState(
        { term: firstStmt },
        store,
        BlockKont({
          state: State({ statements: restStmts }, store, kont),
        }),
      );
    }

    case 'ExprStmt': {
      return OkState({ term: term.expression }, store, kont);
    }

    case 'Print': {
      return OkState(
        { term: term.expression },
        store,
        PrintKont({ kont, showEvidence: term.showEvidence }),
      );
    }

    case 'VarStmt': {
      return OkState(
        { term: term.assignment },
        store,
        VarKont({
          state: State(
            {
              variable: term.name.lexeme,
            },
            store,
            kont,
          ),
        }),
      );
    }

    default:
      return Err(
        InterpreterUnsupportedExpression({
          reason: `We're sorry. GSens does not support this kinds of expressions yet (${term.kind})`,
        }),
      );
  }
};

export const evaluate = (
  expr: Expression | Statement,
): Result<Value, InterpreterError> => {
  let state = inject(expr);

  while (
    !isValue(state.term as Expression) ||
    state.kont.kind !== 'EmptyKont'
  ) {
    const result = step(state);

    if (!result.success) {
      return result;
    }

    state = result.result;
  }

  return Ok(state.term as Value); // TODO: Improve this
};
