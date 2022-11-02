import {
  Sens,
  SensUtils,
  Senv,
  SenvUtils,
  Type,
  TypeEff,
  TypeEffUtils,
  TypeUtils,
} from '@gsoul-lang/core/utils';
import {
  Arrow,
  Bool,
  Nil,
  Product,
  Real,
  RecType,
  typeIsKinded,
  TypeKind,
} from '@gsoul-lang/core/utils/Type';
import { isKinded } from '@gsoul-lang/core/utils/ADT';
import { TypeEffect, TypeEffectKind } from '@gsoul-lang/core/utils/TypeEff';
import { Result } from '@badrap/result';
import { zip } from 'ramda';
import RecursivePolarityCheck, {
  RecursivePolarityMode,
} from '@gsoul-lang/core/utils/lib/RecursivePolarityCheck';
import Meet from '@gsoul-lang/core/utils/lib/Meet';

type Evi<T> = Readonly<[T, T]>;

export type Evidence = Evi<TypeEffect>;

// export type EvidenceInteriorError = {
//   kind: 'EvidenceInteriorError';
//   string;
// };
// export const EvidenceInteriorError = factoryOf<EvidenceInteriorError>(
//   'EvidenceInteriorError',
// );

// export type EvidenceTransitivityError = {
//   kind: 'EvidenceTransitivityError';
//   string;
// };
// export const EvidenceTransitivityError = factoryOf<EvidenceTransitivityError>(
//   'EvidenceTransitivityError',
// );

// export type EvidenceTypeError = {
//   kind: 'EvidenceTypeError';
//   string;
// };
// export const EvidenceTypeError =
//   factoryOf<EvidenceTypeError>('EvidenceTypeError');

export class EvidenceInteriorError extends Error {}
export class EvidenceTransitivityError extends Error {}
export class EvidenceTypeError extends Error {}

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
    return Result.ok([Sens(s1, s24), Sens(s13, s4)]);
  }

  return Result.err(new EvidenceInteriorError('Interior is not defined'));
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

    if (!eviSensRes.isOk) {
      return Result.err(eviSensRes.error);
    }

    const { value: eviSens } = eviSensRes;

    eviSenv1 = SenvUtils.extend(eviSenv1, x, eviSens[0]);
    eviSenv2 = SenvUtils.extend(eviSenv2, x, eviSens[1]);
  }

  return Result.ok([eviSenv1, eviSenv2]);
};

const baseTypes: string[] = [Real().kind, Bool().kind, Nil().kind];

const interiorType = (t1: Type, t2: Type): Result<Evi<Type>, EvidenceError> => {
  if (t1.kind === t2.kind && baseTypes.includes(t1.kind)) {
    return Result.ok([t1, t2]);
  }

  if (isKinded(t1, TypeKind.Arrow) && isKinded(t2, TypeKind.Arrow)) {
    const eviT11Res = interior(t2.domain, t1.domain);

    const eviT12Res = interior(t1.codomain, t2.codomain);

    return Result.all([eviT11Res, eviT12Res]).map(([eviT11, eviT12]) => [
      Arrow({
        domain: eviT11[1],
        codomain: eviT12[0],
      }),
      Arrow({
        domain: eviT11[0],
        codomain: eviT12[1],
      }),
    ]);
  }

  if (isKinded(t1, TypeKind.Product) && isKinded(t2, TypeKind.Product)) {
    if (t1.typeEffects.length !== t2.typeEffects.length) {
      return Result.err(
        new EvidenceInteriorError('Wrong number of product components'),
      );
    }

    const componentInteriors = zip(t1.typeEffects, t2.typeEffects).map(
      ([teff1, teff2]) => interior(teff1, teff2),
    );

    Result.all(componentInteriors).map((interiors) => {
      const leftInteriors = interiors.map((evi) => evi[0]);
      const rightInteriors = interiors.map((evi) => evi[1]);

      return [
        Product({ typeEffects: leftInteriors }),
        Product({ typeEffects: rightInteriors }),
      ];
    });
  }

  if (isKinded(t1, TypeKind.RecType) && isKinded(t2, TypeKind.RecType)) {
    if (t1.variable !== t2.variable) {
      return Result.err(
        new EvidenceInteriorError(
          'Bound variables of recursive types are incompatible',
        ),
      );
    }

    const positivePolarity = RecursivePolarityCheck.Type(
      t1.variable,
      RecursivePolarityMode.POSITIVE,
      t1,
      t2,
    );

    const bodyInterior = interior(t1.body, t2.body);

    if (positivePolarity) {
      return bodyInterior.map(([leftBody, rightBody]) => [
        RecType({
          variable: t1.variable,
          body: leftBody,
        }),
        RecType({
          variable: t2.variable,
          body: rightBody,
        }),
      ]);
    }

    const bodyMeet = Meet.TypeEffect(t1.body, t2.body);

    if (bodyMeet.isOk) {
      return Result.ok([
        RecType({
          variable: t1.variable,
          body: bodyMeet.value,
        }),
        RecType({
          variable: t2.variable,
          body: bodyMeet.value,
        }),
      ]);
    }
  }

  return Result.err(new EvidenceInteriorError('Unsopported type'));
};

export const interior = (
  te1: TypeEffect,
  te2: TypeEffect,
): Result<Evidence, EvidenceError> => {
  if (
    isKinded(te1, TypeEffectKind.RecursiveVar) &&
    isKinded(te2, TypeEffectKind.RecursiveVar)
  ) {
    if (te1.name === te1.name) {
      return Result.ok([te1, te2]);
    }

    return Result.err(new EvidenceInteriorError('Interior is not defined'));
  }

  if (
    isKinded(te1, TypeEffectKind.TypeEff) &&
    isKinded(te2, TypeEffectKind.TypeEff)
  ) {
    const eviTypeRes = interiorType(te1.type, te2.type);

    const eviSenvRes = interiorSenv(te1.effect, te2.effect);

    return Result.all([eviTypeRes, eviSenvRes]).map(([eviType, eviSenv]) => [
      TypeEff(eviType[0], eviSenv[0]),
      TypeEff(eviType[1], eviSenv[1]),
    ]);
  }

  return Result.err(new EvidenceInteriorError('Interior is not defined'));
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
    return Result.err(
      new EvidenceTransitivityError('Consistent transitivity is not defined'),
    );
  }

  return Result.ok([Sens(s11, s1p), Sens(s2p, s24)]);
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

    if (!eviSensRes.isOk) {
      return Result.err(eviSensRes.error);
    }

    const { value: eviSens } = eviSensRes;

    eviSenv1 = SenvUtils.extend(eviSenv1, x, eviSens[0]);
    eviSenv2 = SenvUtils.extend(eviSenv2, x, eviSens[1]);
  }

  return Result.ok([eviSenv1, eviSenv2]);
};

const transType = (
  ev1: Evi<Type>,
  ev2: Evi<Type>,
): Result<Evi<Type>, EvidenceError> => {
  const middle = TypeUtils.meet(ev1[1], ev2[0]);

  if (!middle.isOk) {
    return Result.err(new EvidenceTransitivityError('Undefined meet'));
  }

  const leftTrans = interiorType(ev1[0], middle.value);
  const rightTrans = interiorType(middle.value, ev2[1]);

  return Result.all([leftTrans, rightTrans]).map(([left, right]) => [
    left[0],
    right[1],
  ]);
};

// const transType = (
//   ev1: Evi<Type>,
//   ev2: Evi<Type>,
// ): Result<Evi<Type>, EvidenceError> => {
//   const [t1, t2] = ev1;
//   const [t3, t4] = ev2;

//   if (
//     t1.kind === t2.kind &&
//     t1.kind === t3.kind &&
//     t1.kind === t4.kind &&
//     baseTypes.includes(t1.kind)
//   ) {
//     return Result.ok(ev1);
//   }

//   if (
//     isKinded(t1, TypeKind.Arrow) &&
//     isKinded(t2, TypeKind.Arrow) &&
//     isKinded(t3, TypeKind.Arrow) &&
//     isKinded(t4, TypeKind.Arrow)
//   ) {
//     const evit11Res = trans(
//       [t4.domain as TypeEff, t3.domain as TypeEff],
//       [t2.domain as TypeEff, t1.domain as TypeEff],
//     );

//     if (!evit11Res.success) {
//       return evit11Res;
//     }

//     const eviT12Res = trans(
//       [t1.codomain as TypeEff, t2.codomain as TypeEff],
//       [t3.codomain as TypeEff, t4.codomain as TypeEff],
//     );

//     if (!eviT12Res.success) {
//       return eviT12Res;
//     }

//     const {
//       result: [t21p, t11p],
//     } = evit11Res;
//     const {
//       result: [T12p, T22p],
//     } = eviT12Res;

//     return Result.ok([
//       Arrow({
//         domain: t11p,
//         codomain: T12p,
//       }),
//       Arrow({
//         domain: t21p,
//         codomain: T22p,
//       }),
//     ]);
//   }

//   if (
//     isKinded(t1, TypeKind.RecType) &&
//     isKinded(t2, TypeKind.RecType) &&
//     isKinded(t3, TypeKind.RecType) &&
//     isKinded(t4, TypeKind.RecType)
//   ) {
//     const evit11Res = trans(
//       [t4.domain as TypeEff, t3.domain as TypeEff],
//       [t2.domain as TypeEff, t1.domain as TypeEff],
//     );

//     if (!evit11Res.success) {
//       return evit11Res;
//     }

//     const eviT12Res = trans(
//       [t1.codomain as TypeEff, t2.codomain as TypeEff],
//       [t3.codomain as TypeEff, t4.codomain as TypeEff],
//     );

//     if (!eviT12Res.success) {
//       return eviT12Res;
//     }

//     const {
//       result: [t21p, t11p],
//     } = evit11Res;
//     const {
//       result: [T12p, T22p],
//     } = eviT12Res;

//     return Result.ok([
//       Arrow({
//         domain: t11p,
//         codomain: T12p,
//       }),
//       Arrow({
//         domain: t21p,
//         codomain: T22p,
//       }),
//     ]);
//   }

//   if (
//     isKinded(t1, TypeKind.AProduct) &&
//     isKinded(t2, TypeKind.AProduct) &&
//     isKinded(t3, TypeKind.AProduct) &&
//     isKinded(t4, TypeKind.AProduct)
//   ) {
//     const evit11Res = trans(
//       [t1.first as TypeEff, t2.first as TypeEff],
//       [t3.first as TypeEff, t4.first as TypeEff],
//     );

//     if (!evit11Res.success) {
//       return evit11Res;
//     }

//     const eviT12Res = trans(
//       [t1.second as TypeEff, t2.second as TypeEff],
//       [t3.second as TypeEff, t4.second as TypeEff],
//     );

//     if (!eviT12Res.success) {
//       return eviT12Res;
//     }

//     const {
//       result: [t21p, t11p],
//     } = evit11Res;
//     const {
//       result: [T12p, T22p],
//     } = eviT12Res;

//     return Result.ok([
//       AProduct({
//         first: t11p,
//         second: T12p,
//       }),
//       AProduct({
//         first: t21p,
//         second: T22p,
//       }),
//     ]);
//   }

//   return Result.err(EvidenceTransitivityError({ 'Unsupported type' }));
// };

export const trans = (
  [teff11, teff12]: Evidence,
  [teff21, teff22]: Evidence,
): Result<Evidence, EvidenceError> => {
  if (
    isKinded(teff11, TypeEffectKind.RecursiveVar) &&
    isKinded(teff12, TypeEffectKind.RecursiveVar) &&
    isKinded(teff21, TypeEffectKind.RecursiveVar) &&
    isKinded(teff22, TypeEffectKind.RecursiveVar)
  ) {
    if (
      teff11.name === teff12.name &&
      teff11.name === teff21.name &&
      teff11.name === teff22.name
    ) {
      return Result.ok([teff11, teff22]);
    }

    return Result.err(
      new EvidenceTransitivityError('Consistent transitivity is not defined'),
    );
  }

  if (
    isKinded(teff11, TypeEffectKind.TypeEff) &&
    isKinded(teff12, TypeEffectKind.TypeEff) &&
    isKinded(teff21, TypeEffectKind.TypeEff) &&
    isKinded(teff22, TypeEffectKind.TypeEff)
  ) {
    const eviTypeRes = transType(
      [teff11.type, teff12.type],
      [teff12.type, teff22.type],
    );
    const eviSenvRes = transSenv(
      [teff11.effect, teff12.effect],
      [teff12.effect, teff22.effect],
    );

    return Result.all([eviTypeRes, eviSenvRes]).map(([eviType, eviSenv]) => [
      TypeEff(eviType[0], eviSenv[0]),
      TypeEff(eviType[1], eviSenv[1]),
    ]);
  }

  return Result.err(
    new EvidenceTransitivityError('Consistent transitivity is not defined'),
  );
};

// INVERSION

export const icod = (ev: Evidence): Result<Evidence, EvidenceError> => {
  const [left, right] = ev;

  if (
    isKinded(left, TypeEffectKind.RecursiveVar) ||
    isKinded(right, TypeEffectKind.RecursiveVar)
  ) {
    return Result.err(
      new EvidenceTypeError(
        'Cannot compute (i)codomain of a recusive type-and-effect',
      ),
    );
  }

  if (
    !typeIsKinded(left, TypeKind.Arrow) ||
    !typeIsKinded(right, TypeKind.Arrow)
  ) {
    return Result.err(
      new EvidenceTypeError(
        'Operator icod is not defined for types other than functions',
      ),
    );
  }

  return Result.ok([
    TypeEffUtils.ArrowsUtils.codomain(left),
    TypeEffUtils.ArrowsUtils.codomain(right),
  ]);
};

export const idom = (ev: Evidence): Result<Evidence, EvidenceError> => {
  const [left, right] = ev;

  if (
    isKinded(left, TypeEffectKind.RecursiveVar) ||
    isKinded(right, TypeEffectKind.RecursiveVar)
  ) {
    return Result.err(
      new EvidenceTypeError(
        'Cannot compute (i)codomain of a recusive type-and-effect',
      ),
    );
  }

  if (
    !typeIsKinded(left, TypeKind.Arrow) ||
    !typeIsKinded(right, TypeKind.Arrow)
  ) {
    return Result.err(
      new EvidenceTypeError(
        'Operator idom is not defined for types other than functions',
      ),
    );
  }

  return Result.ok([
    TypeEffUtils.ArrowsUtils.domain(left),
    TypeEffUtils.ArrowsUtils.domain(right),
  ]);
};

export const iscod = (
  ev: Evidence,
  effect?: Senv,
): Result<Evidence, EvidenceError> => {
  const [left, right] = ev;

  if (
    isKinded(left, TypeEffectKind.RecursiveVar) ||
    isKinded(right, TypeEffectKind.RecursiveVar)
  ) {
    return Result.err(
      new EvidenceTypeError(
        'Cannot compute (i)codomain of a recusive type-and-effect',
      ),
    );
  }

  if (
    !typeIsKinded(left, TypeKind.ForallT) ||
    !typeIsKinded(right, TypeKind.ForallT)
  ) {
    return Result.err(
      new EvidenceTypeError(
        'Operator iscod is not defined for types other than functions',
      ),
    );
  }

  return Result.ok([
    TypeEffUtils.ForallsUtils.instance(left, effect),
    TypeEffUtils.ForallsUtils.instance(right, effect),
  ]);
};

export const ifirst = (ev: Evidence): Result<Evidence, EvidenceError> => {
  const [left, right] = ev;

  if (
    isKinded(left, TypeEffectKind.RecursiveVar) ||
    isKinded(right, TypeEffectKind.RecursiveVar)
  ) {
    return Result.err(
      new EvidenceTypeError(
        'Cannot compute (i)codomain of a recusive type-and-effect',
      ),
    );
  }

  if (
    !typeIsKinded(left, TypeKind.AProduct) ||
    !typeIsKinded(right, TypeKind.AProduct)
  ) {
    return Result.err(
      new EvidenceTypeError(
        'Operator ifirst is not defined for types other than products',
      ),
    );
  }

  return Result.ok([
    TypeEffUtils.AdditiveProductsUtils.firstProjection(left),
    TypeEffUtils.AdditiveProductsUtils.firstProjection(right),
  ]);
};

export const isecond = (ev: Evidence): Result<Evidence, EvidenceError> => {
  const [left, right] = ev;

  if (
    isKinded(left, TypeEffectKind.RecursiveVar) ||
    isKinded(right, TypeEffectKind.RecursiveVar)
  ) {
    return Result.err(
      new EvidenceTypeError(
        'Cannot compute (i)codomain of a recusive type-and-effect',
      ),
    );
  }

  if (
    !typeIsKinded(left, TypeKind.AProduct) ||
    !typeIsKinded(right, TypeKind.AProduct)
  ) {
    return Result.err(
      new EvidenceTypeError(
        'Operator isecond is not defined for types other than products',
      ),
    );
  }

  return Result.ok([
    TypeEffUtils.AdditiveProductsUtils.secondProjection(left),
    TypeEffUtils.AdditiveProductsUtils.secondProjection(right),
  ]);
};

export const iproj = (
  index: number,
  ev: Evidence,
): Result<Evidence, EvidenceError> => {
  const [left, right] = ev;

  if (
    isKinded(left, TypeEffectKind.RecursiveVar) ||
    isKinded(right, TypeEffectKind.RecursiveVar)
  ) {
    return Result.err(
      new EvidenceTypeError(
        'Cannot compute (i)codomain of a recusive type-and-effect',
      ),
    );
  }

  if (
    !typeIsKinded(left, TypeKind.Product) ||
    !typeIsKinded(right, TypeKind.Product)
  ) {
    return Result.err(
      new EvidenceTypeError(
        'Operator iproj is not defined for types other than products',
      ),
    );
  }

  return Result.ok([
    TypeEffUtils.ProductUtils.projection(index, left),
    TypeEffUtils.ProductUtils.projection(index, right),
  ]);
};

export const iunfold = (ev: Evidence): Result<Evidence, EvidenceError> => {
  const [left, right] = ev;

  if (
    isKinded(left, TypeEffectKind.RecursiveVar) ||
    isKinded(right, TypeEffectKind.RecursiveVar)
  ) {
    return Result.err(
      new EvidenceTypeError(
        'Cannot compute (i)codomain of a recusive type-and-effect',
      ),
    );
  }

  if (
    !typeIsKinded(left, TypeKind.RecType) ||
    !typeIsKinded(right, TypeKind.RecType)
  ) {
    return Result.err(
      new EvidenceTypeError(
        'Operator iunfold is not defined for types other than functions',
      ),
    );
  }

  return Result.ok([
    TypeEffUtils.RecursiveUtils.unfold(left),
    TypeEffUtils.RecursiveUtils.unfold(right),
  ]);
};

// UTILS

export const sum = (
  ev1: Evidence,
  ev2: Evidence,
): Result<Evidence, EvidenceError> => {
  const [teff11, teff12] = ev1;
  const [teff21, teff22] = ev2;

  if (
    isKinded(teff11, TypeEffectKind.RecursiveVar) ||
    isKinded(teff21, TypeEffectKind.RecursiveVar) ||
    isKinded(teff12, TypeEffectKind.RecursiveVar) ||
    isKinded(teff22, TypeEffectKind.RecursiveVar)
  ) {
    return Result.err(
      new EvidenceTypeError('Cannot compute sum of a recusive type-and-effect'),
    );
  }

  /**
   * Types must be the same
   */
  if (
    teff11.type.kind !== teff12.type.kind ||
    teff11.type.kind !== teff21.type.kind ||
    teff11.type.kind !== teff22.type.kind
  ) {
    return Result.err(
      new EvidenceTypeError('All types in evidence should be of the same kind'),
    );
  }

  return Result.ok([
    TypeEff(teff11.type, SenvUtils.add(teff11.effect, teff21.effect)),
    TypeEff(teff21.type, SenvUtils.add(teff12.effect, teff22.effect)),
  ]);
};

export const realComparison = (
  ev1: Evidence,
  ev2: Evidence,
): Result<Evidence, EvidenceError> => {
  const [teff11, teff12] = ev1;
  const [teff21, teff22] = ev2;

  if (
    isKinded(teff11, TypeEffectKind.RecursiveVar) ||
    isKinded(teff21, TypeEffectKind.RecursiveVar) ||
    isKinded(teff12, TypeEffectKind.RecursiveVar) ||
    isKinded(teff22, TypeEffectKind.RecursiveVar)
  ) {
    return Result.err(
      new EvidenceTypeError(
        'Cannot compute comparison of a recusive type-and-effect',
      ),
    );
  }

  /**
   * Types must be the same
   */
  if (
    teff11.type.kind !== teff12.type.kind ||
    teff11.type.kind !== teff21.type.kind ||
    teff11.type.kind !== teff22.type.kind
  ) {
    return Result.err(
      new EvidenceTypeError('All types in evidence should be of the same kind'),
    );
  }

  return Result.ok([
    TypeEff(
      Bool(),
      SenvUtils.scaleInf(SenvUtils.add(teff11.effect, teff21.effect)),
    ),
    TypeEff(
      Bool(),
      SenvUtils.scaleInf(SenvUtils.add(teff12.effect, teff22.effect)),
    ),
  ]);
};

export const scale = (ev: Evidence, factor: number): Evidence => {
  const [left, right] = ev;

  return [
    isKinded(left, TypeEffectKind.RecursiveVar)
      ? left
      : TypeEff(left.type, SenvUtils.scale(left.effect, factor)),
    isKinded(right, TypeEffectKind.RecursiveVar)
      ? right
      : TypeEff(right.type, SenvUtils.scale(right.effect, factor)),
  ];
};

export const scaleInf = (ev: Evidence): Evidence => {
  return scale(ev, SensUtils.MAX_SENS);
};

export const subst = (ev: Evidence, name: string, senv: Senv): Evidence => {
  return [
    TypeEffUtils.subst(ev[0], name, senv),
    TypeEffUtils.subst(ev[1], name, senv),
  ];
};

// export const substTup = (
//   ev: Evidence,
//   names: [string, string],
//   latents: [Senv, Senv],
//   senv: Senv,
// ): Evidence => {
//   return [
//     TypeEffUtils.substTup(ev[0], names, latents, senv),
//     TypeEffUtils.substTup(ev[1], names, latents, senv),
//   ];
// };

export const format = ([teff1, teff2]: Evidence): string => {
  return `⟨${TypeEffUtils.format(teff1)}, ${TypeEffUtils.format(teff2)}⟩`;
};
