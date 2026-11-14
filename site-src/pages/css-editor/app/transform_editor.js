import { LitElement, html, css, nothing } from "lit";
import { editorStyles } from "./editor_styles.js";
import { renderPresetSection } from "./editor_controls.js";
import { parseFunctionList, serializeFunctionList } from "./function_list_editor.js";
import { splitTopLevel, parseNumberWithUnit, parsePixels, parseAngleDegrees, formatNumber, formatLength, roundTo } from "./css_value_syntax.js";
import { emitEvent } from "./pointer_tracking.js";

const AXIS_INDEX = Object.freeze({ x: 0, y: 1 });

const TRANSFORM_KINDS = [
  {
    name: "translate",
    label: "Translate",
    cssNames: ["translate", "translatex", "translatey"],
    parameters: [
      { label: "X", unit: "px", min: -200, max: 200, step: 1, defaultValue: 40 },
      { label: "Y", unit: "px", min: -200, max: 200, step: 1, defaultValue: 0 }
    ],
    parseCall: (name, argumentsText) => parseAxisPair(name, argumentsText, parsePixels, 0),
    formatCall: ([x, y]) => `translate(${formatLength(x, "px")}, ${formatLength(y, "px")})`
  },
  singleAngleKind({ name: "rotate", label: "Rotate", cssNames: ["rotate", "rotatez"], defaultValue: 15 }),
  {
    name: "scale",
    label: "Scale",
    cssNames: ["scale", "scalex", "scaley"],
    parameters: [
      { label: "X", unit: "×", min: 0, max: 3, step: 0.05, defaultValue: 1.2 },
      { label: "Y", unit: "×", min: 0, max: 3, step: 0.05, defaultValue: 1.2 }
    ],
    parseCall: (name, argumentsText) => {
      const pair = parseAxisPair(name, argumentsText, parseScaleFactor, 1);
      if (pair && name === "scale" && splitTopLevel(argumentsText, ",").length === 1) pair[1] = pair[0];
      return pair;
    },
    formatCall: ([x, y]) => (x === y ? `scale(${formatNumber(x, 3)})` : `scale(${formatNumber(x, 3)}, ${formatNumber(y, 3)})`)
  },
  {
    name: "skew",
    label: "Skew",
    cssNames: ["skew", "skewx", "skewy"],
    parameters: [
      { label: "X", unit: "deg", min: -70, max: 70, step: 1, defaultValue: 10 },
      { label: "Y", unit: "deg", min: -70, max: 70, step: 1, defaultValue: 0 }
    ],
    parseCall: (name, argumentsText) => parseAxisPair(name, argumentsText, parseAngleDegrees, 0),
    formatCall: ([x, y]) => `skew(${formatLength(x, "deg")}, ${formatLength(y, "deg")})`
  },
  singleAngleKind({ name: "rotateX", label: "Rotate X (3D)", cssNames: ["rotatex"], defaultValue: 30 }),
  singleAngleKind({ name: "rotateY", label: "Rotate Y (3D)", cssNames: ["rotatey"], defaultValue: 30 }),
  {
    name: "perspective",
    label: "Perspective",
    cssNames: ["perspective"],
    parameters: [{ label: "Distance", unit: "px", min: 100, max: 2000, step: 10, defaultValue: 600 }],
    parseCall: (name, argumentsText) => {
      const pixels = parsePixels(argumentsText);
      return pixels === null || pixels < 0 ? null : [pixels];
    },
    formatCall: ([pixels]) => `perspective(${formatLength(pixels, "px")})`
  }
];

const TRANSFORM_PRESETS = [
  { label: "Tilted card", css: "perspective(800px) rotateX(20deg) rotateY(-25deg)" },
  { label: "Lift", css: "translate(0, -8px) scale(1.04)" },
  { label: "Slant", css: "skew(-12deg, 0)" },
  { label: "Spin", css: "rotate(45deg)" },
  { label: "Mirror", css: "scale(-1, 1)" },
  { label: "Isometric", css: "rotate(-30deg) skew(30deg, 0) scale(1, 0.86)" },
  { label: "Flip up", css: "perspective(600px) rotateX(55deg)" }
];

export const transformDefinition = {
  id: "transform",
  label: "Transform",
  group: "Shape",
  properties: ["transform"],
  presets: TRANSFORM_PRESETS,
  parse: (value) => parseFunctionList(value, TRANSFORM_KINDS),
  serialize: (model) => serializeFunctionList(model, TRANSFORM_KINDS),
  render: ({ model, onChange }) => html`<transform-editor .model=${model} @model-change=${onChange}></transform-editor>`
};

function singleAngleKind({ name, label, cssNames, defaultValue }) {
  return {
    name,
    label,
    cssNames,
    parameters: [{ label: "Angle", unit: "deg", min: -180, max: 180, step: 1, defaultValue }],
    parseCall: (callName, argumentsText) => {
      const degrees = parseAngleDegrees(argumentsText);
      return degrees === null ? null : [roundTo(degrees, 2)];
    },
    formatCall: ([degrees]) => `${name}(${formatLength(degrees, "deg")})`
  };
}

function parseAxisPair(name, argumentsText, parseComponent, neutralValue) {
  const parts = splitTopLevel(argumentsText, ",");
  const singleAxis = name.at(-1);
  if (singleAxis in AXIS_INDEX) {
    const value = parts.length === 1 ? parseComponent(parts[0]) : null;
    if (value === null) return null;
    const pair = [neutralValue, neutralValue];
    pair[AXIS_INDEX[singleAxis]] = roundTo(value, 3);
    return pair;
  }
  if (parts.length > 2) return null;
  const values = parts.map(parseComponent);
  if (values.includes(null)) return null;
  return [roundTo(values[0], 3), roundTo(values[1] ?? neutralValue, 3)];
}

function parseScaleFactor(token) {
  const parsed = parseNumberWithUnit(token);
  if (!parsed) return null;
  if (parsed.unit === "%") return parsed.number / 100;
  return parsed.unit === "" ? parsed.number : null;
}

class TransformEditor extends LitElement {
  static properties = {
    model: { attribute: false }
  };

  static styles = [editorStyles, css`
    .scene {
      position: relative;
      width: 11rem;
      aspect-ratio: 1;
    }

    .ghost, .card {
      position: absolute;
      inset: 0;
      border-radius: 14px;
    }

    .ghost {
      border: 2px dashed currentColor;
      opacity: 0.35;
    }

    .card {
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, #ff8a3d, #ff3d77 55%, #7c3aed);
      color: #fff;
      font: 800 2.2rem/1 system-ui, -apple-system, "Segoe UI", sans-serif;
      box-shadow: 0 14px 34px rgb(0 0 0 / 0.25);
      transition: transform 0.08s linear;
    }
  `];

  render() {
    if (!this.model) return nothing;
    const transformCss = serializeFunctionList(this.model, TRANSFORM_KINDS);
    return html`
      <div class="preview">
        <preview-stage>
          <div class="scene">
            <div class="ghost"></div>
            <div class="card" style="transform: ${transformCss}">Aa</div>
          </div>
        </preview-stage>
      </div>
      <div class="controls">
        ${renderPresetSection(TRANSFORM_PRESETS, (presetCss) => emitEvent(this, "model-change", transformDefinition.parse(presetCss)))}
        <section class="section">
          <function-list-controls heading="Functions, applied in order" .kinds=${TRANSFORM_KINDS} .model=${this.model}
            @model-change=${(event) => emitEvent(this, "model-change", event.detail)}></function-list-controls>
          <p class="hint">Order matters: each function transforms the result of the ones before it. Put perspective first for 3D rotations.</p>
        </section>
      </div>
    `;
  }
}

customElements.define("transform-editor", TransformEditor);
