import { LitElement, html, css, nothing } from "lit";
import { boxSizingStyles, toolbarStyles } from "./shared_styles.js";

const SOURCE_LINE_HEIGHT_PX = 20;

export class JsonSourcePane extends LitElement {
  static properties = {
    errorInfo: { attribute: false },
    detachedSummary: { type: String },
    isDetached: { type: Boolean },
    isWrapped: { type: Boolean }
  };

  static styles = [boxSizingStyles, toolbarStyles, css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .editor {
      flex: 1;
      min-height: 0;
      width: 100%;
      margin: 0;
      padding: 0.5rem 0.75rem;
      border: 0;
      resize: none;
      overflow: auto;
      overscroll-behavior: contain;
      background: transparent;
      color: var(--text);
      font: 13px/${SOURCE_LINE_HEIGHT_PX}px var(--mono);
      tab-size: 2;
      white-space: pre;
    }

    .editor.is-wrapped {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .editor:focus {
      outline: none;
      box-shadow: inset 0 0 0 2px var(--accent);
    }

    .editor::placeholder {
      color: var(--muted);
    }

    .error-bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.45rem 0.75rem;
      border-top: 1px solid rgb(248 113 113 / 0.4);
      background: rgb(248 113 113 / 0.1);
      color: #f87171;
      font: 0.8rem/1.4 var(--mono);
    }

    .error-text {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .detached {
      flex: 1;
      display: grid;
      place-content: center;
      gap: 0.9rem;
      padding: 2rem;
      text-align: center;
      color: var(--muted);
      font: 0.95rem/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
    }

    .detached strong {
      color: var(--text);
      font-family: var(--mono);
    }

    .detached .tool-button {
      justify-self: center;
    }
  `];

  constructor() {
    super();
    this.errorInfo = null;
    this.detachedSummary = "";
    this.isDetached = false;
    this.isWrapped = true;
  }

  readText() {
    return this.#editor()?.value ?? "";
  }

  setText(text) {
    const editor = this.#editor();
    if (!editor) return;
    editor.value = text;
    editor.scrollTop = 0;
  }

  revealError() {
    const editor = this.#editor();
    if (!editor || !this.errorInfo) return;
    const { offset, line } = this.errorInfo;
    editor.focus({ preventScroll: true });
    editor.setSelectionRange(offset, Math.min(offset + 1, editor.value.length));
    editor.scrollTop = Math.max(0, (line - 1) * SOURCE_LINE_HEIGHT_PX - editor.clientHeight / 2);
  }

  render() {
    if (this.isDetached) {
      return html`<div class="detached">
        <p><strong>${this.detachedSummary}</strong></p>
        <p>The raw text is too large to edit comfortably in the browser, so it is kept out of the text box. The tree on the right is fully usable.</p>
        <button class="tool-button" @click=${() => this.#emit("attach-request")}>Edit as text anyway</button>
      </div>`;
    }
    return html`
      <textarea class="editor ${this.isWrapped ? "is-wrapped" : ""}" wrap=${this.isWrapped ? "soft" : "off"} spellcheck="false" autocomplete="off" autocapitalize="off"
        aria-label="JSON input" placeholder="Paste JSON here, open a file, or drop one anywhere on the tool."
        @input=${() => this.#emit("source-input")}></textarea>
      ${this.errorInfo ? this.#renderError() : nothing}
    `;
  }

  #renderError() {
    const { message, line, column } = this.errorInfo;
    return html`<div class="error-bar" role="alert">
      <span class="error-text">Line ${line}, column ${column}: ${message}</span>
      <button class="tool-button" @click=${() => this.revealError()}>Go to error</button>
    </div>`;
  }

  #editor() {
    return this.renderRoot.querySelector(".editor");
  }

  #emit(eventName) {
    this.dispatchEvent(new CustomEvent(eventName, { bubbles: true, composed: true }));
  }
}

customElements.define("json-source-pane", JsonSourcePane);
