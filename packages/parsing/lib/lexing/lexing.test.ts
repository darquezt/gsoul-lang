import { scanTokens } from './lexing';
import Token from './Token';
import TokenType from './TokenType';

const withEOF = (tokens: Token[]) => {
  const lastToken: Token | null = tokens[tokens.length - 1];

  const col = lastToken ? lastToken.col + lastToken.lexeme.length : 1;
  const line = lastToken ? lastToken.line : 1;

  return [...tokens, new Token(TokenType.EOF, 'end', null, line, col)];
};

describe('Lexing', () => {
  describe('types', () => {
    test('The unknown sensitivity', () => {
      expect(scanTokens('?')).toStrictEqual<Token[]>(
        withEOF([new Token(TokenType.QUESTION, '?', null, 1, 1)]),
      );
    });

    test('A sensitivity environment', () => {
      expect(scanTokens('[2x + 3y]')).toStrictEqual<Token[]>(
        withEOF([
          new Token(TokenType.LEFT_BRACKET, '[', null, 1, 1),
          new Token(TokenType.NUMBERLIT, '2', 2, 1, 2),
          new Token(TokenType.IDENTIFIER, 'x', null, 1, 3),
          new Token(TokenType.PLUS, '+', null, 1, 5),
          new Token(TokenType.NUMBERLIT, '3', 3, 1, 7),
          new Token(TokenType.IDENTIFIER, 'y', null, 1, 8),
          new Token(TokenType.RIGHT_BRACKET, ']', null, 1, 9),
        ]),
      );
    });

    test('An arrow type', () => {
      expect(scanTokens('Number![] -> Bool![]')).toStrictEqual<Token[]>(
        withEOF([
          new Token(TokenType.NUMBER, 'Number', null, 1, 1),
          new Token(TokenType.BANG, '!', null, 1, 7),
          new Token(TokenType.LEFT_BRACKET, '[', null, 1, 8),
          new Token(TokenType.RIGHT_BRACKET, ']', null, 1, 9),
          new Token(TokenType.ARROW, '->', null, 1, 11),
          new Token(TokenType.BOOL, 'Bool', null, 1, 14),
          new Token(TokenType.BANG, '!', null, 1, 18),
          new Token(TokenType.LEFT_BRACKET, '[', null, 1, 19),
          new Token(TokenType.RIGHT_BRACKET, ']', null, 1, 20),
        ]),
      );
    });
  });

  // (x:Number -> Bool@[2x + 3y])

  describe('primaries', () => {
    test('An integer', () => {
      expect(scanTokens('2')).toStrictEqual<Token[]>(
        withEOF([new Token(TokenType.NUMBERLIT, '2', 2, 1, 1)]),
      );
    });

    test('A floating point', () => {
      expect(scanTokens('21.34')).toStrictEqual<Token[]>(
        withEOF([new Token(TokenType.NUMBERLIT, '21.34', 21.34, 1, 1)]),
      );
    });

    test('true keyword', () => {
      expect(scanTokens('true')).toStrictEqual<Token[]>(
        withEOF([new Token(TokenType.TRUE, 'true', null, 1, 1)]),
      );
    });

    test('false keyword', () => {
      expect(scanTokens('false')).toStrictEqual<Token[]>(
        withEOF([new Token(TokenType.FALSE, 'false', null, 1, 1)]),
      );
    });

    test('An identifier', () => {
      expect(scanTokens('someVarname1')).toStrictEqual<Token[]>(
        withEOF([new Token(TokenType.IDENTIFIER, 'someVarname1', null, 1, 1)]),
      );
    });

    test('A function', () => {
      expect(scanTokens('fun (x : Number![1x]) { x; }')).toStrictEqual<Token[]>(
        withEOF([
          new Token(TokenType.FUN, 'fun', null, 1, 1),
          new Token(TokenType.LEFT_PAREN, '(', null, 1, 5),
          new Token(TokenType.IDENTIFIER, 'x', null, 1, 6),
          new Token(TokenType.COLON, ':', null, 1, 8),
          new Token(TokenType.NUMBER, 'Number', null, 1, 10),
          new Token(TokenType.BANG, '!', null, 1, 16),
          new Token(TokenType.LEFT_BRACKET, '[', null, 1, 17),
          new Token(TokenType.NUMBERLIT, '1', 1, 1, 18),
          new Token(TokenType.IDENTIFIER, 'x', null, 1, 19),
          new Token(TokenType.RIGHT_BRACKET, ']', null, 1, 20),
          new Token(TokenType.RIGHT_PAREN, ')', null, 1, 21),
          new Token(TokenType.LEFT_BRACE, '{', null, 1, 23),
          new Token(TokenType.IDENTIFIER, 'x', null, 1, 25),
          new Token(TokenType.SEMICOLON, ';', null, 1, 26),
          new Token(TokenType.RIGHT_BRACE, '}', null, 1, 28),
        ]),
      );
    });
  });

  describe('expressions', () => {
    test('A multiplication', () => {
      expect(scanTokens('x * 2')).toStrictEqual<Token[]>(
        withEOF([
          new Token(TokenType.IDENTIFIER, 'x', null, 1, 1),
          new Token(TokenType.STAR, '*', null, 1, 3),
          new Token(TokenType.NUMBERLIT, '2', 2, 1, 5),
        ]),
      );
    });

    test('A (leq) comparison', () => {
      expect(scanTokens('x <= 2')).toStrictEqual<Token[]>(
        withEOF([
          new Token(TokenType.IDENTIFIER, 'x', null, 1, 1),
          new Token(TokenType.LESS_EQUAL, '<=', null, 1, 3),
          new Token(TokenType.NUMBERLIT, '2', 2, 1, 6),
        ]),
      );
    });

    test('An ascription', () => {
      expect(scanTokens('x :: Number![]')).toStrictEqual<Token[]>(
        withEOF([
          new Token(TokenType.IDENTIFIER, 'x', null, 1, 1),
          new Token(TokenType.COLON_COLON, '::', null, 1, 3),
          new Token(TokenType.NUMBER, 'Number', null, 1, 6),
          new Token(TokenType.BANG, '!', null, 1, 12),
          new Token(TokenType.LEFT_BRACKET, '[', null, 1, 13),
          new Token(TokenType.RIGHT_BRACKET, ']', null, 1, 14),
        ]),
      );
    });
  });

  describe('statements', () => {
    test('A print statement', () => {
      expect(scanTokens('print 2;')).toStrictEqual<Token[]>(
        withEOF([
          new Token(TokenType.PRINT, 'print', null, 1, 1),
          new Token(TokenType.NUMBERLIT, '2', 2, 1, 7),
          new Token(TokenType.SEMICOLON, ';', null, 1, 8),
        ]),
      );
    });
  });

  describe('declarations', () => {
    test('A var declaration', () => {
      expect(scanTokens('let x = 2;')).toStrictEqual<Token[]>(
        withEOF([
          new Token(TokenType.LET, 'let', null, 1, 1),
          new Token(TokenType.IDENTIFIER, 'x', null, 1, 5),
          new Token(TokenType.EQUAL, '=', null, 1, 7),
          new Token(TokenType.NUMBERLIT, '2', 2, 1, 9),
          new Token(TokenType.SEMICOLON, ';', null, 1, 10),
        ]),
      );
    });

    test('A sensitive var declaration', () => {
      expect(scanTokens('slet x = 2;')).toStrictEqual<Token[]>(
        withEOF([
          new Token(TokenType.SLET, 'slet', null, 1, 1),
          new Token(TokenType.IDENTIFIER, 'x', null, 1, 6),
          new Token(TokenType.EQUAL, '=', null, 1, 8),
          new Token(TokenType.NUMBERLIT, '2', 2, 1, 10),
          new Token(TokenType.SEMICOLON, ';', null, 1, 11),
        ]),
      );
    });

    test('Several declarations', () => {
      const program = 'let x = 2;\nprint 2';

      expect(scanTokens(program)).toStrictEqual<Token[]>(
        withEOF([
          new Token(TokenType.LET, 'let', null, 1, 1),
          new Token(TokenType.IDENTIFIER, 'x', null, 1, 5),
          new Token(TokenType.EQUAL, '=', null, 1, 7),
          new Token(TokenType.NUMBERLIT, '2', 2, 1, 9),
          new Token(TokenType.SEMICOLON, ';', null, 1, 10),

          new Token(TokenType.PRINT, 'print', null, 2, 1),
          new Token(TokenType.NUMBERLIT, '2', 2, 2, 7),
        ]),
      );
    });
  });
});
