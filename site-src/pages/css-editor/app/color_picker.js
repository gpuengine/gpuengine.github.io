import { LitElement, html, css, nothing } from "lit";
import { baseStyles, checkerboardStyles } from "./editor_styles.js";
import { trackPointerDrag, arrowKeyDelta, emitEvent } from "./pointer_tracking.js";
import { clamp } from "./css_value_syntax.js";
import { parseColor, formatColor, colorsAreEqual, rgbToHsv, hsvToRgb, COLOR_FORMATS } from "./color_model.js";

const FULL_HUE_DEGREES = 360;
const KEYBOARD_FRACTION_STEP = 0.01;
const KEYBOARD_FRACTION_LARGE_STEP = 0.1;

export class ColorPicker extends LitElement {
  static properties = {
    color: { attribute: false },
    hsv: { state: true }
  };

  static styles = [baseStyles, checkerboardStyles, css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .saturation-value {
      position: relative;
      height: 9.5rem;
      border-radius: 8px;
      background-image: linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent);
      touch-action: none;
      cursor: crosshair;
      user-select: none;
    }

    .thumb {
      position: absolute;
      width: 0.9rem;
      height: 0.9rem;
      border: 2px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 0 1px rgb(0 0 0 / 0.5), 0 1px 4px rgb(0 0 0 / 0.4);
      transform: translate(-50%, -50%);
      pointer-events: none;
    }

    .slider-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .sliders {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .track {
      position: relative;
      height: 0.8rem;
      border-radius: 999px;
      touch-action: none;
      cursor: pointer;
      user-select: none;
    }

    .track .thumb {
      top: 50%;
    }

    .hue-track {
      background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
    }

    .alpha-track {
      background: linear-gradient(to right, transparent, var(--opaque)), var(--checkerboard);
      background-size: auto, 8px 8px;
    }

    .current {
      width: 2rem;
      height: 2rem;
      flex: none;
      border-radius: 8px;
      background: linear-gradient(var(--current), var(--current)), var(--checkerboard);
      box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.2);
    }
  `];

  render() {
    if (!this.color || !this.hsv) return nothing;
    const { hue, saturation, value } = this.hsv;
    const opaqueColor = formatColor({ ...this.color, alpha: 1 }, COLOR_FORMATS.RGB);
    const currentColor = formatColor(this.color, COLOR_FORMATS.RGB);
    return html`
      <div class="saturation-value" style="background-color: hsl(${hue} 100% 50%)" role="slider" tabindex="0"
        aria-label="Saturation and brightness" aria-valuetext="saturation ${Math.round(saturation * 100)}%, brightness ${Math.round(value * 100)}%"
        @pointerdown=${this.startSaturationValueDrag} @keydown=${this.handleSaturationValueKey}>
        <span class="thumb" style="left: ${saturation * 100}%; top: ${(1 - value) * 100}%; background: ${opaqueColor}"></span>
      </div>
      <div class="slider-row">
        <div class="sliders">
          <div class="track hue-track" role="slider" tabindex="0" aria-label="Hue" aria-valuemin="0" aria-valuemax="360"
            aria-valuenow=${Math.round(hue)} @pointerdown=${this.startHueDrag} @keydown=${this.handleHueKey}>
            <span class="thumb" style="left: ${hue / FULL_HUE_DEGREES * 100}%; background: hsl(${hue} 100% 50%)"></span>
          </div>
          <div class="track alpha-track" style="--opaque: ${opaqueColor}" role="slider" tabindex="0" aria-label="Opacity"
            aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(this.color.alpha * 100)}
            @pointerdown=${this.startAlphaDrag} @keydown=${this.handleAlphaKey}>
            <span class="thumb" style="left: ${this.color.alpha * 100}%; background: ${currentColor}"></span>
          </div>
        </div>
        <span class="current" style="--current: ${currentColor}" aria-hidden="true"></span>
      </div>
    `;
  }

  willUpdate(changedProperties) {
    if (!changedProperties.has("color") || !this.color) return;
    if (this.hsv && colorsAreEqual(hsvToRgb(this.hsv, this.color.alpha), this.color)) return;
    const nextHsv = rgbToHsv(this.color);
    if (!this.hsv) {
      this.hsv = nextHsv;
      return;
    }
    const isBlack = nextHsv.value === 0;
    const isGray = nextHsv.saturation === 0;
    this.hsv = {
      hue: isBlack || isGray ? this.hsv.hue : nextHsv.hue,
      saturation: isBlack ? this.hsv.saturation : nextHsv.saturation,
      value: nextHsv.value
    };
  }

  startSaturationValueDrag(event) {
    event.currentTarget.focus();
    trackPointerDrag(event, event.currentTarget, (position) => {
      this.updateHsv({ saturation: clamp(position.x, 0, 1), value: clamp(1 - position.y, 0, 1) });
    });
  }

  startHueDrag(event) {
    event.currentTarget.focus();
    trackPointerDrag(event, event.currentTarget, (position) => {
      this.updateHsv({ hue: clamp(position.x, 0, 1) * FULL_HUE_DEGREES });
    });
  }

  startAlphaDrag(event) {
    event.currentTarget.focus();
    trackPointerDrag(event, event.currentTarget, (position) => {
      this.emitColor({ ...this.color, alpha: Math.round(clamp(position.x, 0, 1) * 100) / 100 });
    });
  }

  handleSaturationValueKey(event) {
    const delta = arrowKeyDelta(event, { step: KEYBOARD_FRACTION_STEP, largeStep: KEYBOARD_FRACTION_LARGE_STEP });
    if (!delta) return;
    event.preventDefault();
    this.updateHsv({
      saturation: clamp(this.hsv.saturation + delta.x, 0, 1),
      value: clamp(this.hsv.value - delta.y, 0, 1)
    });
  }

  handleHueKey(event) {
    const delta = arrowKeyDelta(event);
    if (!delta) return;
    event.preventDefault();
    this.updateHsv({ hue: clamp(this.hsv.hue + (delta.x || -delta.y), 0, FULL_HUE_DEGREES) });
  }

  handleAlphaKey(event) {
    const delta = arrowKeyDelta(event, { step: KEYBOARD_FRACTION_STEP, largeStep: KEYBOARD_FRACTION_LARGE_STEP });
    if (!delta) return;
    event.preventDefault();
    const alpha = Math.round(clamp(this.color.alpha + (delta.x || -delta.y), 0, 1) * 100) / 100;
    this.emitColor({ ...this.color, alpha });
  }

  updateHsv(changes) {
    this.hsv = { ...this.hsv, ...changes };
    this.emitColor(hsvToRgb(this.hsv, this.color.alpha));
  }

  emitColor(color) {
    emitEvent(this, "color-change", color);
  }
}

export class ColorField extends LitElement {
  static properties = {
    label: {},
    color: { attribute: false },
    colorFormat: {},
    isExpanded: { type: Boolean, reflect: true, attribute: "expanded" },
    isTextInvalid: { state: true }
  };

  static styles = [baseStyles, checkerboardStyles, css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .field {
      display: grid;
      grid-template-columns: 5.5rem 1.9rem minmax(0, 1fr);
      align-items: center;
      gap: 0.5rem;
    }

    .label {
      color: var(--muted);
    }

    .swatch {
      width: 1.9rem;
      height: 1.9rem;
      padding: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: linear-gradient(var(--swatch), var(--swatch)), var(--checkerboard);
      cursor: pointer;
    }

    :host([expanded]) .swatch {
      border-color: var(--accent);
    }

    .text-input {
      width: 100%;
      min-width: 0;
    }

    color-picker {
      padding: 0.6rem;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--bg);
    }

    :host([hide-label]) .field {
      grid-template-columns: 1.9rem minmax(0, 1fr);
    }

    :host([hide-label]) .label {
      display: none;
    }
  `];

  constructor() {
    super();
    this.label = "Color";
    this.colorFormat = COLOR_FORMATS.HEX;
    this.isExpanded = false;
    this.isTextInvalid = false;
  }

  render() {
    if (!this.color) return nothing;
    return html`
      <div class="field">
        <span class="label">${this.label}</span>
        <button class="swatch" type="button" style="--swatch: ${formatColor(this.color, COLOR_FORMATS.RGB)}"
          aria-label="${this.isExpanded ? "Close" : "Open"} ${this.label} picker" aria-expanded=${String(this.isExpanded)}
          @click=${() => { this.isExpanded = !this.isExpanded; }}></button>
        <input class="text-input" spellcheck="false" aria-label=${this.label} aria-invalid=${String(this.isTextInvalid)}
          @input=${this.handleTextInput} @blur=${this.syncTextInput}>
      </div>
      ${this.isExpanded ? html`<color-picker .color=${this.color} @color-change=${this.forwardColor}></color-picker>` : nothing}
    `;
  }

  updated() {
    const textInput = this.renderRoot.querySelector(".text-input");
    if (textInput && this.renderRoot.activeElement !== textInput) this.syncTextInput();
  }

  syncTextInput() {
    const textInput = this.renderRoot.querySelector(".text-input");
    if (!textInput) return;
    textInput.value = formatColor(this.color, this.colorFormat);
    this.isTextInvalid = false;
  }

  handleTextInput(event) {
    const color = parseColor(event.target.value);
    this.isTextInvalid = !color;
    if (color) emitEvent(this, "color-change", color);
  }

  forwardColor(event) {
    emitEvent(this, "color-change", event.detail);
  }
}

customElements.define("color-picker", ColorPicker);
customElements.define("color-field", ColorField);
