import { LitElement, html, css, svg, nothing } from "lit";
import { editorStyles } from "./editor_styles.js";
import { renderPresetSection, renderHandle, handleStyles } from "./editor_controls.js";
import { parseFunctionCall, splitTopLevel, parseNumberWithUnit, formatNumber, roundTo, clamp } from "./css_value_syntax.js";
import { trackPointerDrag, arrowKeyDelta, emitEvent } from "./pointer_tracking.js";

const GRAPH_MINIMUM_Y = -0.5;
const GRAPH_MAXIMUM_Y = 1.5;
const GRAPH_RANGE_Y = GRAPH_MAXIMUM_Y - GRAPH_MINIMUM_Y;
const CONTROL_POINT_DECIMALS = 2;
const KEYBOARD_STEP = 0.01;
const KEYBOARD_LARGE_STEP = 0.1;
const DEFAULT_DURATION_MILLISECONDS = 1200;
const PAUSE_BETWEEN_RUNS_MILLISECONDS = 400;
const CURVE_SAMPLE_COUNT = 60;

const NAMED_EASINGS = Object.freeze({
  "linear": [0, 0, 1, 1],
  "ease": [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1]
});

const EASING_PRESETS = [
  { label: "ease", css: "ease" },
  { label: "ease-in", css: "ease-in" },
  { label: "ease-out", css: "ease-out" },
  { label: "ease-in-out", css: "ease-in-out" },
  { label: "linear", css: "linear" },
  { label: "Out back", css: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
  { label: "In back", css: "cubic-bezier(0.36, 0, 0.66, -0.56)" },
  { label: "Out expo", css: "cubic-bezier(0.16, 1, 0.3, 1)" },
  { label: "In-out cubic", css: "cubic-bezier(0.65, 0, 0.35, 1)" },
  { label: "Out quint", css: "cubic-bezier(0.22, 1, 0.36, 1)" },
  { label: "Snappy", css: "cubic-bezier(0.2, 0.9, 0.1, 1)" }
];

export const easingDefinition = {
  id: "easing",
  label: "Easing curve",
  group: "Motion",
  properties: ["transition-timing-function", "animation-timing-function"],
  presets: EASING_PRESETS,
  parse: parseEasing,
  serialize: serializeEasing,
  render: ({ model, onChange }) => html`<easing-editor .model=${model} @model-change=${onChange}></easing-editor>`
};

function parseEasing(value) {
  const keyword = value.trim().toLowerCase();
  if (keyword in NAMED_EASINGS) return controlPointsModel(NAMED_EASINGS[keyword]);
  const call = parseFunctionCall(value);
  if (!call || call.name !== "cubic-bezier") return null;
  const numbers = splitTopLevel(call.argumentsText, ",").map((token) => {
    const parsed = parseNumberWithUnit(token);
    return parsed && parsed.unit === "" ? parsed.number : null;
  });
  if (numbers.length !== 4 || numbers.includes(null)) return null;
  const [x1, , x2] = numbers;
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return null;
  return controlPointsModel(numbers);
}

function controlPointsModel([x1, y1, x2, y2]) {
  return { x1, y1, x2, y2 };
}

function serializeEasing(model) {
  const points = [model.x1, model.y1, model.x2, model.y2].map((value) => roundTo(value, CONTROL_POINT_DECIMALS));
  const matchingName = Object.keys(NAMED_EASINGS).find((name) => NAMED_EASINGS[name].every((value, index) => value === points[index]));
  return matchingName ?? `cubic-bezier(${points.map((value) => formatNumber(value, CONTROL_POINT_DECIMALS)).join(", ")})`;
}

function toGraphPercent(x, y) {
  return { left: x * 100, top: (GRAPH_MAXIMUM_Y - y) / GRAPH_RANGE_Y * 100 };
}

function toGraphUnits(x, y) {
  return `${x} ${GRAPH_MAXIMUM_Y - y}`;
}

function sampleCurvePathData({ x1, y1, x2, y2 }) {
  const pointAt = (t, start, end) => 3 * (1 - t) ** 2 * t * start + 3 * (1 - t) * t ** 2 * end + t ** 3;
  const samples = Array.from({ length: CURVE_SAMPLE_COUNT + 1 }, (unused, index) => {
    const t = index / CURVE_SAMPLE_COUNT;
    return toGraphUnits(pointAt(t, x1, x2), pointAt(t, y1, y2));
  });
  return `M ${samples.join(" L ")}`;
}

function prefersReducedMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

class EasingEditor extends LitElement {
  static properties = {
    model: { attribute: false },
    durationMilliseconds: { state: true }
  };

  static styles = [editorStyles, handleStyles, css`
    .layout {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 2rem;
      width: 100%;
    }

    .graph {
      position: relative;
      height: min(26rem, 56vh);
      aspect-ratio: 1 / 2;
      user-select: none;
    }

    .graph svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .unit-square {
      fill: rgb(127 127 127 / 0.12);
      stroke: currentColor;
      stroke-opacity: 0.35;
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
    }

    .diagonal {
      stroke: currentColor;
      stroke-opacity: 0.25;
      stroke-dasharray: 4 4;
      vector-effect: non-scaling-stroke;
    }

    .arm {
      stroke: currentColor;
      stroke-opacity: 0.6;
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
    }

    .curve {
      fill: none;
      stroke: var(--accent);
      stroke-width: 3;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }

    .lanes {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      width: min(18rem, 100%);
    }

    .lane-label {
      font-size: 0.75rem;
      opacity: 0.75;
    }

    .lane {
      position: relative;
      height: 2.4rem;
      border-radius: 999px;
      background: rgb(127 127 127 / 0.18);
    }

    .ball {
      position: absolute;
      top: 0.3rem;
      left: 0.3rem;
      width: 1.8rem;
      height: 1.8rem;
      border-radius: 50%;
      background: var(--accent);
    }

    .ball[data-reference] {
      background: currentColor;
      opacity: 0.45;
    }

    .grow-demo {
      display: flex;
      gap: 1rem;
      align-items: center;
      justify-content: center;
      height: 5rem;
    }

    .grow-square {
      width: 3.5rem;
      height: 3.5rem;
      border-radius: 12px;
      background: linear-gradient(135deg, #ff8a3d, #7c3aed);
    }
  `];

  constructor() {
    super();
    this.durationMilliseconds = DEFAULT_DURATION_MILLISECONDS;
    this.runningAnimations = [];
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopAnimations();
  }

  render() {
    if (!this.model) return nothing;
    const { x1, y1, x2, y2 } = this.model;
    const firstHandle = toGraphPercent(x1, y1);
    const secondHandle = toGraphPercent(x2, y2);
    return html`
      <div class="preview">
        <preview-stage>
          <div class="layout">
            <div class="graph">
              <svg viewBox="0 0 1 ${GRAPH_RANGE_Y}" preserveAspectRatio="none" aria-hidden="true">
                ${svg`
                  <rect class="unit-square" x="0" y=${GRAPH_MAXIMUM_Y - 1} width="1" height="1"></rect>
                  <line class="diagonal" x1="0" y1=${GRAPH_MAXIMUM_Y} x2="1" y2=${GRAPH_MAXIMUM_Y - 1}></line>
                  <line class="arm" x1="0" y1=${GRAPH_MAXIMUM_Y} x2=${x1} y2=${GRAPH_MAXIMUM_Y - y1}></line>
                  <line class="arm" x1="1" y1=${GRAPH_MAXIMUM_Y - 1} x2=${x2} y2=${GRAPH_MAXIMUM_Y - y2}></line>
                  <path class="curve" d=${sampleCurvePathData(this.model)}></path>
                `}
              </svg>
              ${renderHandle({ x: firstHandle.left, y: firstHandle.top, label: `First control point ${x1}, ${y1}`,
                onPointerDown: (event) => this.startHandleDrag(event, "first"), onKeyDown: (event) => this.nudgeHandle(event, "first") })}
              ${renderHandle({ x: secondHandle.left, y: secondHandle.top, label: `Second control point ${x2}, ${y2}`,
                onPointerDown: (event) => this.startHandleDrag(event, "second"), onKeyDown: (event) => this.nudgeHandle(event, "second") })}
            </div>
            <div class="lanes">
              <div>
                <div class="lane-label">Your curve</div>
                <div class="lane"><span class="ball" data-animated></span></div>
              </div>
              <div>
                <div class="lane-label">linear, for comparison</div>
                <div class="lane"><span class="ball" data-reference></span></div>
              </div>
              <div class="grow-demo"><span class="grow-square"></span></div>
            </div>
          </div>
        </preview-stage>
      </div>
      <div class="controls">
        ${renderPresetSection(EASING_PRESETS, (presetCss) => emitEvent(this, "model-change", parseEasing(presetCss)))}
        <section class="section">
          <h3 class="section-heading">Control points</h3>
          <scrub-number label="X1" min="0" max="1" step="0.01" .value=${x1} @value-change=${(event) => this.applyChanges({ x1: clamp(event.detail, 0, 1) })}></scrub-number>
          <scrub-number label="Y1" min=${GRAPH_MINIMUM_Y} max=${GRAPH_MAXIMUM_Y} step="0.01" .value=${y1} @value-change=${(event) => this.applyChanges({ y1: event.detail })}></scrub-number>
          <scrub-number label="X2" min="0" max="1" step="0.01" .value=${x2} @value-change=${(event) => this.applyChanges({ x2: clamp(event.detail, 0, 1) })}></scrub-number>
          <scrub-number label="Y2" min=${GRAPH_MINIMUM_Y} max=${GRAPH_MAXIMUM_Y} step="0.01" .value=${y2} @value-change=${(event) => this.applyChanges({ y2: event.detail })}></scrub-number>
          <p class="hint">X values must stay between 0 and 1. Y values outside 0–1 overshoot, which gives a bounce or anticipation.</p>
        </section>
        <section class="section">
          <h3 class="section-heading">Preview</h3>
          <scrub-number label="Duration" unit="ms" min="200" max="4000" step="50" .value=${this.durationMilliseconds}
            @value-change=${(event) => { this.durationMilliseconds = Math.max(50, event.detail); }}></scrub-number>
          <div class="row"><button class="button" type="button" @click=${() => this.restartAnimations()}>Replay</button></div>
        </section>
      </div>
    `;
  }

  updated(changedProperties) {
    if (changedProperties.has("model") || changedProperties.has("durationMilliseconds")) this.restartAnimations();
  }

  restartAnimations() {
    this.stopAnimations();
    if (!this.model) return;
    const timing = {
      duration: this.durationMilliseconds,
      iterations: prefersReducedMotion() ? 1 : Infinity,
      direction: "alternate",
      endDelay: PAUSE_BETWEEN_RUNS_MILLISECONDS,
      fill: "both"
    };
    const slide = [{ left: "0.3rem" }, { left: "calc(100% - 2.1rem)" }];
    const easing = serializeEasing(this.model);
    this.runningAnimations = [
      this.renderRoot.querySelector("[data-animated]").animate(slide, { ...timing, easing }),
      this.renderRoot.querySelector("[data-reference]").animate(slide, { ...timing, easing: "linear" }),
      this.renderRoot.querySelector(".grow-square").animate([{ transform: "scale(0.4) rotate(0deg)" }, { transform: "scale(1.3) rotate(90deg)" }], { ...timing, easing })
    ];
  }

  stopAnimations() {
    this.runningAnimations.forEach((animation) => animation.cancel());
    this.runningAnimations = [];
  }

  startHandleDrag(event, which) {
    const graph = this.renderRoot.querySelector(".graph");
    event.currentTarget.focus();
    trackPointerDrag(event, graph, (position) => {
      const x = roundTo(clamp(position.x, 0, 1), CONTROL_POINT_DECIMALS);
      const y = roundTo(clamp(GRAPH_MAXIMUM_Y - position.y * GRAPH_RANGE_Y, GRAPH_MINIMUM_Y, GRAPH_MAXIMUM_Y), CONTROL_POINT_DECIMALS);
      this.applyChanges(which === "first" ? { x1: x, y1: y } : { x2: x, y2: y });
    }, { isImmediate: false });
  }

  nudgeHandle(event, which) {
    const delta = arrowKeyDelta(event, { step: KEYBOARD_STEP, largeStep: KEYBOARD_LARGE_STEP });
    if (!delta) return;
    event.preventDefault();
    const [xKey, yKey] = which === "first" ? ["x1", "y1"] : ["x2", "y2"];
    this.applyChanges({
      [xKey]: roundTo(clamp(this.model[xKey] + delta.x, 0, 1), CONTROL_POINT_DECIMALS),
      [yKey]: roundTo(clamp(this.model[yKey] - delta.y, GRAPH_MINIMUM_Y, GRAPH_MAXIMUM_Y), CONTROL_POINT_DECIMALS)
    });
  }

  applyChanges(changes) {
    emitEvent(this, "model-change", { ...this.model, ...changes });
  }
}

customElements.define("easing-editor", EasingEditor);
