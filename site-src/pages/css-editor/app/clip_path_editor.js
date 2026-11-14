import { LitElement, html, css, nothing } from "lit";
import { editorStyles } from "./editor_styles.js";
import { renderPresetSection, renderHandle, handleStyles, renderOutlinePath, replaceAt, removeAt } from "./editor_controls.js";
import { splitTopLevel, splitWhitespace, parsePercent, parsePixels, parsePosition, parseFunctionCall, compressBoxValues, formatNumber, roundTo, clamp } from "./css_value_syntax.js";
import { trackPointerDrag, arrowKeyDelta, relativePointerPosition, emitEvent } from "./pointer_tracking.js";

const CLIP_SHAPES = Object.freeze({ POLYGON: "polygon", CIRCLE: "circle", ELLIPSE: "ellipse", INSET: "inset" });
const FILL_RULES = Object.freeze({ NONZERO: "nonzero", EVENODD: "evenodd" });
const MINIMUM_POLYGON_POINTS = 3;
const SNAP_PERCENT = 5;
const PERCENT_DECIMALS = 1;
const CENTER_PERCENT = 50;

const CLIP_PATH_PRESETS = [
  { label: "Star", css: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)" },
  { label: "Triangle", css: "polygon(50% 0%, 100% 100%, 0% 100%)" },
  { label: "Trapezoid", css: "polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)" },
  { label: "Parallelogram", css: "polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%)" },
  { label: "Rhombus", css: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" },
  { label: "Pentagon", css: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)" },
  { label: "Hexagon", css: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)" },
  { label: "Octagon", css: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)" },
  { label: "Arrow", css: "polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)" },
  { label: "Chevron", css: "polygon(75% 0%, 100% 50%, 75% 100%, 0% 100%, 25% 50%, 0% 0%)" },
  { label: "Plus", css: "polygon(35% 0%, 65% 0%, 65% 35%, 100% 35%, 100% 65%, 65% 65%, 65% 100%, 35% 100%, 35% 65%, 0% 65%, 0% 35%, 35% 35%)" },
  { label: "Speech bubble", css: "polygon(0% 0%, 100% 0%, 100% 75%, 75% 75%, 75% 100%, 50% 75%, 0% 75%)" },
  { label: "Circle", css: "circle(50% at 50% 50%)" },
  { label: "Ellipse", css: "ellipse(30% 45% at 50% 50%)" },
  { label: "Inset", css: "inset(10% 15% round 24px)" }
];

const DEFAULT_SHAPE_SETTINGS = Object.freeze({
  fillRule: FILL_RULES.NONZERO,
  points: [{ x: 50, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
  circle: { radius: 40, centerX: CENTER_PERCENT, centerY: CENTER_PERCENT },
  ellipse: { radiusX: 35, radiusY: 45, centerX: CENTER_PERCENT, centerY: CENTER_PERCENT },
  inset: { top: 10, right: 10, bottom: 10, left: 10, roundRadius: 0 }
});

export const clipPathDefinition = {
  id: "clip-path",
  label: "Clip path",
  group: "Shape",
  properties: ["clip-path"],
  presets: CLIP_PATH_PRESETS,
  parse: parseClipPath,
  serialize: serializeClipPath,
  render: ({ model, onChange }) => html`<clip-path-editor .model=${model} @model-change=${onChange}></clip-path-editor>`
};

function parseClipPath(value) {
  const call = parseFunctionCall(value);
  if (!call) return null;
  const model = structuredClone({ ...DEFAULT_SHAPE_SETTINGS, shape: call.name });
  const parsers = {
    [CLIP_SHAPES.POLYGON]: parsePolygonArguments,
    [CLIP_SHAPES.CIRCLE]: parseCircleArguments,
    [CLIP_SHAPES.ELLIPSE]: parseEllipseArguments,
    [CLIP_SHAPES.INSET]: parseInsetArguments
  };
  const parseArguments = parsers[call.name];
  if (!parseArguments) return null;
  const shapeSettings = parseArguments(call.argumentsText);
  return shapeSettings ? { ...model, ...shapeSettings } : null;
}

function parsePolygonArguments(argumentsText) {
  const parts = splitTopLevel(argumentsText, ",");
  const firstPart = parts[0].toLowerCase();
  const hasFillRule = Object.values(FILL_RULES).includes(firstPart);
  const points = (hasFillRule ? parts.slice(1) : parts).map((pointText) => {
    const coordinates = splitWhitespace(pointText).map(parsePercent);
    return coordinates.length === 2 && !coordinates.includes(null) ? { x: coordinates[0], y: coordinates[1] } : null;
  });
  if (points.length < MINIMUM_POLYGON_POINTS || points.includes(null)) return null;
  return { points, fillRule: hasFillRule ? firstPart : FILL_RULES.NONZERO };
}

function parseCircleArguments(argumentsText) {
  const shape = parseRadiiAndCenter(argumentsText, 1);
  if (!shape) return null;
  return { circle: { radius: shape.radii[0] ?? CENTER_PERCENT, centerX: shape.centerX, centerY: shape.centerY } };
}

function parseEllipseArguments(argumentsText) {
  const shape = parseRadiiAndCenter(argumentsText, 2);
  if (!shape || shape.radii.length === 1) return null;
  const [radiusX = CENTER_PERCENT, radiusY = CENTER_PERCENT] = shape.radii;
  return { ellipse: { radiusX, radiusY, centerX: shape.centerX, centerY: shape.centerY } };
}

function parseRadiiAndCenter(argumentsText, maximumRadii) {
  const tokens = splitWhitespace(argumentsText);
  const atIndex = tokens.findIndex((token) => token.toLowerCase() === "at");
  const radiusTokens = atIndex === -1 ? tokens : tokens.slice(0, atIndex);
  if (radiusTokens.length > maximumRadii) return null;
  const radii = radiusTokens.map(parsePercent);
  if (radii.includes(null)) return null;
  if (atIndex === -1) return { radii, centerX: CENTER_PERCENT, centerY: CENTER_PERCENT };
  const position = parsePosition(tokens, atIndex + 1);
  if (!position || position.nextIndex !== tokens.length) return null;
  return { radii, centerX: position.x, centerY: position.y };
}

function parseInsetArguments(argumentsText) {
  const tokens = splitWhitespace(argumentsText);
  const roundIndex = tokens.findIndex((token) => token.toLowerCase() === "round");
  const offsetTokens = roundIndex === -1 ? tokens : tokens.slice(0, roundIndex);
  const offsets = offsetTokens.map(parsePercent);
  if (offsets.length === 0 || offsets.length > 4 || offsets.includes(null)) return null;
  const [top, right = top, bottom = top, left = right] = offsets;
  let roundRadius = 0;
  if (roundIndex !== -1) {
    const radiusTokens = tokens.slice(roundIndex + 1);
    roundRadius = radiusTokens.length === 1 ? parsePixels(radiusTokens[0]) : null;
    if (roundRadius === null) return null;
  }
  return { inset: { top, right, bottom, left, roundRadius } };
}

function serializeClipPath(model) {
  const percent = (value) => `${formatNumber(value, PERCENT_DECIMALS)}%`;
  switch (model.shape) {
    case CLIP_SHAPES.CIRCLE: {
      const { radius, centerX, centerY } = model.circle;
      return `circle(${percent(radius)} at ${percent(centerX)} ${percent(centerY)})`;
    }
    case CLIP_SHAPES.ELLIPSE: {
      const { radiusX, radiusY, centerX, centerY } = model.ellipse;
      return `ellipse(${percent(radiusX)} ${percent(radiusY)} at ${percent(centerX)} ${percent(centerY)})`;
    }
    case CLIP_SHAPES.INSET: {
      const { top, right, bottom, left, roundRadius } = model.inset;
      const offsets = compressBoxValues([top, right, bottom, left]).map(percent).join(" ");
      return roundRadius > 0 ? `inset(${offsets} round ${formatNumber(roundRadius)}px)` : `inset(${offsets})`;
    }
    default: {
      const fillRulePrefix = model.fillRule === FILL_RULES.EVENODD ? "evenodd, " : "";
      return `polygon(${fillRulePrefix}${model.points.map((point) => `${percent(point.x)} ${percent(point.y)}`).join(", ")})`;
    }
  }
}

function nearestEdgeIndex(points, target) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  points.forEach((start, index) => {
    const end = points[(index + 1) % points.length];
    const distance = distanceToSegment(target, start, end);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function distanceToSegment(point, start, end) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  const projection = lengthSquared === 0 ? 0 : clamp(((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared, 0, 1);
  return Math.hypot(point.x - (start.x + projection * deltaX), point.y - (start.y + projection * deltaY));
}

class ClipPathEditor extends LitElement {
  static properties = {
    model: { attribute: false },
    selectedPointIndex: { state: true },
    isSnapping: { state: true },
    canvasWidthPixels: { state: true }
  };

  static styles = [editorStyles, handleStyles, css`
    .canvas {
      position: relative;
      width: min(28rem, 100%);
      aspect-ratio: 1;
      user-select: none;
    }

    .ghost, .clipped {
      position: absolute;
      inset: 0;
      background: url("/site/media/hero-poster.jpg") center / cover, linear-gradient(135deg, #ff8a3d, #7c3aed);
    }

    .ghost {
      opacity: 0.22;
      border-radius: 4px;
    }

    .outline {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;
      pointer-events: none;
    }

    .shape-thumbnail {
      width: 0.9rem;
      height: 0.9rem;
      background: var(--accent);
    }

    .point-editor {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
    }
  `];

  constructor() {
    super();
    this.selectedPointIndex = 0;
    this.isSnapping = false;
    this.canvasWidthPixels = 0;
    this.resizeObserver = new ResizeObserver(([entry]) => { this.canvasWidthPixels = entry.contentRect.width; });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver.disconnect();
  }

  firstUpdated() {
    this.resizeObserver.observe(this.renderRoot.querySelector(".canvas"));
  }

  willUpdate() {
    const lastIndex = Math.max(0, (this.model?.points.length ?? 0) - 1);
    if (this.selectedPointIndex > lastIndex) this.selectedPointIndex = lastIndex;
  }

  render() {
    if (!this.model) return nothing;
    return html`
      <div class="preview">
        <preview-stage>
          <div class="canvas" @dblclick=${this.insertPointAtPointer}>
            <div class="ghost"></div>
            <div class="clipped" style="clip-path: ${serializeClipPath(this.model)}"></div>
            <svg class="outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${renderOutlinePath(this.outlinePathData())}</svg>
            ${this.renderHandles()}
          </div>
        </preview-stage>
      </div>
      <div class="controls">
        ${renderPresetSection(CLIP_PATH_PRESETS, (presetCss) => this.applyPreset(presetCss),
          (preset) => html`<span class="shape-thumbnail" style="clip-path: ${preset.css}"></span>`)}
        <section class="section">
          <h3 class="section-heading">Shape</h3>
          <segmented-choice label="Clip shape" .value=${this.model.shape}
            .options=${[{ value: "polygon", label: "Polygon" }, { value: "circle", label: "Circle" }, { value: "ellipse", label: "Ellipse" }, { value: "inset", label: "Inset" }]}
            @value-change=${(event) => this.applyChanges({ shape: event.detail })}></segmented-choice>
          <label class="row"><input type="checkbox" .checked=${this.isSnapping} @change=${(event) => { this.isSnapping = event.target.checked; }}> Snap handles to ${SNAP_PERCENT}% grid</label>
        </section>
        ${this.renderShapeControls()}
      </div>
    `;
  }

  renderShapeControls() {
    switch (this.model.shape) {
      case CLIP_SHAPES.CIRCLE: return this.renderCircleControls();
      case CLIP_SHAPES.ELLIPSE: return this.renderEllipseControls();
      case CLIP_SHAPES.INSET: return this.renderInsetControls();
      default: return this.renderPolygonControls();
    }
  }

  renderPolygonControls() {
    const { points, fillRule } = this.model;
    const point = points[this.selectedPointIndex];
    const updatePoint = (changes) => this.applyChanges({ points: replaceAt(points, this.selectedPointIndex, { ...point, ...changes }) });
    return html`
      <section class="section">
        <h3 class="section-heading">Points (${points.length})</h3>
        <p class="hint">Drag handles to reshape. Double-click the image to add a point on the nearest edge, double-click a handle to remove it.</p>
        ${point ? html`
          <div class="point-editor">
            <scrub-number label="Point ${this.selectedPointIndex + 1} X" unit="%" min="0" max="100" step="0.5" .value=${point.x}
              @value-change=${(event) => updatePoint({ x: event.detail })}></scrub-number>
            <scrub-number label="Point ${this.selectedPointIndex + 1} Y" unit="%" min="0" max="100" step="0.5" .value=${point.y}
              @value-change=${(event) => updatePoint({ y: event.detail })}></scrub-number>
            <div class="row">
              <button class="button" type="button" @click=${() => this.selectRelativePoint(-1)}>‹ Previous</button>
              <button class="button" type="button" @click=${() => this.selectRelativePoint(1)}>Next ›</button>
              <button class="button" type="button" ?disabled=${points.length <= MINIMUM_POLYGON_POINTS}
                @click=${() => this.removePoint(this.selectedPointIndex)}>Remove</button>
            </div>
          </div>
        ` : nothing}
        <div class="row">
          <span class="row-label">Fill rule</span>
          <segmented-choice label="Fill rule" .value=${fillRule}
            .options=${[{ value: "nonzero", label: "nonzero" }, { value: "evenodd", label: "evenodd" }]}
            @value-change=${(event) => this.applyChanges({ fillRule: event.detail })}></segmented-choice>
        </div>
      </section>
    `;
  }

  renderCircleControls() {
    const circle = this.model.circle;
    const update = (changes) => this.applyChanges({ circle: { ...circle, ...changes } });
    return html`
      <section class="section">
        <h3 class="section-heading">Circle</h3>
        <scrub-number label="Radius" unit="%" min="0" max="75" step="0.5" .value=${circle.radius} @value-change=${(event) => update({ radius: Math.max(0, event.detail) })}></scrub-number>
        <scrub-number label="Center X" unit="%" min="0" max="100" step="0.5" .value=${circle.centerX} @value-change=${(event) => update({ centerX: event.detail })}></scrub-number>
        <scrub-number label="Center Y" unit="%" min="0" max="100" step="0.5" .value=${circle.centerY} @value-change=${(event) => update({ centerY: event.detail })}></scrub-number>
      </section>
    `;
  }

  renderEllipseControls() {
    const ellipse = this.model.ellipse;
    const update = (changes) => this.applyChanges({ ellipse: { ...ellipse, ...changes } });
    return html`
      <section class="section">
        <h3 class="section-heading">Ellipse</h3>
        <scrub-number label="Radius X" unit="%" min="0" max="100" step="0.5" .value=${ellipse.radiusX} @value-change=${(event) => update({ radiusX: Math.max(0, event.detail) })}></scrub-number>
        <scrub-number label="Radius Y" unit="%" min="0" max="100" step="0.5" .value=${ellipse.radiusY} @value-change=${(event) => update({ radiusY: Math.max(0, event.detail) })}></scrub-number>
        <scrub-number label="Center X" unit="%" min="0" max="100" step="0.5" .value=${ellipse.centerX} @value-change=${(event) => update({ centerX: event.detail })}></scrub-number>
        <scrub-number label="Center Y" unit="%" min="0" max="100" step="0.5" .value=${ellipse.centerY} @value-change=${(event) => update({ centerY: event.detail })}></scrub-number>
      </section>
    `;
  }

  renderInsetControls() {
    const inset = this.model.inset;
    const update = (changes) => this.applyChanges({ inset: { ...inset, ...changes } });
    return html`
      <section class="section">
        <h3 class="section-heading">Inset</h3>
        ${["top", "right", "bottom", "left"].map((side) => html`
          <scrub-number label=${side[0].toUpperCase() + side.slice(1)} unit="%" min="0" max="100" step="0.5" .value=${inset[side]}
            @value-change=${(event) => update({ [side]: clamp(event.detail, 0, 100) })}></scrub-number>
        `)}
        <scrub-number label="Round" unit="px" min="0" max="200" .value=${inset.roundRadius}
          @value-change=${(event) => update({ roundRadius: Math.max(0, event.detail) })}></scrub-number>
      </section>
    `;
  }

  renderHandles() {
    switch (this.model.shape) {
      case CLIP_SHAPES.CIRCLE: {
        const { radius, centerX, centerY } = this.model.circle;
        return [
          this.renderDragHandle({ x: centerX, y: centerY, label: "Circle center" }, (position) => ({ circle: { ...this.model.circle, centerX: position.x, centerY: position.y } })),
          this.renderDragHandle({ x: centerX + radius, y: centerY, label: "Circle radius" }, (position) => ({ circle: { ...this.model.circle, radius: roundTo(Math.hypot(position.x - this.model.circle.centerX, position.y - this.model.circle.centerY), PERCENT_DECIMALS) } }))
        ];
      }
      case CLIP_SHAPES.ELLIPSE: {
        const { radiusX, radiusY, centerX, centerY } = this.model.ellipse;
        return [
          this.renderDragHandle({ x: centerX, y: centerY, label: "Ellipse center" }, (position) => ({ ellipse: { ...this.model.ellipse, centerX: position.x, centerY: position.y } })),
          this.renderDragHandle({ x: centerX + radiusX, y: centerY, label: "Ellipse horizontal radius" }, (position) => ({ ellipse: { ...this.model.ellipse, radiusX: Math.abs(position.x - this.model.ellipse.centerX) } })),
          this.renderDragHandle({ x: centerX, y: centerY + radiusY, label: "Ellipse vertical radius" }, (position) => ({ ellipse: { ...this.model.ellipse, radiusY: Math.abs(position.y - this.model.ellipse.centerY) } }))
        ];
      }
      case CLIP_SHAPES.INSET: {
        const { top, right, bottom, left } = this.model.inset;
        const middleX = (left + 100 - right) / 2;
        const middleY = (top + 100 - bottom) / 2;
        return [
          this.renderDragHandle({ x: middleX, y: top, label: "Top inset" }, (position) => ({ inset: { ...this.model.inset, top: position.y } })),
          this.renderDragHandle({ x: 100 - right, y: middleY, label: "Right inset" }, (position) => ({ inset: { ...this.model.inset, right: 100 - position.x } })),
          this.renderDragHandle({ x: middleX, y: 100 - bottom, label: "Bottom inset" }, (position) => ({ inset: { ...this.model.inset, bottom: 100 - position.y } })),
          this.renderDragHandle({ x: left, y: middleY, label: "Left inset" }, (position) => ({ inset: { ...this.model.inset, left: position.x } }))
        ];
      }
      default:
        return this.model.points.map((point, index) => renderHandle({
          x: point.x,
          y: point.y,
          label: `Point ${index + 1}`,
          isSelected: index === this.selectedPointIndex,
          onPointerDown: (event) => this.startPointDrag(event, index),
          onKeyDown: (event) => this.handlePointKey(event, index),
          onDoubleClick: (event) => {
            event.stopPropagation();
            this.removePoint(index);
          }
        }));
    }
  }

  renderDragHandle({ x, y, label }, changesForPosition) {
    return renderHandle({
      x,
      y,
      label,
      onPointerDown: (event) => {
        event.currentTarget.focus();
        trackPointerDrag(event, this.canvas, (position) => this.applyChanges(changesForPosition(this.toPercentPoint(position))), { isImmediate: false });
      },
      onKeyDown: (event) => {
        const delta = arrowKeyDelta(event, { step: 0.5, largeStep: SNAP_PERCENT });
        if (!delta) return;
        event.preventDefault();
        this.applyChanges(changesForPosition({ x: x + delta.x, y: y + delta.y }));
      }
    });
  }

  outlinePathData() {
    switch (this.model.shape) {
      case CLIP_SHAPES.CIRCLE: {
        const { radius, centerX, centerY } = this.model.circle;
        return ellipsePathData(centerX, centerY, radius, radius);
      }
      case CLIP_SHAPES.ELLIPSE: {
        const { radiusX, radiusY, centerX, centerY } = this.model.ellipse;
        return ellipsePathData(centerX, centerY, radiusX, radiusY);
      }
      case CLIP_SHAPES.INSET: {
        const { top, right, bottom, left, roundRadius } = this.model.inset;
        const width = Math.max(0, 100 - left - right);
        const height = Math.max(0, 100 - top - bottom);
        const radius = Math.min(this.canvasWidthPixels ? roundRadius / this.canvasWidthPixels * 100 : 0, width / 2, height / 2);
        return roundedRectanglePathData(left, top, width, height, radius);
      }
      default:
        return `M ${this.model.points.map((point) => `${point.x} ${point.y}`).join(" L ")} Z`;
    }
  }

  get canvas() {
    return this.renderRoot.querySelector(".canvas");
  }

  toPercentPoint(position) {
    const snapSize = this.isSnapping ? SNAP_PERCENT : 10 ** -PERCENT_DECIMALS;
    const toPercent = (fraction) => roundTo(Math.round(clamp(fraction, 0, 1) * 100 / snapSize) * snapSize, PERCENT_DECIMALS);
    return { x: toPercent(position.x), y: toPercent(position.y) };
  }

  startPointDrag(event, index) {
    this.selectedPointIndex = index;
    event.currentTarget.focus();
    trackPointerDrag(event, this.canvas, (position) => {
      this.applyChanges({ points: replaceAt(this.model.points, index, this.toPercentPoint(position)) });
    }, { isImmediate: false });
  }

  handlePointKey(event, index) {
    this.selectedPointIndex = index;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      this.removePoint(index);
      return;
    }
    const delta = arrowKeyDelta(event, { step: 0.5, largeStep: SNAP_PERCENT });
    if (!delta) return;
    event.preventDefault();
    const point = this.model.points[index];
    const moved = { x: clamp(point.x + delta.x, 0, 100), y: clamp(point.y + delta.y, 0, 100) };
    this.applyChanges({ points: replaceAt(this.model.points, index, moved) });
  }

  insertPointAtPointer(event) {
    if (this.model.shape !== CLIP_SHAPES.POLYGON) return;
    const point = this.toPercentPoint(relativePointerPosition(event, this.canvas));
    const insertIndex = nearestEdgeIndex(this.model.points, point) + 1;
    const points = [...this.model.points.slice(0, insertIndex), point, ...this.model.points.slice(insertIndex)];
    this.selectedPointIndex = insertIndex;
    this.applyChanges({ points });
  }

  removePoint(index) {
    if (this.model.points.length <= MINIMUM_POLYGON_POINTS) return;
    this.applyChanges({ points: removeAt(this.model.points, index) });
  }

  selectRelativePoint(offset) {
    const count = this.model.points.length;
    this.selectedPointIndex = (this.selectedPointIndex + offset + count) % count;
  }

  applyPreset(presetCss) {
    this.selectedPointIndex = 0;
    emitEvent(this, "model-change", parseClipPath(presetCss));
  }

  applyChanges(changes) {
    emitEvent(this, "model-change", { ...this.model, ...changes });
  }
}

function ellipsePathData(centerX, centerY, radiusX, radiusY) {
  return `M ${centerX - radiusX} ${centerY} a ${radiusX} ${radiusY} 0 1 0 ${radiusX * 2} 0 a ${radiusX} ${radiusY} 0 1 0 ${-radiusX * 2} 0 Z`;
}

function roundedRectanglePathData(x, y, width, height, radius) {
  if (radius <= 0) return `M ${x} ${y} h ${width} v ${height} h ${-width} Z`;
  return `M ${x + radius} ${y} h ${width - 2 * radius} a ${radius} ${radius} 0 0 1 ${radius} ${radius} v ${height - 2 * radius}
    a ${radius} ${radius} 0 0 1 ${-radius} ${radius} h ${-(width - 2 * radius)} a ${radius} ${radius} 0 0 1 ${-radius} ${-radius}
    v ${-(height - 2 * radius)} a ${radius} ${radius} 0 0 1 ${radius} ${-radius} Z`;
}

customElements.define("clip-path-editor", ClipPathEditor);
