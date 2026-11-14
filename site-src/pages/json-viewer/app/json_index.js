export const NODE_TYPE = Object.freeze({ NULL: 0, BOOLEAN: 1, NUMBER: 2, STRING: 3, ARRAY: 4, OBJECT: 5 });

const NO_POSITION = -1;
const NO_PARENT = -1;
const INITIAL_NODE_CAPACITY = 1024;
const ESTIMATED_CHARACTERS_PER_NODE = 12;
const MAX_NESTING_DEPTH = 65535;

const CHARACTER = Object.freeze({
  TAB: 9,
  NEWLINE: 10,
  CARRIAGE_RETURN: 13,
  SPACE: 32,
  QUOTE: 34,
  COMMA: 44,
  MINUS: 45,
  DIGIT_ZERO: 48,
  DIGIT_NINE: 57,
  COLON: 58,
  OPEN_BRACKET: 91,
  BACKSLASH: 92,
  CLOSE_BRACKET: 93,
  LETTER_F: 102,
  LETTER_N: 110,
  LETTER_T: 116,
  LETTER_U: 117,
  OPEN_BRACE: 123,
  CLOSE_BRACE: 125,
  FIRST_PRINTABLE: 32
});

const SIMPLE_ESCAPE_CODES = new Set(["\"", "\\", "/", "b", "f", "n", "r", "t"].map((letter) => letter.charCodeAt(0)));
const NUMBER_PATTERN = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const FOUR_HEX_DIGITS_PATTERN = /[0-9a-fA-F]{4}/y;
const LITERALS = [
  { firstCode: CHARACTER.LETTER_T, word: "true", type: NODE_TYPE.BOOLEAN },
  { firstCode: CHARACTER.LETTER_F, word: "false", type: NODE_TYPE.BOOLEAN },
  { firstCode: CHARACTER.LETTER_N, word: "null", type: NODE_TYPE.NULL }
];
const IDENTIFIER_PATTERN = /^[A-Za-z_$][\w$]*$/;

const PARSE_STATE = Object.freeze({ VALUE: 0, VALUE_OR_CLOSE: 1, KEY_OR_CLOSE: 2, KEY: 3, AFTER_VALUE: 4, DONE: 5 });

export class JsonSyntaxError extends Error {
  constructor(message, offset) {
    super(message);
    this.offset = offset;
  }
}

export function parseJsonIndex(text) {
  const parser = {
    text,
    position: 0,
    nodes: createNodeTable(Math.max(INITIAL_NODE_CAPACITY, Math.ceil(text.length / ESTIMATED_CHARACTERS_PER_NODE))),
    openContainers: [],
    pendingKeyStart: NO_POSITION,
    pendingKeyEnd: NO_POSITION
  };
  let state = PARSE_STATE.VALUE;
  while (state !== PARSE_STATE.DONE) {
    skipWhitespace(parser);
    state = PARSE_STEPS[state](parser);
  }
  return parser.nodes;
}

export function isContainerType(type) {
  return type === NODE_TYPE.ARRAY || type === NODE_TYPE.OBJECT;
}

export function locateOffset(text, offset) {
  let line = 1;
  let lineStart = 0;
  let newlineIndex = text.indexOf("\n");
  while (newlineIndex !== -1 && newlineIndex < offset) {
    line++;
    lineStart = newlineIndex + 1;
    newlineIndex = text.indexOf("\n", lineStart);
  }
  return { line, column: offset - lineStart + 1 };
}

export function readRawKey(document, nodeIndex) {
  const { nodes, text } = document;
  const keyStart = nodes.keyStarts[nodeIndex];
  if (keyStart === NO_POSITION) return null;
  return text.slice(keyStart + 1, nodes.keyEnds[nodeIndex] - 1);
}

export function readRawValue(document, nodeIndex) {
  return document.text.slice(document.nodes.valueStarts[nodeIndex], document.nodes.valueEnds[nodeIndex]);
}

export function decodeRawStringContent(rawContent) {
  try {
    return JSON.parse(`"${rawContent}"`);
  } catch {
    return rawContent;
  }
}

export function formatNodeRange(document, rootNodeIndex, indentUnit) {
  const { nodes, text } = document;
  const isPretty = indentUnit.length > 0;
  const keySeparator = isPretty ? ": " : ":";
  const rootDepth = nodes.depths[rootNodeIndex];
  const indentCache = [""];
  const lineBreakAt = (relativeDepth) => {
    if (!isPretty) return "";
    while (indentCache.length <= relativeDepth) indentCache.push(indentCache[indentCache.length - 1] + indentUnit);
    return "\n" + indentCache[relativeDepth];
  };
  const parts = [];
  const openContainers = [];
  const closeFinishedContainers = (nodeIndex) => {
    while (openContainers.length > 0 && nodes.subtreeEnds[openContainers[openContainers.length - 1]] <= nodeIndex) {
      const container = openContainers.pop();
      parts.push(lineBreakAt(nodes.depths[container] - rootDepth), closingBracketFor(nodes.types[container]));
    }
  };
  const rangeEnd = nodes.subtreeEnds[rootNodeIndex];
  for (let nodeIndex = rootNodeIndex; nodeIndex < rangeEnd; nodeIndex++) {
    closeFinishedContainers(nodeIndex);
    if (nodeIndex !== rootNodeIndex) {
      if (nodes.positionsInParent[nodeIndex] > 0) parts.push(",");
      parts.push(lineBreakAt(nodes.depths[nodeIndex] - rootDepth));
      if (nodes.keyStarts[nodeIndex] !== NO_POSITION) {
        parts.push(text.slice(nodes.keyStarts[nodeIndex], nodes.keyEnds[nodeIndex]), keySeparator);
      }
    }
    const type = nodes.types[nodeIndex];
    if (!isContainerType(type)) {
      parts.push(text.slice(nodes.valueStarts[nodeIndex], nodes.valueEnds[nodeIndex]));
      continue;
    }
    parts.push(openingBracketFor(type));
    if (nodes.childCounts[nodeIndex] === 0) parts.push(closingBracketFor(type));
    else openContainers.push(nodeIndex);
  }
  closeFinishedContainers(rangeEnd);
  return parts.join("");
}

export function openingBracketFor(type) {
  return type === NODE_TYPE.OBJECT ? "{" : "[";
}

export function closingBracketFor(type) {
  return type === NODE_TYPE.OBJECT ? "}" : "]";
}

export function nodePathSegments(document, nodeIndex) {
  const { nodes } = document;
  const segments = [];
  for (let current = nodeIndex; nodes.parents[current] !== NO_PARENT; current = nodes.parents[current]) {
    const parent = nodes.parents[current];
    segments.push(nodes.types[parent] === NODE_TYPE.ARRAY ? nodes.positionsInParent[current] : readRawKey(document, current));
  }
  return segments.reverse();
}

export function formatPathForDisplay(segments) {
  return "$" + segments.map((segment) => {
    if (typeof segment === "number") return `[${segment}]`;
    const key = decodeRawStringContent(segment);
    return IDENTIFIER_PATTERN.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
  }).join("");
}

export function findNodeByPath(document, segments) {
  const { nodes } = document;
  let current = 0;
  for (const segment of segments) {
    if (!isContainerType(nodes.types[current])) return NO_PARENT;
    current = findChild(document, current, segment);
    if (current === NO_PARENT) return NO_PARENT;
  }
  return current;
}

function findChild(document, parentIndex, segment) {
  const { nodes } = document;
  const isArray = nodes.types[parentIndex] === NODE_TYPE.ARRAY;
  const end = nodes.subtreeEnds[parentIndex];
  for (let child = parentIndex + 1; child < end; child = nodes.subtreeEnds[child]) {
    const isMatch = isArray ? nodes.positionsInParent[child] === segment : readRawKey(document, child) === segment;
    if (isMatch) return child;
  }
  return NO_PARENT;
}

const PARSE_STEPS = {
  [PARSE_STATE.VALUE]: readValue,
  [PARSE_STATE.VALUE_OR_CLOSE]: (parser) => (currentCode(parser) === CHARACTER.CLOSE_BRACKET ? closeContainer(parser) : readValue(parser)),
  [PARSE_STATE.KEY_OR_CLOSE]: (parser) => (currentCode(parser) === CHARACTER.CLOSE_BRACE ? closeContainer(parser) : readKey(parser)),
  [PARSE_STATE.KEY]: readKey,
  [PARSE_STATE.AFTER_VALUE]: readAfterValue
};

function readValue(parser) {
  const code = currentCode(parser);
  const start = parser.position;
  if (code === CHARACTER.OPEN_BRACE) return openContainer(parser, NODE_TYPE.OBJECT);
  if (code === CHARACTER.OPEN_BRACKET) return openContainer(parser, NODE_TYPE.ARRAY);
  if (code === CHARACTER.QUOTE) return addPrimitive(parser, NODE_TYPE.STRING, start, scanString(parser.text, start));
  if (code === CHARACTER.MINUS || (code >= CHARACTER.DIGIT_ZERO && code <= CHARACTER.DIGIT_NINE)) {
    return addPrimitive(parser, NODE_TYPE.NUMBER, start, scanNumber(parser.text, start));
  }
  const literal = LITERALS.find((candidate) => candidate.firstCode === code);
  if (literal && parser.text.startsWith(literal.word, start)) {
    return addPrimitive(parser, literal.type, start, start + literal.word.length);
  }
  if (start >= parser.text.length) throw new JsonSyntaxError(start === 0 ? "The input is empty" : "Unexpected end of input", start);
  throw new JsonSyntaxError(`Unexpected character ${JSON.stringify(parser.text[start])}`, start);
}

function readKey(parser) {
  const { text } = parser;
  const start = parser.position;
  if (currentCode(parser) !== CHARACTER.QUOTE) throw new JsonSyntaxError("Expected a property name in double quotes", start);
  parser.position = scanString(text, start);
  parser.pendingKeyStart = start;
  parser.pendingKeyEnd = parser.position;
  skipWhitespace(parser);
  if (currentCode(parser) !== CHARACTER.COLON) throw new JsonSyntaxError("Expected ':' after the property name", parser.position);
  parser.position++;
  return PARSE_STATE.VALUE;
}

function readAfterValue(parser) {
  const { openContainers, nodes } = parser;
  if (openContainers.length === 0) {
    if (parser.position < parser.text.length) throw new JsonSyntaxError("Unexpected content after the JSON value", parser.position);
    return PARSE_STATE.DONE;
  }
  const containerType = nodes.types[openContainers[openContainers.length - 1]];
  const code = currentCode(parser);
  if (code === CHARACTER.COMMA) {
    parser.position++;
    return containerType === NODE_TYPE.OBJECT ? PARSE_STATE.KEY : PARSE_STATE.VALUE;
  }
  const expectedCloser = containerType === NODE_TYPE.OBJECT ? CHARACTER.CLOSE_BRACE : CHARACTER.CLOSE_BRACKET;
  if (code === expectedCloser) return closeContainer(parser);
  const closerText = String.fromCharCode(expectedCloser);
  const message = parser.position >= parser.text.length ? `Unexpected end of input, expected ',' or '${closerText}'` : `Expected ',' or '${closerText}'`;
  throw new JsonSyntaxError(message, parser.position);
}

function openContainer(parser, type) {
  if (parser.openContainers.length >= MAX_NESTING_DEPTH) throw new JsonSyntaxError("Nesting is too deep", parser.position);
  const nodeIndex = addNode(parser, type, parser.position, NO_POSITION);
  parser.openContainers.push(nodeIndex);
  parser.position++;
  return type === NODE_TYPE.OBJECT ? PARSE_STATE.KEY_OR_CLOSE : PARSE_STATE.VALUE_OR_CLOSE;
}

function closeContainer(parser) {
  const { nodes } = parser;
  const nodeIndex = parser.openContainers.pop();
  parser.position++;
  nodes.valueEnds[nodeIndex] = parser.position;
  nodes.subtreeEnds[nodeIndex] = nodes.count;
  return PARSE_STATE.AFTER_VALUE;
}

function addPrimitive(parser, type, start, end) {
  addNode(parser, type, start, end);
  parser.position = end;
  return PARSE_STATE.AFTER_VALUE;
}

function addNode(parser, type, valueStart, valueEnd) {
  const nodes = parser.nodes;
  if (nodes.count === nodes.capacity) growNodeTable(nodes);
  const nodeIndex = nodes.count++;
  const depth = parser.openContainers.length;
  const parentIndex = depth > 0 ? parser.openContainers[depth - 1] : NO_PARENT;
  nodes.types[nodeIndex] = type;
  nodes.parents[nodeIndex] = parentIndex;
  nodes.depths[nodeIndex] = depth;
  nodes.keyStarts[nodeIndex] = parser.pendingKeyStart;
  nodes.keyEnds[nodeIndex] = parser.pendingKeyEnd;
  nodes.positionsInParent[nodeIndex] = parentIndex === NO_PARENT ? 0 : nodes.childCounts[parentIndex]++;
  nodes.valueStarts[nodeIndex] = valueStart;
  nodes.valueEnds[nodeIndex] = valueEnd;
  nodes.childCounts[nodeIndex] = 0;
  nodes.subtreeEnds[nodeIndex] = nodeIndex + 1;
  parser.pendingKeyStart = NO_POSITION;
  parser.pendingKeyEnd = NO_POSITION;
  return nodeIndex;
}

function scanString(text, start) {
  const length = text.length;
  let position = start + 1;
  while (position < length) {
    const code = text.charCodeAt(position);
    if (code === CHARACTER.QUOTE) return position + 1;
    if (code === CHARACTER.BACKSLASH) {
      position = skipEscapeSequence(text, position);
      continue;
    }
    if (code < CHARACTER.FIRST_PRINTABLE) throw new JsonSyntaxError("Unescaped control character in string", position);
    position++;
  }
  throw new JsonSyntaxError("Unterminated string", start);
}

function skipEscapeSequence(text, backslashPosition) {
  const escapeCode = text.charCodeAt(backslashPosition + 1);
  if (SIMPLE_ESCAPE_CODES.has(escapeCode)) return backslashPosition + 2;
  if (escapeCode === CHARACTER.LETTER_U) {
    FOUR_HEX_DIGITS_PATTERN.lastIndex = backslashPosition + 2;
    if (FOUR_HEX_DIGITS_PATTERN.test(text)) return backslashPosition + 6;
  }
  throw new JsonSyntaxError("Invalid escape sequence in string", backslashPosition);
}

function scanNumber(text, start) {
  NUMBER_PATTERN.lastIndex = start;
  const match = NUMBER_PATTERN.exec(text);
  if (!match) throw new JsonSyntaxError("Invalid number", start);
  return start + match[0].length;
}

function skipWhitespace(parser) {
  const { text } = parser;
  const length = text.length;
  let position = parser.position;
  while (position < length) {
    const code = text.charCodeAt(position);
    if (code !== CHARACTER.SPACE && code !== CHARACTER.NEWLINE && code !== CHARACTER.CARRIAGE_RETURN && code !== CHARACTER.TAB) break;
    position++;
  }
  parser.position = position;
}

function currentCode(parser) {
  return parser.text.charCodeAt(parser.position);
}

const NODE_FIELDS = [
  ["types", Uint8Array],
  ["parents", Int32Array],
  ["depths", Uint16Array],
  ["keyStarts", Int32Array],
  ["keyEnds", Int32Array],
  ["valueStarts", Int32Array],
  ["valueEnds", Int32Array],
  ["childCounts", Int32Array],
  ["subtreeEnds", Int32Array],
  ["positionsInParent", Int32Array]
];

function createNodeTable(capacity) {
  const table = { count: 0, capacity };
  for (const [fieldName, ArrayType] of NODE_FIELDS) table[fieldName] = new ArrayType(capacity);
  return table;
}

function growNodeTable(table) {
  const newCapacity = table.capacity * 2;
  for (const [fieldName, ArrayType] of NODE_FIELDS) {
    const grown = new ArrayType(newCapacity);
    grown.set(table[fieldName]);
    table[fieldName] = grown;
  }
  table.capacity = newCapacity;
}
