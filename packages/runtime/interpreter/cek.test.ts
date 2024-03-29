import { Token, TokenType } from '@gsoul-lang/parsing/lib/lexing';
import { Sens, Senv, TypeEff } from '@gsoul-lang/core/utils';
import { MaxSens } from '@gsoul-lang/core/utils/Sens';
import { Arrow, Real } from '@gsoul-lang/core/utils/Type';
import {
  Ascription,
  Binary,
  Block,
  Call,
  ExprStmt,
  Fun,
  NonLinearBinary,
  RealLiteral,
  Variable,
} from '../elaboration/ast';
import { initialEvidence } from '../utils/Evidence';
import { evaluate } from './cek';
import { Result } from '@badrap/result';
import { TypeEffectKind } from '@gsoul-lang/core/utils/TypeEff';

const RealEmptySenv = TypeEff(Real(), Senv());

const variableToken = (name: string, line = 1, col = 1): Token =>
  new Token(TokenType.IDENTIFIER, name, null, line, col);

describe('CEK', () => {
  test('function application', () => {
    const body = Block({
      statements: [
        ExprStmt({
          expression: Variable({
            name: variableToken('x'),
            typeEff: RealEmptySenv,
          }),
          typeEff: RealEmptySenv,
        }),
        ExprStmt({
          expression: Ascription({
            expression: RealLiteral({
              value: 4,
            }),
            typeEff: RealEmptySenv,
            evidence: initialEvidence(RealEmptySenv),
          }),
          typeEff: RealEmptySenv,
        }),
      ],
      resources: [],
      typeEff: RealEmptySenv,
    });

    // fix this test
    const fun = Ascription({
      expression: Fun({
        binders: [
          {
            name: variableToken('x'),
            type: RealEmptySenv,
          },
        ],
        body,
        typeEff: {
          kind: TypeEffectKind.TypeEff,
          type: Arrow({
            domain: [RealEmptySenv],
            codomain: RealEmptySenv,
          }),
          effect: Senv(),
        },
      }),
      typeEff: TypeEff(
        Arrow({
          domain: [RealEmptySenv],
          codomain: RealEmptySenv,
        }),
        Senv(),
      ),
      evidence: initialEvidence(
        TypeEff(
          Arrow({
            domain: [RealEmptySenv],
            codomain: RealEmptySenv,
          }),
          Senv(),
        ),
      ),
    });

    const arg = Ascription({
      evidence: initialEvidence(RealEmptySenv),
      expression: RealLiteral({ value: 2 }),
      typeEff: RealEmptySenv,
    });

    const app = Call({
      callee: fun,
      args: [arg],
      typeEff: RealEmptySenv,
      paren: new Token(TokenType.RIGHT_PAREN, ')', null, 1, 1),
    });

    const val = evaluate(app);

    const result = Result.ok(
      Ascription({
        expression: RealLiteral({
          value: 4,
        }),
        typeEff: { kind: TypeEffectKind.TypeEff, type: Real(), effect: Senv() },
        evidence: initialEvidence({
          kind: TypeEffectKind.TypeEff,
          type: Real(),
          effect: Senv(),
        }),
      }),
    );

    expect(val).toStrictEqual(result);
  });

  test('Simple binary op', () => {
    const leftInner = 2;
    const rightInner = 7;

    const left = Ascription({
      expression: RealLiteral({
        value: leftInner,
      }),
      typeEff: RealEmptySenv,
      evidence: initialEvidence(RealEmptySenv),
    });

    const right = Ascription({
      expression: RealLiteral({
        value: rightInner,
      }),
      typeEff: RealEmptySenv,
      evidence: initialEvidence(RealEmptySenv),
    });

    const sum = Binary({
      left,
      right,
      operator: new Token(TokenType.PLUS, '+', null, 1, 1),
      typeEff: RealEmptySenv,
    });

    const val = evaluate(sum);

    const result = Result.ok(
      Ascription({
        expression: RealLiteral({
          value: leftInner + rightInner,
        }),
        typeEff: RealEmptySenv,
        evidence: initialEvidence(RealEmptySenv),
      }),
    );

    expect(val).toStrictEqual(result);
  });

  test('Simple non-linear binary op', () => {
    const leftInner = 2;
    const rightInner = 7;

    const leftTypeEff = TypeEff(Real(), Senv({ x: new Sens(1) }));
    const rightTypeEff = TypeEff(Real(), Senv({ y: new Sens(2) }));

    const left = Ascription({
      expression: RealLiteral({
        value: leftInner,
      }),
      typeEff: leftTypeEff,
      evidence: [RealEmptySenv, leftTypeEff],
    });

    const right = Ascription({
      expression: RealLiteral({
        value: rightInner,
      }),
      typeEff: rightTypeEff,
      evidence: [RealEmptySenv, rightTypeEff],
    });

    const sum = NonLinearBinary({
      left,
      right,
      operator: new Token(TokenType.STAR, '*', null, 1, 1),
      typeEff: TypeEff(Real(), Senv({ x: MaxSens(), y: MaxSens() })),
    });

    const val = evaluate(sum);

    const result = Result.ok(
      Ascription({
        expression: RealLiteral({
          value: leftInner * rightInner,
        }),
        typeEff: sum.typeEff,
        evidence: [RealEmptySenv, sum.typeEff],
      }),
    );

    expect(val).toStrictEqual(result);
  });
});
