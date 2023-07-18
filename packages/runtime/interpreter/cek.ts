import {
  singletonFactoryOf,
  SingletonKindedFactory,
} from '@gsoul-lang/core/utils/ADT';
import {
  Expression,
  Statement,
  isValue,
  Value,
  ExprKind,
  StmtKind,
  ascrExpressionIsKinded,
  isSimpleValue,
  SimpleValue,
} from '../elaboration/ast';
import { Store } from '../utils';
import { InterpreterError, InterpreterUnsupportedExpression } from './errors';
import { Result } from '@badrap/result';
import {
  BinaryKontKind,
  LeftOpKont,
  NLLeftOpKont,
  NLRightOpKont,
  reduceBinaryOperation,
  reduceLeftOperand,
  reduceNLBinaryOperation,
  reduceNLLeftOperand,
  reduceNLRightOperand,
  reduceRightOperand,
  RightOpKont,
} from './interpretations/binary';
import {
  ArgsKont,
  FnKont,
  funClosureCreation,
  FunKontKind,
  reduceFunArg,
  reduceFunCall,
  reduceFunCallee,
} from './interpretations/funs';
import { reduceVariable } from './interpretations/variables';
import {
  forallClosureCreation,
  ForallKont,
  ForallSubstKont,
  ForallKontKind,
  reduceForallBody,
  reduceForallCallee,
  reduceForallSubstitutedBody,
} from './interpretations/foralls';
import {
  AscrKont,
  AscrKontKind,
  reconstructValueAscription,
  reduceAscrInnerExpression,
  reduceDoubleAscription,
} from './interpretations/ascriptions';
import {
  BlockKont,
  BlockKontKind,
  reduceFirstBlockStatement,
  reduceNextBlockStatement,
} from './interpretations/blocks';
import {
  PrintKont,
  PrintKontKind,
  printValueAndContinue,
  reducePrintInnerExpression,
} from './interpretations/prints';
import {
  DeclKontKind,
  extendStoreAndContinue,
  reduceVarDeclInnerExpression,
  VarDeclKont,
} from './interpretations/declarations';
import {
  PairFirstKont,
  PairFirstProjKont,
  PairKontKind,
  PairSecondKont,
  PairSecondProjKont,
  producePairValue,
  projectFirstPairComponent,
  projectSecondPairComponent,
  reduceFirstPairComponent,
  reducePairAndFirstProj,
  reducePairAndSecondProj,
  reduceSecondPairComponent,
} from './interpretations/pairs';
import {
  FoldKont,
  RecursiveKontKind,
  reduceFold,
  reduceFoldedExpression,
  reduceUnfold,
  reduceUnfoldedExpression,
  UnfoldKont,
} from './interpretations/recursive';
import {
  projectTuple,
  reduceNextTupleComponent,
  reduceProjectionTuple,
  reduceTuple,
  TupleKontKind,
  TupleNextComponentsKont,
  TupleProjKont,
} from './interpretations/tuples';
import {
  IfBranchesKont,
  IfKontKind,
  reduceIfBranch,
  reduceIfCondition,
} from './interpretations/ifs';
import {
  produceInjValue,
  InjKont,
  InjKontKind,
  reduceInjection,
  CaseBranchesKont,
  reduceCaseBranch,
  reduceCaseSum,
} from './interpretations/sums';
import {
  polyClosureCreation,
  PolyKont,
  PolyKontKind,
  reducePolyBody,
  reducePolyCallee,
} from './interpretations/polys';
import {
  FixPointKont,
  FixPointKontKind,
  reduceFixPoint,
  restoreStoreAndKont,
} from './interpretations/fixpoints';
import {
  ExprKont,
  ExprKontKind,
  reduceExprInnerExpression,
  restoreState,
} from './interpretations/expressions';

enum KontKind {
  EmptyKont = 'EmptyKont',
}

type EmptyKont = {
  kind: KontKind.EmptyKont;
};
const EmptyKont: SingletonKindedFactory<EmptyKont> = singletonFactoryOf(
  KontKind.EmptyKont,
);

export type Kont =
  | EmptyKont
  | RightOpKont
  | LeftOpKont
  | NLRightOpKont
  | NLLeftOpKont
  | ArgsKont
  | FnKont
  | ForallKont
  | ForallSubstKont
  | PolyKont
  | AscrKont
  | BlockKont
  | VarDeclKont
  | PrintKont
  | PairSecondKont
  | PairFirstKont
  | PairFirstProjKont
  | PairSecondProjKont
  | TupleNextComponentsKont
  | TupleProjKont
  | UnfoldKont
  | FoldKont
  | IfBranchesKont
  | InjKont
  | CaseBranchesKont
  | FixPointKont
  | ExprKont;

export type State<T> = T & {
  store: Store;
  kont: Kont;
};
export const State = <T>(t: T, store: Store, kont: Kont): State<T> => ({
  ...t,
  store,
  kont,
});

export const OkState = <T, E extends Error>(
  t: T,
  store: Store,
  kont: Kont,
): Result<State<T>, E> =>
  Result.ok({
    ...t,
    store,
    kont,
  });

export type StepState = State<{ term: Expression | Statement }>;

export type StepReducer<E extends Expression | Statement, K extends Kont> = (
  term: E,
  store: Store,
  kont: K,
) => Result<StepState, InterpreterError>;

const inject = (term: Expression | Statement): StepState => {
  return State({ term }, Store(), EmptyKont());
};

const step = ({
  term,
  store,
  kont,
}: StepState): Result<StepState, InterpreterError> => {
  if (
    isSimpleValue(term as Expression) &&
    kont.kind === AscrKontKind.AscrKont
  ) {
    return reconstructValueAscription(term as SimpleValue, store, kont);
  }

  if (term.kind === ExprKind.Ascription && isValue(term)) {
    switch (kont.kind) {
      case BinaryKontKind.RightOpKont: {
        return reduceRightOperand(term, store, kont);
      }

      case BinaryKontKind.NLRightOpKont: {
        return reduceNLRightOperand(term, store, kont);
      }

      case BinaryKontKind.LeftOpKont: {
        return reduceBinaryOperation(term, store, kont);
      }

      case BinaryKontKind.NLLeftOpKont: {
        return reduceNLBinaryOperation(term, store, kont);
      }

      case FunKontKind.ArgsKont: {
        return reduceFunArg(term, store, kont);
      }

      case FunKontKind.FnKont: {
        return reduceFunCall(term, store, kont);
      }

      case ForallKontKind.ForallKont: {
        return reduceForallBody(term, store, kont);
      }

      case ForallKontKind.ForallSubstKont: {
        return reduceForallSubstitutedBody(term, store, kont);
      }

      case PolyKontKind.PolyKont: {
        return reducePolyBody(term, store, kont);
      }

      case AscrKontKind.AscrKont: {
        return reduceDoubleAscription(term, store, kont);
      }

      case BlockKontKind.BlockKont: {
        return reduceNextBlockStatement(term, store, kont);
      }

      case PrintKontKind.PrintKont: {
        return printValueAndContinue(term, store, kont);
      }

      case ExprKontKind.ExprKont: {
        return restoreState(term, store, kont);
      }

      case PairKontKind.PairSecondKont: {
        return reduceSecondPairComponent(term, store, kont);
      }

      case PairKontKind.PairFirstKont: {
        return producePairValue(term, store, kont);
      }

      case PairKontKind.PairFirstProjKont: {
        return projectFirstPairComponent(term, store, kont);
      }

      case PairKontKind.PairSecondProjKont: {
        return projectSecondPairComponent(term, store, kont);
      }

      case TupleKontKind.TupleNextComponentsKont: {
        return reduceNextTupleComponent(term, store, kont);
      }

      case TupleKontKind.TupleProjKont: {
        return projectTuple(term, store, kont);
      }

      case DeclKontKind.VarDeclKont: {
        return extendStoreAndContinue(term, store, kont);
      }

      case RecursiveKontKind.FoldKont: {
        return reduceFold(term, store, kont);
      }

      case RecursiveKontKind.UnfoldKont: {
        return reduceUnfold(term, store, kont);
      }

      case IfKontKind.IfBranchesKont: {
        return reduceIfBranch(term, store, kont);
      }

      case InjKontKind.InjKont: {
        return produceInjValue(term, store, kont);
      }

      case InjKontKind.CaseBranchesKont: {
        return reduceCaseBranch(term, store, kont);
      }

      case FixPointKontKind.FixPointKont: {
        return restoreStoreAndKont(term, store, kont);
      }
    }
  }

  switch (term.kind) {
    case ExprKind.Binary: {
      return reduceLeftOperand(term, store, kont);
    }

    case ExprKind.NonLinearBinary: {
      return reduceNLLeftOperand(term, store, kont);
    }

    case ExprKind.Variable: {
      return reduceVariable(term, store, kont);
    }

    case ExprKind.Call: {
      return reduceFunCallee(term, store, kont);
    }

    case ExprKind.SCall: {
      return reduceForallCallee(term, store, kont);
    }

    case ExprKind.TCall: {
      return reducePolyCallee(term, store, kont);
    }

    case ExprKind.Pair: {
      return reduceFirstPairComponent(term, store, kont);
    }

    case ExprKind.ProjFst: {
      return reducePairAndFirstProj(term, store, kont);
    }

    case ExprKind.ProjSnd: {
      return reducePairAndSecondProj(term, store, kont);
    }

    case ExprKind.Tuple: {
      return reduceTuple(term, store, kont);
    }

    case ExprKind.Projection: {
      return reduceProjectionTuple(term, store, kont);
    }

    case ExprKind.Inj: {
      return reduceInjection(term, store, kont);
    }

    case ExprKind.Case: {
      return reduceCaseSum(term, store, kont);
    }

    case ExprKind.Block: {
      return reduceFirstBlockStatement(term, store, kont);
    }

    case StmtKind.ExprStmt: {
      return reduceExprInnerExpression(term, store, kont);
    }

    case StmtKind.PrintStmt: {
      return reducePrintInnerExpression(term, store, kont);
    }

    case ExprKind.Fold: {
      return reduceFoldedExpression(term, store, kont);
    }

    case ExprKind.Unfold: {
      return reduceUnfoldedExpression(term, store, kont);
    }

    case ExprKind.If: {
      return reduceIfCondition(term, store, kont);
    }

    case StmtKind.VarStmt: {
      return reduceVarDeclInnerExpression(term, store, kont);
    }

    case ExprKind.FixPoint: {
      return reduceFixPoint(term, store, kont);
    }

    case ExprKind.Ascription: {
      if (ascrExpressionIsKinded(term, ExprKind.Fun)) {
        return funClosureCreation(term, store, kont);
      }

      if (ascrExpressionIsKinded(term, ExprKind.Forall)) {
        return forallClosureCreation(term, store, kont);
      }

      if (ascrExpressionIsKinded(term, ExprKind.Poly)) {
        return polyClosureCreation(term, store, kont);
      }

      return reduceAscrInnerExpression(term, store, kont);
    }

    default:
      return Result.err(
        new InterpreterUnsupportedExpression({
          reason: `We're sorry. GSoul does not support this kinds of expressions yet (${term.kind})`,
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

    if (!result.isOk) {
      return Result.err(result.error);
    }

    state = result.value;
  }

  return Result.ok(state.term as Value); // TODO: Improve this
};
