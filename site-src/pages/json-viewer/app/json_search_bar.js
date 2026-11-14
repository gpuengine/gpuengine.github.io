import { LitElement, html, css } from "lit";
import { boxSizingStyles, toolbarStyles } from "./shared_styles.js";
import { SEARCH_SCOPE } from "./text_search.js";

const SEARCH_DEBOUNCE_MILLISECONDS = 220;
const SEARCH_DIRECTION = Object.freeze({ NEXT: 1, PREVIOUS: -1 });

export class JsonSearchBar extends LitElement {
  static properties = {
    resultLabel: { type: String },
    hasResults: { type: Boolean },
    isDisabled: { type: Boolean },
    disabledReason: { type: String },
    query: { state: true },
    isCaseSensitive: { state: true },
    scope: { state: true }
  };

  static styles = [boxSizingStyles, toolbarStyles, css`
    :host {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      min-width: 0;
    }

    .search-input {
      flex: 1;
      min-width: 6rem;
      height: 1.9rem;
      padding: 0 0.6rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--bg);
      color: var(--text);
      font: 0.85rem var(--mono);
    }

    .search-input:focus {
      outline: none;
      border-color: var(--accent);
    }

    .search-input:disabled {
      opacity: 0.6;
    }

    .scope-select {
      height: 1.9rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      color: var(--text);
      font: 0.8rem system-ui, sans-serif;
    }

    .result-label {
      min-width: 4.5rem;
      color: var(--muted);
      font: 0.78rem var(--mono);
      text-align: right;
      white-space: nowrap;
    }

    @media (max-width: 640px) {
      .scope-select { display: none; }
    }
  `];

  #debounceTimer = 0;
  #hasPendingChange = false;

  constructor() {
    super();
    this.resultLabel = "";
    this.hasResults = false;
    this.isDisabled = false;
    this.disabledReason = "";
    this.query = "";
    this.isCaseSensitive = false;
    this.scope = SEARCH_SCOPE.KEYS_AND_VALUES;
  }

  focusInput() {
    const input = this.renderRoot.querySelector(".search-input");
    input?.focus();
    input?.select();
  }

  render() {
    const placeholder = this.isDisabled ? this.disabledReason : "Search keys and values";
    return html`
      <input class="search-input" type="search" .value=${this.query} placeholder=${placeholder} aria-label="Search JSON"
        title=${this.isDisabled ? this.disabledReason : "Search (Ctrl+F). Enter: next, Shift+Enter: previous"}
        ?disabled=${this.isDisabled} spellcheck="false" @input=${this.#handleInput} @keydown=${this.#handleKeyDown}>
      <button class="tool-button tool-button--icon" title="Match case" aria-label="Match case"
        aria-pressed=${String(this.isCaseSensitive)} ?disabled=${this.isDisabled} @click=${this.#toggleCaseSensitive}>Aa</button>
      <select class="scope-select" aria-label="Search in" ?disabled=${this.isDisabled} @change=${this.#handleScopeChange}>
        <option value=${SEARCH_SCOPE.KEYS_AND_VALUES} ?selected=${this.scope === SEARCH_SCOPE.KEYS_AND_VALUES}>Keys &amp; values</option>
        <option value=${SEARCH_SCOPE.KEYS} ?selected=${this.scope === SEARCH_SCOPE.KEYS}>Keys</option>
        <option value=${SEARCH_SCOPE.VALUES} ?selected=${this.scope === SEARCH_SCOPE.VALUES}>Values</option>
      </select>
      <span class="result-label" aria-live="polite">${this.resultLabel}</span>
      <button class="tool-button tool-button--icon" title="Previous match (Shift+Enter)" aria-label="Previous match"
        ?disabled=${!this.hasResults} @click=${() => this.#step(SEARCH_DIRECTION.PREVIOUS)}>↑</button>
      <button class="tool-button tool-button--icon" title="Next match (Enter)" aria-label="Next match"
        ?disabled=${!this.hasResults} @click=${() => this.#step(SEARCH_DIRECTION.NEXT)}>↓</button>
    `;
  }

  #handleInput(event) {
    this.query = event.target.value;
    clearTimeout(this.#debounceTimer);
    this.#hasPendingChange = true;
    this.#debounceTimer = setTimeout(() => this.#emitChange(), SEARCH_DEBOUNCE_MILLISECONDS);
  }

  #handleKeyDown(event) {
    if (event.key === "Escape" && this.query) {
      event.preventDefault();
      this.query = "";
      this.#emitChange();
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (this.#hasPendingChange) {
      this.#emitChange();
      return;
    }
    this.#step(event.shiftKey ? SEARCH_DIRECTION.PREVIOUS : SEARCH_DIRECTION.NEXT);
  }

  #toggleCaseSensitive() {
    this.isCaseSensitive = !this.isCaseSensitive;
    this.#emitChange();
  }

  #handleScopeChange(event) {
    this.scope = event.target.value;
    this.#emitChange();
  }

  #emitChange() {
    clearTimeout(this.#debounceTimer);
    this.#hasPendingChange = false;
    this.dispatchEvent(new CustomEvent("search-change", {
      detail: { query: this.query, isCaseSensitive: this.isCaseSensitive, scope: this.scope },
      bubbles: true,
      composed: true
    }));
  }

  #step(direction) {
    this.dispatchEvent(new CustomEvent("search-step", { detail: { direction }, bubbles: true, composed: true }));
  }
}

customElements.define("json-search-bar", JsonSearchBar);
