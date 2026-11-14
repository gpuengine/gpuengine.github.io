import { LitElement, html, css, svg, nothing } from "lit";
import { baseStyles, checkerboardStyles } from "./editor_styles.js";
import { parseDeclaration, formatDeclaration } from "./css_value_syntax.js";
import { COLOR_FORMATS, COLOR_FORMAT_LABELS } from "./color_model.js";
import { colorDefinition } from "./color_editor.js";
import { gradientDefinition } from "./gradient_editor.js";
import { boxShadowDefinition, textShadowDefinition } from "./shadow_editor.js";
import { filterDefinition } from "./filter_editor.js";
import { clipPathDefinition } from "./clip_path_editor.js";
import { borderRadiusDefinition } from "./border_radius_editor.js";
import { transformDefinition } from "./transform_editor.js";
import { easingDefinition } from "./easing_editor.js";
import "./editor_controls.js";
import "./color_picker.js";

const EDITOR_DEFINITIONS = [
  colorDefinition,
  gradientDefinition,
  boxShadowDefinition,
  textShadowDefinition,
  filterDefinition,
  clipPathDefinition,
  borderRadiusDefinition,
  transformDefinition,
  easingDefinition
];
const EDITOR_GROUPS = ["Color", "Effects", "Shape", "Motion"];
const NAV_ICON_STYLES = Object.freeze({
  "color": "background: #ff8a3d; border-radius: 50%",
  "gradient": "background: linear-gradient(135deg, #ff8a3d, #ff3d77, #7c3aed)",
  "box-shadow": "background: #fff; box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.25), 2px 2px 0 #ff8a3d",
  "filter": "background: linear-gradient(135deg, #ff8a3d, #3d8bff); filter: blur(1.5px)",
  "clip-path": "background: #ff8a3d; clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
  "border-radius": "background: #ff8a3d; border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%",
  "transform": "background: #ff8a3d; transform: perspective(40px) rotateY(-35deg) rotate(-8deg)"
});
const COLOR_FORMAT_STORAGE_KEY = "css-editor-color-format";
const NOTICE_MILLISECONDS = 1600;
const DEFAULT_SOURCE_HINT = "Edit or paste any value or declaration here, e.g. box-shadow: 0 4px 12px #0003";

export class CssWorkbench extends LitElement {
  static properties = {
    activeEditorId: { state: true },
    editorStates: { state: true },
    colorFormat: { state: true },
    sourceError: { state: true },
    notice: { state: true }
  };

  static styles = [baseStyles, checkerboardStyles, css`
    :host {
      display: grid;
      grid-template-columns: 11.5rem minmax(0, 1fr);
      min-height: 0;
      overflow: hidden;
      background: var(--bg);
    }

    .editor-nav {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      min-height: 0;
      overflow: auto;
      padding: 0.75rem 0.6rem;
      border-right: 1px solid var(--line);
      background: var(--surface);
    }

    .nav-group-heading {
      margin: 0.8rem 0.5rem 0.3rem;
      color: var(--muted);
      font: 600 0.68rem var(--mono);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .nav-group-heading:first-child {
      margin-top: 0.2rem;
    }

    .nav-button {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      width: 100%;
      padding: 0.4rem 0.55rem;
      border: 0;
      border-radius: 7px;
      background: none;
      color: var(--muted);
      font-size: 0.85rem;
      text-align: left;
      white-space: nowrap;
      cursor: pointer;
    }

    .nav-button:hover {
      color: var(--text);
      background: var(--surface-raised);
    }

    .nav-button[aria-current="page"] {
      color: var(--text);
      background: var(--surface-raised);
      box-shadow: inset 2px 0 0 var(--accent);
    }

    .nav-icon {
      display: grid;
      place-items: center;
      width: 1.05rem;
      height: 1.05rem;
      flex: none;
      border-radius: 3px;
      color: #ff8a3d;
      font: 800 0.85rem/1 system-ui, sans-serif;
    }

    .nav-icon svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .workspace {
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      min-width: 0;
      min-height: 0;
    }

    .editor-slot {
      min-height: 0;
      display: grid;
    }

    .editor-slot > * {
      min-height: 0;
    }

    .output {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      padding: 0.6rem 0.75rem 0.65rem;
      border-top: 1px solid var(--line);
      background: var(--surface);
    }

    .output-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .output-title {
      margin: 0 auto 0 0;
      color: var(--muted);
      font: 600 0.7rem var(--mono);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .output-option {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      color: var(--muted);
      font-size: 0.78rem;
    }

    .source {
      width: 100%;
      min-height: 4.6rem;
      max-height: 8.5rem;
      padding: 0.6rem 0.75rem;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--bg);
      font: 0.85rem/1.5 var(--mono);
      field-sizing: content;
      resize: vertical;
    }

    .source:focus {
      outline: none;
      border-color: var(--accent);
    }

    .source[aria-invalid="true"] {
      border-color: #ef4444;
    }

    .source-status {
      margin: 0;
      min-height: 1.2em;
      color: var(--muted);
      font-size: 0.75rem;
    }

    .source-status[data-error] {
      color: #f87171;
    }

    @media (max-width: 800px) {
      :host {
        display: block;
        overflow: auto;
        overscroll-behavior: contain;
      }

      .editor-nav {
        position: sticky;
        top: 0;
        z-index: 5;
        flex-direction: row;
        gap: 0.25rem;
        padding: 0.45rem 0.6rem;
        overflow-x: auto;
        border-right: 0;
        border-bottom: 1px solid var(--line);
        scrollbar-width: none;
      }

      .nav-group-heading {
        display: none;
      }

      .nav-button {
        width: auto;
        flex: none;
      }

      .nav-button[aria-current="page"] {
        box-shadow: inset 0 -2px 0 var(--accent);
      }

      .workspace {
        display: flex;
        flex-direction: column;
      }

      .output {
        position: sticky;
        bottom: 0;
        z-index: 5;
        box-shadow: 0 -8px 20px rgb(0 0 0 / 0.2);
      }

      .output-header {
        flex-wrap: nowrap;
        overflow-x: auto;
        scrollbar-width: none;
      }

      .output-title, .option-label {
        display: none;
      }

      .output-header select {
        max-width: 9rem;
      }

      .output-header .button--primary {
        order: -1;
      }

      .source {
        min-height: 3.2rem;
        max-height: 6.5rem;
        font-size: 0.78rem;
      }
    }
  `];

  constructor() {
    super();
    this.editorStates = Object.fromEntries(EDITOR_DEFINITIONS.map((definition) => [definition.id, createInitialEditorState(definition)]));
    this.activeEditorId = EDITOR_DEFINITIONS[0].id;
    this.colorFormat = readStoredColorFormat();
    this.sourceError = null;
    this.notice = null;
    this.restoreFromHash();
  }

  get activeDefinition() {
    return EDITOR_DEFINITIONS.find((definition) => definition.id === this.activeEditorId);
  }

  get activeState() {
    return this.editorStates[this.activeEditorId];
  }

  render() {
    const definition = this.activeDefinition;
    const { model, property } = this.activeState;
    return html`
      <nav class="editor-nav" aria-label="CSS property">
        ${EDITOR_GROUPS.map((group) => html`
          <h2 class="nav-group-heading">${group}</h2>
          ${EDITOR_DEFINITIONS.filter((candidate) => candidate.group === group).map((candidate) => html`
            <button class="nav-button" type="button" aria-current=${candidate.id === this.activeEditorId ? "page" : "false"}
              @click=${() => this.selectEditor(candidate.id)}>
              ${renderNavIcon(candidate.id)}${candidate.label}
            </button>
          `)}
        `)}
      </nav>
      <div class="workspace">
        <div class="editor-slot">
          ${definition.render({ model, colorFormat: this.colorFormat, onChange: (event) => this.handleModelChange(event.detail) })}
        </div>
        <section class="output" aria-label="Generated CSS">
          <div class="output-header">
            <h2 class="output-title">CSS</h2>
            ${definition.properties.length > 1 ? html`
              <label class="output-option"><span class="option-label">Property</span>
                <select aria-label="Property" @change=${(event) => this.changeProperty(event.target.value)}>
                  ${definition.properties.map((candidate) => html`<option value=${candidate} ?selected=${candidate === property}>${candidate}</option>`)}
                </select>
              </label>
            ` : nothing}
            <label class="output-option"><span class="option-label">Colors</span>
              <select aria-label="Color format" @change=${(event) => this.changeColorFormat(event.target.value)}>
                ${Object.values(COLOR_FORMATS).map((format) => html`<option value=${format} ?selected=${format === this.colorFormat}>${COLOR_FORMAT_LABELS[format]}</option>`)}
              </select>
            </label>
            <button class="button" type="button" @click=${this.resetActiveEditor}>Reset</button>
            <button class="button" type="button" @click=${() => this.copyText(this.serializeActiveValue(), "Value copied")}>Copy value</button>
            <button class="button button--primary" type="button" @click=${() => this.copyText(this.canonicalSource(), "CSS copied")}>Copy CSS</button>
          </div>
          <textarea class="source" spellcheck="false" autocapitalize="off" aria-label="CSS declaration, editable"
            aria-invalid=${String(Boolean(this.sourceError))} aria-describedby="source-status"
            @input=${this.handleSourceInput} @blur=${this.handleSourceBlur}></textarea>
          <p class="source-status" id="source-status" role="status" ?data-error=${Boolean(this.sourceError)}>
            ${this.sourceError ?? this.notice ?? DEFAULT_SOURCE_HINT}
          </p>
        </section>
      </div>
    `;
  }

  updated(changedProperties) {
    const source = this.renderRoot.querySelector(".source");
    if (this.renderRoot.activeElement !== source) source.value = this.canonicalSource();
    if (changedProperties.has("activeEditorId")) {
      this.renderRoot.querySelector('.nav-button[aria-current="page"]').scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  serializeActiveValue() {
    return this.activeDefinition.serialize(this.activeState.model, this.colorFormat);
  }

  canonicalSource() {
    return formatDeclaration(this.activeState.property, this.serializeActiveValue());
  }

  selectEditor(editorId) {
    this.activeEditorId = editorId;
    this.sourceError = null;
    this.writeHash();
  }

  handleModelChange(model) {
    if (!model) return;
    this.setEditorState(this.activeEditorId, { ...this.activeState, model });
    this.sourceError = null;
    this.writeHash();
  }

  changeProperty(property) {
    this.setEditorState(this.activeEditorId, { ...this.activeState, property });
  }

  changeColorFormat(colorFormat) {
    this.colorFormat = colorFormat;
    try {
      localStorage.setItem(COLOR_FORMAT_STORAGE_KEY, colorFormat);
    } catch {
      return;
    }
  }

  resetActiveEditor() {
    this.setEditorState(this.activeEditorId, createInitialEditorState(this.activeDefinition));
    this.sourceError = null;
    this.writeHash();
  }

  handleSourceInput(event) {
    const text = event.target.value;
    if (!text.trim()) {
      this.sourceError = null;
      return;
    }
    const result = this.importSource(text);
    this.sourceError = result.error ?? null;
    if (!result.error) this.writeHash();
  }

  handleSourceBlur(event) {
    if (!this.sourceError) event.target.value = this.canonicalSource();
  }

  importSource(text) {
    const { property, value } = parseDeclaration(text);
    const others = EDITOR_DEFINITIONS.filter((definition) => definition !== this.activeDefinition);
    const candidates = property
      ? EDITOR_DEFINITIONS.filter((definition) => definition.properties.includes(property))
      : [this.activeDefinition, ...others];
    if (property && candidates.length === 0) {
      return { error: `“${property}” isn't one of the properties this tool edits.` };
    }
    for (const definition of candidates) {
      const model = definition.parse(value);
      if (!model) continue;
      const previousProperty = this.editorStates[definition.id].property;
      const chosenProperty = property ?? previousProperty;
      this.setEditorState(definition.id, { model, property: chosenProperty });
      this.activeEditorId = definition.id;
      return {};
    }
    return { error: `Can't read this as ${property ?? "a supported value"}. Check the syntax; lengths need px or % units.` };
  }

  setEditorState(editorId, state) {
    this.editorStates = { ...this.editorStates, [editorId]: state };
  }

  async copyText(text, message) {
    try {
      await navigator.clipboard.writeText(text);
      this.showNotice(message);
    } catch {
      this.showNotice("Copy failed. Select the text and copy it manually.");
    }
  }

  showNotice(message) {
    this.notice = message;
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => { this.notice = null; }, NOTICE_MILLISECONDS);
  }

  writeHash() {
    const parameters = new URLSearchParams({ editor: this.activeEditorId, value: this.serializeActiveValue() });
    history.replaceState(null, "", `#${parameters}`);
  }

  restoreFromHash() {
    const parameters = new URLSearchParams(location.hash.slice(1));
    const definition = EDITOR_DEFINITIONS.find((candidate) => candidate.id === parameters.get("editor"));
    if (!definition) return;
    this.activeEditorId = definition.id;
    const model = parameters.has("value") ? definition.parse(parameters.get("value")) : null;
    if (model) this.setEditorState(definition.id, { ...this.editorStates[definition.id], model });
  }
}

function createInitialEditorState(definition) {
  return { model: definition.parse(definition.presets[0].css), property: definition.properties[0] };
}

function renderNavIcon(editorId) {
  if (editorId === "text-shadow") return html`<span class="nav-icon" style="text-shadow: 2px 2px 0 #3d8bff">T</span>`;
  if (editorId === "easing") {
    return html`<span class="nav-icon">${svg`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 15 C 8 15, 7 1, 15 1" fill="none" stroke="#ff8a3d" stroke-width="2.2" stroke-linecap="round"></path></svg>`}</span>`;
  }
  return html`<span class="nav-icon" style=${NAV_ICON_STYLES[editorId]}></span>`;
}

function readStoredColorFormat() {
  try {
    const stored = localStorage.getItem(COLOR_FORMAT_STORAGE_KEY);
    return Object.values(COLOR_FORMATS).includes(stored) ? stored : COLOR_FORMATS.HEX;
  } catch {
    return COLOR_FORMATS.HEX;
  }
}

customElements.define("css-workbench", CssWorkbench);
