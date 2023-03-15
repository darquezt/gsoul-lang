import { zip } from 'ramda';
import { Type } from '..';
import { isKinded } from '../ADT';
import { TypeKind } from '../Type';
import { TypeEffect, TypeEffectKind } from '../TypeEff';
import Meet from './Meet';
import FreeRecVars from './RecursiveFreeVars';

export enum RecursivePolarityMode {
  NEGATIVE = 'NEGATIVE',
  POSITIVE = 'POSITIVE',
}

const flipMode = (mode: RecursivePolarityMode) =>
  mode === RecursivePolarityMode.POSITIVE
    ? RecursivePolarityMode.NEGATIVE
    : RecursivePolarityMode.POSITIVE;

/**
 * α ∈ₘ g₁ <: g₂
 */
const typeCheckPolarity = (
  variable: string,
  mode: RecursivePolarityMode,
  ty1: Type,
  ty2: Type,
): boolean => {
  if (isKinded(ty1, TypeKind.Real) && isKinded(ty2, TypeKind.Real)) {
    return true;
  }

  if (isKinded(ty1, TypeKind.Nil) && isKinded(ty2, TypeKind.Nil)) {
    return true;
  }

  if (isKinded(ty1, TypeKind.Bool) && isKinded(ty2, TypeKind.Bool)) {
    return true;
  }

  if (isKinded(ty1, TypeKind.Arrow) && isKinded(ty2, TypeKind.Arrow)) {
    const domChecks = zip(ty1.domain, ty2.domain).map(([d1, d2]) =>
      typeEffectCheckPolarity(variable, flipMode(mode), d1, d2),
    );

    const allDomAreSound = !domChecks.includes(false);

    return (
      allDomAreSound &&
      typeEffectCheckPolarity(variable, mode, ty1.codomain, ty2.codomain)
    );
  }

  if (isKinded(ty1, TypeKind.Product) && isKinded(ty2, TypeKind.Product)) {
    if (ty1.typeEffects.length !== ty2.typeEffects.length) {
      return false;
    }

    const inductiveChecks = zip(ty1.typeEffects, ty2.typeEffects).map(
      ([tyEff1, tyEff2]) =>
        typeEffectCheckPolarity(variable, mode, tyEff1, tyEff2),
    );

    return !inductiveChecks.includes(false);
  }

  if (isKinded(ty1, TypeKind.ForallT) && isKinded(ty2, TypeKind.ForallT)) {
    if (ty1.sensVars.length !== ty2.sensVars.length) {
      return false;
    }

    return typeEffectCheckPolarity(variable, mode, ty1.codomain, ty2.codomain);
  }

  if (isKinded(ty1, TypeKind.RecType) && isKinded(ty2, TypeKind.RecType)) {
    if (ty1.variable !== ty2.variable) {
      return false;
    }

    const bodyMeets = Meet.TypeEffect(ty1.body, ty2.body);
    const bodyFreeVars = bodyMeets.map((teff) => FreeRecVars.TypeEffect(teff));

    /**
     * WPR-REC-EQ
     */
    if (bodyFreeVars.isOk && !bodyFreeVars.value.includes(ty1.variable)) {
      return true;
    }

    const variablesAreDifferent = variable !== ty1.variable;
    const variablePolarityCheck = typeEffectCheckPolarity(
      variable,
      mode,
      ty1.body,
      ty2.body,
    );
    const recursivePositivitycheck = typeEffectCheckPolarity(
      ty1.variable,
      RecursivePolarityMode.POSITIVE,
      ty1.body,
      ty2.body,
    );

    /**
     * WPR-REC-NEQ
     */
    return (
      variablesAreDifferent && variablePolarityCheck && recursivePositivitycheck
    );
  }

  return false;
};

/**
 * α ∈ₘ G₁ <: G₂
 */
const typeEffectCheckPolarity = (
  variable: string,
  mode: RecursivePolarityMode,
  teff1: TypeEffect,
  teff2: TypeEffect,
): boolean => {
  if (
    isKinded(teff1, TypeEffectKind.RecursiveVar) &&
    isKinded(teff2, TypeEffectKind.RecursiveVar)
  ) {
    if (teff1.name !== teff2.name) {
      return false;
    }

    if (teff1.name !== variable) {
      return true;
    }

    return mode === RecursivePolarityMode.POSITIVE;
  }

  if (
    isKinded(teff1, TypeEffectKind.TypeEff) &&
    isKinded(teff2, TypeEffectKind.TypeEff)
  ) {
    return typeCheckPolarity(variable, mode, teff1.type, teff2.type);
  }

  return false;
};

const RecursivePolarityCheck = {
  Type: typeCheckPolarity,
  TypeEffect: typeEffectCheckPolarity,
};

export default RecursivePolarityCheck;
