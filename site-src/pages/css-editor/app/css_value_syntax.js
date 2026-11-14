const NUMBER_WITH_UNIT_PATTERN = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([a-z%]*)$/i;
const DECLARATION_PATTERN = /^\s*([a-z-]+)\s*:\s*([\s\S]*?)\s*;?\s*$/i;
const ANGLE_UNITS_PER_DEGREE = Object.freeze({ deg: 1, turn: 1 / 360, rad: Math.PI / 180, grad: 400 / 360 });
const DEFAULT_DECIMALS = 2;
const HORIZONTAL_POSITION_KEYWORDS = Object.freeze({ left: 0, center: 50, right: 100 });
const VERTICAL_POSITION_KEYWORDS = Object.freeze({ top: 0, center: 50, bottom: 100 });

export function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const character of text) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === separator && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  parts.push(current.trim());
  return parts;
}

export function splitWhitespace(text) {
  const tokens = [];
  let depth = 0;
  let current = "";
  for (const character of text.trim()) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (/\s/.test(character) && depth === 0) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  if (current) tokens.push(current);
  return tokens;
}

export function parseNumberWithUnit(token) {
  const match = NUMBER_WITH_UNIT_PATTERN.exec(token?.trim() ?? "");
  if (!match) return null;
  return { number: Number(match[1]), unit: match[2].toLowerCase() };
}

export function parsePixels(token) {
  const parsed = parseNumberWithUnit(token);
  if (!parsed) return null;
  if (parsed.unit === "px" || (parsed.unit === "" && parsed.number === 0)) return parsed.number;
  return null;
}

export function parsePercent(token) {
  const parsed = parseNumberWithUnit(token);
  if (!parsed) return null;
  if (parsed.unit === "%" || (parsed.unit === "" && parsed.number === 0)) return parsed.number;
  return null;
}

export function parseAngleDegrees(token) {
  const parsed = parseNumberWithUnit(token);
  if (!parsed) return null;
  if (parsed.unit === "" && parsed.number === 0) return 0;
  const unitsPerDegree = ANGLE_UNITS_PER_DEGREE[parsed.unit];
  return unitsPerDegree ? parsed.number / unitsPerDegree : null;
}

export function parseFunctionCall(text) {
  const match = /^([a-z-]+)\(([\s\S]*)\)$/i.exec(text.trim());
  if (!match) return null;
  return { name: match[1].toLowerCase(), argumentsText: match[2].trim() };
}

export function parseDeclaration(text) {
  const match = DECLARATION_PATTERN.exec(text);
  if (!match) return { property: null, value: text.trim().replace(/;\s*$/, "") };
  return { property: match[1].toLowerCase(), value: match[2].trim() };
}

export function roundTo(number, decimals = DEFAULT_DECIMALS) {
  const factor = 10 ** decimals;
  const rounded = Math.round(number * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function formatNumber(number, decimals = DEFAULT_DECIMALS) {
  return String(roundTo(number, decimals));
}

export function formatLength(number, unit, decimals = DEFAULT_DECIMALS) {
  const rounded = roundTo(number, decimals);
  return rounded === 0 ? "0" : `${rounded}${unit}`;
}

export function clamp(number, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, number));
}

export function formatDeclaration(property, value) {
  const listItems = splitTopLevel(value, ",");
  const isLongList = listItems.length > 1 && value.length > 60;
  if (!isLongList) return `${property}: ${value};`;
  return `${property}:\n  ${listItems.join(",\n  ")};`;
}

export function compressBoxValues([top, right, bottom, left]) {
  if (left === right) {
    if (top === bottom) return top === right ? [top] : [top, right];
    return [top, right, bottom];
  }
  return [top, right, bottom, left];
}

export function parsePosition(tokens, startIndex) {
  const positionTokens = [];
  let index = startIndex;
  while (index < tokens.length && positionTokens.length < 2 && tokens[index].toLowerCase() !== "in") {
    positionTokens.push(tokens[index].toLowerCase());
    index += 1;
  }
  if (positionTokens.length === 0) return null;
  const isVerticalFirst = positionTokens[0] in VERTICAL_POSITION_KEYWORDS && positionTokens[0] !== "center";
  const [horizontalToken, verticalToken = "center"] = isVerticalFirst ? [positionTokens[1] ?? "center", positionTokens[0]] : positionTokens;
  const x = parsePositionComponent(horizontalToken, HORIZONTAL_POSITION_KEYWORDS);
  const y = parsePositionComponent(verticalToken, VERTICAL_POSITION_KEYWORDS);
  if (x === null || y === null) return null;
  return { x, y, nextIndex: index };
}

function parsePositionComponent(token, keywords) {
  if (token in keywords) return keywords[token];
  const parsed = parseNumberWithUnit(token);
  if (!parsed || !(parsed.unit === "%" || (parsed.unit === "" && parsed.number === 0))) return null;
  return parsed.number;
}
