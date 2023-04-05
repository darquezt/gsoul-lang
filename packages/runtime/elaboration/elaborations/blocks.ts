import { Result } from '@badrap/result';
import { TypeEff, Type, Senv } from '@gsoul-lang/core/utils';
import { Nil } from '@gsoul-lang/core/utils/Type';
import { Block, Statement } from '../ast';
import { statement } from '../elaboration';
import { ElaborationError } from '../errors';
import * as past from '@gsoul-lang/parsing/lib/ast';
import { ElaborationContext } from '../types';

export const block = (
  expr: past.Block,
  ctx: ElaborationContext,
): Result<Block, ElaborationError> => {
  let result = TypeEff<Type, Senv>(Nil(), Senv());
  let currentCtx = ctx;
  const statements: Statement[] = [];

  for (const decl of expr.statements) {
    const stmtElaboration = statement(decl, currentCtx);

    if (!stmtElaboration.isOk) {
      return Result.err(stmtElaboration.error);
    }

    const { value: stmt } = stmtElaboration;

    result = stmt.term.typeEff;
    currentCtx = stmt.ctx;

    statements.push(stmt.term);
  }

  return Result.ok(
    Block({
      statements,
      typeEff: result,
    }),
  );
};
