enum TokenType {
  // Single-character tokens.
  LEFT_PAREN = 'LEFT_PAREN',
  RIGHT_PAREN = 'RIGHT_PAREN',
  LEFT_BRACE = 'LEFT_BRACE',
  RIGHT_BRACE = 'RIGHT_BRACE',
  LEFT_BRACKET = 'LEFT_BRACKET',
  RIGHT_BRACKET = 'RIGHT_BRACKET',

  AT = '@',
  COMMA = 'COMMA',
  DOT = 'DOT',
  MINUS = 'MINUS',
  PLUS = 'PLUS',
  PLUS_PLUS = 'PLUS_PUS',
  SEMICOLON = 'SEMICOLON',
  SLASH = 'SLASH',
  STAR = 'STAR',

  // One or two character tokens.
  BANG = 'BANG',
  BANG_EQUAL = 'BANG_EQUAL',

  EQUAL = 'EQUAL',
  EQUAL_EQUAL = 'EQUAL_EQUAL',

  GREATER = 'GREATER',
  GREATER_EQUAL = 'GREATER_EQUAL',

  LESS = 'LESS',
  LESS_EQUAL = 'LESS_EQUAL',

  ARROW = 'ARROW',
  QUESTION = 'QUESTION',

  COLON = 'COLON',
  COLON_COLON = 'COLON_COLON',

  // Literals.
  IDENTIFIER = 'IDENTIFIER',
  STRINGLIT = 'STRINGLIT',
  NUMBERLIT = 'NUMBERLIT',

  // Keywords.
  NUMBER = 'NUMBER',
  NIL = 'NIL',
  BOOL = 'BOOL',

  AND = 'AND',
  CLASS = 'CLASS',
  ELSE = 'ELSE',
  FALSE = 'FALSE',
  FUN = 'FUN',
  FORALL = 'FORALL',
  FORALLT = 'FORALLT',
  // FOR = 'FOR',
  IF = 'IF',
  NILLIT = 'NILLIT',
  OR = 'OR',

  PRINT = 'PRINT',
  PRINTEV = 'PRINTEV',
  // RETURN = 'RETURN',
  // SUPER = 'SUPER',
  // THIS = 'THIS',
  TRUE = 'TRUE',
  LET = 'LET',
  SLET = 'SLET',
  // WHILE = 'WHILE',

  INVALID = 'INVALID',

  EOF = 'EOF',
}

export default TokenType;
