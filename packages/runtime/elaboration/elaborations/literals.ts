import * as past from '@gsoul-lang/parsing/lib/ast';
import { initialEvidence } from '../../utils/Evidence';
import { Ascription, RealLiteral, BoolLiteral, NilLiteral } from '../ast';

export const realLiteral = (lit: past.Literal): Ascription => {
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

export const boolLiteral = (lit: past.Literal): Ascription => {
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

export const unitLiteral = (): Ascription => {
  const nil = NilLiteral();
  const evidence = initialEvidence(nil.typeEff);

  return Ascription({
    expression: nil,
    evidence,
    typeEff: nil.typeEff,
  });
};
