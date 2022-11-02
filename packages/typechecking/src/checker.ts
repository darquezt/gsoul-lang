import {
  Ascription,
  Binary,
  Block,
  Call,
  Expression,
  ExprKind,
  ExprStmt,
  Fold,
  Forall,
  Fun,
  Literal,
  NonLinearBinary,
  Pair,
  Print,
  Projection,
  ProjFst,
  ProjSnd,
  SCall,
  Statement,
  StmtKind,
  Tuple,
  Unfold,
  Variable,
  VarStmt,
} from '@gsens-lang/parsing/lib/ast';
import {
  Sens,
  Senv,
  SenvUtils,
  TypeEnv,
  TypeEnvUtils,
  TypeEff,
  TypeEffUtils,
} from '@gsens-lang/core/utils';
import {
  AProduct,
  Arrow,
  Bool,
  ForallT,
  Nil,
  Product,
  Real,
  typeIsKinded,
  TypeKind,
} from '@gsens-lang/core/utils/Type';
import { isKinded } from '@gsens-lang/core/utils/ADT';

import { isSubTypeEff } from './subtyping';
import { Token } from '@gsens-lang/parsing/lib/lexing';
import { TypeAssoc, TypeAssocs, TypingSeeker } from './utils/typingSeeker';
import { TypeEffect } from '@gsens-lang/core/utils/TypeEff';

export type PureSuccess = {
  success: true;
  typeEff: TypeEff;
  typings: TypeAssocs;
};
export const PureSuccess = (
  te: TypeEff,
  typings: TypeAssocs = [],
): PureSuccess => ({
  success: true,
  typeEff: te,
  typings,
});

export type StatefulSuccess = {
  success: true;
  typeEff: TypeEff;
  tenv: TypeEnv;
  typings: TypeAssocs;
};
export const StatefulSuccess = (
  te: TypeEff,
  tenv: TypeEnv,
  typings: TypeAssocs = [],
): StatefulSuccess => ({
  success: true,
  typeEff: te,
  tenv,
  typings,
});

export type TypeCheckingSuccess = {
  success: true;
  typeEff: TypeEff;
  typings: TypingSeeker;
};
export const TypeCheckingSuccess = (
  te: TypeEff,
  typings: TypingSeeker,
): TypeCheckingSuccess => ({
  success: true,
  typeEff: te,
  typings,
});

export type Failure = { token: Token; success: false; reason?: string };
export const Failure = (token: Token, reason?: string): Failure => ({
  success: false,
  reason,
  token,
});

export type TypeCheckingResult = TypeCheckingSuccess | Failure;
export type PureResult = PureSuccess | Failure;
export type StatefulResult = StatefulSuccess | Failure;

const realLit = (expr: Literal): PureResult => ({
  success: true,
  typeEff: TypeEff(Real(), Senv()),
  typings: [[expr.token, TypeEff(Real(), Senv())]],
});

const boolLit = (expr: Literal): PureResult => ({
  success: true,
  typeEff: TypeEff(Bool(), Senv()),
  typings: [[expr.token, TypeEff(Bool(), Senv())]],
});

const nilLit = (expr: Literal): PureResult => ({
  success: true,
  typeEff: TypeEff(Nil(), Senv()),
  typings: [[expr.token, TypeEff(Nil(), Senv())]],
});

const variable = (variable: Variable, tenv: TypeEnv): PureResult => {
  const typeFromTenv = tenv[variable.name.lexeme];

  if (!typeFromTenv) {
    return Failure(
      variable.name,
      `Variable ${variable.name.lexeme} is not in scope`,
    );
  }

  return PureSuccess(typeFromTenv, [[variable.name, typeFromTenv]]);
};

const binary = (expr: Binary, tenv: TypeEnv): PureResult => {
  const lTC = expression(expr.left, tenv);

  if (!lTC.success) {
    return lTC;
  } else if (!isKinded(lTC.typeEff.type, TypeKind.Real)) {
    return Failure(
      expr.operator,
      'Expected real expression on the left-hand side of + operation',
    );
  }

  const rTC = expression(expr.right, tenv);

  if (!rTC.success) {
    return rTC;
  } else if (!isKinded(rTC.typeEff.type, TypeKind.Real)) {
    return Failure(
      expr.operator,
      'Expected real expression on the right-hand side of + operation',
    );
  }

  return PureSuccess(
    TypeEff(Real(), SenvUtils.add(lTC.typeEff.effect, rTC.typeEff.effect)),
    lTC.typings.concat(rTC.typings),
  );
};

const nonLinearBinary = (expr: NonLinearBinary, tenv: TypeEnv): PureResult => {
  const lTC = expression(expr.left, tenv);

  if (!lTC.success) {
    return lTC;
  } else if (!isKinded(lTC.typeEff.type, TypeKind.Real)) {
    return Failure(
      expr.operator,
      'Expected real expression on the left-hand side of + operation',
    );
  }

  const rTC = expression(expr.right, tenv);

  if (!rTC.success) {
    return rTC;
  } else if (!isKinded(rTC.typeEff.type, TypeKind.Real)) {
    return Failure(
      expr.operator,
      'Expected real expression on the right-hand side of + operation',
    );
  }

  const addedEffect = SenvUtils.add(lTC.typeEff.effect, rTC.typeEff.effect);

  return PureSuccess(
    TypeEff(Real(), SenvUtils.scaleInf(addedEffect)),
    lTC.typings.concat(rTC.typings),
  );
};

const fun = (expr: Fun, tenv: TypeEnv): PureResult => {
  const { binder, body } = expr;

  const varName = binder.name.lexeme;

  const bodyTC = expression(
    body,
    TypeEnvUtils.extend(tenv, varName, binder.type as TypeEff),
  );

  if (!bodyTC.success) {
    return bodyTC;
  }

  return PureSuccess(
    TypeEff(
      Arrow({
        domain: binder.type,
        codomain: bodyTC.typeEff,
      }),
      Senv(),
    ),
    bodyTC.typings,
  );
};

const forall = (expr: Forall, tenv: TypeEnv): PureResult => {
  const { expr: inner, sensVars } = expr;

  const bodyTC = expression(inner, tenv);

  if (!bodyTC.success) {
    return bodyTC;
  }

  return PureSuccess(
    TypeEff(
      ForallT({
        sensVars: sensVars.map((v) => v.lexeme),
        codomain: bodyTC.typeEff,
      }),
      Senv(),
    ),
    bodyTC.typings,
  );
};

const app = (expr: Call, tenv: TypeEnv): PureResult => {
  const calleeTC = expression(expr.callee, tenv);

  if (!calleeTC.success) {
    return calleeTC;
  }

  const calleeTypeEff = calleeTC.typeEff;

  if (!typeIsKinded(calleeTypeEff, TypeKind.Arrow)) {
    return Failure(expr.paren, 'Expression called is not a function');
  }

  const argTC = expression(expr.arg, tenv);

  if (!argTC.success) {
    return argTC;
  }

  const argType = argTC.typeEff;

  if (!isSubTypeEff(argType, TypeEffUtils.ArrowsUtils.domain(calleeTypeEff))) {
    return Failure(
      expr.paren,
      'Argument type is not subtype of the expected type in the function',
    );
  }

  return PureSuccess(
    TypeEffUtils.ArrowsUtils.codomain(calleeTypeEff),
    calleeTC.typings.concat(argTC.typings),
  );
};

const sapp = (expr: SCall, tenv: TypeEnv): PureResult => {
  const calleeTC = expression(expr.callee, tenv);

  if (!calleeTC.success) {
    return calleeTC;
  }

  const calleeTypeEff = calleeTC.typeEff;

  if (!typeIsKinded(calleeTypeEff, TypeKind.ForallT)) {
    return Failure(
      expr.bracket,
      'Expression called is not a sensitive quantification',
    );
  }

  return PureSuccess(
    TypeEffUtils.ForallsUtils.instance(calleeTypeEff, expr.arg),
    calleeTC.typings,
  );
};

const ascription = (expr: Ascription, tenv: TypeEnv): PureResult => {
  const innerTC = expression(expr.expression, tenv);

  if (!innerTC.success) {
    return innerTC;
  }

  if (!isSubTypeEff(innerTC.typeEff, expr.typeEff)) {
    return Failure(
      expr.ascriptionToken,
      'Expression type-and-effect is not a subtype of the ascription type-and-effect',
    );
  }

  return PureSuccess(expr.typeEff as TypeEff, innerTC.typings);
};

const printExpr = (expr: Print, tenv: TypeEnv): PureResult => {
  const exprTC = expression(expr.expression, tenv);

  if (!exprTC.success) {
    return exprTC;
  }

  return PureSuccess(
    exprTC.typeEff,
    [[expr.token, exprTC.typeEff] as TypeAssoc].concat(exprTC.typings),
  );
};

const block = (expr: Block, tenv: TypeEnv): PureResult => {
  let result = TypeEff(Nil(), Senv()) as TypeEff;
  let currentTenv = tenv;
  const typings: TypeAssocs = [];

  for (const decl of expr.statements) {
    const declTC = statement(decl, currentTenv);

    if (!declTC.success) {
      return declTC;
    }

    typings.push(...declTC.typings);

    result = declTC.typeEff;
    currentTenv = declTC.tenv;
  }

  return PureSuccess(result, typings);
};

const tuple = (expr: Tuple, tenv: TypeEnv): PureResult => {
  const typeEffects: TypeEffect[] = [];
  const typings: TypeAssocs = [];

  for (const e of expr.expressions) {
    const eTC = expression(e, tenv);

    if (!eTC.success) {
      return eTC;
    }

    typeEffects.push(eTC.typeEff);
    typings.concat(eTC.typings);
  }

  return PureSuccess(
    TypeEff(
      Product({
        typeEffects,
      }),
      Senv(),
    ),
    typings,
  );
};

export const projection = (expr: Projection, tenv: TypeEnv): PureResult => {
  const tupleTC = expression(expr.tuple, tenv);

  if (!tupleTC.success) {
    return tupleTC;
  }

  const tupleTypeEff = tupleTC.typeEff;

  if (!typeIsKinded(tupleTypeEff, TypeKind.Product)) {
    return Failure(
      expr.projectToken,
      'Expression being projected must be a tuple',
    );
  }

  if (expr.index >= tupleTypeEff.type.typeEffects.length) {
    return Failure(expr.projectToken, `Tuple has no ${expr.index} element`);
  }

  return PureSuccess(
    TypeEffUtils.ProductUtils.projection(expr.index, tupleTypeEff),
    tupleTC.typings,
  );
};

// const untup = (expr: Untup, tenv: TypeEnv): PureResult => {
//   const tuplTC = expression(expr.tuple, tenv);

//   if (!tuplTC.success) {
//     return tuplTC;
//   }

//   const [x1, x2] = expr.identifiers;

//   const bodyTC = expression(
//     expr.body,
//     TypeEnvUtils.extend(
//       TypeEnvUtils.extend(
//         tenv,
//         x1.lexeme,
//         TypeEff(tuplTC.typeEff.type, Senv({ [x1.lexeme]: Sens(1) })),
//       ),
//       x2.lexeme,
//       TypeEff(tuplTC.typeEff.type, Senv({ [x2.lexeme]: Sens(1) })),
//     ),
//   );

//   if (!bodyTC.success) {
//     return bodyTC;
//   }

//   const tuplType = tuplTC.typeEff.type;

//   if (!isKinded(tuplType, TypeKind.MProduct)) {
//     return Failure(
//       expr.untupToken,
//       'The expression being destructured is not a tuple',
//     );
//   }

//   const tuplSenv = tuplTC.typeEff.effect;

//   const firstEffect = (tuplType.first as TypeEff).effect;
//   const secondEffect = (tuplType.second as TypeEff).effect;

//   return PureSuccess(
//     TypeEff(
//       TypeUtils.subst(
//         TypeUtils.subst(
//           bodyTC.typeEff.type,
//           x1.lexeme,
//           SenvUtils.add(tuplSenv, firstEffect),
//         ),
//         x2.lexeme,
//         SenvUtils.add(tuplSenv, secondEffect),
//       ),
//       SenvUtils.substTup(
//         bodyTC.typeEff.effect,
//         [x1.lexeme, x2.lexeme],
//         [firstEffect, secondEffect],
//         tuplSenv,
//       ),
//     ),
//     tuplTC.typings.concat(bodyTC.typings),
//   );
// };

const pair = (expr: Pair, tenv: TypeEnv): PureResult => {
  const fstTC = expression(expr.first, tenv);

  if (!fstTC.success) {
    return fstTC;
  }

  const sndTC = expression(expr.second, tenv);

  if (!sndTC.success) {
    return sndTC;
  }

  return PureSuccess(
    TypeEff(
      AProduct({
        first: fstTC.typeEff,
        second: sndTC.typeEff,
      }),
      Senv(),
    ),
    fstTC.typings.concat(sndTC.typings),
  );
};

export const projFst = (expr: ProjFst, tenv: TypeEnv): PureResult => {
  const pairTC = expression(expr.pair, tenv);

  if (!pairTC.success) {
    return pairTC;
  }

  const pairTypeEff = pairTC.typeEff;

  if (!typeIsKinded(pairTypeEff, TypeKind.AProduct)) {
    return Failure(expr.projToken, 'Expression being projected must be a pair');
  }

  return PureSuccess(
    TypeEffUtils.AdditiveProductsUtils.firstProjection(pairTypeEff),
    pairTC.typings,
  );
};

export const projSnd = (expr: ProjSnd, tenv: TypeEnv): PureResult => {
  const pairTC = expression(expr.pair, tenv);

  if (!pairTC.success) {
    return pairTC;
  }

  const pairTypeEff = pairTC.typeEff;

  if (!typeIsKinded(pairTypeEff, TypeKind.AProduct)) {
    return Failure(expr.projToken, 'Expression being projected must be a pair');
  }

  return PureSuccess(
    TypeEffUtils.AdditiveProductsUtils.secondProjection(pairTypeEff),
    pairTC.typings,
  );
};

export const fold = (expr: Fold, tenv: TypeEnv): PureResult => {
  const bodyTC = expression(expr.expression, tenv);

  if (!bodyTC.success) {
    return bodyTC;
  }

  const typeEff = TypeEff(expr.recType, Senv());

  const unfolded = TypeEffUtils.RecursiveUtils.unfold(typeEff);

  if (!isSubTypeEff(bodyTC.typeEff, unfolded)) {
    return Failure(
      expr.foldToken,
      'Expression type-and-effect is not a subtype of the unfolded type-and-effect',
    );
  }

  return PureSuccess(typeEff, bodyTC.typings);
};

export const unfold = (expr: Unfold, tenv: TypeEnv): PureResult => {
  const bodyTC = expression(expr.expression, tenv);

  if (!bodyTC.success) {
    return bodyTC;
  }

  const bodyTeff = bodyTC.typeEff;

  if (!typeIsKinded(bodyTeff, TypeKind.RecType)) {
    return Failure(
      expr.unfoldToken,
      'Expression being unfolded must be a fold',
    );
  }

  return PureSuccess(
    TypeEffUtils.RecursiveUtils.unfold(bodyTeff),
    bodyTC.typings,
  );
};

export const expression = (
  expr: Expression,
  tenv: TypeEnv = {},
): PureResult => {
  switch (expr.kind) {
    case ExprKind.Binary:
      return binary(expr, tenv);
    case ExprKind.Call:
      return app(expr, tenv);
    case ExprKind.SCall:
      return sapp(expr, tenv);
    case ExprKind.NonLinearBinary:
      return nonLinearBinary(expr, tenv);
    case ExprKind.Variable:
      return variable(expr, tenv);
    case ExprKind.Fun:
      return fun(expr, tenv);
    case ExprKind.Forall:
      return forall(expr, tenv);
    case ExprKind.Literal: {
      const { value } = expr;
      if (typeof value === 'number') {
        return realLit(expr);
      } else if (typeof value === 'boolean') {
        return boolLit(expr);
      }
      return nilLit(expr);
    }
    case ExprKind.Ascription:
      return ascription(expr, tenv);
    case ExprKind.Grouping:
      return expression(expr.expression, tenv);
    case ExprKind.Print:
      return printExpr(expr, tenv);
    case ExprKind.Block:
      return block(expr, tenv);
    case ExprKind.Tuple:
      return tuple(expr, tenv);
    case ExprKind.Projection:
      return projection(expr, tenv);
    // case ExprKind.Untup:
    //   return untup(expr, tenv);
    case ExprKind.Pair:
      return pair(expr, tenv);
    case ExprKind.ProjFst:
      return projFst(expr, tenv);
    case ExprKind.ProjSnd:
      return projSnd(expr, tenv);
    case ExprKind.Fold:
      return fold(expr, tenv);
    case ExprKind.Unfold:
      return unfold(expr, tenv);
  }
};

const exprStmt = (stmt: ExprStmt, tenv: TypeEnv): StatefulResult => {
  const exprTC = expression(stmt.expression, tenv);

  if (!exprTC.success) {
    return exprTC;
  }

  return StatefulSuccess(exprTC.typeEff, tenv, exprTC.typings);
};

const varStmt = (stmt: VarStmt, tenv: TypeEnv): StatefulResult => {
  const exprTC = expression(stmt.assignment, tenv);

  if (!exprTC.success) {
    return exprTC;
  }

  if (stmt.resource && !SenvUtils.isEmpty(exprTC.typeEff.effect)) {
    return Failure(stmt.name, 'A resource cannot depend on other resources');
  }

  const typeEff = stmt.resource
    ? TypeEff(exprTC.typeEff.type, Senv({ [stmt.name.lexeme]: Sens(1) }))
    : exprTC.typeEff;

  return StatefulSuccess(
    exprTC.typeEff,
    TypeEnvUtils.extend(tenv, stmt.name.lexeme, typeEff),
    [[stmt.name, typeEff] as TypeAssoc].concat(exprTC.typings),
  );
};

export const statement = (
  stmt: Statement,
  tenv: TypeEnv = {},
): StatefulResult => {
  switch (stmt.kind) {
    case StmtKind.ExprStmt:
      return exprStmt(stmt, tenv);
    case StmtKind.VarStmt:
      return varStmt(stmt, tenv);
  }
};

export const typeCheck = (statements: Statement[]): TypeCheckingResult => {
  const tc = expression(Block({ statements }));

  if (!tc.success) {
    return tc;
  }

  const typings = new TypingSeeker(tc.typings);

  return TypeCheckingSuccess(tc.typeEff, typings);
};
