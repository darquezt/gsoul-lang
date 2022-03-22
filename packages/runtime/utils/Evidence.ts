import {
  Sens,
  Senv,
  SenvUtils,
  Type,
  TypeEff,
  TypeEffUtils,
} from '@gsens-lang/core/utils';
import { Arrow, Bool, Nil, Real } from '@gsens-lang/core/utils/Type';
import { factoryOf, isKinded } from '@gsens-lang/core/utils/ADT';
import { Result } from './Result';
import { Err, Ok } from '../utils/Result';

type Evi<T> = Readonly<[T, T]>;

export type Evidence = Evi<TypeEff>;

export type EvidenceInteriorError = {
  kind: 'EvidenceInteriorError';
  reason: string;
};
export const EvidenceInteriorError = factoryOf<EvidenceInteriorError>(
  'EvidenceInteriorError',
);

export type EvidenceTransitivityError = {
  kind: 'EvidenceTransitivityError';
  reason: string;
};
export const EvidenceTransitivityError = factoryOf<EvidenceTransitivityError>(
  'EvidenceTransitivityError',
);

export type EvidenceTypeError = {
  kind: 'EvidenceTypeError';
  reason: string;
};
export const EvidenceTypeError =
  factoryOf<EvidenceTypeError>('EvidenceTypeError');

export type EvidenceError =
  | EvidenceInteriorError
  | EvidenceTransitivityError
  | EvidenceTypeError;

const interiorSens = (
  [s1, s2]: Sens,
  [s3, s4]: Sens,
): Result<Evi<Sens>, EvidenceError> => {
  const s24 = Math.min(s2, s4);
  const s13 = Math.max(s1, s3);

  if (s1 <= s24 && s13 <= s4) {
    return Ok([Sens(s1, s24), Sens(s13, s4)]);
  }

  return Err(
    EvidenceInteriorError({
      reason: 'Interior is not defined',
    }),
  );
};

const interiorSenv = (
  senv1: Senv,
  senv2: Senv,
): Result<Evi<Senv>, EvidenceError> => {
  const senv1Keys = Object.keys(senv1);
  const senv2Keys = Object.keys(senv2);
  const keys = [...senv1Keys, ...senv2Keys];

  let eviSenv1 = Senv();
  let eviSenv2 = Senv();

  for (const x of keys) {
    const eviSensRes = interiorSens(
      SenvUtils.access(senv1, x),
      SenvUtils.access(senv2, x),
    );

    if (!eviSensRes.success) {
      return eviSensRes;
    }

    const { result: eviSens } = eviSensRes;

    eviSenv1 = SenvUtils.extend(eviSenv1, x, eviSens[0]);
    eviSenv2 = SenvUtils.extend(eviSenv2, x, eviSens[1]);
  }

  return Ok([eviSenv1, eviSenv2]);
};

const baseTypes: string[] = [Real().kind, Bool().kind, Nil().kind];

const interiorType = (t1: Type, t2: Type): Result<Evi<Type>, EvidenceError> => {
  if (t1.kind === t2.kind && baseTypes.includes(t1.kind)) {
    return Ok([t1, t2]);
  }
  if (isKinded(t1, 'Arrow') && isKinded(t2, 'Arrow')) {
    const evit11Res = interior(t2.domain, t1.domain);

    if (!evit11Res.success) {
      return evit11Res;
    }

    const eviT12Res = interior(t1.codomain, t2.codomain);

    if (!eviT12Res.success) {
      return eviT12Res;
    }

    const {
      result: [t21p, t11p],
    } = evit11Res;
    const {
      result: [T12p, T22p],
    } = eviT12Res;

    return Ok([
      Arrow({
        domain: t11p,
        codomain: T12p,
      }),
      Arrow({
        domain: t21p,
        codomain: T22p,
      }),
    ]);
  }

  return Err(EvidenceInteriorError({ reason: 'Unsopported type' }));
};

export const interior = (
  te1: TypeEff,
  te2: TypeEff,
): Result<Evidence, EvidenceError> => {
  const eviTypeRes = interiorType(te1.type, te2.type);

  if (!eviTypeRes.success) {
    return eviTypeRes;
  }

  const eviSenvRes = interiorSenv(te1.effect, te2.effect);

  if (!eviSenvRes.success) {
    return eviSenvRes;
  }

  const { result: eviType } = eviTypeRes;
  const { result: eviSenv } = eviSenvRes;

  return Ok([TypeEff(eviType[0], eviSenv[0]), TypeEff(eviType[1], eviSenv[1])]);
};

export const initialEvidence = (te1: TypeEff): Evidence => {
  return [te1, te1];
};

export const transSens = (
  ev1: Evi<Sens>,
  ev2: Evi<Sens>,
): Result<Evi<Sens>, EvidenceError> => {
  const [[s11, s12], [s13, s14]] = ev1;
  const [[s21, s22], [s23, s24]] = ev2;

  const s1p = Math.min(s12, s14, s22);
  const s2p = Math.max(s13, s21, s23);

  if (!(s11 <= s1p) || !(s2p <= s24)) {
    return Err(
      EvidenceTransitivityError({
        reason: 'Consistent transitivity is not defined',
      }),
    );
  }

  return Ok([Sens(s11, s1p), Sens(s2p, s24)]);
};

export const transSenv = (
  ev1: Evi<Senv>,
  ev2: Evi<Senv>,
): Result<Evi<Senv>, EvidenceError> => {
  const [senv1, senv2] = ev1;
  const [senv3, senv4] = ev2;

  const senv1Keys = Object.keys(senv1);
  const senv2Keys = Object.keys(senv2);
  const senv3Keys = Object.keys(senv3);
  const senv4Keys = Object.keys(senv4);
  const keys = [...senv1Keys, ...senv2Keys, ...senv3Keys, ...senv4Keys];

  let eviSenv1 = Senv();
  let eviSenv2 = Senv();

  for (const x of keys) {
    const eviSensRes = transSens(
      [SenvUtils.access(senv1, x), SenvUtils.access(senv2, x)],
      [SenvUtils.access(senv3, x), SenvUtils.access(senv4, x)],
    );

    if (!eviSensRes.success) {
      return eviSensRes;
    }

    const { result: eviSens } = eviSensRes;

    eviSenv1 = SenvUtils.extend(eviSenv1, x, eviSens[0]);
    eviSenv2 = SenvUtils.extend(eviSenv2, x, eviSens[1]);
  }

  return Ok([eviSenv1, eviSenv2]);
};

const transType = (
  ev1: Evi<Type>,
  ev2: Evi<Type>,
): Result<Evi<Type>, EvidenceError> => {
  const [t1, t2] = ev1;
  const [t3, t4] = ev2;

  if (
    t1.kind === t2.kind &&
    t1.kind === t3.kind &&
    t1.kind === t4.kind &&
    baseTypes.includes(t1.kind)
  ) {
    return Ok(ev1);
  }

  if (
    isKinded(t1, 'Arrow') &&
    isKinded(t2, 'Arrow') &&
    isKinded(t3, 'Arrow') &&
    isKinded(t4, 'Arrow')
  ) {
    const evit11Res = trans([t4.domain, t3.domain], [t2.domain, t1.domain]);

    if (!evit11Res.success) {
      return evit11Res;
    }

    const eviT12Res = trans(
      [t1.codomain, t2.codomain],
      [t3.codomain, t4.codomain],
    );

    if (!eviT12Res.success) {
      return eviT12Res;
    }

    const {
      result: [t21p, t11p],
    } = evit11Res;
    const {
      result: [T12p, T22p],
    } = eviT12Res;

    return Ok([
      Arrow({
        domain: t11p,
        codomain: T12p,
      }),
      Arrow({
        domain: t21p,
        codomain: T22p,
      }),
    ]);
  }

  return Err(EvidenceTransitivityError({ reason: 'Unsupported type' }));
};

export const trans = (
  ev1: Evidence,
  ev2: Evidence,
): Result<Evidence, EvidenceError> => {
  const eviTypeRes = transType(
    [ev1[0].type, ev1[1].type],
    [ev2[0].type, ev2[1].type],
  );

  if (!eviTypeRes.success) {
    return eviTypeRes;
  }

  const eviSenvRes = transSenv(
    [ev1[0].effect, ev1[1].effect],
    [ev2[0].effect, ev2[1].effect],
  );

  if (!eviSenvRes.success) {
    return eviSenvRes;
  }

  const { result: eviType } = eviTypeRes;
  const { result: eviSenv } = eviSenvRes;

  return Ok([TypeEff(eviType[0], eviSenv[0]), TypeEff(eviType[1], eviSenv[1])]);
};

// INVERSION

export const icod = (ev: Evidence): Result<Evidence, EvidenceError> => {
  if (!isKinded(ev[0].type, 'Arrow') || !isKinded(ev[1].type, 'Arrow')) {
    return Err(
      EvidenceTypeError({
        reason: 'Operator icod is not defined for types other than functions',
      }),
    );
  }

  return Ok([
    TypeEff(
      ev[0].type.codomain.type,
      SenvUtils.add(ev[0].effect, ev[0].type.codomain.effect),
    ),
    TypeEff(
      ev[1].type.codomain.type,
      SenvUtils.add(ev[1].effect, ev[1].type.codomain.effect),
    ),
  ]);
};

export const iscod = (
  ev: Evidence,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _name: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _effect: Senv,
): Result<Evidence, EvidenceError> => {
  console.log('ISCOD', format(ev));
  if (!isKinded(ev[0].type, 'ForallT') || !isKinded(ev[1].type, 'ForallT')) {
    return Err(
      EvidenceTypeError({
        reason: 'Operator iscod is not defined for types other than foralls',
      }),
    );
  }

  return Ok([
    TypeEff(
      ev[0].type.codomain.type,
      SenvUtils.add(ev[0].effect, ev[0].type.codomain.effect),
    ),
    // TypeEffUtils.subst(
    //   name,
    //   effect,
    // ),
    TypeEff(
      ev[1].type.codomain.type,
      SenvUtils.add(ev[1].effect, ev[1].type.codomain.effect),
    ),
    // TypeEffUtils.subst(
    //   name,
    //   effect,
    // ),
  ]);
};

export const idom = (ev: Evidence): Result<Evidence, EvidenceError> => {
  if (!isKinded(ev[0].type, 'Arrow') || !isKinded(ev[1].type, 'Arrow')) {
    return Err(
      EvidenceTypeError({
        reason: 'Operator idom is not defined for types other than functions',
      }),
    );
  }

  return Ok([ev[1].type.domain, ev[0].type.domain]);
};

// UTILS

export const sum = (
  ev1: Evidence,
  ev2: Evidence,
): Result<Evidence, EvidenceError> => {
  /**
   * Types must be the same
   */
  if (
    ev1[0].type.kind !== ev1[1].type.kind ||
    ev1[0].type.kind !== ev2[0].type.kind ||
    ev1[0].type.kind !== ev2[1].type.kind
  ) {
    return Err(
      EvidenceTypeError({
        reason: 'All types in evidence should be of the same kind',
      }),
    );
  }

  return Ok([
    TypeEff(ev1[0].type, SenvUtils.add(ev1[0].effect, ev2[0].effect)),
    TypeEff(ev2[0].type, SenvUtils.add(ev1[1].effect, ev2[1].effect)),
  ]);
};

export const scale = (ev: Evidence, factor: number): Evidence => {
  return [
    TypeEff(ev[0].type, SenvUtils.scale(ev[0].effect, factor)),
    TypeEff(ev[1].type, SenvUtils.scale(ev[1].effect, factor)),
  ];
};

export const scaleInf = (ev: Evidence): Evidence => {
  return [
    TypeEff(ev[0].type, SenvUtils.scaleInf(ev[0].effect)),
    TypeEff(ev[1].type, SenvUtils.scaleInf(ev[1].effect)),
  ];
};

export const subst = (ev: Evidence, name: string, senv: Senv): Evidence => {
  return [
    TypeEffUtils.subst(ev[0], name, senv),
    TypeEffUtils.subst(ev[1], name, senv),
  ];
};

export const format = ([teff1, teff2]: Evidence): string => {
  return `⟨${TypeEffUtils.format(teff1)}, ${TypeEffUtils.format(teff2)}⟩`;
};
