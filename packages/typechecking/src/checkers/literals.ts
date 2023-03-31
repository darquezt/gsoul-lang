import { Result } from '@badrap/result';
import { Senv, TypeEff } from '@gsoul-lang/core/utils';
import { Bool, Nil, Real } from '@gsoul-lang/core/utils/Type';
import { Literal } from '@gsoul-lang/parsing/lib/ast';
import { TypeCheckingRule } from '../utils/types';

export const realLit: TypeCheckingRule<Literal> = (expr) =>
  Result.ok({
    typeEff: TypeEff(Real(), Senv()),
    typings: [[expr.token, TypeEff(Real(), Senv())]],
  });

export const boolLit: TypeCheckingRule<Literal> = (expr) =>
  Result.ok({
    typeEff: TypeEff(Bool(), Senv()),
    typings: [[expr.token, TypeEff(Bool(), Senv())]],
  });

export const nilLit: TypeCheckingRule<Literal> = (expr) =>
  Result.ok({
    typeEff: TypeEff(Nil(), Senv()),
    typings: [[expr.token, TypeEff(Nil(), Senv())]],
  });
