import { LitElement, html, css, nothing } from "lit";
import { editorStyles } from "./editor_styles.js";
import { renderPresetSection, renderHandle, handleStyles } from "./editor_controls.js";
import { splitTopLevel, splitWhitespace, parseAngleDegrees, parseNumberWithUnit, parsePosition, formatNumber, roundTo, clamp } from "./css_value_syntax.js";
import { parseColor, formatColor, mixColors, COLOR_FORMATS } from "./color_model.js";
import { trackPointerDrag, arrowKeyDelta, emitEvent } from "./pointer_tracking.js";

const GRADIENT_KINDS = Object.freeze({ LINEAR: "linear", RADIAL: "radial", CONIC: "conic" });
const RADIAL_SHAPES = Object.freeze({ ELLIPSE: "ellipse", CIRCLE: "circle" });
const RADIAL_SIZES = Object.freeze(["farthest-corner", "farthest-side", "closest-corner", "closest-side"]);
const DEFAULT_RADIAL_SIZE = RADIAL_SIZES[0];
const DEFAULT_LINEAR_ANGLE_DEGREES = 180;
const CENTER_PERCENT = 50;
const FULL_TURN_DEGREES = 360;
const MINIMUM_STOP_COUNT = 2;
const INTERPOLATION_SPACES = Object.freeze(["", "srgb", "srgb-linear", "oklab", "oklch", "lab", "lch", "hsl", "hwb", "display-p3"]);
const POLAR_INTERPOLATION_SPACES = Object.freeze(["oklch", "lch", "hsl", "hwb"]);
const HUE_INTERPOLATION_METHODS = Object.freeze(["", "shorter", "longer", "increasing", "decreasing"]);
const GRADIENT_PATTERN = /^(repeating-)?(linear|radial|conic)-gradient\(([\s\S]*)\)$/i;
const SIDE_KEYWORD_ANGLES = Object.freeze({
  "top": 0, "right": 90, "bottom": 180, "left": 270,
  "top right": 45, "right top": 45, "bottom right": 135, "right bottom": 135,
  "bottom left": 225, "left bottom": 225, "top left": 315, "left top": 315
});

const GRADIENT_PRESETS = [
  { label: "Sunset", css: "linear-gradient(135deg, #ff8a3d 0%, #ff3d77 50%, #7c3aed 100%)" },
  { label: "Ocean", css: "linear-gradient(#0ea5e9, #1e3a8a)" },
  { label: "Vivid OKLCH", css: "linear-gradient(90deg in oklch, #ff0080, #00e5ff)" },
  { label: "Rainbow", css: "linear-gradient(90deg in hsl longer hue, #ff0000, #ff0000)" },
  { label: "Spotlight", css: "radial-gradient(circle at 30% 30%, #fff7ed 0%, #fb923c 35%, #7c2d12 100%)" },
  { label: "Color wheel", css: "conic-gradient(#ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)" },
  { label: "Pie chart", css: "conic-gradient(#ff8a3d 0% 35%, #3d8bff 35% 70%, #4ade80 70% 100%)" },
  { label: "Stripes", css: "repeating-linear-gradient(45deg, #1c1612 0 10px, #ff8a3d 10px 20px)" },
  { label: "Rings", css: "repeating-radial-gradient(circle, #3d8bff 0% 4%, #ede7e2 4% 8%)" }
];

let nextStopId = 1;

export const gradientDefinition = {
  id: "gradient",
  label: "Gradient",
  group: "Color",
  properties: ["background-image", "background"],
  presets: GRADIENT_PRESETS,
  parse: parseGradient,
  serialize: serializeGradient,
  render: ({ model, colorFormat, onChange }) => html`<gradient-editor .model=${model} .colorFormat=${colorFormat}
    @model-change=${onChange}></gradient-editor>`
};

function parseGradient(value) {
  const match = GRADIENT_PATTERN.exec(value.trim());
  if (!match) return null;
  const [, repeatingPrefix, kindText, argumentsText] = match;
  const kind = kindText.toLowerCase();
  const parts = splitTopLevel(argumentsText, ",");
  const startsWithStop = parseStopTokens(parts[0], kind) !== null;
  const config = startsWithStop ? {} : parseGradientConfig(kind, splitWhitespace(parts[0]));
  if (!config) return null;
  const stops = parseStops(startsWithStop ? parts : parts.slice(1), kind);
  if (!stops || stops.length < MINIMUM_STOP_COUNT) return null;
  return { ...createDefaultConfig(), ...config, kind, isRepeating: Boolean(repeatingPrefix), stops };
}

function createDefaultConfig() {
  return {
    angle: DEFAULT_LINEAR_ANGLE_DEGREES,
    sideKeyword: null,
    shape: RADIAL_SHAPES.ELLIPSE,
    size: DEFAULT_RADIAL_SIZE,
    centerX: CENTER_PERCENT,
    centerY: CENTER_PERCENT,
    fromAngle: 0,
    interpolation: { space: "", hueMethod: "" }
  };
}

function parseGradientConfig(kind, tokens) {
  const config = {};
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index].toLowerCase();
    if (token === "in") {
      const interpolation = parseInterpolation(tokens, index + 1);
      if (!interpolation) return null;
      config.interpolation = interpolation.value;
      index = interpolation.nextIndex;
    } else if (token === "at" && kind !== GRADIENT_KINDS.LINEAR) {
      const position = parsePosition(tokens, index + 1);
      if (!position) return null;
      config.centerX = position.x;
      config.centerY = position.y;
      index = position.nextIndex;
    } else if (token === "to" && kind === GRADIENT_KINDS.LINEAR) {
      const side = parseSideKeyword(tokens, index + 1);
      if (!side) return null;
      config.sideKeyword = side.keyword;
      config.angle = SIDE_KEYWORD_ANGLES[side.keyword];
      index = side.nextIndex;
    } else if (token === "from" && kind === GRADIENT_KINDS.CONIC) {
      const fromAngle = parseAngleDegrees(tokens[index + 1] ?? "");
      if (fromAngle === null) return null;
      config.fromAngle = fromAngle;
      index += 2;
    } else if (kind === GRADIENT_KINDS.RADIAL && Object.values(RADIAL_SHAPES).includes(token)) {
      config.shape = token;
      index += 1;
    } else if (kind === GRADIENT_KINDS.RADIAL && RADIAL_SIZES.includes(token)) {
      config.size = token;
      index += 1;
    } else if (kind === GRADIENT_KINDS.LINEAR && parseAngleDegrees(token) !== null) {
      config.angle = parseAngleDegrees(token);
      index += 1;
    } else {
      return null;
    }
  }
  return config;
}

function parseInterpolation(tokens, startIndex) {
  const space = tokens[startIndex]?.toLowerCase();
  if (!space || !INTERPOLATION_SPACES.includes(space)) return null;
  const hueMethod = tokens[startIndex + 1]?.toLowerCase();
  const hasHueMethod = HUE_INTERPOLATION_METHODS.includes(hueMethod) && tokens[startIndex + 2]?.toLowerCase() === "hue";
  return {
    value: { space, hueMethod: hasHueMethod ? hueMethod : "" },
    nextIndex: startIndex + (hasHueMethod ? 3 : 1)
  };
}

function parseSideKeyword(tokens, startIndex) {
  const twoWords = tokens.slice(startIndex, startIndex + 2).join(" ").toLowerCase();
  if (twoWords in SIDE_KEYWORD_ANGLES && twoWords.includes(" ")) return { keyword: twoWords, nextIndex: startIndex + 2 };
  const oneWord = tokens[startIndex]?.toLowerCase();
  if (oneWord in SIDE_KEYWORD_ANGLES) return { keyword: oneWord, nextIndex: startIndex + 1 };
  return null;
}

function parseStopTokens(text, kind) {
  const [colorToken, ...positionTokens] = splitWhitespace(text);
  const color = parseColor(colorToken ?? "");
  if (!color || positionTokens.length > 2) return null;
  if (positionTokens.length === 0) return [{ color, position: null }];
  const positions = positionTokens.map((token) => parseStopPosition(token, kind));
  if (positions.includes(null)) return null;
  return positions.map((position) => ({ color, position }));
}

function parseStopPosition(token, kind) {
  const parsed = parseNumberWithUnit(token);
  if (!parsed) return null;
  if (parsed.unit === "%") return parsed.number;
  if (parsed.unit === "" && parsed.number === 0) return 0;
  if (parsed.unit === "px" && kind !== GRADIENT_KINDS.CONIC) return { pixels: parsed.number };
  if (kind === GRADIENT_KINDS.CONIC) {
    const degrees = parseAngleDegrees(token);
    return degrees === null ? null : degrees / FULL_TURN_DEGREES * 100;
  }
  return null;
}

function parseStops(parts, kind) {
  const parsedStops = [];
  for (const part of parts) {
    const stops = parseStopTokens(part, kind);
    if (!stops) return null;
    parsedStops.push(...stops);
  }
  const usesPixels = parsedStops.some((stop) => typeof stop.position === "object" && stop.position !== null);
  const usesPercent = parsedStops.some((stop) => typeof stop.position === "number" && stop.position !== 0);
  if (usesPixels && usesPercent) return null;
  const unit = usesPixels ? "px" : "%";
  const positions = parsedStops.map((stop) => (typeof stop.position === "object" && stop.position !== null ? stop.position.pixels : stop.position));
  const filledPositions = fillMissingPositions(positions, unit);
  return parsedStops.map((stop, index) => ({ id: nextStopId++, color: stop.color, position: filledPositions[index], unit }));
}

function fillMissingPositions(positions, unit) {
  const filled = [...positions];
  const lastIndex = filled.length - 1;
  if (filled[0] === null) filled[0] = 0;
  if (filled[lastIndex] === null) filled[lastIndex] = unit === "%" ? 100 : Math.max(0, ...filled.filter((position) => position !== null));
  let previousKnownIndex = 0;
  for (let index = 1; index <= lastIndex; index += 1) {
    if (filled[index] === null) continue;
    const gap = index - previousKnownIndex;
    for (let missingIndex = previousKnownIndex + 1; missingIndex < index; missingIndex += 1) {
      const fraction = (missingIndex - previousKnownIndex) / gap;
      filled[missingIndex] = filled[previousKnownIndex] + (filled[index] - filled[previousKnownIndex]) * fraction;
    }
    previousKnownIndex = index;
  }
  return filled.map((position) => roundTo(position, 2));
}

function serializeGradient(model, colorFormat) {
  const functionName = `${model.isRepeating ? "repeating-" : ""}${model.kind}-gradient`;
  const stops = sortStops(model.stops).map((stop) => `${formatColor(stop.color, colorFormat)} ${formatStopPosition(stop)}`);
  const config = serializeGradientConfig(model);
  return `${functionName}(${[config, ...stops].filter(Boolean).join(", ")})`;
}

function serializeGradientConfig(model) {
  const parts = [];
  if (model.kind === GRADIENT_KINDS.LINEAR) {
    if (model.sideKeyword) parts.push(`to ${model.sideKeyword}`);
    else if (model.angle !== DEFAULT_LINEAR_ANGLE_DEGREES) parts.push(`${formatNumber(model.angle, 1)}deg`);
  }
  if (model.kind === GRADIENT_KINDS.RADIAL) {
    if (model.shape === RADIAL_SHAPES.CIRCLE) parts.push(RADIAL_SHAPES.CIRCLE);
    if (model.size !== DEFAULT_RADIAL_SIZE) parts.push(model.size);
  }
  if (model.kind === GRADIENT_KINDS.CONIC && model.fromAngle !== 0) parts.push(`from ${formatNumber(model.fromAngle, 1)}deg`);
  const isCentered = model.centerX === CENTER_PERCENT && model.centerY === CENTER_PERCENT;
  if (model.kind !== GRADIENT_KINDS.LINEAR && !isCentered) parts.push(`at ${formatNumber(model.centerX, 1)}% ${formatNumber(model.centerY, 1)}%`);
  if (model.interpolation.space) parts.push(serializeInterpolation(model.interpolation));
  return parts.join(" ");
}

function serializeInterpolation({ space, hueMethod }) {
  const hasHueMethod = hueMethod && POLAR_INTERPOLATION_SPACES.includes(space);
  return hasHueMethod ? `in ${space} ${hueMethod} hue` : `in ${space}`;
}

function formatStopPosition(stop) {
  return stop.position === 0 ? "0" : `${formatNumber(stop.position, 2)}${stop.unit}`;
}

function sortStops(stops) {
  return [...stops].sort((first, second) => first.position - second.position);
}

function colorAtPosition(stops, position) {
  const sorted = sortStops(stops);
  const nextIndex = sorted.findIndex((stop) => stop.position >= position);
  if (nextIndex === -1) return { ...sorted.at(-1).color };
  if (nextIndex === 0) return { ...sorted[0].color };
  const previous = sorted[nextIndex - 1];
  const next = sorted[nextIndex];
  const span = next.position - previous.position;
  return mixColors(previous.color, next.color, span === 0 ? 0 : (position - previous.position) / span);
}

function stopBarRange(stops) {
  if (stops[0]?.unit !== "px") return 100;
  return Math.max(100, ...stops.map((stop) => stop.position));
}

class GradientEditor extends LitElement {
  static properties = {
    model: { attribute: false },
    colorFormat: {},
    selectedStopId: { state: true }
  };

  static styles = [editorStyles, handleStyles, css`
    .gradient-box {
      position: relative;
      width: min(100%, 40rem);
      aspect-ratio: 16 / 10;
      border-radius: 14px;
      box-shadow: 0 0 0 1px rgb(0 0 0 / 0.08), 0 12px 32px rgb(0 0 0 / 0.18);
    }

    .stops-bar {
      position: relative;
      height: 1.6rem;
      margin: 0 0.5rem 1.4rem;
      border-radius: 6px;
      background: var(--bar-gradient), var(--checkerboard);
      box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.15);
      cursor: copy;
      touch-action: none;
    }

    .stop-handle {
      position: absolute;
      top: calc(100% + 0.15rem);
      width: 1.1rem;
      height: 1.1rem;
      margin-left: -0.55rem;
      padding: 0;
      border: 2px solid var(--surface);
      border-radius: 4px;
      background: linear-gradient(var(--stop-color), var(--stop-color)), var(--checkerboard);
      box-shadow: 0 0 0 1px var(--line);
      cursor: grab;
      touch-action: none;
    }

    .stop-handle::before {
      content: "";
      position: absolute;
      left: 50%;
      bottom: 100%;
      width: 2px;
      height: 1rem;
      background: var(--muted);
      transform: translateX(-50%);
    }

    .stop-handle[aria-pressed="true"] {
      box-shadow: 0 0 0 2px var(--accent);
    }

    .stop-handle[aria-pressed="true"]::before {
      background: var(--accent);
    }

    .angle-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .angle-row scrub-number {
      flex: 1;
      min-width: 0;
      grid-template-columns: 3rem minmax(0, 1fr) 4.2rem;
    }

    select {
      flex: 1;
      min-width: 0;
    }
  `];

  constructor() {
    super();
    this.selectedStopId = null;
    this.colorFormat = COLOR_FORMATS.HEX;
  }

  willUpdate() {
    const hasSelectedStop = this.model?.stops.some((stop) => stop.id === this.selectedStopId);
    if (this.model && !hasSelectedStop) this.selectedStopId = this.model.stops[0]?.id ?? null;
  }

  render() {
    if (!this.model) return nothing;
    const gradientCss = serializeGradient(this.model, COLOR_FORMATS.RGB);
    const hasCenter = this.model.kind !== GRADIENT_KINDS.LINEAR;
    return html`
      <div class="preview">
        <preview-stage>
          <div class="gradient-box" style="background-image: ${gradientCss}">
            ${hasCenter ? renderHandle({
              x: this.model.centerX,
              y: this.model.centerY,
              label: "Gradient center",
              onPointerDown: (event) => this.startCenterDrag(event),
              onKeyDown: (event) => this.nudgeCenter(event)
            }) : nothing}
          </div>
        </preview-stage>
      </div>
      <div class="controls">
        ${renderPresetSection(GRADIENT_PRESETS, (presetCss) => this.emitModel(parseGradient(presetCss)))}
        ${this.renderTypeSection()}
        ${this.renderStopsSection()}
      </div>
    `;
  }

  renderTypeSection() {
    const { kind, isRepeating, interpolation } = this.model;
    return html`
      <section class="section">
        <h3 class="section-heading">Type</h3>
        <div class="row">
          <segmented-choice label="Gradient type" .value=${kind}
            .options=${[{ value: "linear", label: "Linear" }, { value: "radial", label: "Radial" }, { value: "conic", label: "Conic" }]}
            @value-change=${(event) => this.applyChanges({ kind: event.detail })}></segmented-choice>
          <button class="button" type="button" aria-pressed=${String(isRepeating)}
            @click=${() => this.applyChanges({ isRepeating: !isRepeating })}>Repeating</button>
        </div>
        ${kind === GRADIENT_KINDS.LINEAR ? this.renderAngleRow("Angle", this.model.angle, (angle) => this.applyChanges({ angle, sideKeyword: null })) : nothing}
        ${kind === GRADIENT_KINDS.CONIC ? this.renderAngleRow("From", this.model.fromAngle, (fromAngle) => this.applyChanges({ fromAngle })) : nothing}
        ${kind === GRADIENT_KINDS.RADIAL ? this.renderRadialShapeControls() : nothing}
        ${kind !== GRADIENT_KINDS.LINEAR ? html`
          <scrub-number label="Center X" unit="%" min="0" max="100" .value=${this.model.centerX}
            @value-change=${(event) => this.applyChanges({ centerX: event.detail })}></scrub-number>
          <scrub-number label="Center Y" unit="%" min="0" max="100" .value=${this.model.centerY}
            @value-change=${(event) => this.applyChanges({ centerY: event.detail })}></scrub-number>
        ` : nothing}
        <div class="row">
          <span class="row-label">Blend in</span>
          <select aria-label="Interpolation color space" @change=${(event) => this.applyChanges({ interpolation: { ...interpolation, space: event.target.value } })}>
            ${INTERPOLATION_SPACES.map((space) => html`<option value=${space} ?selected=${space === interpolation.space}>${space || "default (sRGB)"}</option>`)}
          </select>
        </div>
        ${POLAR_INTERPOLATION_SPACES.includes(interpolation.space) ? html`
          <div class="row">
            <span class="row-label">Hue path</span>
            <select aria-label="Hue interpolation" @change=${(event) => this.applyChanges({ interpolation: { ...interpolation, hueMethod: event.target.value } })}>
              ${HUE_INTERPOLATION_METHODS.map((method) => html`<option value=${method} ?selected=${method === interpolation.hueMethod}>${method || "shorter (default)"}</option>`)}
            </select>
          </div>
        ` : nothing}
      </section>
    `;
  }

  renderAngleRow(label, angle, onAngleChange) {
    return html`
      <div class="angle-row">
        <angle-dial label=${label} .angle=${angle} @value-change=${(event) => onAngleChange(event.detail)}></angle-dial>
        <scrub-number label=${label} unit="deg" min="0" max="360" .value=${roundTo(angle, 1)}
          @value-change=${(event) => onAngleChange(event.detail)}></scrub-number>
      </div>
    `;
  }

  renderRadialShapeControls() {
    return html`
      <div class="row">
        <span class="row-label">Shape</span>
        <segmented-choice label="Radial shape" .value=${this.model.shape}
          .options=${[{ value: "ellipse", label: "Ellipse" }, { value: "circle", label: "Circle" }]}
          @value-change=${(event) => this.applyChanges({ shape: event.detail })}></segmented-choice>
      </div>
      <div class="row">
        <span class="row-label">Size</span>
        <select aria-label="Radial size" @change=${(event) => this.applyChanges({ size: event.target.value })}>
          ${RADIAL_SIZES.map((size) => html`<option value=${size} ?selected=${size === this.model.size}>${size}</option>`)}
        </select>
      </div>
    `;
  }

  renderStopsSection() {
    const { stops } = this.model;
    const range = stopBarRange(stops);
    const barStops = sortStops(stops).map((stop) => `${formatColor(stop.color, COLOR_FORMATS.RGB)} ${stop.position / range * 100}%`);
    const selectedStop = stops.find((stop) => stop.id === this.selectedStopId);
    return html`
      <section class="section">
        <h3 class="section-heading">
          Color stops
          <span class="row">
            <button class="button button--small" type="button" @click=${this.reverseStops}>Reverse</button>
            <button class="button button--small" type="button" @click=${this.spaceStopsEvenly}>Even</button>
          </span>
        </h3>
        <div class="stops-bar" style="--bar-gradient: linear-gradient(to right, ${barStops.join(", ")})"
          title="Click to add a stop" @pointerdown=${this.addStopAtPointer}>
          ${stops.map((stop) => html`
            <button class="stop-handle" type="button" style="left: ${stop.position / range * 100}%; --stop-color: ${formatColor(stop.color, COLOR_FORMATS.RGB)}"
              aria-label="Color stop at ${formatStopPosition(stop)}" aria-pressed=${String(stop.id === this.selectedStopId)}
              @pointerdown=${(event) => this.startStopDrag(event, stop.id)} @keydown=${(event) => this.handleStopKey(event, stop)}></button>
          `)}
        </div>
        <p class="hint">Click the bar to add a stop, drag stops to move them, press Delete to remove the selected one.</p>
        ${selectedStop ? html`
          <color-field label="Stop color" .color=${selectedStop.color} .colorFormat=${this.colorFormat}
            @color-change=${(event) => this.updateStop(selectedStop.id, { color: event.detail })}></color-field>
          <scrub-number label="Position" unit=${selectedStop.unit} min="0" max=${range} step="0.5" .value=${selectedStop.position}
            @value-change=${(event) => this.updateStop(selectedStop.id, { position: event.detail })}></scrub-number>
          <div class="row">
            <button class="button" type="button" ?disabled=${stops.length <= MINIMUM_STOP_COUNT}
              @click=${() => this.removeStop(selectedStop.id)}>Remove stop</button>
          </div>
        ` : nothing}
      </section>
    `;
  }

  startCenterDrag(event) {
    const box = this.renderRoot.querySelector(".gradient-box");
    event.currentTarget.focus();
    trackPointerDrag(event, box, (position) => {
      this.applyChanges({ centerX: roundTo(clamp(position.x, 0, 1) * 100, 1), centerY: roundTo(clamp(position.y, 0, 1) * 100, 1) });
    }, { isImmediate: false });
  }

  nudgeCenter(event) {
    const delta = arrowKeyDelta(event);
    if (!delta) return;
    event.preventDefault();
    this.applyChanges({ centerX: clamp(this.model.centerX + delta.x, 0, 100), centerY: clamp(this.model.centerY + delta.y, 0, 100) });
  }

  addStopAtPointer(event) {
    if (event.target !== event.currentTarget || event.button !== 0) return;
    const bar = event.currentTarget;
    const range = stopBarRange(this.model.stops);
    const fraction = clamp((event.clientX - bar.getBoundingClientRect().left) / bar.clientWidth, 0, 1);
    const position = roundTo(fraction * range, 1);
    const unit = this.model.stops[0].unit;
    const stop = { id: nextStopId++, color: colorAtPosition(this.model.stops, position), position, unit };
    this.selectedStopId = stop.id;
    this.applyChanges({ stops: [...this.model.stops, stop] });
    this.startStopDrag(event, stop.id);
  }

  startStopDrag(event, stopId) {
    event.stopPropagation();
    this.selectedStopId = stopId;
    const bar = this.renderRoot.querySelector(".stops-bar");
    const range = stopBarRange(this.model.stops);
    trackPointerDrag(event, bar, (position) => {
      this.updateStop(stopId, { position: roundTo(clamp(position.x, 0, 1) * range, 1) });
    }, { isImmediate: false });
  }

  handleStopKey(event, stop) {
    this.selectedStopId = stop.id;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      this.removeStop(stop.id);
      return;
    }
    const delta = arrowKeyDelta(event);
    if (!delta) return;
    event.preventDefault();
    this.updateStop(stop.id, { position: clamp(stop.position + (delta.x || -delta.y), 0, stopBarRange(this.model.stops)) });
  }

  removeStop(stopId) {
    if (this.model.stops.length <= MINIMUM_STOP_COUNT) return;
    this.applyChanges({ stops: this.model.stops.filter((stop) => stop.id !== stopId) });
  }

  reverseStops() {
    const range = stopBarRange(this.model.stops);
    this.applyChanges({ stops: this.model.stops.map((stop) => ({ ...stop, position: roundTo(range - stop.position, 2) })) });
  }

  spaceStopsEvenly() {
    const range = stopBarRange(this.model.stops);
    const lastIndex = this.model.stops.length - 1;
    const sorted = sortStops(this.model.stops);
    this.applyChanges({ stops: sorted.map((stop, index) => ({ ...stop, position: roundTo(index / lastIndex * range, 2) })) });
  }

  updateStop(stopId, changes) {
    this.applyChanges({ stops: this.model.stops.map((stop) => (stop.id === stopId ? { ...stop, ...changes } : stop)) });
  }

  applyChanges(changes) {
    this.emitModel({ ...this.model, ...changes });
  }

  emitModel(model) {
    emitEvent(this, "model-change", model);
  }
}

customElements.define("gradient-editor", GradientEditor);
