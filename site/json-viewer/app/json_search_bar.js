import{LitElement as i,html as a,css as r}from"lit";import{boxSizingStyles as o,toolbarStyles as l}from"./shared_styles.js";import{SEARCH_SCOPE as t}from"./text_search.js";const n=220,s=Object.freeze({NEXT:1,PREVIOUS:-1});export class JsonSearchBar extends i{static properties={resultLabel:{type:String},hasResults:{type:Boolean},isDisabled:{type:Boolean},disabledReason:{type:String},query:{state:!0},isCaseSensitive:{state:!0},scope:{state:!0}};static styles=[o,l,r`
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
  `];#t=0;#s=!1;constructor(){super(),this.resultLabel="",this.hasResults=!1,this.isDisabled=!1,this.disabledReason="",this.query="",this.isCaseSensitive=!1,this.scope=t.KEYS_AND_VALUES}focusInput(){const e=this.renderRoot.querySelector(".search-input");e?.focus(),e?.select()}render(){const e=this.isDisabled?this.disabledReason:"Search keys and values";return a`
      <input class="search-input" type="search" .value=${this.query} placeholder=${e} aria-label="Search JSON"
        title=${this.isDisabled?this.disabledReason:"Search (Ctrl+F). Enter: next, Shift+Enter: previous"}
        ?disabled=${this.isDisabled} spellcheck="false" @input=${this.#a} @keydown=${this.#r}>
      <button class="tool-button tool-button--icon" title="Match case" aria-label="Match case"
        aria-pressed=${String(this.isCaseSensitive)} ?disabled=${this.isDisabled} @click=${this.#o}>Aa</button>
      <select class="scope-select" aria-label="Search in" ?disabled=${this.isDisabled} @change=${this.#l}>
        <option value=${t.KEYS_AND_VALUES} ?selected=${this.scope===t.KEYS_AND_VALUES}>Keys &amp; values</option>
        <option value=${t.KEYS} ?selected=${this.scope===t.KEYS}>Keys</option>
        <option value=${t.VALUES} ?selected=${this.scope===t.VALUES}>Values</option>
      </select>
      <span class="result-label" aria-live="polite">${this.resultLabel}</span>
      <button class="tool-button tool-button--icon" title="Previous match (Shift+Enter)" aria-label="Previous match"
        ?disabled=${!this.hasResults} @click=${()=>this.#i(s.PREVIOUS)}>↑</button>
      <button class="tool-button tool-button--icon" title="Next match (Enter)" aria-label="Next match"
        ?disabled=${!this.hasResults} @click=${()=>this.#i(s.NEXT)}>↓</button>
    `}#a(e){this.query=e.target.value,clearTimeout(this.#t),this.#s=!0,this.#t=setTimeout(()=>this.#e(),n)}#r(e){if(e.key==="Escape"&&this.query){e.preventDefault(),this.query="",this.#e();return}if(e.key==="Enter"){if(e.preventDefault(),this.#s){this.#e();return}this.#i(e.shiftKey?s.PREVIOUS:s.NEXT)}}#o(){this.isCaseSensitive=!this.isCaseSensitive,this.#e()}#l(e){this.scope=e.target.value,this.#e()}#e(){clearTimeout(this.#t),this.#s=!1,this.dispatchEvent(new CustomEvent("search-change",{detail:{query:this.query,isCaseSensitive:this.isCaseSensitive,scope:this.scope},bubbles:!0,composed:!0}))}#i(e){this.dispatchEvent(new CustomEvent("search-step",{detail:{direction:e},bubbles:!0,composed:!0}))}}customElements.define("json-search-bar",JsonSearchBar);
