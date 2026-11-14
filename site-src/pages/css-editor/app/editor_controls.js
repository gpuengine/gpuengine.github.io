import { LitElement, html, css, svg, nothing } from "lit";
import { baseStyles, checkerboardStyles } from "./editor_styles.js";
import { trackPointerDrag, arrowKeyDelta, emitEvent } from "./pointer_tracking.js";
import { clamp, roundTo } from "./css_value_syntax.js";

const SCRUB_PIXELS_PER_STEP = 2;
const FAST_SCRUB_MULTIPLIER = 10;
const ANGLE_SNAP_DEGREES = 15;
const FULL_TURN_DEGREES = 360;
const BACKDROPS = Object.freeze(["checker", "light", "dark"]);
const BACKDROP_STORAGE_KEY = "css-editor-backdrop";

export class ScrubNumber extends LitElement {
  static properties = {
    label: {},
    value: { type: Number },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    unit: {}
  };

  static styles = [baseStyles, css`
    :host {
      display: grid;
      grid-template-columns: 5.5rem minmax(0, 1fr) 4.6rem;
      align-items: center;
      gap: 0.5rem;
    }

    .label {
      color: var(--muted);
      cursor: ew-resize;
      user-select: none;
      touch-action: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .label:hover {
      color: var(--text);
    }

    input[type="range"] {
      width: 100%;
      margin: 0;
      accent-color: var(--accent);
    }

    .number {
      display: flex;
      align-items: center;
      height: 1.75rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--bg);
    }

    .number:focus-within {
      border-color: var(--accent);
    }

    input[type="number"] {
      width: 100%;
      min-width: 0;
      padding: 0 0 0 0.4rem;
      border: 0;
      background: none;
      font: 0.78rem var(--mono);
      outline: none;
      appearance: textfield;
      -moz-appearance: textfield;
    }

    input[type="number"]::-webkit-inner-spin-button {
      display: none;
    }

    .unit {
      padding-right: 0.4rem;
      color: var(--muted);
      font: 0.72rem var(--mono);
    }
  `];

  constructor() {
    super();
    this.label = "";
    this.value = 0;
    this.min = 0;
    this.max = 100;
    this.step = 1;
    this.unit = "";
  }

  render() {
    return html`
      <span class="label" title="Drag to adjust" @pointerdown=${this.startScrub}>${this.label}</span>
      <input type="range" aria-label=${this.label} min=${this.min} max=${this.max} step=${this.step}
        .value=${String(clamp(this.value, this.min, this.max))} @input=${this.handleRangeInput}>
      <span class="number">
        <input type="number" aria-label="${this.label} value" step=${this.step} @input=${this.handleNumberInput} @blur=${this.syncNumberInput}>
        <span class="unit">${this.unit}</span>
      </span>
    `;
  }

  updated() {
    const numberInput = this.renderRoot.querySelector('input[type="number"]');
    const isEditing = this.renderRoot.activeElement === numberInput;
    if (!isEditing || Number(numberInput.value) !== this.value) this.syncNumberInput();
  }

  syncNumberInput() {
    this.renderRoot.querySelector('input[type="number"]').value = String(this.value);
  }

  handleRangeInput(event) {
    this.emitValue(Number(event.target.value));
  }

  handleNumberInput(event) {
    const typedValue = event.target.valueAsNumber;
    if (Number.isFinite(typedValue)) this.emitValue(typedValue);
  }

  startScrub(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startValue = this.value;
    trackPointerDrag(event, this, (position, moveEvent) => {
      const stepsMoved = Math.round((moveEvent.clientX - startX) / SCRUB_PIXELS_PER_STEP);
      const multiplier = moveEvent.shiftKey ? FAST_SCRUB_MULTIPLIER : 1;
      this.emitValue(startValue + stepsMoved * this.step * multiplier);
    }, { isImmediate: false });
  }

  emitValue(value) {
    emitEvent(this, "value-change", roundTo(value, decimalsInStep(this.step)));
  }
}

export class SegmentedChoice extends LitElement {
  static properties = {
    label: {},
    options: { attribute: false },
    value: {}
  };

  static styles = [baseStyles, css`
    :host {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 0;
    }

    .button {
      border-radius: 0;
      margin-left: -1px;
    }

    .button:first-child {
      margin-left: 0;
      border-radius: 6px 0 0 6px;
    }

    .button:last-child {
      border-radius: 0 6px 6px 0;
    }
  `];

  constructor() {
    super();
    this.options = [];
  }

  render() {
    return html`<span role="group" aria-label=${this.label ?? ""} style="display: contents">${this.options.map((option) => html`
      <button class="button" type="button" aria-pressed=${String(option.value === this.value)}
        @click=${() => emitEvent(this, "value-change", option.value)}>${option.label}</button>
    `)}</span>`;
  }
}

export class XyPad extends LitElement {
  static properties = {
    x: { type: Number },
    y: { type: Number },
    range: { type: Number },
    label: {}
  };

  static styles = [baseStyles, css`
    :host {
      display: block;
      width: 8.5rem;
      flex: none;
    }

    .pad {
      position: relative;
      aspect-ratio: 1;
      border: 1px solid var(--line);
      border-radius: 8px;
      background:
        linear-gradient(var(--line), var(--line)) center / 1px 100% no-repeat,
        linear-gradient(var(--line), var(--line)) center / 100% 1px no-repeat,
        var(--bg);
      touch-action: none;
      cursor: crosshair;
      user-select: none;
    }

    svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;
      pointer-events: none;
    }

    line {
      stroke: var(--accent);
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
    }

    circle {
      fill: var(--accent);
      stroke: var(--surface);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
    }
  `];

  constructor() {
    super();
    this.x = 0;
    this.y = 0;
    this.range = 50;
    this.label = "Offset";
  }

  render() {
    const thumbX = 50 + clamp(this.x / this.range, -1, 1) * 50;
    const thumbY = 50 + clamp(this.y / this.range, -1, 1) * 50;
    return html`
      <div class="pad" role="slider" tabindex="0" aria-label=${this.label}
        aria-valuetext="x ${this.x}, y ${this.y}" @pointerdown=${this.startDrag} @keydown=${this.handleKeyDown}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1="50" y1="50" x2=${thumbX} y2=${thumbY}></line>
        </svg>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx=${thumbX} cy=${thumbY} r="6"></circle>
        </svg>
      </div>
    `;
  }

  startDrag(event) {
    const pad = event.currentTarget;
    pad.focus();
    trackPointerDrag(event, pad, (position) => {
      const toOffset = (fraction) => Math.round((clamp(fraction, 0, 1) - 0.5) * 2 * this.range);
      emitEvent(this, "value-change", { x: toOffset(position.x), y: toOffset(position.y) });
    });
  }

  handleKeyDown(event) {
    const delta = arrowKeyDelta(event);
    if (!delta) return;
    event.preventDefault();
    emitEvent(this, "value-change", { x: this.x + delta.x, y: this.y + delta.y });
  }
}

export class AngleDial extends LitElement {
  static properties = {
    angle: { type: Number },
    label: {}
  };

  static styles = [baseStyles, css`
    :host {
      display: inline-block;
      flex: none;
    }

    .dial {
      position: relative;
      width: 3.4rem;
      height: 3.4rem;
      border: 1px solid var(--line);
      border-radius: 50%;
      background: var(--bg);
      touch-action: none;
      cursor: grab;
      user-select: none;
    }

    .hand {
      position: absolute;
      left: calc(50% - 1px);
      top: 12%;
      width: 2px;
      height: 38%;
      border-radius: 1px;
      background: var(--accent);
      transform-origin: 50% 100%;
    }

    .hand::before {
      content: "";
      position: absolute;
      left: 50%;
      top: 0;
      width: 0.6rem;
      height: 0.6rem;
      border-radius: 50%;
      background: var(--accent);
      transform: translate(-50%, -50%);
    }
  `];

  constructor() {
    super();
    this.angle = 0;
    this.label = "Angle";
  }

  render() {
    return html`
      <div class="dial" role="slider" tabindex="0" aria-label=${this.label} aria-valuemin="0" aria-valuemax="360"
        aria-valuenow=${this.angle} @pointerdown=${this.startDrag} @keydown=${this.handleKeyDown}>
        <span class="hand" style="transform: rotate(${this.angle}deg)"></span>
      </div>
    `;
  }

  startDrag(event) {
    const dial = event.currentTarget;
    dial.focus();
    trackPointerDrag(event, dial, (position, moveEvent) => {
      const radians = Math.atan2(position.x - 0.5, 0.5 - position.y);
      const degrees = (radians * 180 / Math.PI + FULL_TURN_DEGREES) % FULL_TURN_DEGREES;
      const snapSize = moveEvent.shiftKey ? ANGLE_SNAP_DEGREES : 1;
      emitEvent(this, "value-change", (Math.round(degrees / snapSize) * snapSize) % FULL_TURN_DEGREES);
    });
  }

  handleKeyDown(event) {
    const delta = arrowKeyDelta(event, { step: 1, largeStep: ANGLE_SNAP_DEGREES });
    if (!delta) return;
    event.preventDefault();
    const change = delta.x || -delta.y;
    emitEvent(this, "value-change", (this.angle + change + FULL_TURN_DEGREES) % FULL_TURN_DEGREES);
  }
}

export class PreviewStage extends LitElement {
  static properties = {
    backdrop: { state: true }
  };

  static styles = [baseStyles, checkerboardStyles, css`
    :host {
      position: relative;
      display: block;
      min-height: 0;
      overflow: hidden;
    }

    .stage {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 2.5rem 1.5rem;
      overflow: auto;
    }

    .stage[data-backdrop="checker"] {
      background: var(--checkerboard);
      color: #1c1612;
    }

    .stage[data-backdrop="light"] {
      background: #f5f1ed;
      color: #1c1612;
    }

    .stage[data-backdrop="dark"] {
      background: #14110f;
      color: #ede7e2;
    }

    .backdrop-choice {
      position: absolute;
      top: 0.6rem;
      right: 0.6rem;
      z-index: 2;
      display: flex;
      gap: 0.3rem;
      padding: 0.25rem;
      border-radius: 999px;
      background: rgb(0 0 0 / 0.35);
      backdrop-filter: blur(6px);
    }

    .backdrop-button {
      width: 1.2rem;
      height: 1.2rem;
      padding: 0;
      border: 2px solid transparent;
      border-radius: 50%;
      cursor: pointer;
    }

    .backdrop-button[aria-pressed="true"] {
      border-color: var(--accent);
    }

    .backdrop-button[data-backdrop="checker"] {
      background: repeating-conic-gradient(#cfc8c2 0 25%, #fbf9f7 0 50%) 0 0 / 6px 6px;
    }

    .backdrop-button[data-backdrop="light"] {
      background: #f5f1ed;
    }

    .backdrop-button[data-backdrop="dark"] {
      background: #14110f;
      box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.3);
    }
  `];

  constructor() {
    super();
    this.backdrop = readStoredBackdrop();
  }

  render() {
    return html`
      <div class="stage" data-backdrop=${this.backdrop}><slot></slot></div>
      <div class="backdrop-choice" role="group" aria-label="Preview background">
        ${BACKDROPS.map((backdrop) => html`
          <button class="backdrop-button" type="button" data-backdrop=${backdrop} aria-label="${backdrop} background"
            aria-pressed=${String(backdrop === this.backdrop)} @click=${() => this.chooseBackdrop(backdrop)}></button>
        `)}
      </div>
    `;
  }

  chooseBackdrop(backdrop) {
    this.backdrop = backdrop;
    try {
      localStorage.setItem(BACKDROP_STORAGE_KEY, backdrop);
    } catch {
      return;
    }
  }
}

export function renderHandle({ x, y, label, isSelected = false, onPointerDown, onKeyDown, onDoubleClick }) {
  return html`<button class="handle" type="button" aria-label=${label} aria-pressed=${String(isSelected)}
    style="left: ${x}%; top: ${y}%" @pointerdown=${onPointerDown} @keydown=${onKeyDown} @dblclick=${onDoubleClick}></button>`;
}

export function renderPresetSection(presets, onPick, renderThumbnail = () => nothing) {
  return html`
    <section class="section">
      <h3 class="section-heading">Presets</h3>
      <div class="preset-list">
        ${presets.map((preset) => html`
          <button class="preset-button" type="button" title=${preset.css} @click=${() => onPick(preset.css)}>
            ${renderThumbnail(preset)}${preset.label}
          </button>
        `)}
      </div>
    </section>
  `;
}

export function replaceAt(items, index, replacement) {
  return items.map((item, itemIndex) => (itemIndex === index ? replacement : item));
}

export function removeAt(items, index) {
  return items.filter((item, itemIndex) => itemIndex !== index);
}

export function moveItem(items, index, offset) {
  const targetIndex = index + offset;
  if (targetIndex < 0 || targetIndex >= items.length) return items;
  const reordered = [...items];
  [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
  return reordered;
}

export const handleStyles = css`
  .handle {
    position: absolute;
    z-index: 3;
    width: 0.95rem;
    height: 0.95rem;
    margin: -0.475rem 0 0 -0.475rem;
    padding: 0;
    border: 2px solid #fff;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 1px rgb(0 0 0 / 0.45), 0 2px 6px rgb(0 0 0 / 0.35);
    cursor: grab;
    touch-action: none;
  }

  .handle::after {
    content: "";
    position: absolute;
    inset: -0.6rem;
  }

  .handle[aria-pressed="true"] {
    background: #fff;
    border-color: var(--accent);
  }

  .handle:active {
    cursor: grabbing;
  }
`;

export function renderOutlinePath(pathData) {
  return svg`<path d=${pathData} fill="none" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"></path>
    <path d=${pathData} fill="none" stroke="#000" stroke-width="1" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"></path>`;
}

function decimalsInStep(step) {
  const [, fraction = ""] = String(step).split(".");
  return fraction.length;
}

function readStoredBackdrop() {
  try {
    const stored = localStorage.getItem(BACKDROP_STORAGE_KEY);
    return BACKDROPS.includes(stored) ? stored : BACKDROPS[0];
  } catch {
    return BACKDROPS[0];
  }
}

customElements.define("scrub-number", ScrubNumber);
customElements.define("segmented-choice", SegmentedChoice);
customElements.define("xy-pad", XyPad);
customElements.define("angle-dial", AngleDial);
customElements.define("preview-stage", PreviewStage);
