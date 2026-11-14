import { LitElement, html, css, nothing } from "lit";
import { editorStyles } from "./editor_styles.js";
import { renderPresetSection, replaceAt, removeAt } from "./editor_controls.js";
import { splitTopLevel, splitWhitespace, parsePixels, formatLength } from "./css_value_syntax.js";
import { parseColor, formatColor, createColor, COLOR_FORMATS } from "./color_model.js";
import { emitEvent } from "./pointer_tracking.js";

const SHADOW_VARIANTS = Object.freeze({ BOX: "box", TEXT: "text" });
const MINIMUM_LENGTH_COUNT = 2;
const OFFSET_PAD_RANGE_PIXELS = 50;
const DEFAULT_SHADOW_COLOR = createColor(0, 0, 0, 1);
const NEW_LAYER = Object.freeze({ isInset: false, offsetX: 0, offsetY: 8, blur: 16, spread: 0, color: createColor(0, 0, 0, 0.2) });

const BOX_SHADOW_PRESETS = [
  { label: "Layered", css: "0 1px 2px rgb(0 0 0 / 0.07), 0 2px 4px rgb(0 0 0 / 0.07), 0 4px 8px rgb(0 0 0 / 0.07), 0 8px 16px rgb(0 0 0 / 0.07), 0 16px 32px rgb(0 0 0 / 0.07)" },
  { label: "Soft", css: "0 10px 30px rgb(0 0 0 / 0.15)" },
  { label: "Lifted", css: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" },
  { label: "Hard offset", css: "8px 8px 0 #1c1612" },
  { label: "Inset", css: "inset 0 2px 6px rgb(0 0 0 / 0.35)" },
  { label: "Glow", css: "0 0 12px rgb(255 138 61 / 0.9), 0 0 40px rgb(255 138 61 / 0.5)" },
  { label: "Neumorphic", css: "12px 12px 24px #c9c4bf, -12px -12px 24px #ffffff" },
  { label: "Focus ring", css: "0 0 0 2px #ffffff, 0 0 0 5px #ff8a3d" }
];

const TEXT_SHADOW_PRESETS = [
  { label: "Retro", css: "3px 3px 0 #ff8a3d, 6px 6px 0 #3d8bff" },
  { label: "Soft", css: "0 2px 6px rgb(0 0 0 / 0.35)" },
  { label: "Neon", css: "0 0 4px #fff, 0 0 12px #ff3df2, 0 0 28px #ff3df2" },
  { label: "Outline", css: "1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000" },
  { label: "Emboss", css: "-1px -1px 0 rgb(255 255 255 / 0.6), 1px 1px 0 rgb(0 0 0 / 0.4)" },
  { label: "Long", css: "1px 1px 0 #c2410c, 2px 2px 0 #c2410c, 3px 3px 0 #c2410c, 4px 4px 0 #c2410c, 5px 5px 0 #c2410c, 6px 6px 0 #c2410c" }
];

export const boxShadowDefinition = createShadowDefinition({
  id: "box-shadow",
  label: "Box shadow",
  variant: SHADOW_VARIANTS.BOX,
  presets: BOX_SHADOW_PRESETS
});

export const textShadowDefinition = createShadowDefinition({
  id: "text-shadow",
  label: "Text shadow",
  variant: SHADOW_VARIANTS.TEXT,
  presets: TEXT_SHADOW_PRESETS
});

function createShadowDefinition({ id, label, variant, presets }) {
  const definition = {
    id,
    label,
    group: "Effects",
    properties: [id],
    presets,
    parse: (value) => parseShadowList(value, variant),
    serialize: (model, colorFormat) => serializeShadowList(model, variant, colorFormat),
    render: ({ model, colorFormat, onChange }) => html`<shadow-editor .variant=${variant} .definition=${definition}
      .model=${model} .colorFormat=${colorFormat} @model-change=${onChange}></shadow-editor>`
  };
  return definition;
}

function parseShadowList(value, variant) {
  if (value.trim().toLowerCase() === "none") return { layers: [] };
  const layers = splitTopLevel(value, ",").map((layerText) => parseShadowLayer(layerText, variant));
  return layers.includes(null) ? null : { layers };
}

function parseShadowLayer(layerText, variant) {
  const allowsInsetAndSpread = variant === SHADOW_VARIANTS.BOX;
  const maximumLengthCount = allowsInsetAndSpread ? 4 : 3;
  const lengths = [];
  let isInset = false;
  let color = null;
  for (const token of splitWhitespace(layerText)) {
    if (allowsInsetAndSpread && !isInset && token.toLowerCase() === "inset") {
      isInset = true;
      continue;
    }
    const pixels = parsePixels(token);
    if (pixels !== null) {
      lengths.push(pixels);
      continue;
    }
    if (color) return null;
    color = parseColor(token);
    if (!color) return null;
  }
  if (lengths.length < MINIMUM_LENGTH_COUNT || lengths.length > maximumLengthCount) return null;
  const [offsetX, offsetY, blur = 0, spread = 0] = lengths;
  if (blur < 0) return null;
  return { isInset, offsetX, offsetY, blur, spread, color: color ?? { ...DEFAULT_SHADOW_COLOR } };
}

function serializeShadowList(model, variant, colorFormat) {
  if (model.layers.length === 0) return "none";
  return model.layers.map((layer) => serializeShadowLayer(layer, variant, colorFormat)).join(", ");
}

function serializeShadowLayer(layer, variant, colorFormat) {
  const parts = [formatLength(layer.offsetX, "px"), formatLength(layer.offsetY, "px"), formatLength(layer.blur, "px")];
  if (variant === SHADOW_VARIANTS.BOX) {
    if (layer.spread !== 0) parts.push(formatLength(layer.spread, "px"));
    if (layer.isInset) parts.unshift("inset");
  }
  parts.push(formatColor(layer.color, colorFormat));
  return parts.join(" ");
}

class ShadowEditor extends LitElement {
  static properties = {
    variant: {},
    definition: { attribute: false },
    model: { attribute: false },
    colorFormat: {},
    selectedIndex: { state: true },
    subjectColor: { state: true }
  };

  static styles = [editorStyles, css`
    .box {
      width: min(12rem, 60%);
      aspect-ratio: 1;
      border-radius: 18px;
    }

    .text {
      max-width: 100%;
      padding: 0.5rem;
      font: 800 clamp(2.6rem, 8vw, 5.5rem)/1.1 system-ui, -apple-system, "Segoe UI", sans-serif;
      letter-spacing: -0.02em;
      text-align: center;
      outline: none;
      overflow-wrap: anywhere;
    }

    .layer-editor {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      padding: 0.75rem;
      border: 1px solid var(--line);
      border-radius: 8px;
    }

    .offset-row {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    .offset-numbers {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
    }

    .offset-numbers scrub-number {
      grid-template-columns: 1.2rem minmax(0, 1fr) 4.2rem;
    }
  `];

  constructor() {
    super();
    this.selectedIndex = 0;
    this.subjectColor = null;
    this.colorFormat = COLOR_FORMATS.HEX;
  }

  willUpdate() {
    const lastIndex = Math.max(0, (this.model?.layers.length ?? 0) - 1);
    if (this.selectedIndex > lastIndex) this.selectedIndex = lastIndex;
  }

  get isBoxVariant() {
    return this.variant === SHADOW_VARIANTS.BOX;
  }

  render() {
    if (!this.model) return nothing;
    const shadowValue = serializeShadowList(this.model, this.variant, COLOR_FORMATS.RGB);
    const subjectColor = this.subjectColor ?? (this.isBoxVariant ? createColor(255, 255, 255) : createColor(28, 22, 18));
    const subjectCss = formatColor(subjectColor, COLOR_FORMATS.RGB);
    return html`
      <div class="preview">
        <preview-stage>
          ${this.isBoxVariant
            ? html`<div class="box" style="box-shadow: ${shadowValue}; background: ${subjectCss}"></div>`
            : html`<div class="text" contenteditable="plaintext-only" spellcheck="false" aria-label="Sample text, editable"
                style="text-shadow: ${shadowValue}; color: ${subjectCss}">Shadow</div>`}
        </preview-stage>
      </div>
      <div class="controls">
        ${renderPresetSection(this.definition.presets, (presetCss) => this.applyPreset(presetCss))}
        ${this.renderLayerList()}
        ${this.renderLayerEditor()}
        <section class="section">
          <h3 class="section-heading">Preview</h3>
          <color-field label=${this.isBoxVariant ? "Box color" : "Text color"} .color=${subjectColor} .colorFormat=${this.colorFormat}
            @color-change=${(event) => { this.subjectColor = event.detail; }}></color-field>
        </section>
      </div>
    `;
  }

  renderLayerList() {
    return html`
      <section class="section">
        <h3 class="section-heading">
          Layers
          <button class="button button--small" type="button" @click=${this.addLayer}>+ Add layer</button>
        </h3>
        ${this.model.layers.length === 0 ? html`<p class="hint">No shadow. Add a layer to start.</p>` : nothing}
        <ul class="item-list">
          ${this.model.layers.map((layer, index) => html`
            <li class="item" aria-current=${String(index === this.selectedIndex)}>
              <button class="item-select" type="button" @click=${() => { this.selectedIndex = index; }}>
                <span class="item-swatch" style="--swatch: ${formatColor(layer.color, COLOR_FORMATS.RGB)}"></span>
                <span class="item-summary">${serializeShadowLayer(layer, this.variant, this.colorFormat)}</span>
              </button>
              <button class="button button--icon button--small" type="button" aria-label="Remove layer ${index + 1}"
                @click=${() => this.removeLayer(index)}>×</button>
            </li>
          `)}
        </ul>
      </section>
    `;
  }

  renderLayerEditor() {
    const layer = this.model.layers[this.selectedIndex];
    if (!layer) return nothing;
    const update = (changes) => this.updateLayer({ ...layer, ...changes });
    return html`
      <section class="section">
        <h3 class="section-heading">Layer ${this.selectedIndex + 1}</h3>
        <div class="layer-editor">
          <div class="offset-row">
            <xy-pad .x=${layer.offsetX} .y=${layer.offsetY} .range=${OFFSET_PAD_RANGE_PIXELS} label="Shadow offset"
              @value-change=${(event) => update({ offsetX: event.detail.x, offsetY: event.detail.y })}></xy-pad>
            <div class="offset-numbers">
              <scrub-number label="X" unit="px" min="-100" max="100" .value=${layer.offsetX}
                @value-change=${(event) => update({ offsetX: event.detail })}></scrub-number>
              <scrub-number label="Y" unit="px" min="-100" max="100" .value=${layer.offsetY}
                @value-change=${(event) => update({ offsetY: event.detail })}></scrub-number>
            </div>
          </div>
          <scrub-number label="Blur" unit="px" min="0" max="120" .value=${layer.blur}
            @value-change=${(event) => update({ blur: Math.max(0, event.detail) })}></scrub-number>
          ${this.isBoxVariant ? html`
            <scrub-number label="Spread" unit="px" min="-60" max="60" .value=${layer.spread}
              @value-change=${(event) => update({ spread: event.detail })}></scrub-number>
          ` : nothing}
          <color-field label="Color" .color=${layer.color} .colorFormat=${this.colorFormat}
            @color-change=${(event) => update({ color: event.detail })}></color-field>
          ${this.isBoxVariant ? html`
            <div class="row">
              <span class="row-label">Type</span>
              <segmented-choice label="Shadow type" .value=${layer.isInset ? "inset" : "outset"}
                .options=${[{ value: "outset", label: "Drop" }, { value: "inset", label: "Inset" }]}
                @value-change=${(event) => update({ isInset: event.detail === "inset" })}></segmented-choice>
            </div>
          ` : nothing}
        </div>
      </section>
    `;
  }

  applyPreset(presetCss) {
    this.selectedIndex = 0;
    this.emitModel(this.definition.parse(presetCss));
  }

  addLayer() {
    const layers = [...this.model.layers, { ...NEW_LAYER, color: { ...NEW_LAYER.color } }];
    this.selectedIndex = layers.length - 1;
    this.emitModel({ layers });
  }

  removeLayer(index) {
    const layers = removeAt(this.model.layers, index);
    this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, layers.length - 1));
    this.emitModel({ layers });
  }

  updateLayer(layer) {
    this.emitModel({ layers: replaceAt(this.model.layers, this.selectedIndex, layer) });
  }

  emitModel(model) {
    emitEvent(this, "model-change", model);
  }
}

customElements.define("shadow-editor", ShadowEditor);
