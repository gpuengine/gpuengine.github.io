import { LitElement, html, css, nothing } from "lit";
import { editorStyles } from "./editor_styles.js";
import { renderPresetSection } from "./editor_controls.js";
import { parseColor, formatColor, contrastRatio, createColor, COLOR_FORMATS, COLOR_FORMAT_LABELS } from "./color_model.js";
import { emitEvent } from "./pointer_tracking.js";

const WHITE = createColor(255, 255, 255);
const BLACK = createColor(0, 0, 0);
const CONTRAST_THRESHOLDS = Object.freeze({ AAA: 7, AA: 4.5, AA_LARGE: 3 });
const COPIED_NOTICE_MILLISECONDS = 1400;

const COLOR_PRESETS = [
  { label: "Ember", css: "#ff8a3d" },
  { label: "Translucent", css: "rgb(61 139 255 / 0.6)" },
  { label: "Mint", css: "hsl(152 68% 52%)" },
  { label: "Vivid pink", css: "oklch(65% 0.26 350)" },
  { label: "Ink", css: "#1c1612" },
  { label: "Paper", css: "hwb(30 92% 2%)" }
];

export const colorDefinition = {
  id: "color",
  label: "Color",
  group: "Color",
  properties: ["background-color", "background", "color", "border-color", "fill", "stroke", "accent-color", "outline-color"],
  presets: COLOR_PRESETS,
  parse: (value) => {
    const color = parseColor(value);
    return color ? { color } : null;
  },
  serialize: (model, colorFormat) => formatColor(model.color, colorFormat),
  render: ({ model, colorFormat, onChange }) => html`<color-editor .model=${model} .colorFormat=${colorFormat}
    @model-change=${onChange}></color-editor>`
};

function contrastGrade(ratio) {
  if (ratio >= CONTRAST_THRESHOLDS.AAA) return "AAA";
  if (ratio >= CONTRAST_THRESHOLDS.AA) return "AA";
  if (ratio >= CONTRAST_THRESHOLDS.AA_LARGE) return "AA large";
  return "Fails";
}

class ColorEditor extends LitElement {
  static properties = {
    model: { attribute: false },
    colorFormat: {},
    copiedFormat: { state: true }
  };

  static styles = [editorStyles, css`
    .swatch {
      display: grid;
      place-items: center;
      width: min(22rem, 100%);
      aspect-ratio: 4 / 3;
      border-radius: 18px;
      background: linear-gradient(var(--swatch), var(--swatch)), var(--checkerboard);
      box-shadow: 0 0 0 1px rgb(0 0 0 / 0.08), 0 12px 32px rgb(0 0 0 / 0.18);
    }

    .sample-text {
      display: flex;
      gap: 1.25rem;
      font: 700 1.6rem/1 system-ui, -apple-system, "Segoe UI", sans-serif;
    }

    .format-list {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 0.35rem 0.6rem;
      align-items: center;
      margin: 0;
    }

    .format-list dt {
      color: var(--muted);
      font-size: 0.75rem;
    }

    .format-list dd {
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font: 0.78rem var(--mono);
    }

    .contrast {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }

    .contrast-card {
      padding: 0.55rem 0.7rem;
      border-radius: 8px;
      font-weight: 600;
    }

    .contrast-card small {
      display: block;
      font-weight: 400;
      opacity: 0.85;
    }
  `];

  constructor() {
    super();
    this.colorFormat = COLOR_FORMATS.HEX;
    this.copiedFormat = null;
  }

  render() {
    if (!this.model) return nothing;
    const { color } = this.model;
    const colorCss = formatColor(color, COLOR_FORMATS.RGB);
    return html`
      <div class="preview">
        <preview-stage>
          <div class="swatch" style="--swatch: ${colorCss}">
            <div class="sample-text"><span style="color: #fff">Aa</span><span style="color: #000">Aa</span></div>
          </div>
        </preview-stage>
      </div>
      <div class="controls">
        ${renderPresetSection(COLOR_PRESETS, (presetCss) => emitEvent(this, "model-change", colorDefinition.parse(presetCss)))}
        <section class="section">
          <h3 class="section-heading">Picker</h3>
          <color-picker .color=${color} @color-change=${(event) => emitEvent(this, "model-change", { color: event.detail })}></color-picker>
          <color-field label="Value" .color=${color} .colorFormat=${this.colorFormat}
            @color-change=${(event) => emitEvent(this, "model-change", { color: event.detail })}></color-field>
        </section>
        <section class="section">
          <h3 class="section-heading">All formats</h3>
          <dl class="format-list">
            ${Object.values(COLOR_FORMATS).map((format) => this.renderFormatRow(color, format))}
          </dl>
        </section>
        <section class="section">
          <h3 class="section-heading">Text contrast (WCAG)</h3>
          <div class="contrast">
            ${[WHITE, BLACK].map((textColor) => this.renderContrastCard(color, textColor))}
          </div>
          ${color.alpha < 1 ? html`<p class="hint">Contrast ignores transparency; check it against the real background.</p>` : nothing}
        </section>
      </div>
    `;
  }

  renderFormatRow(color, format) {
    const text = formatColor(color, format);
    return html`
      <dt>${COLOR_FORMAT_LABELS[format]}</dt>
      <dd title=${text}>${text}</dd>
      <button class="button button--small" type="button" @click=${() => this.copyFormat(format, text)}>
        ${this.copiedFormat === format ? "Copied" : "Copy"}
      </button>
    `;
  }

  renderContrastCard(color, textColor) {
    const ratio = contrastRatio(color, textColor);
    return html`
      <div class="contrast-card" style="background: ${formatColor({ ...color, alpha: 1 }, COLOR_FORMATS.RGB)}; color: ${formatColor(textColor, COLOR_FORMATS.HEX)}">
        ${ratio.toFixed(2)} : 1
        <small>${textColor === WHITE ? "White" : "Black"} text · ${contrastGrade(ratio)}</small>
      </div>
    `;
  }

  async copyFormat(format, text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    this.copiedFormat = format;
    clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => { this.copiedFormat = null; }, COPIED_NOTICE_MILLISECONDS);
  }
}

customElements.define("color-editor", ColorEditor);
