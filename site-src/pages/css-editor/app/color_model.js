import { parseNumberWithUnit, parseAngleDegrees, roundTo, clamp } from "./css_value_syntax.js";

export const COLOR_FORMATS = Object.freeze({
  HEX: "hex",
  RGB: "rgb",
  RGBA: "rgba",
  HSL: "hsl",
  HSLA: "hsla",
  HWB: "hwb",
  OKLCH: "oklch"
});

export const COLOR_FORMAT_LABELS = Object.freeze({
  [COLOR_FORMATS.HEX]: "HEX",
  [COLOR_FORMATS.RGB]: "RGB",
  [COLOR_FORMATS.RGBA]: "RGBA (legacy)",
  [COLOR_FORMATS.HSL]: "HSL",
  [COLOR_FORMATS.HSLA]: "HSLA (legacy)",
  [COLOR_FORMATS.HWB]: "HWB",
  [COLOR_FORMATS.OKLCH]: "OKLCH"
});

const CHANNEL_MAXIMUM = 255;
const FULL_TURN_DEGREES = 360;
const OKLCH_CHROMA_AT_FULL_PERCENT = 0.4;
const TRANSPARENT = Object.freeze({ red: 0, green: 0, blue: 0, alpha: 0 });
const HEX_PATTERN = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOR_FUNCTION_PATTERN = /^(rgba?|hsla?|hwb|oklch)\(([^()]*)\)$/i;
const SRGB_LINEAR_THRESHOLD = 0.04045;
const SRGB_ENCODED_THRESHOLD = 0.0031308;
const CANVAS_SENTINEL_COLOR = "#010203";

export function createColor(red, green, blue, alpha = 1) {
  return { red, green, blue, alpha };
}

export function parseColor(text) {
  const source = text?.trim().toLowerCase() ?? "";
  if (!source) return null;
  if (source === "transparent") return { ...TRANSPARENT };
  if (source.startsWith("#")) return parseHexColor(source);
  const functionMatch = COLOR_FUNCTION_PATTERN.exec(source);
  if (functionMatch) return parseColorFunction(functionMatch[1], functionMatch[2]);
  if (/^[a-z]+$/.test(source)) return resolveNamedColor(source);
  return null;
}

export function formatColor(color, format) {
  const alpha = roundTo(color.alpha, 3);
  const hasAlpha = alpha < 1;
  const [red, green, blue] = [color.red, color.green, color.blue].map((channel) => Math.round(clamp(channel, 0, CHANNEL_MAXIMUM)));
  switch (format) {
    case COLOR_FORMATS.RGB:
      return hasAlpha ? `rgb(${red} ${green} ${blue} / ${alpha})` : `rgb(${red} ${green} ${blue})`;
    case COLOR_FORMATS.RGBA:
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    case COLOR_FORMATS.HSL: {
      const { hue, saturation, lightness } = rgbToHsl(color);
      const channels = `${formatHue(hue, 1)} ${roundTo(saturation, 1)}% ${roundTo(lightness, 1)}%`;
      return hasAlpha ? `hsl(${channels} / ${alpha})` : `hsl(${channels})`;
    }
    case COLOR_FORMATS.HSLA: {
      const { hue, saturation, lightness } = rgbToHsl(color);
      return `hsla(${formatHue(hue, 1)}, ${roundTo(saturation, 1)}%, ${roundTo(lightness, 1)}%, ${alpha})`;
    }
    case COLOR_FORMATS.HWB: {
      const { hue, whiteness, blackness } = rgbToHwb(color);
      const channels = `${formatHue(hue, 1)} ${roundTo(whiteness, 1)}% ${roundTo(blackness, 1)}%`;
      return hasAlpha ? `hwb(${channels} / ${alpha})` : `hwb(${channels})`;
    }
    case COLOR_FORMATS.OKLCH: {
      const { lightness, chroma, hue } = rgbToOklch(color);
      const channels = `${roundTo(lightness * 100, 2)}% ${roundTo(chroma, 4)} ${formatHue(hue, 2)}`;
      return hasAlpha ? `oklch(${channels} / ${alpha})` : `oklch(${channels})`;
    }
    default:
      return formatHexColor(red, green, blue, alpha);
  }
}

export function colorsAreEqual(first, second) {
  return formatColor(first, COLOR_FORMATS.RGBA) === formatColor(second, COLOR_FORMATS.RGBA);
}

export function mixColors(first, second, amount) {
  const mixChannel = (channel) => first[channel] + (second[channel] - first[channel]) * amount;
  return createColor(mixChannel("red"), mixChannel("green"), mixChannel("blue"), mixChannel("alpha"));
}

export function contrastRatio(first, second) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

export function rgbToHsv({ red, green, blue }) {
  const [r, g, b] = [red, green, blue].map((channel) => channel / CHANNEL_MAXIMUM);
  const maximum = Math.max(r, g, b);
  const range = maximum - Math.min(r, g, b);
  return {
    hue: hueFromRgb(r, g, b, maximum, range),
    saturation: maximum === 0 ? 0 : range / maximum,
    value: maximum
  };
}

export function hsvToRgb({ hue, saturation, value }, alpha = 1) {
  const channelAt = (offset) => {
    const position = (offset + hue / 60) % 6;
    return value - value * saturation * clamp(Math.min(position, 4 - position), 0, 1);
  };
  return createColor(channelAt(5) * CHANNEL_MAXIMUM, channelAt(3) * CHANNEL_MAXIMUM, channelAt(1) * CHANNEL_MAXIMUM, alpha);
}

export function rgbToHsl({ red, green, blue }) {
  const [r, g, b] = [red, green, blue].map((channel) => channel / CHANNEL_MAXIMUM);
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const range = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  const saturation = range === 0 ? 0 : range / (1 - Math.abs(2 * lightness - 1));
  return { hue: hueFromRgb(r, g, b, maximum, range), saturation: saturation * 100, lightness: lightness * 100 };
}

export function hslToRgb(hue, saturationPercent, lightnessPercent, alpha = 1) {
  const saturation = saturationPercent / 100;
  const lightness = lightnessPercent / 100;
  const chromaHalf = saturation * Math.min(lightness, 1 - lightness);
  const channelAt = (offset) => {
    const position = (offset + hue / 30) % 12;
    return lightness - chromaHalf * clamp(Math.min(position - 3, 9 - position), -1, 1);
  };
  return createColor(channelAt(0) * CHANNEL_MAXIMUM, channelAt(8) * CHANNEL_MAXIMUM, channelAt(4) * CHANNEL_MAXIMUM, alpha);
}

function rgbToHwb(color) {
  const { hue, saturation, value } = rgbToHsv(color);
  return { hue, whiteness: (1 - saturation) * value * 100, blackness: (1 - value) * 100 };
}

function hwbToRgb(hue, whitenessPercent, blacknessPercent, alpha) {
  let whiteness = whitenessPercent / 100;
  let blackness = blacknessPercent / 100;
  if (whiteness + blackness >= 1) {
    const gray = (whiteness / (whiteness + blackness)) * CHANNEL_MAXIMUM;
    return createColor(gray, gray, gray, alpha);
  }
  const pure = hslToRgb(hue, 100, 50);
  const scale = 1 - whiteness - blackness;
  const channel = (value) => value * scale + whiteness * CHANNEL_MAXIMUM;
  return createColor(channel(pure.red), channel(pure.green), channel(pure.blue), alpha);
}

function rgbToOklch(color) {
  const [r, g, b] = [color.red, color.green, color.blue].map((channel) => decodeSrgb(channel / CHANNEL_MAXIMUM));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const greenRed = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const blueYellow = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.hypot(greenRed, blueYellow);
  const hue = chroma < 1e-4 ? 0 : (Math.atan2(blueYellow, greenRed) * 180 / Math.PI + 360) % 360;
  return { lightness, chroma, hue };
}

function oklchToRgb(lightness, chroma, hue, alpha) {
  const hueRadians = hue * Math.PI / 180;
  const greenRed = chroma * Math.cos(hueRadians);
  const blueYellow = chroma * Math.sin(hueRadians);
  const l = (lightness + 0.3963377774 * greenRed + 0.2158037573 * blueYellow) ** 3;
  const m = (lightness - 0.1055613458 * greenRed - 0.0638541728 * blueYellow) ** 3;
  const s = (lightness - 0.0894841775 * greenRed - 1.291485548 * blueYellow) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ];
  const [red, green, blue] = linear.map((channel) => clamp(encodeSrgb(channel), 0, 1) * CHANNEL_MAXIMUM);
  return createColor(red, green, blue, alpha);
}

function formatHue(hue, decimals) {
  return roundTo(hue, decimals) % FULL_TURN_DEGREES;
}

function hueFromRgb(r, g, b, maximum, range) {
  if (range === 0) return 0;
  let hue;
  if (maximum === r) hue = ((g - b) / range) % 6;
  else if (maximum === g) hue = (b - r) / range + 2;
  else hue = (r - g) / range + 4;
  return (hue * 60 + 360) % 360;
}

function relativeLuminance(color) {
  const [r, g, b] = [color.red, color.green, color.blue].map((channel) => decodeSrgb(channel / CHANNEL_MAXIMUM));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function decodeSrgb(channel) {
  const magnitude = Math.abs(channel);
  const linear = magnitude <= SRGB_LINEAR_THRESHOLD ? magnitude / 12.92 : ((magnitude + 0.055) / 1.055) ** 2.4;
  return Math.sign(channel) * linear;
}

function encodeSrgb(channel) {
  const magnitude = Math.abs(channel);
  const encoded = magnitude <= SRGB_ENCODED_THRESHOLD ? magnitude * 12.92 : 1.055 * magnitude ** (1 / 2.4) - 0.055;
  return Math.sign(channel) * encoded;
}

function parseHexColor(source) {
  const match = HEX_PATTERN.exec(source);
  if (!match) return null;
  let digits = match[1];
  if (digits.length <= 4) digits = [...digits].map((digit) => digit + digit).join("");
  const channel = (index) => parseInt(digits.slice(index * 2, index * 2 + 2), 16);
  const alpha = digits.length === 8 ? channel(3) / CHANNEL_MAXIMUM : 1;
  return createColor(channel(0), channel(1), channel(2), alpha);
}

function formatHexColor(red, green, blue, alpha) {
  const toHex = (value) => value.toString(16).padStart(2, "0");
  const alphaHex = alpha < 1 ? toHex(Math.round(alpha * CHANNEL_MAXIMUM)) : "";
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}${alphaHex}`;
}

function parseColorFunction(functionName, argumentsText) {
  const tokens = argumentsText.replace(/,/g, " ").replace("/", " / ").trim().split(/\s+/);
  const slashIndex = tokens.indexOf("/");
  const channels = slashIndex === -1 ? tokens.slice(0, 3) : tokens.slice(0, slashIndex);
  const alphaToken = slashIndex === -1 ? tokens[3] : tokens[slashIndex + 1];
  const expectedTokenCount = slashIndex === -1 ? (alphaToken === undefined ? 3 : 4) : slashIndex + 2;
  if (channels.length !== 3 || tokens.length !== expectedTokenCount) return null;
  const alpha = alphaToken === undefined ? 1 : parseAlpha(alphaToken);
  if (alpha === null) return null;
  if (functionName.startsWith("rgb")) return parseRgbChannels(channels, alpha);
  if (functionName.startsWith("hsl")) return parseHueBasedChannels(channels, alpha, hslToRgb);
  if (functionName === "hwb") return parseHueBasedChannels(channels, alpha, hwbToRgb);
  return parseOklchChannels(channels, alpha);
}

function parseRgbChannels(channels, alpha) {
  const values = channels.map((token) => {
    const parsed = parseChannelNumber(token);
    if (!parsed) return null;
    return parsed.unit === "%" ? parsed.number * CHANNEL_MAXIMUM / 100 : parsed.number;
  });
  if (values.includes(null)) return null;
  return createColor(...values.map((value) => clamp(value, 0, CHANNEL_MAXIMUM)), alpha);
}

function parseHueBasedChannels(channels, alpha, toRgb) {
  const hue = parseHueDegrees(channels[0]);
  const percents = channels.slice(1).map((token) => {
    const parsed = parseChannelNumber(token);
    return parsed && (parsed.unit === "%" || parsed.unit === "") ? clamp(parsed.number, 0, 100) : null;
  });
  if (hue === null || percents.includes(null)) return null;
  return toRgb(((hue % 360) + 360) % 360, percents[0], percents[1], alpha);
}

function parseOklchChannels(channels, alpha) {
  const [lightnessToken, chromaToken] = channels.map(parseChannelNumber);
  const hue = parseHueDegrees(channels[2]);
  if (!lightnessToken || !chromaToken || hue === null) return null;
  const lightness = lightnessToken.unit === "%" ? lightnessToken.number / 100 : lightnessToken.number;
  const chroma = chromaToken.unit === "%" ? chromaToken.number / 100 * OKLCH_CHROMA_AT_FULL_PERCENT : chromaToken.number;
  return oklchToRgb(clamp(lightness, 0, 1), Math.max(0, chroma), hue, alpha);
}

function parseHueDegrees(token) {
  const parsed = parseChannelNumber(token);
  if (parsed && parsed.unit === "") return parsed.number;
  return parseAngleDegrees(token);
}

function parseChannelNumber(token) {
  if (token === "none") return { number: 0, unit: "" };
  const parsed = parseNumberWithUnit(token);
  return parsed && (parsed.unit === "" || parsed.unit === "%") ? parsed : null;
}

function parseAlpha(token) {
  const parsed = parseChannelNumber(token);
  if (!parsed) return null;
  return clamp(parsed.unit === "%" ? parsed.number / 100 : parsed.number, 0, 1);
}

function resolveNamedColor(name) {
  if (!globalThis.document) return null;
  const context = resolveNamedColor.context ??= document.createElement("canvas").getContext("2d");
  context.fillStyle = CANVAS_SENTINEL_COLOR;
  context.fillStyle = name;
  const resolved = context.fillStyle;
  if (resolved === CANVAS_SENTINEL_COLOR) return null;
  return parseColor(resolved);
}
