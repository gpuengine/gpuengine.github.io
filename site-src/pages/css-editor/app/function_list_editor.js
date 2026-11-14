import { LitElement, html, css, nothing } from "lit";
import { baseStyles, checkerboardStyles, panelStyles } from "./editor_styles.js";
import { replaceAt, removeAt, moveItem } from "./editor_controls.js";
import { splitWhitespace, parseFunctionCall } from "./css_value_syntax.js";
import { emitEvent } from "./pointer_tracking.js";

export const PARAMETER_TYPES = Object.freeze({ NUMBER: "number", COLOR: "color" });

export function parseFunctionList(value, kinds) {
  if (value.trim().toLowerCase() === "none") return { items: [] };
  const items = [];
  for (const callText of splitWhitespace(value)) {
    const call = parseFunctionCall(callText);
    const kind = call && kinds.find((candidate) => candidate.cssNames.includes(call.name));
    const values = kind?.parseCall(call.name, call.argumentsText);
    if (!values) return null;
    items.push({ kindName: kind.name, values });
  }
  return { items };
}

export function serializeFunctionList(model, kinds, colorFormat) {
  if (model.items.length === 0) return "none";
  return model.items.map((item) => findKind(kinds, item.kindName).formatCall(item.values, colorFormat)).join(" ");
}

function findKind(kinds, kindName) {
  return kinds.find((kind) => kind.name === kindName);
}

class FunctionListControls extends LitElement {
  static properties = {
    kinds: { attribute: false },
    model: { attribute: false },
    colorFormat: {},
    heading: {}
  };

  static styles = [baseStyles, checkerboardStyles, panelStyles, css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
    }

    .function-item {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.6rem 0.65rem 0.7rem;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--bg);
    }

    .function-header {
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }

    .function-name {
      flex: 1;
      font: 600 0.78rem var(--mono);
    }

    .add-row select {
      flex: 1;
      min-width: 0;
    }
  `];

  render() {
    if (!this.model) return nothing;
    const { items } = this.model;
    return html`
      <h3 class="section-heading">${this.heading}</h3>
      ${items.length === 0 ? html`<p class="hint">Nothing applied yet. Add a function below.</p>` : nothing}
      ${items.map((item, index) => this.renderItem(item, index, items.length))}
      <div class="row add-row">
        <select aria-label="Function to add" @change=${this.addItem}>
          <option value="">+ Add function…</option>
          ${this.kinds.map((kind) => html`<option value=${kind.name}>${kind.label}</option>`)}
        </select>
      </div>
    `;
  }

  renderItem(item, index, itemCount) {
    const kind = findKind(this.kinds, item.kindName);
    return html`
      <div class="function-item">
        <div class="function-header">
          <span class="function-name">${kind.label}</span>
          <button class="button button--icon button--small" type="button" aria-label="Move ${kind.label} up" ?disabled=${index === 0}
            @click=${() => this.emitItems(moveItem(this.model.items, index, -1))}>↑</button>
          <button class="button button--icon button--small" type="button" aria-label="Move ${kind.label} down" ?disabled=${index === itemCount - 1}
            @click=${() => this.emitItems(moveItem(this.model.items, index, 1))}>↓</button>
          <button class="button button--icon button--small" type="button" aria-label="Remove ${kind.label}"
            @click=${() => this.emitItems(removeAt(this.model.items, index))}>×</button>
        </div>
        ${kind.parameters.map((parameter, parameterIndex) => this.renderParameter(item, index, parameter, parameterIndex))}
      </div>
    `;
  }

  renderParameter(item, itemIndex, parameter, parameterIndex) {
    const updateValue = (value) => {
      const values = replaceAt(item.values, parameterIndex, value);
      this.emitItems(replaceAt(this.model.items, itemIndex, { ...item, values }));
    };
    if (parameter.type === PARAMETER_TYPES.COLOR) {
      return html`<color-field label=${parameter.label} .color=${item.values[parameterIndex]} .colorFormat=${this.colorFormat}
        @color-change=${(event) => updateValue(event.detail)}></color-field>`;
    }
    return html`<scrub-number label=${parameter.label} unit=${parameter.unit} min=${parameter.min} max=${parameter.max}
      step=${parameter.step} .value=${item.values[parameterIndex]} @value-change=${(event) => updateValue(event.detail)}></scrub-number>`;
  }

  addItem(event) {
    const kind = findKind(this.kinds, event.target.value);
    event.target.value = "";
    if (!kind) return;
    const values = kind.parameters.map((parameter) => (typeof parameter.defaultValue === "object" ? { ...parameter.defaultValue } : parameter.defaultValue));
    this.emitItems([...this.model.items, { kindName: kind.name, values }]);
  }

  emitItems(items) {
    emitEvent(this, "model-change", { ...this.model, items });
  }
}

customElements.define("function-list-controls", FunctionListControls);
