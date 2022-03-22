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
  ExprKind,
  StmtKind,
  SClosure,
  Forall,
  ExpressionUtils,
} from '../elaboration/ast';
import { Store, StoreUtils, Evidence, EvidenceUtils } from '../utils';
import { TypeEff } from '@gsens-lang/core/utils/TypeEff';
import { Token, TokenType } from '@gsens-lang/parsing/lib/lexing';
import { Arrow, ForallT, Real } from '@gsens-lang/core/utils/Type';
import { Senv, SenvUtils, TypeEffUtils } from '@gsens-lang/core/utils';
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

enum KontKind {
  EmptyKont = 'EmptyKont',
  ArgKont = 'ArgKont',
  FnKont = 'FnKont',
  ForallKont = 'ForallKont',
  ForallSubstKont = 'ForallSubstKont',
  RightOpKont = 'RightOpKont',
  LeftOpKont = 'LeftOpKont',
  NLRightOpKont = 'NLRightOpKont',
  NLLeftOpKont = 'NLLeftOpKont',
  AscrKont = 'AscrKont',
  BlockKont = 'BlockKont',
  PrintKont = 'PrintKont',
  VarKont = 'VarKont',
}

type EmptyKont = {
  kind: KontKind.EmptyKont;
};
const EmptyKont: SingletonKindedFactory<EmptyKont> = singletonFactoryOf(
  KontKind.EmptyKont,
);

// Lambda app konts

type ArgKont = {
  kind: KontKind.ArgKont;
  state: State<{ expression: Expression }>;
  paren: Token;
};
const ArgKont: KindedFactory<ArgKont> = factoryOf(KontKind.ArgKont);

type FnKont = {
  kind: KontKind.FnKont;
  state: State<{ value: Value<Closure> }>;
  paren: Token;
};
const FnKont: KindedFactory<FnKont> = factoryOf(KontKind.FnKont);

// Sensitivity polymorphism konts

type ForallKont = {
  kind: KontKind.ForallKont;
  state: State<{ senv: Senv }>;
  bracket: Token;
};
const ForallKont: KindedFactory<ForallKont> = factoryOf(KontKind.ForallKont);

type ForallSubstKont = {
  kind: KontKind.ForallSubstKont;
  state: State<{ name: string; senv: Senv }>;
};
const ForallSubstKont: KindedFactory<ForallSubstKont> = factoryOf(
  KontKind.ForallSubstKont,
);

// Binary operations konts

type RightOpKont = {
  kind: KontKind.RightOpKont;
  state: State<{ expression: Expression }>;
  op: Token;
};
const RightOpKont: KindedFactory<RightOpKont> = factoryOf(KontKind.RightOpKont);

type LeftOpKont = {
  kind: KontKind.LeftOpKont;
  state: State<{ value: Value }>;
  op: Token;
};
const LeftOpKont: KindedFactory<LeftOpKont> = factoryOf(KontKind.LeftOpKont);

type NLRightOpKont = {
  kind: KontKind.NLRightOpKont;
  state: State<{ expression: Expression }>;
  op: Token;
};
const NLRightOpKont: KindedFactory<NLRightOpKont> = factoryOf(
  KontKind.NLRightOpKont,
);

type NLLeftOpKont = {
  kind: KontKind.NLLeftOpKont;
  state: State<{ value: Value }>;
  op: Token;
};
const NLLeftOpKont: KindedFactory<NLLeftOpKont> = factoryOf(
  KontKind.NLLeftOpKont,
);

// Ascription konts

type AscrKont = {
  kind: KontKind.AscrKont;
  state: State<{ typeEff: TypeEff; evidence: Evidence }>;
};
const AscrKont: KindedFactory<AscrKont> = factoryOf(KontKind.AscrKont);

// Block konts

type BlockKont = {
  kind: KontKind.BlockKont;
  state: State<{ statements: Statement[] }>;
};
const BlockKont: KindedFactory<BlockKont> = factoryOf(KontKind.BlockKont);

// Print konts

type PrintKont = {
  kind: KontKind.PrintKont;
  kont: Kont;
  showEvidence: boolean;
};
const PrintKont: KindedFactory<PrintKont> = factoryOf(KontKind.PrintKont);

// Variable declaration konts

type VarKont = {
  kind: KontKind.VarKont;
  state: State<{ variable: string }>;
};
const VarKont: KindedFactory<VarKont> = factoryOf(KontKind.VarKont);

type Kont =
  | EmptyKont
  | RightOpKont
  | LeftOpKont
  | NLRightOpKont
  | NLLeftOpKont
  | ArgKont
  | FnKont
  | ForallKont
  | ForallSubstKont
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
    case ExprKind.Binary: {
      return OkState(
        { term: term.left },
        store,
        RightOpKont({
          state: State({ expression: term.right }, store, kont),
          op: term.operator,
        }),
      );
    }

    case ExprKind.NonLinearBinary: {
      return OkState(
        { term: term.left },
        store,
        NLRightOpKont({
          state: State({ expression: term.right }, store, kont),
          op: term.operator,
        }),
      );
    }

    case ExprKind.Variable: {
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

    case ExprKind.Call: {
      return OkState(
        { term: term.callee },
        store,
        ArgKont({
          state: State({ expression: term.arg }, store, kont),
          paren: term.paren,
        }),
      );
    }

    case ExprKind.SCall: {
      return OkState(
        { term: term.callee },
        store,
        ForallKont({
          state: State({ senv: term.arg }, store, kont),
          bracket: term.bracket,
        }),
      );
    }

    case ExprKind.Ascription: {
      const inner = term.expression;

      // Expression finished evaluating
      if (isSimpleValue(inner)) {
        switch (kont.kind) {
          case KontKind.RightOpKont: {
            return OkState(
              { term: kont.state.expression },
              store,
              LeftOpKont({
                state: State({ value: term as Value }, store, kont.state.kont),
                op: kont.op,
              }),
            );
          }

          case KontKind.NLRightOpKont: {
            return OkState(
              { term: kont.state.expression },
              store,
              NLLeftOpKont({
                state: State({ value: term as Value }, store, kont.state.kont),
                op: kont.op,
              }),
            );
          }

          case KontKind.LeftOpKont: {
            if (kont.op.type === TokenType.PLUS) {
              if (!isKinded(inner, ExprKind.RealLiteral)) {
                return Err(
                  InterpreterEvidenceError({
                    reason: `Left operand of ${kont.op.lexeme} must be a number`,
                  }),
                );
              }

              const left = kont.state.value;

              if (!simpleValueIsKinded(left, ExprKind.RealLiteral)) {
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

          case KontKind.NLLeftOpKont: {
            if (kont.op.type === TokenType.STAR) {
              if (!isKinded(inner, ExprKind.RealLiteral)) {
                return Err(
                  InterpreterTypeError({
                    reason: `Left operand of ${kont.op.lexeme} must be a number`,
                    operator: kont.op,
                  }),
                );
              }

              const left = kont.state.value;

              if (!simpleValueIsKinded(left, ExprKind.RealLiteral)) {
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

          case KontKind.ArgKont: {
            if (isKinded(inner, ExprKind.Closure)) {
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

          case KontKind.FnKont: {
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
              idomRes.result,
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
              typeEff: closure.fun.binder.type,
              evidence: argEviRes.result,
              expression: inner,
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
            const bodyEffect = SenvUtils.add(
              ascrFun.typeEff.effect,
              codomain.effect,
            );

            const body = Ascription({
              expression: closure.fun.body,
              evidence: bodyEviRes.result,
              typeEff: TypeEff(codomain.type, bodyEffect),
            });

            return OkState(
              { term: body },
              StoreUtils.extend(
                closure.store,
                closure.fun.binder.name.lexeme,
                arg,
              ),
              kont.state.kont,
            );
          }

          case KontKind.ForallKont: {
            if (isKinded(inner, ExprKind.SClosure)) {
              const {
                sensVars: [svar, ...sensVars],
                expr: body,
              } = inner.forall;

              const evidenceRes = EvidenceUtils.iscod(
                term.evidence,
                svar.lexeme,
                kont.state.senv,
              );

              if (!evidenceRes.success) {
                return Err(
                  InterpreterTypeError({
                    reason: evidenceRes.error.reason,
                    operator: kont.bracket,
                  }),
                );
              }

              const evidence = evidenceRes.result;

              const newTypeEff =
                sensVars.length === 0
                  ? inner.forall.typeEff.type.codomain
                  : TypeEff(
                      ForallT({
                        sensVars: sensVars.map((v) => v.lexeme),
                        codomain: inner.forall.typeEff.type.codomain,
                      }),
                      inner.typeEff.effect,
                    );

              const newAscrTypeEff =
                sensVars.length === 0
                  ? (term.typeEff.type as ForallT).codomain
                  : TypeEff(
                      ForallT({
                        sensVars: sensVars.map((v) => v.lexeme),
                        codomain: (term.typeEff.type as ForallT).codomain,
                      }),
                      term.typeEff.effect,
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
                inner.store,
                ForallSubstKont({
                  state: {
                    name: svar.lexeme,
                    senv: kont.state.senv,
                    store: kont.state.store,
                    kont: kont.state.kont,
                  },
                }),
              );
            }
            break;
          }

          case KontKind.ForallSubstKont: {
            return OkState(
              {
                term: ExpressionUtils.subst(
                  term,
                  kont.state.name,
                  kont.state.senv,
                ),
              },
              kont.state.store,
              kont.state.kont,
            );
          }

          case KontKind.AscrKont: {
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

          case KontKind.BlockKont: {
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

          case KontKind.PrintKont: {
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

          case KontKind.VarKont: {
            return OkState(
              { term },
              StoreUtils.extend(store, kont.state.variable, term as Value),
              kont.state.kont,
            );
          }
        }
      }

      // Closure creation
      if (isKinded(inner, ExprKind.Fun)) {
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

      // SClosure creation

      if (isKinded(inner, ExprKind.Forall)) {
        return OkState(
          {
            term: Ascription({
              ...term,
              expression: SClosure({
                forall: inner,
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

    case ExprKind.Block: {
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

    case StmtKind.ExprStmt: {
      return OkState({ term: term.expression }, store, kont);
    }

    case ExprKind.Print: {
      return OkState(
        { term: term.expression },
        store,
        PrintKont({ kont, showEvidence: term.showEvidence }),
      );
    }

    case StmtKind.VarStmt: {
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
    state.kont.kind !== KontKind.EmptyKont
  ) {
    const result = step(state);

    if (!result.success) {
      return result;
    }

    state = result.result;
  }

  return Ok(state.term as Value); // TODO: Improve this
};
