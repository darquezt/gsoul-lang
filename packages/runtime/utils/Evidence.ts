import {
  Sens,
  Senv,
  SenvUtils,
  Type,
  TypeEff,
  TypeEffUtils,
} from '@gsens-lang/core/utils';
import { Arrow, Bool, Nil, Real } from '@gsens-lang/core/utils/Type';
import { isKinded } from '@gsens-lang/core/utils/ADT';

type Evi<T> = Readonly<[T, T]>;

export type Evidence = Evi<TypeEff>;

export class EvidenceError extends Error {}

const interiorSens = ([s1, s2]: Sens, [s3, s4]: Sens): Evi<Sens> => {
  const s24 = Math.min(s2, s4);
  const s13 = Math.max(s1, s3);

  if (s1 <= s24 && s13 <= s4) {
    return [Sens(s1, s24), Sens(s13, s4)];
  }

  throw new EvidenceError();
};

const interiorSenv = (senv1: Senv, senv2: Senv): Evi<Senv> => {
  const senv1Keys = Object.keys(senv1);
  const senv2Keys = Object.keys(senv2);
  const keys = [...senv1Keys, ...senv2Keys];

  let eviSenv1 = Senv();
  let eviSenv2 = Senv();

  for (const x of keys) {
    const eviSens = interiorSens(
      SenvUtils.access(senv1, x),
      SenvUtils.access(senv2, x),
    );

    eviSenv1 = SenvUtils.extend(eviSenv1, x, eviSens[0]);
    eviSenv2 = SenvUtils.extend(eviSenv2, x, eviSens[1]);
  }

  return [eviSenv1, eviSenv2];
};

const baseTypes: string[] = [Real().kind, Bool().kind, Nil().kind];

const interiorType = (t1: Type, t2: Type): Evi<Type> => {
  if (t1.kind === t2.kind && baseTypes.includes(t1.kind)) {
    return [t1, t2];
  }
  if (isKinded(t1, 'Arrow') && isKinded(t2, 'Arrow')) {
    const evit11 = interiorType(t2.binder.type, t1.binder.type);
    const eviT12 = interior(t1.returnTypeEff, t2.returnTypeEff);

    const [t21p, t11p] = evit11;
    const [T12p, T22p] = eviT12;

    return [
      Arrow({
        binder: { identifier: t1.binder.identifier, type: t11p },
        returnTypeEff: T12p,
      }),
      Arrow({
        binder: { identifier: t2.binder.identifier, type: t21p },
        returnTypeEff: T22p,
      }),
    ];
  }

  throw new EvidenceError();
};

export const interior = (te1: TypeEff, te2: TypeEff): Evidence => {
  const eviType = interiorType(te1.type, te2.type);
  const eviSenv = interiorSenv(te1.effect, te2.effect);

  return [TypeEff(eviType[0], eviSenv[0]), TypeEff(eviType[1], eviSenv[1])];
};

export const initialEvidence = (te1: TypeEff): Evidence => {
  return [te1, te1];
};

export const transSens = (ev1: Evi<Sens>, ev2: Evi<Sens>): Evi<Sens> => {
  const [[s11, s12], [s13, s14]] = ev1;
  const [[s21, s22], [s23, s24]] = ev2;

  const s1p = Math.min(s12, s14, s22);
  const s2p = Math.max(s13, s21, s23);

  if (!(s11 <= s1p) || !(s2p <= s24)) {
    throw new EvidenceError();
  }

  return [Sens(s11, s1p), Sens(s2p, s24)];
};

export const transSenv = (ev1: Evi<Senv>, ev2: Evi<Senv>): Evi<Senv> => {
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
    const eviSens = transSens(
      [SenvUtils.access(senv1, x), SenvUtils.access(senv2, x)],
      [SenvUtils.access(senv3, x), SenvUtils.access(senv4, x)],
    );

    eviSenv1 = SenvUtils.extend(eviSenv1, x, eviSens[0]);
    eviSenv2 = SenvUtils.extend(eviSenv2, x, eviSens[1]);
  }

  return [eviSenv1, eviSenv2];
};

const transType = (ev1: Evi<Type>, ev2: Evi<Type>): Evi<Type> => {
  const [t1, t2] = ev1;
  const [t3, t4] = ev2;

  if (
    t1.kind === t2.kind &&
    t1.kind === t3.kind &&
    t1.kind === t4.kind &&
    baseTypes.includes(t1.kind)
  ) {
    return ev1;
  }

  if (
    isKinded(t1, 'Arrow') &&
    isKinded(t2, 'Arrow') &&
    isKinded(t3, 'Arrow') &&
    isKinded(t4, 'Arrow')
  ) {
    const evit11 = transType(
      [t4.binder.type, t3.binder.type],
      [t2.binder.type, t1.binder.type],
    );
    const eviT12 = trans(
      [t1.returnTypeEff, t2.returnTypeEff],
      [t3.returnTypeEff, t4.returnTypeEff],
    );

    const [t21p, t11p] = evit11;
    const [T12p, T22p] = eviT12;

    return [
      Arrow({
        binder: { identifier: t1.binder.identifier, type: t11p },
        returnTypeEff: T12p,
      }),
      Arrow({
        binder: { identifier: t2.binder.identifier, type: t21p },
        returnTypeEff: T22p,
      }),
    ];
  }

  throw new EvidenceError();
};

export const trans = (ev1: Evidence, ev2: Evidence): Evidence => {
  const eviType = transType(
    [ev1[0].type, ev1[1].type],
    [ev2[0].type, ev2[1].type],
  );
  const eviSenv = transSenv(
    [ev1[0].effect, ev1[1].effect],
    [ev2[0].effect, ev2[1].effect],
  );

  return [TypeEff(eviType[0], eviSenv[0]), TypeEff(eviType[1], eviSenv[1])];
};

// INVERSION

export const icod = (ev: Evidence): Evidence => {
  if (!isKinded(ev[0].type, 'Arrow') || !isKinded(ev[1].type, 'Arrow')) {
    throw new EvidenceError();
  }

  return [
    TypeEff(
      ev[0].type.returnTypeEff.type,
      SenvUtils.add(ev[0].effect, ev[0].type.returnTypeEff.effect),
    ),
    TypeEff(
      ev[1].type.returnTypeEff.type,
      SenvUtils.add(ev[1].effect, ev[1].type.returnTypeEff.effect),
    ),
  ];
};

export const idom = (ev: Evidence): Evidence => {
  if (!isKinded(ev[0].type, 'Arrow') || !isKinded(ev[1].type, 'Arrow')) {
    throw new EvidenceError();
  }

  return [
    TypeEff(
      ev[1].type.binder.type,
      Senv({ [ev[1].type.binder.identifier]: Sens(1) }),
    ),
    TypeEff(
      ev[0].type.binder.type,
      Senv({ [ev[0].type.binder.identifier]: Sens(1) }),
    ),
  ];
};

// UTILS

export const sum = (ev1: Evidence, ev2: Evidence): Evidence => {
  /**
   * Types must be the same
   */
  if (
    ev1[0].type.kind !== ev1[1].type.kind ||
    ev1[0].type.kind !== ev2[0].type.kind ||
    ev1[0].type.kind !== ev2[1].type.kind
  ) {
    throw new EvidenceError();
  }

  return [
    TypeEff(ev1[0].type, SenvUtils.add(ev1[0].effect, ev2[0].effect)),
    TypeEff(ev2[0].type, SenvUtils.add(ev1[1].effect, ev2[1].effect)),
  ];
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
