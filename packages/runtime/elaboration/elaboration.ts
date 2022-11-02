import * as past from '@gsoul-lang/parsing/lib/ast';
import {
  Sens,
  Senv,
  SenvUtils,
  Type,
  TypeEnv,
  TypeEnvUtils,
  TypeEff,
  TypeEffUtils,
} from '@gsoul-lang/core/utils';
import {
  AProduct,
  Arrow,
  Bool,
  ForallT,
  Nil,
  Product,
  Real,
  RecType,
  typeIsKinded,
  TypeKind,
} from '@gsoul-lang/core/utils/Type';

import {
  Ascription,
  Binary,
  Block,
  BoolLiteral,
  Call,
  Expression,
  ExprStmt,
  Fold,
  Forall,
  Fun,
  NilLiteral,
  NonLinearBinary,
  Pair,
  Print,
  Projection,
  ProjFst,
  ProjSnd,
  RealLiteral,
  SCall,
  Statement,
  Tuple,
  Unfold,
  Variable,
  VarStmt,
} from './ast';
import { initialEvidence, interior } from '../utils/Evidence';
import { Result } from '@badrap/result';
import {
  ElaborationDependencyError,
  ElaborationError,
  ElaborationReferenceError,
  ElaborationSubtypingError,
  ElaborationTypeError,
  ElaborationUnsupportedExpressionError,
} from './errors';
import { prop } from 'ramda';
import { Token, TokenType } from '@gsoul-lang/parsing/lib/lexing';
import { isKinded } from '@gsoul-lang/core/utils/ADT';

export type Stateful<T> = {
  term: T;
  tenv: TypeEnv;
};
export const Stateful = <T>(term: T, tenv: TypeEnv): Stateful<T> => ({
  term,
  tenv,
});

const realLit = (lit: past.Literal): Ascription => {
  const r = RealLiteral({
    value: lit.value as number,
  });

  const evidence = initialEvidence(r.typeEff);

  return Ascription({
    expression: r,
    evidence,
    typeEff: r.typeEff,
  });
};

const boolLit = (lit: past.Literal): Ascription => {
  const b = BoolLiteral({
    value: lit.value as boolean,
  });

  const evidence = initialEvidence(b.typeEff);

  return Ascription({
    expression: b,
    evidence,
    typeEff: b.typeEff,
  });
};

const unitLit = (): Ascription => {
  const nil = NilLiteral();
  const evidence = initialEvidence(nil.typeEff);

  return Ascription({
    expression: nil,
    evidence,
    typeEff: nil.typeEff,
  });
};

const variable = (
  variable: past.Variable,
  tenv: TypeEnv,
): Result<Variable, ElaborationReferenceError> => {
  const typeFromTenv = tenv[variable.name.lexeme];

  if (!typeFromTenv) {
    return Result.err(
      new ElaborationReferenceError({
        reason: `Variable ${variable.name.lexeme} is not in scope`,
        variable: variable.name,
      }),
    );
  }

  return Result.ok(
    Variable({
      name: variable.name,
      typeEff: typeFromTenv,
    }),
  );
};

const binary = (
  expr: past.Binary,
  tenv: TypeEnv,
): Result<Binary, ElaborationError> => {
  const leftElaboration = expression(expr.left, tenv);

  const rightElaboration = expression(expr.right, tenv);

  return Result.all([leftElaboration, rightElaboration]).chain(
    ([left, right]) => {
      if (left.typeEff.type.kind !== right.typeEff.type.kind) {
        return Result.err(
          new ElaborationTypeError({
            reason: 'Operands types do not match',
            operator: expr.operator,
          }),
        );
      }

      return Result.ok(
        Binary({
          operator: expr.operator,
          left,
          right,
          typeEff: TypeEff(
            left.typeEff.type,
            SenvUtils.add(left.typeEff.effect, right.typeEff.effect),
          ),
        }),
      );
    },
  );
};

const nonLinearOperatorsBool = [
  TokenType.GREATER,
  TokenType.GREATER_EQUAL,
  TokenType.LESS,
  TokenType.LESS_EQUAL,
  TokenType.EQUAL_EQUAL,
];
const nonLinearBinary = (
  expr: past.NonLinearBinary,
  tenv: TypeEnv,
): Result<NonLinearBinary, ElaborationError> => {
  const leftElaboration = expression(expr.left, tenv);

  const rightElaboration = expression(expr.right, tenv);

  return Result.all([leftElaboration, rightElaboration]).chain(
    ([left, right]) => {
      if (left.typeEff.type.kind !== right.typeEff.type.kind) {
        return Result.err(
          new ElaborationTypeError({
            reason: 'Operands types do not match',
            operator: expr.operator,
          }),
        );
      }

      const type = nonLinearOperatorsBool.includes(expr.operator.type)
        ? Bool()
        : Real();

      return Result.ok(
        NonLinearBinary({
          operator: expr.operator,
          left,
          right,
          typeEff: TypeEff(
            type,
            SenvUtils.scaleInf(
              SenvUtils.add(left.typeEff.effect, right.typeEff.effect),
            ),
          ),
        }),
      );
    },
  );
};

const fun = (
  expr: past.Fun,
  tenv: TypeEnv,
): Result<Ascription, ElaborationError> => {
  const varName = expr.binder.name.lexeme;

  const bodyElaboration = expression(
    expr.body,
    TypeEnvUtils.extend(tenv, varName, expr.binder.type),
  );

  return bodyElaboration.map((body) => {
    const lambda = Fun({
      binder: expr.binder,
      body,
      typeEff: TypeEff(
        Arrow({
          domain: expr.binder.type,
          codomain: body.typeEff,
        }),
        Senv(),
      ),
    });

    const evidence = initialEvidence(lambda.typeEff);

    return Ascription({
      expression: lambda,
      evidence,
      typeEff: lambda.typeEff,
    });
  });
};

const forall = (
  expr: past.Forall,
  tenv: TypeEnv,
): Result<Ascription, ElaborationError> => {
  const bodyElaboration = expression(expr.expr, tenv);

  return bodyElaboration.map((body) => {
    const lambda = Forall({
      sensVars: expr.sensVars,
      expr: body,
      typeEff: TypeEff(
        ForallT({
          sensVars: expr.sensVars.map((v) => v.lexeme),
          codomain: body.typeEff,
        }),
        Senv(),
      ),
    });

    const evidence = initialEvidence(lambda.typeEff);

    return Ascription({
      expression: lambda,
      evidence,
      typeEff: lambda.typeEff,
    });
  });
};

const checkApplicationCalleeType =
  (operator: Token) =>
  (callee: Expression): Result<Expression, ElaborationError> => {
    const calleeTypeEff = callee.typeEff;

    if (!typeIsKinded(calleeTypeEff, TypeKind.Arrow)) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'Expression called is not a function',
          operator,
        }),
      );
    }

    return Result.ok(callee);
  };

const app = (
  expr: past.Call,
  tenv: TypeEnv,
): Result<Call, ElaborationError> => {
  const calleeElaboration = expression(expr.callee, tenv).chain(
    checkApplicationCalleeType(expr.paren),
  );

  const argElaboration = expression(expr.arg, tenv);

  const evidenceResult = Result.all([calleeElaboration, argElaboration]).chain(
    ([callee, arg]) => {
      const calleeArgType = TypeEffUtils.ArrowsUtils.domain(
        callee.typeEff as TypeEff<Arrow, Senv>,
      );

      const inter = interior(arg.typeEff, calleeArgType);

      if (!inter.isOk) {
        return Result.err(
          new ElaborationSubtypingError({
            reason:
              'Argument type is not subtype of the expected type in the function',
            operator: expr.paren,
            superType: calleeArgType,
            type: arg.typeEff,
          }),
        );
      }

      return Result.ok(inter.value);
    },
  );

  return Result.all([calleeElaboration, argElaboration, evidenceResult]).map(
    ([callee, arg, evidence]) =>
      Call({
        callee,
        arg: Ascription({
          evidence,
          typeEff: TypeEffUtils.ArrowsUtils.domain(
            callee.typeEff as TypeEff<Arrow, Senv>,
          ),
          expression: arg,
        }),
        paren: expr.paren,
        typeEff: TypeEffUtils.ArrowsUtils.codomain(
          callee.typeEff as TypeEff<Arrow, Senv>,
        ),
      }),
  );
};

const checkSensitiveApplicationCalleeType =
  (operator: Token) =>
  (callee: Expression): Result<Expression, ElaborationError> => {
    if (!typeIsKinded(callee.typeEff, TypeKind.ForallT)) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'Expression called is not a sensitivity quantification',
          operator,
        }),
      );
    }

    return Result.ok(callee);
  };

const sapp = (
  expr: past.SCall,
  tenv: TypeEnv,
): Result<SCall, ElaborationError> => {
  const calleeElaboration = expression(expr.callee, tenv).chain(
    checkSensitiveApplicationCalleeType(expr.bracket),
  );

  return calleeElaboration.map((callee) => {
    return SCall({
      callee,
      arg: expr.arg,
      bracket: expr.bracket,
      typeEff: TypeEffUtils.ForallsUtils.instance(
        callee.typeEff as TypeEff<ForallT, Senv>,
        expr.arg,
      ),
    });
  });
};

const ascription = (
  expr: past.Ascription,
  tenv: TypeEnv,
): Result<Ascription, ElaborationError> => {
  const innerElaboration = expression(expr.expression, tenv);

  return innerElaboration.chain((inner) => {
    const evidence = interior(inner.typeEff, expr.typeEff);

    if (!evidence.isOk) {
      return Result.err(
        new ElaborationSubtypingError({
          reason:
            'Expression type-and-effect is not a subtype of the ascription type-and-effect',
          operator: expr.ascriptionToken,
          superType: expr.typeEff,
          type: inner.typeEff,
        }),
      );
    }

    return Result.ok(
      Ascription({
        expression: inner,
        evidence: evidence.value,
        typeEff: expr.typeEff,
      }),
    );
  });
};

const printExpr = (
  expr: past.Print,
  tenv: TypeEnv,
): Result<Print, ElaborationError> => {
  const exprElaboration = expression(expr.expression, tenv);

  return exprElaboration.map((inner) =>
    Print({
      expression: inner,
      typeEff: inner.typeEff,
      showEvidence: expr.showEvidence,
    }),
  );
};

const block = (
  expr: past.Block,
  tenv: TypeEnv,
): Result<Block, ElaborationError> => {
  let result = TypeEff<Type, Senv>(Nil(), Senv());
  let currentTenv = tenv;
  const statements: Statement[] = [];

  for (const decl of expr.statements) {
    const stmtElaboration = statement(decl, currentTenv);

    if (!stmtElaboration.isOk) {
      return Result.err(stmtElaboration.error);
    }

    const { value: stmt } = stmtElaboration;

    result = stmt.term.typeEff;
    currentTenv = stmt.tenv;

    statements.push(stmt.term);
  }

  return Result.ok(
    Block({
      statements,
      typeEff: result,
    }),
  );
};

const tuple = (
  expr: past.Tuple,
  tenv: TypeEnv,
): Result<Ascription, ElaborationError> => {
  const elaborations: Expression[] = [];

  for (const e of expr.expressions) {
    const eTC = expression(e, tenv);

    if (!eTC.isOk) {
      return Result.err(eTC.error);
    }

    elaborations.push(eTC.value);
  }

  const typeEff = TypeEff(
    Product({
      typeEffects: elaborations.map(prop('typeEff')),
    }),
    Senv(),
  );

  const evidence = initialEvidence(typeEff);

  return Result.ok(
    Ascription({
      evidence,
      expression: Tuple({
        expressions: elaborations,
        typeEff,
      }),
      typeEff,
    }),
  );
};

const checkExpressionProjectedIsTuple =
  (operator: Token) =>
  (tuple: Expression): Result<Expression, ElaborationError> => {
    if (!typeIsKinded(tuple.typeEff, TypeKind.Product)) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'The expression being projected must be a tuple',
          operator,
        }),
      );
    }

    return Result.ok(tuple);
  };

const checkProjectionOutOfBounds =
  (index: number, operator: Token) =>
  (tuple: Expression): Result<Expression, ElaborationError> => {
    if (index >= (tuple.typeEff.type as Product).typeEffects.length) {
      return Result.err(
        new ElaborationTypeError({
          reason: `Tuple has no ${index} element`,
          operator: operator,
        }),
      );
    }

    return Result.ok(tuple);
  };

const projection = (
  expr: past.Projection,
  tenv: TypeEnv,
): Result<Projection, ElaborationError> => {
  const tupleElaboration = expression(expr.tuple, tenv)
    .chain(checkExpressionProjectedIsTuple(expr.projectToken))
    .chain(checkProjectionOutOfBounds(expr.index, expr.projectToken));

  return tupleElaboration.map((tuple) =>
    Projection({
      tuple,
      index: expr.index,
      projectToken: expr.projectToken,
      typeEff: TypeEffUtils.ProductUtils.projection(
        expr.index,
        tuple.typeEff as TypeEff<Product, Senv>,
      ),
    }),
  );
};

const pair = (
  expr: past.Pair,
  tenv: TypeEnv,
): Result<Ascription, ElaborationError> => {
  const firstElaboration = expression(expr.first, tenv);

  const secondElaboration = expression(expr.second, tenv);

  return Result.all([firstElaboration, secondElaboration]).map(
    ([first, second]) => {
      const typeEff = TypeEff(
        AProduct({
          first: first.typeEff,
          second: second.typeEff,
        }),
        Senv(),
      );

      const evidence = initialEvidence(typeEff);

      return Ascription({
        evidence,
        expression: Pair({
          first,
          second,
          typeEff,
        }),
        typeEff,
      });
    },
  );
};

const projFst = (
  expr: past.ProjFst,
  tenv: TypeEnv,
): Result<ProjFst, ElaborationError> => {
  const pairElaboration = expression(expr.pair, tenv).chain((pair) => {
    if (!typeIsKinded(pair.typeEff, TypeKind.AProduct)) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'The expression being projected must be a pair',
          operator: expr.projToken,
        }),
      );
    }

    return Result.ok(pair);
  });

  return pairElaboration.map((pair) =>
    ProjFst({
      pair,
      projToken: expr.projToken,
      typeEff: TypeEffUtils.AdditiveProductsUtils.firstProjection(
        pair.typeEff as TypeEff<AProduct, Senv>,
      ),
    }),
  );
};

const projSnd = (
  expr: past.ProjSnd,
  tenv: TypeEnv,
): Result<ProjSnd, ElaborationError> => {
  const pairElaboration = expression(expr.pair, tenv).chain((pair) => {
    if (!typeIsKinded(pair.typeEff, TypeKind.AProduct)) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'The expression being projected must be a pair',
          operator: expr.projToken,
        }),
      );
    }

    return Result.ok(pair);
  });

  return pairElaboration.map((pair) =>
    ProjSnd({
      pair,
      projToken: expr.projToken,
      typeEff: TypeEffUtils.AdditiveProductsUtils.firstProjection(
        pair.typeEff as TypeEff<AProduct, Senv>,
      ),
    }),
  );
};

export const fold = (
  expr: past.Fold,
  tenv: TypeEnv,
): Result<Ascription, ElaborationError> => {
  const bodyElaboration = expression(expr.expression, tenv);

  // TODO: Check that expr.recType is well-formed

  const bodyTypeEff = TypeEffUtils.RecursiveUtils.unfold(
    TypeEff(expr.recType, Senv()),
  );

  const bodyEvidenceResult = bodyElaboration.chain((body) => {
    const bodyEvidence = interior(body.typeEff, bodyTypeEff);

    if (!bodyEvidence.isOk) {
      return Result.err(
        new ElaborationSubtypingError({
          reason:
            'Body type-and-effect is not a subtype of the unfolded expression',
          operator: expr.foldToken,
          superType: bodyTypeEff,
          type: body.typeEff,
        }),
      );
    }

    return Result.ok(bodyEvidence.value);
  });

  const typeEff = TypeEff(expr.recType, Senv());
  const evidence = initialEvidence(typeEff);

  return Result.all([bodyElaboration, bodyEvidenceResult]).map(
    ([body, bodyEvidence]) =>
      Ascription({
        expression: Fold({
          foldToken: expr.foldToken,
          expression: Ascription({
            evidence: bodyEvidence,
            expression: body,
            typeEff: bodyTypeEff,
          }),
          recType: expr.recType,
          typeEff,
        }),
        evidence,
        typeEff,
      }),
  );
};

const checkBodyIsUnfoldable =
  (operator: Token) =>
  (body: Expression): Result<Expression, ElaborationError> => {
    if (!isKinded(body.typeEff.type, TypeKind.RecType)) {
      return Result.err(
        new ElaborationTypeError({
          reason: 'Cannot unfold an expression without a recursive type',
          operator,
        }),
      );
    }

    return Result.ok(body);
  };

export const unfold = (
  expr: past.Unfold,
  tenv: TypeEnv,
): Result<Unfold, ElaborationError> => {
  const bodyElaboration = expression(expr.expression, tenv).chain(
    checkBodyIsUnfoldable(expr.unfoldToken),
  );

  return bodyElaboration.map((body) =>
    Unfold({
      expression: body,
      typeEff: TypeEffUtils.RecursiveUtils.unfold(
        body.typeEff as TypeEff<RecType, Senv>,
      ),
      unfoldToken: expr.unfoldToken,
    }),
  );
};

export const expression = (
  expr: past.Expression,
  tenv: TypeEnv = {},
): Result<Expression, ElaborationError> => {
  switch (expr.kind) {
    case past.ExprKind.Binary:
      return binary(expr, tenv);
    case past.ExprKind.Call:
      return app(expr, tenv);
    case past.ExprKind.SCall:
      return sapp(expr, tenv);
    case past.ExprKind.NonLinearBinary:
      return nonLinearBinary(expr, tenv);
    case past.ExprKind.Variable:
      return variable(expr, tenv);
    case past.ExprKind.Fun:
      return fun(expr, tenv);
    case past.ExprKind.Forall:
      return forall(expr, tenv);
    case past.ExprKind.Literal: {
      if (typeof expr.value === 'number') {
        return Result.ok(realLit(expr));
      } else if (typeof expr.value === 'boolean') {
        return Result.ok(boolLit(expr));
      } else if (expr.value === null) {
        return Result.ok(unitLit());
      }
      return Result.err(
        new ElaborationUnsupportedExpressionError({
          reason: 'Literal type not handled',
        }),
      );
    }
    case past.ExprKind.Ascription:
      return ascription(expr, tenv);
    case past.ExprKind.Grouping:
      return expression(expr.expression, tenv);
    case past.ExprKind.Print:
      return printExpr(expr, tenv);
    case past.ExprKind.Block:
      return block(expr, tenv);
    case past.ExprKind.Tuple:
      return tuple(expr, tenv);
    case past.ExprKind.Projection:
      return projection(expr, tenv);
    case past.ExprKind.Pair:
      return pair(expr, tenv);
    case past.ExprKind.ProjFst:
      return projFst(expr, tenv);
    case past.ExprKind.ProjSnd:
      return projSnd(expr, tenv);
    case past.ExprKind.Fold:
      return fold(expr, tenv);
    case past.ExprKind.Unfold:
      return unfold(expr, tenv);
  }
};

const exprStmt = (
  stmt: past.ExprStmt,
  tenv: TypeEnv,
): Result<Stateful<ExprStmt>, ElaborationError> => {
  const exprElaboration = expression(stmt.expression, tenv);

  if (!exprElaboration.isOk) {
    return Result.err(exprElaboration.error);
  }

  const { value: expr } = exprElaboration;

  return Result.ok(
    Stateful(
      ExprStmt({
        expression: expr,
        typeEff: expr.typeEff,
      }),
      tenv,
    ),
  );
};

const varStmt = (
  stmt: past.VarStmt,
  tenv: TypeEnv,
): Result<Stateful<VarStmt>, ElaborationError> => {
  const exprElaboration = expression(stmt.assignment, tenv);

  if (!exprElaboration.isOk) {
    return Result.err(exprElaboration.error);
  }

  let expr = exprElaboration.value;

  if (stmt.resource) {
    if (!SenvUtils.isEmpty(expr.typeEff.effect)) {
      return Result.err(
        new ElaborationDependencyError({
          reason: 'Resources cannot depend on other resources',
          variable: stmt.name,
        }),
      );
    }

    const typeEff = TypeEff(
      expr.typeEff.type,
      Senv({ [stmt.name.lexeme]: Sens(1) }),
    );

    expr = Ascription({
      expression: expr,
      typeEff: typeEff,
      evidence: [expr.typeEff, typeEff],
    });
  }

  return Result.ok(
    Stateful(
      VarStmt({
        name: stmt.name,
        assignment: expr,
        typeEff: expr.typeEff,
      }),
      TypeEnvUtils.extend(tenv, stmt.name.lexeme, expr.typeEff),
    ),
  );
};

export const statement = (
  stmt: past.Statement,
  tenv: TypeEnv = {},
): Result<Stateful<Statement>, ElaborationError> => {
  switch (stmt.kind) {
    case past.StmtKind.ExprStmt:
      return exprStmt(stmt, tenv);
    case past.StmtKind.VarStmt:
      return varStmt(stmt, tenv);
  }
};

/**
 * @throws {ElaborationError}
 */
export const elaborate = (
  stmts: past.Statement[],
): Result<Expression, ElaborationError> => {
  const block = past.Block({
    statements: stmts,
  });

  const result = expression(block, TypeEnv());

  if (!result.isOk) {
    return result;
  }

  return Result.ok(result.value);
};
