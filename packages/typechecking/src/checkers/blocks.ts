import { Result } from '@badrap/result';
import { TypeEff, Senv } from '@gsoul-lang/core/utils';
import { Nil } from '@gsoul-lang/core/utils/Type';
import { Block } from '@gsoul-lang/parsing/lib/ast';
import { statement } from '../checker';
import { TypeCheckingRule } from '../utils/types';
import { TypeAssocs } from '../utils/typingSeeker';

export const block: TypeCheckingRule<Block> = (expr, ctx) => {
  let result: TypeEff = TypeEff(Nil(), Senv());
  let currentCtx = ctx;
  const typings: TypeAssocs = [];

  for (const decl of expr.statements) {
    const declTC = statement(decl, currentCtx);

    if (!declTC.isOk) {
      return declTC;
    }

    typings.push(...declTC.value.typings);

    result = declTC.value.typeEff;
    currentCtx = declTC.value.ctx;
  }

  return Result.ok({
    typeEff: result,
    typings,
  });
};
