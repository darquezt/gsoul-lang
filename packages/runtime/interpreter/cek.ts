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
} from '../ast';
import { Store, StoreUtils, Evidence, EvidenceUtils } from '../utils';
import { TypeEff } from '@gsens-lang/core/utils/TypeEff';
import Token from '@gsens-lang/parsing/lexing/Token';
import TokenType from '@gsens-lang/parsing/lexing/TokenType';
import { Real } from '@gsens-lang/core/utils/Type';
import { SenvUtils } from '@gsens-lang/core/utils';

type EmptyKont = {
  kind: 'EmptyKont';
};
const EmptyKont: SingletonKindedFactory<EmptyKont> = singletonFactoryOf(
  'EmptyKont',
);

type ArgKont = {
  kind: 'ArgKont';
  state: State<{ expression: Expression }>;
};
const ArgKont: KindedFactory<ArgKont> = factoryOf('ArgKont');

type FnKont = {
  kind: 'FnKont';
  state: State<{ value: Value<Closure> }>;
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

const inject = (
  term: Expression | Statement,
): State<{ term: Expression | Statement }> => {
  return State({ term }, Store(), EmptyKont());
};

const step = ({
  term,
  store,
  kont,
}: State<{ term: Expression | Statement }>): State<{
  term: Expression | Statement;
}> => {
  switch (term.kind) {
    case 'Binary': {
      return State(
        { term: term.left },
        store,
        RightOpKont({
          state: State({ expression: term.right }, store, kont),
          op: term.operator,
        }),
      );
    }

    case 'NonLinearBinary': {
      return State(
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
        throw new Error('undefined variable');
      }

      return State({ term: ascribedValueToExpr(value) }, store, kont);
    }

    case 'Call': {
      return State(
        { term: term.callee },
        store,
        ArgKont({
          state: State({ expression: term.arg }, store, kont),
        }),
      );
    }

    case 'Ascription': {
      const inner = term.expression;

      // Expression finished evaluating
      if (isSimpleValue(inner)) {
        switch (kont.kind) {
          case 'RightOpKont': {
            return State(
              { term: kont.state.expression },
              store,
              LeftOpKont({
                state: State({ value: term as Value }, store, kont.state.kont),
                op: kont.op,
              }),
            );
          }

          case 'NLRightOpKont': {
            return State(
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
                throw new Error('Left operand of + must be a number');
              }

              const left = kont.state.value;

              if (!simpleValueIsKinded(left, 'RealLiteral')) {
                throw new Error('Left operand of + must be a number');
              }

              const innerSum = left.expression.value + inner.value;
              const sum = AscribedValue({
                expression: RealLiteral({
                  value: innerSum,
                }),
                evidence: EvidenceUtils.sum(left.evidence, term.evidence),
                typeEff: TypeEff(
                  Real(),
                  SenvUtils.add(left.typeEff.effect, term.typeEff.effect),
                ),
              });

              return State({ term: sum }, store, kont.state.kont);
            }

            throw new Error('FATAL: Unknown binary op');
          }

          case 'NLLeftOpKont': {
            if (kont.op.type === TokenType.STAR) {
              if (!isKinded(inner, 'RealLiteral')) {
                throw new Error('Left operand of * must be a number');
              }

              const left = kont.state.value;

              if (!simpleValueIsKinded(left, 'RealLiteral')) {
                throw new Error('Left operand of * must be a number');
              }

              const innerProduct = left.expression.value * inner.value;
              const sum = AscribedValue({
                expression: RealLiteral({
                  value: innerProduct,
                }),
                evidence: EvidenceUtils.scaleInf(
                  EvidenceUtils.sum(left.evidence, term.evidence),
                ),
                typeEff: TypeEff(
                  Real(),
                  SenvUtils.scaleInf(
                    SenvUtils.add(left.typeEff.effect, term.typeEff.effect),
                  ),
                ),
              });

              return State({ term: sum }, store, kont.state.kont);
            }

            throw new Error('FATAL: Unknown binary op');
          }

          case 'ArgKont': {
            if (isKinded(inner, 'Closure')) {
              return State(
                { term: kont.state.expression },
                kont.state.store,
                FnKont({
                  state: State(
                    { value: term as Value<Closure> },
                    store,
                    kont.state.kont,
                  ),
                }),
              );
            }
            break; // TODO: Handle this case
          }

          case 'FnKont': {
            const ascrFun = kont.state.value;
            const closure = ascrFun.expression;

            const argEvi = EvidenceUtils.trans(
              term.evidence,
              EvidenceUtils.subst(
                EvidenceUtils.idom(ascrFun.evidence),
                closure.fun.binder.name.lexeme,
                term.typeEff.effect,
              ),
            );

            const arg = AscribedValue({
              typeEff: TypeEff(closure.fun.binder.type, term.typeEff.effect),
              evidence: argEvi,
              expression: inner,
            });

            return State(
              { term: closure.fun.body },
              StoreUtils.extend(
                closure.store,
                closure.fun.binder.name.lexeme,
                arg,
              ),
              kont.state.kont,
            );
          }

          case 'AscrKont': {
            const evidence = EvidenceUtils.trans(
              term.evidence,
              kont.state.evidence,
            );

            return State(
              {
                term: Ascription({
                  evidence,
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
              return State({ term }, kont.state.store, kont.state.kont);
            }

            // If there are more statements, we drop the value of the current one
            // and follow evaluating the next one

            const [nextStmt, ...restStmts] = statements;

            return State(
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
            // TODO: Pretty print
            console.log(term);

            return State({ term }, store, kont.kont);
          }

          case 'VarKont': {
            return State(
              { term },
              StoreUtils.extend(store, kont.state.variable, term as Value),
              kont.state.kont,
            );
          }
        }
      }

      // Closure creation
      if (isKinded(inner, 'Fun')) {
        return State(
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

      if (isKinded(inner, 'Ascription')) {
        return State(
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

      throw new Error(`FATAL. Kind: ${inner.kind}`);
    }

    /**
     * Statements
     */

    case 'Block': {
      if (term.statements.length === 0) {
        return State({ term: NilLiteral() }, store, kont);
      }

      const [firstStmt, ...restStmts] = term.statements;

      return State(
        { term: firstStmt },
        store,
        BlockKont({
          state: State({ statements: restStmts }, store, kont),
        }),
      );
    }

    case 'ExprStmt': {
      return State({ term: term.expression }, store, kont);
    }

    case 'Print': {
      return State({ term: term.expression }, store, PrintKont({ kont }));
    }

    case 'VarStmt': {
      return State(
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
      throw new Error(term.kind);
  }
};

export const evaluate = (expr: Expression | Statement): Expression => {
  let state = inject(expr);

  while (
    !isValue(state.term as Expression) ||
    state.kont.kind !== 'EmptyKont'
  ) {
    state = step(state);
  }

  return state.term as Expression; // TODO: Improve this
};
