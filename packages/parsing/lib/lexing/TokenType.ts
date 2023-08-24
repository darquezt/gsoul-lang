enum TokenType {
  // Single-character tokens.
  LEFT_PAREN = 'LEFT_PAREN',
  RIGHT_PAREN = 'RIGHT_PAREN',
  LEFT_BRACE = 'LEFT_BRACE',
  RIGHT_BRACE = 'RIGHT_BRACE',
  LEFT_BRACKET = 'LEFT_BRACKET',
  RIGHT_BRACKET = 'RIGHT_BRACKET',

  AT = 'AT',
  COMMA = 'COMMA',
  DOT = 'DOT',
  DOT_DOT = 'DOT_DOT',
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

  BACKSLASH = 'BACKSLASH',
  ARROW = 'ARROW',
  FAT_ARROW = 'FAT_ARROW',
  QUESTION = 'QUESTION',

  COLON = 'COLON',
  COLON_COLON = 'COLON_COLON',
  COLON_COLON_LESS = 'COLON_COLON_LESS',
  COLON_COLON_LEFT_BRACKET = 'COLON_COLON_LEFT_BRACKET',

  // Literals.
  IDENTIFIER = 'IDENTIFIER',
  STRINGLIT = 'STRINGLIT',
  NUMBERLIT = 'NUMBERLIT',

  ATOM = 'ATOM',

  // Keywords.
  NUMBER = 'NUMBER',
  NIL = 'NIL',
  BOOL = 'BOOL',

  //INL = 'INL',
  //INR = 'INR',
  INJ = 'INJ',
  HASH = 'HASH',
  CASE = 'CASE',
  OF = 'OF',
  MATCH = 'MATCH',
  WITH = 'WITH',

  AND = 'AND',
  CLASS = 'CLASS',
  THEN = 'THEN',
  ELSE = 'ELSE',
  FALSE = 'FALSE',
  FUN = 'FUN',
  FORALL = 'FORALL',
  FORALLT = 'FORALLT',
  // FOR = 'FOR',
  IF = 'IF',
  NILLIT = 'NILLIT',
  OR = 'OR',

  PURE = 'PURE',

  AS = 'AS',

  PRINT = 'PRINT',
  PRINTEV = 'PRINTEV',
  // RETURN = 'RETURN',
  // SUPER = 'SUPER',
  // THIS = 'THIS',
  TRUE = 'TRUE',
  LET = 'LET',
  DEF = 'DEF',
  // WHILE = 'WHILE',

  // Multiplicative pairs
  TUPLE = 'TUPLE',
  UNTUP = 'UNTUP',
  IN = 'IN',

  // Additive pairs
  PAIR = 'PAIR',
  FST = 'FST',
  SND = 'SND',

  // Recursive types
  FOLD = 'FOLD',
  UNFOLD = 'UNFOLD',
  RECTYPE = 'RECTYPE',

  INVALID = 'INVALID',

  TYPE = 'TYPE',
  DATA = 'DATA',
  PIPE = 'PIPE',

  RES = 'RES',

  EOF = 'EOF',

  HELLOWORLD = 'HELLOWORLD',
}

export default TokenType;
