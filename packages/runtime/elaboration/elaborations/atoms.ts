import * as past from '@gsoul-lang/parsing/lib/ast';
import { initialEvidence } from '../../utils/Evidence';
import { Ascription, AtomLiteral } from '../ast';

export const atomLiteral = (lit: past.AtomLiteral): Ascription => {
  const a = AtomLiteral({
    name: lit.name,
  });

  const evidence = initialEvidence(a.typeEff);

  return Ascription({
    expression: a,
    evidence,
    typeEff: a.typeEff,
  });
};
