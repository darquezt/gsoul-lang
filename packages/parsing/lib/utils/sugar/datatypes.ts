import { TypeEff, Senv } from '@gsoul-lang/core/utils';
import { Product, Atom, RecType, Sum } from '@gsoul-lang/core/utils/Type';
import { TypeEffect } from '@gsoul-lang/core/utils/TypeEff';
import {
  VarStmt,
  Fun,
  Fold,
  Inj,
  Tuple,
  AtomLiteral,
  Variable,
  Expression,
  Block,
  ExprStmt,
  Projection,
} from '../../ast';
import { Token, TokenType } from '../../lexing';

type DataTypeConstructor = {
  name: Token;
  args: TypeEffect[];
};

export function createDataConstructorProduct(
  name: Token,
  dataConstructor: DataTypeConstructor,
): TypeEff {
  return TypeEff(
    Product({
      typeEffects: [
        TypeEff(
          Atom({
            name: name.lexeme,
          }),
          Senv(),
        ),
        TypeEff(
          Atom({
            name: dataConstructor.name.lexeme,
          }),
          Senv(),
        ),
        ...dataConstructor.args,
      ],
    }),
    Senv(),
  );
}

/**
 *
 * @param products array of product types with at least two elements
 */
export function createDataconstructorSum(products: TypeEff[]): TypeEff {
  return TypeEff(
    Sum({
      typeEffects: products,
    }),
    Senv(),
  );
}

/**
 * @param name name of the data type
 * @param recType desugared recursive type of the datatype
 * @param dataConstructor specific data constructor
 * @param products array of product types with at least two elements
 * @param index index of the data constructor in the products array
 */
export function createDataConstructorFunction(
  name: Token,
  recType: RecType,
  dataConstructor: DataTypeConstructor,
  products: TypeEff[],
  index: number,
): VarStmt {
  const tuple = Tuple({
    constructorToken: name,
    expressions: [
      AtomLiteral({
        name,
      }),
      AtomLiteral({
        name: dataConstructor.name,
      }),
      ...dataConstructor.args.map((_arg, index) => {
        return Variable({
          name: new Token(TokenType.IDENTIFIER, `x${index}`, null, 0, 0),
        });
      }),
    ],
  });

  const foldBody = Inj({
    index,
    injToken: dataConstructor.name,
    types: products
      .filter((_, i) => i !== index)
      .map((product) => product.type),
    expression: tuple,
  });

  return VarStmt({
    resource: false,
    name: dataConstructor.name,
    assignment: Fun({
      binders: dataConstructor.args.map((arg, index) => ({
        name: new Token(TokenType.IDENTIFIER, `x${index}`, null, 0, 0),
        type: arg,
      })),
      body: Fold({
        dataTypeAlias: dataConstructor.name.lexeme,
        recType: TypeEff(recType, Senv()),
        foldToken: name,
        expression: foldBody,
      }),
    }),
  });
}

export const createMatchBranchBody = (
  expr: Expression,
  identifier: Token,
  variables: Token[],
): Expression => {
  const block = Block({
    statements: [
      ...variables.map((variable, index) =>
        VarStmt({
          resource: false,
          name: variable,
          assignment: Projection({
            tuple: Variable({
              name: identifier,
            }),
            projectToken: variable,
            index: index + 2,
          }),
        }),
      ),
      ExprStmt({
        expression: expr,
      }),
    ],
  });

  return block;
};
