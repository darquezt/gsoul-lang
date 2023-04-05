import { Result } from '@badrap/result';
import { TypeEnvUtils } from '@gsoul-lang/core/utils';
import { ExprStmt, PrintStmt, VarStmt } from '@gsoul-lang/parsing/lib/ast';
import { expression } from '../checker';
import { TypeCheckingError } from '../utils/errors';
import {
  TypeCheckingResult,
  TypeCheckingContext,
  StatefulTypeCheckingRule,
} from '../utils/types';
import { TypeAssoc } from '../utils/typingSeeker';

const toStateful = (
  result: Result<TypeCheckingResult, TypeCheckingError>,
  ctx: TypeCheckingContext,
) =>
  result.chain((tc) =>
    Result.ok({
      typeEff: tc.typeEff,
      typings: tc.typings,
      ctx,
    }),
  );

export const exprStmt: StatefulTypeCheckingRule<ExprStmt> = (stmt, ctx) => {
  const exprTC = expression(stmt.expression, ctx);

  return toStateful(exprTC, ctx);
};

export const printStmt: StatefulTypeCheckingRule<PrintStmt> = (stmt, ctx) => {
  const exprTC = expression(stmt.expression, ctx);

  return toStateful(exprTC, ctx);
};

export const varStmt: StatefulTypeCheckingRule<VarStmt> = (stmt, ctx) => {
  const exprTC = expression(stmt.assignment, ctx);

  const [tenv, rset] = ctx;

  return exprTC.chain((exprTC) =>
    Result.ok({
      typeEff: exprTC.typeEff,
      typings: [[stmt.name, exprTC.typeEff] as TypeAssoc].concat(
        exprTC.typings,
      ),
      ctx: [TypeEnvUtils.extend(tenv, stmt.name.lexeme, exprTC.typeEff), rset],
    }),
  );
};
