import { Result } from '@badrap/result';
import { Senv, TypeEff } from '@gsoul-lang/core/utils';
import { Atom } from '@gsoul-lang/core/utils/Type';
import { AtomLiteral } from '@gsoul-lang/parsing/lib/ast';
import { TypeCheckingRule } from '../utils/types';

export const atomLit: TypeCheckingRule<AtomLiteral> = (expr) =>
  Result.ok({
    typeEff: TypeEff(Atom({ name: expr.name.lexeme }), Senv()),
    typings: [[expr.name, TypeEff(Atom({ name: expr.name.lexeme }), Senv())]],
  });
