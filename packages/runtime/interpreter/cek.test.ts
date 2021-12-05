import Token from '@gsens-lang/parsing/lexing/Token';
import TokenType from '@gsens-lang/parsing/lexing/TokenType';
import { Sens, Senv, TypeEff } from '@gsens-lang/core/utils';
import { MaxSens } from '@gsens-lang/core/utils/Sens';
import { Arrow, Real } from '@gsens-lang/core/utils/Type';
import {
  Ascription,
  Binary,
  Block,
  Call,
  ExprStmt,
  Fun,
  NonLinearBinary,
  Print,
  RealLiteral,
  Variable,
} from '../elaboration/ast';
import { initialEvidence } from '../utils/Evidence';
import { evaluate } from './cek';
import { Ok } from '../utils/Result';

const RealEmptySenv = TypeEff(Real(), Senv());

const variableToken = (name: string, line = 1, col = 1): Token =>
  new Token(TokenType.IDENTIFIER, name, null, line, col);

describe('CEK', () => {
  test('function application', () => {
    const body = Block({
      statements: [
        Print({
          expression: Variable({
            name: variableToken('x'),
            typeEff: RealEmptySenv,
          }),
          showEvidence: false,
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
      typeEff: RealEmptySenv,
    });

    const fun = Ascription({
      expression: Fun({
        binder: {
          name: variableToken('x'),
          type: Real(),
        },
        body,
        typeEff: {
          type: Arrow({
            binder: {
              identifier: 'x',
              type: Real(),
            },
            returnTypeEff: RealEmptySenv,
          }),
          effect: Senv(),
        },
      }),
      typeEff: TypeEff(
        Arrow({
          binder: {
            identifier: 'x',
            type: Real(),
          },
          returnTypeEff: RealEmptySenv,
        }),
        Senv(),
      ),
      evidence: initialEvidence(
        TypeEff(
          Arrow({
            binder: {
              identifier: 'x',
              type: Real(),
            },
            returnTypeEff: RealEmptySenv,
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
      arg,
      typeEff: RealEmptySenv,
      paren: new Token(TokenType.RIGHT_PAREN, ')', null, 1, 1),
    });

    const val = evaluate(app);

    const result = Ok(
      Ascription({
        expression: {
          kind: 'RealLiteral',
          typeEff: { type: Real(), effect: Senv() },
          value: 4,
        },
        typeEff: { type: Real(), effect: Senv() },
        evidence: initialEvidence({ type: Real(), effect: Senv() }),
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

    const result = Ok(
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

    const leftTypeEff = TypeEff(Real(), Senv({ x: Sens(1) }));
    const rightTypeEff = TypeEff(Real(), Senv({ y: Sens(2) }));

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

    const result = Ok(
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
