import { flatten } from 'ramda';
import { Type } from '..';
import { TypeKind } from '../Type';
import { TypeEffect, TypeEffectKind } from '../TypeEff';

const typeFreeVars = (ty: Type): string[] => {
  switch (ty.kind) {
    case TypeKind.Real:
    case TypeKind.Nil:
    case TypeKind.Bool:
      return [];
    case TypeKind.Arrow:
      return typeEffectFreeVars(ty.domain).concat(
        typeEffectFreeVars(ty.codomain),
      );
    case TypeKind.Product:
      return flatten(
        ty.typeEffects.map((typeEffect) => typeEffectFreeVars(typeEffect)),
      );
    case TypeKind.ForallT:
      return typeEffectFreeVars(ty.codomain);
    case TypeKind.RecType: {
      const bodyFreeVars = typeEffectFreeVars(ty.body);

      return bodyFreeVars.filter((alpha) => alpha !== ty.variable);
    }
    case TypeKind.MProduct:
    case TypeKind.AProduct:
      return [];
  }
};

const typeEffectFreeVars = (teff: TypeEffect): string[] => {
  switch (teff.kind) {
    case TypeEffectKind.RecursiveVar:
      return [teff.name];
    case TypeEffectKind.TypeEff:
      return typeFreeVars(teff.type);
  }
};

const FreeRecVars = {
  Type: typeFreeVars,
  TypeEffect: typeEffectFreeVars,
};

export default FreeRecVars;