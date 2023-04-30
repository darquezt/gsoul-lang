import { SenvUtils, Type } from '..';
import { TypeKind } from '../Type';
import { TypeEffect, TypeEffectKind } from '../TypeEff';

export enum Directive {
  Pure = 'Pure',
}

const checkTypePure = (type: Type): boolean => {
  switch (type.kind) {
    case TypeKind.Arrow:
      return (
        type.domain.every(checkTypeEffPure) && checkTypeEffPure(type.codomain)
      );
    case TypeKind.Product:
      return type.typeEffects.every(checkTypeEffPure);
    case TypeKind.Sum:
      return type.typeEffects.every(checkTypeEffPure);
    case TypeKind.ForallT:
      return checkTypeEffPure(type.codomain);
    case TypeKind.PolyT:
      return checkTypeEffPure(type.codomain);
    case TypeKind.RecType:
      return checkTypeEffPure(type.body);
    case TypeKind.MProduct:
    case TypeKind.AProduct:
      return checkTypeEffPure(type.first) && checkTypeEffPure(type.second);
    case TypeKind.Atom:
    case TypeKind.Real:
    case TypeKind.Nil:
    case TypeKind.Bool:
      return true;
  }
};

const checkTypeEffPure = (teff: TypeEffect): boolean => {
  switch (teff.kind) {
    case TypeEffectKind.TypeVar:
      return false;
    case TypeEffectKind.TypeEff:
      return checkTypePure(teff.type) && SenvUtils.isEmpty(teff.effect);
  }
};

export const PureDirective = {
  TypeEff: checkTypeEffPure,
};
