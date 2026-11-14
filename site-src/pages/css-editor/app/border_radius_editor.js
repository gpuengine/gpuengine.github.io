import { LitElement, html, css, nothing } from "lit";
import { editorStyles } from "./editor_styles.js";
import { renderPresetSection, renderHandle, handleStyles, replaceAt } from "./editor_controls.js";
import { splitTopLevel, splitWhitespace, parseNumberWithUnit, compressBoxValues, formatLength, roundTo, clamp } from "./css_value_syntax.js";
import { trackPointerDrag, emitEvent } from "./pointer_tracking.js";

const RADIUS_UNITS = Object.freeze({ PERCENT: "%", PIXELS: "px" });
const LINK_MODES = Object.freeze({ ALL: "all", CORNERS: "corners", ELLIPTICAL: "elliptical" });
const LINK_MODE_RANK = Object.freeze({ [LINK_MODES.ALL]: 0, [LINK_MODES.CORNERS]: 1, [LINK_MODES.ELLIPTICAL]: 2 });
const CORNERS = Object.freeze([
  { name: "Top left", isLeft: true, isTop: true },
  { name: "Top right", isLeft: false, isTop: true },
  { name: "Bottom right", isLeft: false, isTop: false },
  { name: "Bottom left", isLeft: true, isTop: false }
]);
const AXES = Object.freeze({ HORIZONTAL: "horizontal", VERTICAL: "vertical" });
const SLIDER_MAXIMUM = Object.freeze({ [RADIUS_UNITS.PERCENT]: 100, [RADIUS_UNITS.PIXELS]: 240 });
const DECIMALS = Object.freeze({ [RADIUS_UNITS.PERCENT]: 1, [RADIUS_UNITS.PIXELS]: 0 });

const BORDER_RADIUS_PRESETS = [
  { label: "Blob", css: "30% 70% 70% 30% / 30% 30% 70% 70%" },
  { label: "Rounded", css: "16px" },
  { label: "Pill", css: "999px" },
  { label: "Circle", css: "50%" },
  { label: "Leaf", css: "0 70%" },
  { label: "Drop", css: "50% 50% 50% 0" },
  { label: "Tab", css: "16px 16px 0 0" },
  { label: "Hand-drawn", css: "255px 15px 225px 15px / 15px 225px 15px 255px" }
];

export const borderRadiusDefinition = {
  id: "border-radius",
  label: "Border radius",
  group: "Shape",
  properties: ["border-radius"],
  presets: BORDER_RADIUS_PRESETS,
  parse: parseBorderRadius,
  serialize: serializeBorderRadius,
  render: ({ model, onChange }) => html`<border-radius-editor .model=${model} @model-change=${onChange}></border-radius-editor>`
};

function parseBorderRadius(value) {
  const halves = splitTopLevel(value, "/");
  if (halves.length > 2) return null;
  const parsedHalves = halves.map((half) => splitWhitespace(half).map(parseNumberWithUnit));
  const lengths = parsedHalves.flat();
  if (lengths.includes(null) || parsedHalves.some((half) => half.length === 0 || half.length > 4)) return null;
  const units = new Set(lengths.filter((length) => !(length.unit === "" && length.number === 0)).map((length) => length.unit));
  if (units.size > 1) return null;
  const unit = units.values().next().value ?? RADIUS_UNITS.PIXELS;
  if (!Object.values(RADIUS_UNITS).includes(unit) || lengths.some((length) => length.number < 0)) return null;
  const horizontal = expandCornerValues(parsedHalves[0].map((length) => length.number));
  const vertical = parsedHalves[1] ? expandCornerValues(parsedHalves[1].map((length) => length.number)) : [...horizontal];
  return { unit, horizontal, vertical };
}

function expandCornerValues([topLeft, topRight = topLeft, bottomRight = topLeft, bottomLeft = topRight]) {
  return [topLeft, topRight, bottomRight, bottomLeft];
}

function serializeBorderRadius(model) {
  const format = (values) => compressBoxValues(values).map((value) => formatLength(value, model.unit, DECIMALS[model.unit])).join(" ");
  const horizontalText = format(model.horizontal);
  const verticalText = format(model.vertical);
  return horizontalText === verticalText ? horizontalText : `${horizontalText} / ${verticalText}`;
}

function requiredLinkMode(model) {
  const isCircular = model.horizontal.every((value, index) => value === model.vertical[index]);
  if (!isCircular) return LINK_MODES.ELLIPTICAL;
  return model.horizontal.every((value) => value === model.horizontal[0]) ? LINK_MODES.ALL : LINK_MODES.CORNERS;
}

class BorderRadiusEditor extends LitElement {
  static properties = {
    model: { attribute: false },
    linkMode: { state: true },
    boxSize: { state: true }
  };

  static styles = [editorStyles, handleStyles, css`
    .box {
      position: relative;
      width: min(22rem, 100%);
      aspect-ratio: 3 / 2;
    }

    .shape {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, #ff8a3d, #ff3d77 55%, #7c3aed);
      box-shadow: 0 14px 34px rgb(0 0 0 / 0.25);
    }

    .frame {
      position: absolute;
      inset: 0;
      border: 1px dashed currentColor;
      opacity: 0.35;
      pointer-events: none;
    }
  `];

  constructor() {
    super();
    this.linkMode = LINK_MODES.ALL;
    this.boxSize = { width: 0, height: 0 };
    this.resizeObserver = new ResizeObserver(([entry]) => {
      this.boxSize = { width: entry.contentRect.width, height: entry.contentRect.height };
    });
  }

  firstUpdated() {
    this.resizeObserver.observe(this.renderRoot.querySelector(".box"));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver.disconnect();
  }

  willUpdate(changedProperties) {
    if (!changedProperties.has("model") || !this.model) return;
    const neededMode = requiredLinkMode(this.model);
    if (LINK_MODE_RANK[neededMode] > LINK_MODE_RANK[this.linkMode]) this.linkMode = neededMode;
  }

  render() {
    if (!this.model) return nothing;
    return html`
      <div class="preview">
        <preview-stage>
          <div class="box">
            <div class="frame"></div>
            <div class="shape" style="border-radius: ${serializeBorderRadius(this.model)}"></div>
            ${this.renderHandles()}
          </div>
        </preview-stage>
      </div>
      <div class="controls">
        ${renderPresetSection(BORDER_RADIUS_PRESETS, (presetCss) => this.applyPreset(presetCss))}
        <section class="section">
          <h3 class="section-heading">Settings</h3>
          <div class="row">
            <span class="row-label">Unit</span>
            <segmented-choice label="Unit" .value=${this.model.unit}
              .options=${[{ value: "px", label: "px" }, { value: "%", label: "%" }]}
              @value-change=${(event) => this.convertUnit(event.detail)}></segmented-choice>
          </div>
          <div class="row">
            <span class="row-label">Link</span>
            <segmented-choice label="Link corners" .value=${this.linkMode}
              .options=${[{ value: "all", label: "All" }, { value: "corners", label: "Per corner" }, { value: "elliptical", label: "Elliptical" }]}
              @value-change=${(event) => this.changeLinkMode(event.detail)}></segmented-choice>
          </div>
          <p class="hint">Drag the handles on the edges of the shape. Elliptical mode gives each corner a separate horizontal and vertical radius.</p>
        </section>
        <section class="section">
          <h3 class="section-heading">Radii</h3>
          ${this.renderRadiusFields()}
        </section>
      </div>
    `;
  }

  renderRadiusFields() {
    const { unit, horizontal, vertical } = this.model;
    const field = (label, value, onValue) => html`<scrub-number label=${label} unit=${unit} min="0" max=${SLIDER_MAXIMUM[unit]}
      step=${unit === RADIUS_UNITS.PERCENT ? 0.5 : 1} .value=${value} @value-change=${(event) => onValue(Math.max(0, event.detail))}></scrub-number>`;
    if (this.linkMode === LINK_MODES.ALL) {
      return field("Radius", horizontal[0], (value) => this.setRadius({ cornerIndex: 0, axis: AXES.HORIZONTAL, value }));
    }
    if (this.linkMode === LINK_MODES.CORNERS) {
      return CORNERS.map((corner, cornerIndex) => field(corner.name, horizontal[cornerIndex], (value) => this.setRadius({ cornerIndex, axis: AXES.HORIZONTAL, value })));
    }
    return CORNERS.flatMap((corner, cornerIndex) => [
      field(`${corner.name} X`, horizontal[cornerIndex], (value) => this.setRadius({ cornerIndex, axis: AXES.HORIZONTAL, value })),
      field(`${corner.name} Y`, vertical[cornerIndex], (value) => this.setRadius({ cornerIndex, axis: AXES.VERTICAL, value }))
    ]);
  }

  renderHandles() {
    if (!this.boxSize.width) return nothing;
    return CORNERS.flatMap((corner, cornerIndex) => {
      const horizontalPercent = this.toPercentOfBox(this.model.horizontal[cornerIndex], AXES.HORIZONTAL);
      const verticalPercent = this.toPercentOfBox(this.model.vertical[cornerIndex], AXES.VERTICAL);
      return [
        renderHandle({
          x: corner.isLeft ? horizontalPercent : 100 - horizontalPercent,
          y: corner.isTop ? 0 : 100,
          label: `${corner.name} horizontal radius`,
          onPointerDown: (event) => this.startHandleDrag(event, cornerIndex, AXES.HORIZONTAL)
        }),
        renderHandle({
          x: corner.isLeft ? 0 : 100,
          y: corner.isTop ? verticalPercent : 100 - verticalPercent,
          label: `${corner.name} vertical radius`,
          onPointerDown: (event) => this.startHandleDrag(event, cornerIndex, AXES.VERTICAL)
        })
      ];
    });
  }

  toPercentOfBox(value, axis) {
    if (this.model.unit === RADIUS_UNITS.PERCENT) return clamp(value, 0, 100);
    const boxLength = axis === AXES.HORIZONTAL ? this.boxSize.width : this.boxSize.height;
    return clamp(value / boxLength * 100, 0, 100);
  }

  fromFractionOfBox(fraction, axis) {
    const clampedFraction = clamp(fraction, 0, 1);
    if (this.model.unit === RADIUS_UNITS.PERCENT) return roundTo(clampedFraction * 100, 1);
    const boxLength = axis === AXES.HORIZONTAL ? this.boxSize.width : this.boxSize.height;
    return Math.round(clampedFraction * boxLength);
  }

  startHandleDrag(event, cornerIndex, axis) {
    const corner = CORNERS[cornerIndex];
    const box = this.renderRoot.querySelector(".box");
    event.currentTarget.focus();
    trackPointerDrag(event, box, (position) => {
      const fraction = axis === AXES.HORIZONTAL
        ? (corner.isLeft ? position.x : 1 - position.x)
        : (corner.isTop ? position.y : 1 - position.y);
      this.setRadius({ cornerIndex, axis, value: this.fromFractionOfBox(fraction, axis) });
    }, { isImmediate: false });
  }

  setRadius({ cornerIndex, axis, value }) {
    const { horizontal, vertical } = this.model;
    if (this.linkMode === LINK_MODES.ALL) {
      const allValues = horizontal.map(() => value);
      this.applyChanges({ horizontal: allValues, vertical: [...allValues] });
      return;
    }
    if (this.linkMode === LINK_MODES.CORNERS) {
      this.applyChanges({ horizontal: replaceAt(horizontal, cornerIndex, value), vertical: replaceAt(vertical, cornerIndex, value) });
      return;
    }
    const axisValues = axis === AXES.HORIZONTAL ? horizontal : vertical;
    this.applyChanges({ [axis]: replaceAt(axisValues, cornerIndex, value) });
  }

  changeLinkMode(linkMode) {
    this.linkMode = linkMode;
    const { horizontal } = this.model;
    if (linkMode === LINK_MODES.ALL) {
      const allValues = horizontal.map(() => horizontal[0]);
      this.applyChanges({ horizontal: allValues, vertical: [...allValues] });
    } else if (linkMode === LINK_MODES.CORNERS) {
      this.applyChanges({ vertical: [...horizontal] });
    }
  }

  convertUnit(unit) {
    if (unit === this.model.unit || !this.boxSize.width) return;
    const decimals = DECIMALS[unit];
    const convert = (value, axis) => {
      const boxLength = axis === AXES.HORIZONTAL ? this.boxSize.width : this.boxSize.height;
      const converted = unit === RADIUS_UNITS.PIXELS ? value / 100 * boxLength : value / boxLength * 100;
      return roundTo(converted, decimals);
    };
    const horizontal = this.model.horizontal.map((value) => convert(value, AXES.HORIZONTAL));
    const isElliptical = this.linkMode === LINK_MODES.ELLIPTICAL;
    const vertical = isElliptical ? this.model.vertical.map((value) => convert(value, AXES.VERTICAL)) : [...horizontal];
    this.applyChanges({ unit, horizontal, vertical });
  }

  applyPreset(presetCss) {
    const presetModel = parseBorderRadius(presetCss);
    this.linkMode = requiredLinkMode(presetModel);
    emitEvent(this, "model-change", presetModel);
  }

  applyChanges(changes) {
    emitEvent(this, "model-change", { ...this.model, ...changes });
  }
}

customElements.define("border-radius-editor", BorderRadiusEditor);
