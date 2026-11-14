import { LitElement, html, css, nothing } from "lit";
import { editorStyles } from "./editor_styles.js";
import { renderPresetSection } from "./editor_controls.js";
import { parseFunctionList, serializeFunctionList, PARAMETER_TYPES } from "./function_list_editor.js";
import { splitWhitespace, parseNumberWithUnit, parsePixels, parseAngleDegrees, formatNumber, formatLength, roundTo, clamp } from "./css_value_syntax.js";
import { parseColor, formatColor, createColor, COLOR_FORMATS } from "./color_model.js";
import { trackPointerDrag, emitEvent } from "./pointer_tracking.js";

const PREVIEW_IMAGE_URL = "/site/media/hero-poster.jpg";
const DEFAULT_COMPARE_PERCENT = 50;

const FILTER_KINDS = [
  pixelFilter({ name: "blur", label: "Blur", maximum: 40, defaultValue: 4 }),
  percentFilter({ name: "brightness", label: "Brightness", maximum: 300, defaultValue: 120 }),
  percentFilter({ name: "contrast", label: "Contrast", maximum: 300, defaultValue: 130 }),
  percentFilter({ name: "saturate", label: "Saturate", maximum: 300, defaultValue: 160 }),
  percentFilter({ name: "grayscale", label: "Grayscale", maximum: 100, defaultValue: 100 }),
  percentFilter({ name: "sepia", label: "Sepia", maximum: 100, defaultValue: 80 }),
  percentFilter({ name: "invert", label: "Invert", maximum: 100, defaultValue: 100 }),
  percentFilter({ name: "opacity", label: "Opacity", maximum: 100, defaultValue: 50 }),
  {
    name: "hue-rotate",
    label: "Hue rotate",
    cssNames: ["hue-rotate"],
    parameters: [{ label: "Angle", unit: "deg", min: -180, max: 180, step: 1, defaultValue: 90 }],
    parseCall: (name, argumentsText) => {
      const degrees = argumentsText === "" ? 0 : parseAngleDegrees(argumentsText);
      return degrees === null ? null : [roundTo(degrees, 2)];
    },
    formatCall: ([degrees]) => `hue-rotate(${formatNumber(degrees, 1)}deg)`
  },
  {
    name: "drop-shadow",
    label: "Drop shadow",
    cssNames: ["drop-shadow"],
    parameters: [
      { label: "X", unit: "px", min: -60, max: 60, step: 1, defaultValue: 0 },
      { label: "Y", unit: "px", min: -60, max: 60, step: 1, defaultValue: 8 },
      { label: "Blur", unit: "px", min: 0, max: 60, step: 1, defaultValue: 12 },
      { label: "Color", type: PARAMETER_TYPES.COLOR, defaultValue: createColor(0, 0, 0, 0.5) }
    ],
    parseCall: (name, argumentsText) => parseDropShadowArguments(argumentsText),
    formatCall: ([offsetX, offsetY, blur, color], colorFormat) =>
      `drop-shadow(${formatLength(offsetX, "px")} ${formatLength(offsetY, "px")} ${formatLength(blur, "px")} ${formatColor(color, colorFormat)})`
  }
];

const FILTER_PRESETS = [
  { label: "Vintage", css: "sepia(60%) contrast(110%) brightness(105%) saturate(80%)" },
  { label: "Noir", css: "grayscale(100%) contrast(140%) brightness(90%)" },
  { label: "Vivid", css: "saturate(180%) contrast(110%)" },
  { label: "Faded", css: "contrast(80%) brightness(115%) saturate(70%)" },
  { label: "Night vision", css: "grayscale(100%) sepia(100%) hue-rotate(60deg) saturate(400%) brightness(80%)" },
  { label: "Frosted", css: "blur(6px) brightness(115%)" },
  { label: "Negative", css: "invert(100%) hue-rotate(180deg)" },
  { label: "Sticker", css: "drop-shadow(0 0 2px #fff) drop-shadow(0 6px 10px rgb(0 0 0 / 0.5))" }
];

export const filterDefinition = {
  id: "filter",
  label: "Filter",
  group: "Effects",
  properties: ["filter", "backdrop-filter"],
  presets: FILTER_PRESETS,
  parse: (value) => parseFunctionList(value, FILTER_KINDS),
  serialize: (model, colorFormat) => serializeFunctionList(model, FILTER_KINDS, colorFormat),
  render: ({ model, colorFormat, onChange }) => html`<filter-editor .model=${model} .colorFormat=${colorFormat}
    @model-change=${onChange}></filter-editor>`
};

function pixelFilter({ name, label, maximum, defaultValue }) {
  return {
    name,
    label,
    cssNames: [name],
    parameters: [{ label: "Radius", unit: "px", min: 0, max: maximum, step: 0.5, defaultValue }],
    parseCall: (callName, argumentsText) => {
      const pixels = argumentsText === "" ? 0 : parsePixels(argumentsText);
      return pixels === null || pixels < 0 ? null : [pixels];
    },
    formatCall: ([pixels]) => `${name}(${formatLength(pixels, "px")})`
  };
}

function percentFilter({ name, label, maximum, defaultValue }) {
  return {
    name,
    label,
    cssNames: [name],
    parameters: [{ label: "Amount", unit: "%", min: 0, max: maximum, step: 1, defaultValue }],
    parseCall: (callName, argumentsText) => {
      if (argumentsText === "") return [100];
      const parsed = parseNumberWithUnit(argumentsText);
      if (!parsed || !(parsed.unit === "" || parsed.unit === "%") || parsed.number < 0) return null;
      return [roundTo(parsed.unit === "%" ? parsed.number : parsed.number * 100, 2)];
    },
    formatCall: ([percent]) => `${name}(${formatNumber(percent, 1)}%)`
  };
}

function parseDropShadowArguments(argumentsText) {
  const lengths = [];
  let color = null;
  for (const token of splitWhitespace(argumentsText)) {
    const pixels = parsePixels(token);
    if (pixels !== null) {
      lengths.push(pixels);
      continue;
    }
    if (color) return null;
    color = parseColor(token);
    if (!color) return null;
  }
  if (lengths.length < 2 || lengths.length > 3) return null;
  const [offsetX, offsetY, blur = 0] = lengths;
  return [offsetX, offsetY, blur, color ?? createColor(0, 0, 0, 1)];
}

class FilterEditor extends LitElement {
  static properties = {
    model: { attribute: false },
    colorFormat: {},
    comparePercent: { state: true }
  };

  static styles = [editorStyles, css`
    .compare {
      position: relative;
      width: min(40rem, 100%);
      aspect-ratio: 16 / 9;
      overflow: hidden;
      border-radius: 12px;
      user-select: none;
      touch-action: none;
      cursor: ew-resize;
    }

    .compare img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
    }

    .divider {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      margin-left: -1px;
      background: #fff;
      box-shadow: 0 0 0 1px rgb(0 0 0 / 0.3);
      pointer-events: none;
    }

    .divider::after {
      content: "⇆";
      position: absolute;
      top: 50%;
      left: 50%;
      display: grid;
      place-items: center;
      width: 1.8rem;
      height: 1.8rem;
      border-radius: 50%;
      background: #fff;
      color: #1c1612;
      font-size: 0.9rem;
      transform: translate(-50%, -50%);
      box-shadow: 0 2px 8px rgb(0 0 0 / 0.35);
    }

    .compare-label {
      position: absolute;
      bottom: 0.5rem;
      padding: 0.1rem 0.5rem;
      border-radius: 999px;
      background: rgb(0 0 0 / 0.55);
      color: #fff;
      font-size: 0.72rem;
      pointer-events: none;
    }
  `];

  constructor() {
    super();
    this.comparePercent = DEFAULT_COMPARE_PERCENT;
    this.colorFormat = COLOR_FORMATS.HEX;
  }

  render() {
    if (!this.model) return nothing;
    const filterCss = serializeFunctionList(this.model, FILTER_KINDS, COLOR_FORMATS.RGB);
    return html`
      <div class="preview">
        <preview-stage>
          <div class="compare" role="slider" tabindex="0" aria-label="Before and after divider" aria-valuemin="0" aria-valuemax="100"
            aria-valuenow=${Math.round(this.comparePercent)} @pointerdown=${this.startCompareDrag} @keydown=${this.handleCompareKey}>
            <img src=${PREVIEW_IMAGE_URL} alt="">
            <img src=${PREVIEW_IMAGE_URL} alt="" style="filter: ${filterCss}; clip-path: inset(0 0 0 ${this.comparePercent}%)">
            <span class="divider" style="left: ${this.comparePercent}%"></span>
            <span class="compare-label" style="left: 0.5rem">Original</span>
            <span class="compare-label" style="right: 0.5rem">Filtered</span>
          </div>
        </preview-stage>
      </div>
      <div class="controls">
        ${renderPresetSection(FILTER_PRESETS, (presetCss) => emitEvent(this, "model-change", filterDefinition.parse(presetCss)))}
        <section class="section">
          <function-list-controls heading="Filters, applied in order" .kinds=${FILTER_KINDS} .model=${this.model}
            .colorFormat=${this.colorFormat} @model-change=${(event) => emitEvent(this, "model-change", event.detail)}></function-list-controls>
        </section>
      </div>
    `;
  }

  startCompareDrag(event) {
    event.currentTarget.focus();
    trackPointerDrag(event, event.currentTarget, (position) => {
      this.comparePercent = clamp(position.x, 0, 1) * 100;
    });
  }

  handleCompareKey(event) {
    const step = event.shiftKey ? 10 : 2;
    if (event.key === "ArrowLeft") this.comparePercent = clamp(this.comparePercent - step, 0, 100);
    else if (event.key === "ArrowRight") this.comparePercent = clamp(this.comparePercent + step, 0, 100);
    else return;
    event.preventDefault();
  }
}

customElements.define("filter-editor", FilterEditor);
