import Token, { TokenLiteral } from './Token';
import TokenType from './TokenType';

/**
 * A mapping between source keywords and their corresponding TokenTypes
 */
const keywords: Record<string, TokenType> = {
  true: TokenType.TRUE,
  false: TokenType.FALSE,
  nil: TokenType.NILLIT,
  Nil: TokenType.NIL,
  let: TokenType.LET,
  sens: TokenType.SENSITIVE,
  print: TokenType.PRINT,
  printEv: TokenType.PRINTEV,
  Number: TokenType.NUMBER,
  Bool: TokenType.BOOL,
  fn: TokenType.FUN,
  forall: TokenType.FORALL,
  Forall: TokenType.FORALLT,
  Tuple: TokenType.TUPLE,
  in: TokenType.IN,
  Pair: TokenType.PAIR,
  fst: TokenType.FST,
  snd: TokenType.SND,
  fold: TokenType.FOLD,
  unfold: TokenType.UNFOLD,
  rec: TokenType.RECTYPE,
  if: TokenType.IF,
  then: TokenType.THEN,
  else: TokenType.ELSE,
  inl: TokenType.INL,
  inr: TokenType.INR,
  case: TokenType.CASE,
  of: TokenType.OF,
  type: TokenType.TYPE,
};

/**
 * A.k.a the lexer function
 *
 * @param source A piece of code
 * @returns A list of the scanned tokens from the source
 */
export const scanTokens = (source: string): Token[] => {
  const tokens: Token[] = [];
  let start = 0;
  let current = 0;
  let line = 1;
  let col = 1;

  // ===================
  // BEGIN LOCAL UTILITY FUNCTIONS
  // ===================

  const isAtEnd = (): boolean => current >= source.length;

  function scanToken() {
    const c = advance();

    switch (c) {
      case '(':
        addToken(TokenType.LEFT_PAREN);
        break;
      case ')':
        addToken(TokenType.RIGHT_PAREN);
        break;
      case '{':
        addToken(TokenType.LEFT_BRACE);
        break;
      case '}':
        addToken(TokenType.RIGHT_BRACE);
        break;
      case '[':
        addToken(TokenType.LEFT_BRACKET);
        break;
      case ']':
        addToken(TokenType.RIGHT_BRACKET);
        break;
      case '?':
        addToken(TokenType.QUESTION);
        break;
      case ',':
        addToken(TokenType.COMMA);
        break;
      case '.':
        addToken(TokenType.DOT);
        break;
      case '-':
        addToken(match('>') ? TokenType.ARROW : TokenType.MINUS);
        break;
      case ':': {
        if (match(':')) {
          addToken(TokenType.COLON_COLON);
        } else if (isAlpha(peek())) {
          atom();
        } else {
          addToken(TokenType.COLON);
        }
        break;
      }
      case ';':
        addToken(TokenType.SEMICOLON);
        break;
      case '@':
        addToken(TokenType.AT);
        break;
      case '*':
        addToken(TokenType.STAR);
        break;
      case '+': {
        addToken(match('+') ? TokenType.PLUS_PLUS : TokenType.PLUS);
        break;
      }
      case '!': {
        addToken(match('=') ? TokenType.BANG_EQUAL : TokenType.BANG);
        break;
      }
      case '=': {
        if (match('=')) {
          addToken(TokenType.EQUAL_EQUAL);
        } else if (match('>')) {
          addToken(TokenType.FAT_ARROW);
        } else {
          addToken(TokenType.EQUAL);
        }
        break;
      }
      case '<': {
        addToken(match('=') ? TokenType.LESS_EQUAL : TokenType.LESS);
        break;
      }
      case '>': {
        addToken(match('=') ? TokenType.GREATER_EQUAL : TokenType.GREATER);
        break;
      }
      case '/': {
        if (match('/')) {
          while (peek() !== '\n' && !isAtEnd()) {
            advance();
          }
        } else {
          addToken(TokenType.SLASH);
        }
        break;
      }
      case '\\': {
        addToken(TokenType.BACKSLASH);
        break;
      }
      case ' ':
      case '\r':
      case '\t':
        col += c.length;
        break;
      case '\n':
        line++;
        col = 1;
        break;
      // case '"':
      //   string();
      //   break;
      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        number();
        break;
      default: {
        if (isDigit(c)) {
          number();
        } else if (isAlpha(c)) {
          identifier();
        } else {
          addToken(TokenType.INVALID);
        }
        break;
      }
    }
  }

  // function string(): void {
  //   while (peek() !== '"' && !isAtEnd()) {
  //     if (peek() === '\n') {
  //       line++;
  //     }

  //     advance();
  //   }

  //   if (isAtEnd()) {
  //     reportError(line, '', 'Unterminated string');
  //   }

  //   advance();

  //   // This is the moment to escape special characters!
  //   const value = source.slice(start + 1, current - 1);

  //   addToken(TokenType.STRING, value);
  // }

  function number(): void {
    while (isDigit(peek())) {
      advance();
    }

    if (peek() === '.' && isDigit(peekNext())) {
      advance();

      while (isDigit(peek())) {
        advance();
      }
    }

    addToken(TokenType.NUMBERLIT, Number(getLexeme()));
  }

  function atom(): void {
    while (isAlphaNumeric(peek())) {
      advance();
    }

    const name = getLexeme().slice(1);

    addToken(TokenType.ATOM, name);
  }

  function identifier(): void {
    while (isAlphaNumeric(peek())) {
      advance();
    }

    const lexeme = getLexeme();
    const tokenType = keywords[lexeme] ?? TokenType.IDENTIFIER;

    addToken(tokenType);
  }

  function isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  function isAlpha(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
  }

  function isAlphaNumeric(c: string): boolean {
    return isDigit(c) || isAlpha(c);
  }

  function advance(): string {
    current++;
    return source.charAt(current - 1);
  }

  function peek(): string {
    return isAtEnd() ? '\0' : source.charAt(current);
  }

  function peekNext(): string {
    return current + 1 >= source.length ? '\0' : source.charAt(current + 1);
  }

  function addToken(type: TokenType, literal: TokenLiteral | null = null) {
    const lexeme = getLexeme();

    tokens.push(new Token(type, lexeme, literal, line, col));

    col += lexeme.length;
  }

  function match(expected: string): boolean {
    if (isAtEnd() || source.charAt(current) !== expected) {
      return false;
    }

    current++;

    return true;
  }

  function getLexeme(): string {
    return source.slice(start, current);
  }

  // ===================
  // END LOCAL UTILITY FUNCTIONS
  // ===================

  while (!isAtEnd()) {
    start = current;
    scanToken();
  }

  tokens.push(new Token(TokenType.EOF, 'end', null, line, col));

  return tokens;
};
