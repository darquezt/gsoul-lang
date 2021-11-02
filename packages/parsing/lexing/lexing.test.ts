import { scanTokens } from './lexing';
import Token from './Token';
import TokenType from './TokenType';

const withEOF = (tokens: Token[]) => [
  ...tokens,
  new Token(TokenType.EOF, 'end', null, 1),
];

describe('Lexing types', () => {
  test('The unknown sensitivity', () => {
    expect(scanTokens('?')).toStrictEqual<Token[]>(
      withEOF([new Token(TokenType.QUESTION, '?', null, 1)]),
    );
  });

  test('A sensitivity environment', () => {
    expect(scanTokens('@[2x + 3y]')).toStrictEqual<Token[]>(
      withEOF([
        new Token(TokenType.AT, '@', null, 1),
        new Token(TokenType.LEFT_BRACKET, '[', null, 1),
        new Token(TokenType.NUMBERLIT, '2', 2, 1),
        new Token(TokenType.IDENTIFIER, 'x', null, 1),
        new Token(TokenType.PLUS, '+', null, 1),
        new Token(TokenType.NUMBERLIT, '3', 3, 1),
        new Token(TokenType.IDENTIFIER, 'y', null, 1),
        new Token(TokenType.RIGHT_BRACKET, ']', null, 1),
      ]),
    );
  });

  test('An arrow type', () => {
    expect(scanTokens('(x:Number -> Bool@[])')).toStrictEqual<Token[]>(
      withEOF([
        new Token(TokenType.LEFT_PAREN, '(', null, 1),
        new Token(TokenType.IDENTIFIER, 'x', null, 1),
        new Token(TokenType.COLON, ':', null, 1),
        new Token(TokenType.NUMBER, 'Number', null, 1),
        new Token(TokenType.ARROW, '->', null, 1),
        new Token(TokenType.BOOL, 'Bool', null, 1),
        new Token(TokenType.AT, '@', null, 1),
        new Token(TokenType.LEFT_BRACKET, '[', null, 1),
        new Token(TokenType.RIGHT_BRACKET, ']', null, 1),
        new Token(TokenType.RIGHT_PAREN, ')', null, 1),
      ]),
    );
  });
});

// (x:Number -> Bool@[2x + 3y])

describe('Lexing primaries', () => {
  test('An integer', () => {
    expect(scanTokens('2')).toStrictEqual<Token[]>(
      withEOF([new Token(TokenType.NUMBERLIT, '2', 2, 1)]),
    );
  });

  test('A floating point', () => {
    expect(scanTokens('21.34')).toStrictEqual<Token[]>(
      withEOF([new Token(TokenType.NUMBERLIT, '21.34', 21.34, 1)]),
    );
  });

  test('true keyword', () => {
    expect(scanTokens('true')).toStrictEqual<Token[]>(
      withEOF([new Token(TokenType.TRUE, 'true', null, 1)]),
    );
  });

  test('false keyword', () => {
    expect(scanTokens('false')).toStrictEqual<Token[]>(
      withEOF([new Token(TokenType.FALSE, 'false', null, 1)]),
    );
  });

  test('An identifier', () => {
    expect(scanTokens('someVarname1')).toStrictEqual<Token[]>(
      withEOF([new Token(TokenType.IDENTIFIER, 'someVarname1', null, 1)]),
    );
  });

  test('A function', () => {
    expect(scanTokens('fun(x:Number) {x;}')).toStrictEqual<Token[]>(
      withEOF([
        new Token(TokenType.FUN, 'fun', null, 1),
        new Token(TokenType.LEFT_PAREN, '(', null, 1),
        new Token(TokenType.IDENTIFIER, 'x', null, 1),
        new Token(TokenType.COLON, ':', null, 1),
        new Token(TokenType.NUMBER, 'Number', null, 1),
        new Token(TokenType.RIGHT_PAREN, ')', null, 1),
        new Token(TokenType.LEFT_BRACE, '{', null, 1),
        new Token(TokenType.IDENTIFIER, 'x', null, 1),
        new Token(TokenType.SEMICOLON, ';', null, 1),
        new Token(TokenType.RIGHT_BRACE, '}', null, 1),
      ]),
    );
  });
});

describe('Lexing expressions', () => {
  test('A multiplication', () => {
    expect(scanTokens('x * 2')).toStrictEqual<Token[]>(
      withEOF([
        new Token(TokenType.IDENTIFIER, 'x', null, 1),
        new Token(TokenType.STAR, '*', null, 1),
        new Token(TokenType.NUMBERLIT, '2', 2, 1),
      ]),
    );
  });

  test('A (leq) comparison', () => {
    expect(scanTokens('x <= 2')).toStrictEqual<Token[]>(
      withEOF([
        new Token(TokenType.IDENTIFIER, 'x', null, 1),
        new Token(TokenType.LESS_EQUAL, '<=', null, 1),
        new Token(TokenType.NUMBERLIT, '2', 2, 1),
      ]),
    );
  });

  test('An ascription', () => {
    expect(scanTokens('x :: Number@[]')).toStrictEqual<Token[]>(
      withEOF([
        new Token(TokenType.IDENTIFIER, 'x', null, 1),
        new Token(TokenType.COLON_COLON, '::', null, 1),
        new Token(TokenType.NUMBER, 'Number', null, 1),
        new Token(TokenType.AT, '@', null, 1),
        new Token(TokenType.LEFT_BRACKET, '[', null, 1),
        new Token(TokenType.RIGHT_BRACKET, ']', null, 1),
      ]),
    );
  });
});

describe('Lexing statements', () => {
  test('A print statement', () => {
    expect(scanTokens('print 2;')).toStrictEqual<Token[]>(
      withEOF([
        new Token(TokenType.PRINT, 'print', null, 1),
        new Token(TokenType.NUMBERLIT, '2', 2, 1),
        new Token(TokenType.SEMICOLON, ';', null, 1),
      ]),
    );
  });
});

describe('Lexing declarations', () => {
  test('A var declaration', () => {
    expect(scanTokens('var x = 2;')).toStrictEqual<Token[]>(
      withEOF([
        new Token(TokenType.VAR, 'var', null, 1),
        new Token(TokenType.IDENTIFIER, 'x', null, 1),
        new Token(TokenType.EQUAL, '=', null, 1),
        new Token(TokenType.NUMBERLIT, '2', 2, 1),
        new Token(TokenType.SEMICOLON, ';', null, 1),
      ]),
    );
  });
});
