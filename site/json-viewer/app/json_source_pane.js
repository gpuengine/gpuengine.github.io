import{LitElement as i,html as o,css as a,nothing as n}from"lit";import{boxSizingStyles as l,toolbarStyles as c}from"./shared_styles.js";const s=20;export class JsonSourcePane extends i{static properties={errorInfo:{attribute:!1},detachedSummary:{type:String},isDetached:{type:Boolean},isWrapped:{type:Boolean}};static styles=[l,c,a`
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
      font: 13px/${s}px var(--mono);
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
  `];constructor(){super(),this.errorInfo=null,this.detachedSummary="",this.isDetached=!1,this.isWrapped=!0}readText(){return this.#e()?.value??""}setText(e){const t=this.#e();t&&(t.value=e,t.scrollTop=0)}revealError(){const e=this.#e();if(!e||!this.errorInfo)return;const{offset:t,line:r}=this.errorInfo;e.focus({preventScroll:!0}),e.setSelectionRange(t,Math.min(t+1,e.value.length)),e.scrollTop=Math.max(0,(r-1)*s-e.clientHeight/2)}render(){return this.isDetached?o`<div class="detached">
        <p><strong>${this.detachedSummary}</strong></p>
        <p>The raw text is too large to edit comfortably in the browser, so it is kept out of the text box. The tree on the right is fully usable.</p>
        <button class="tool-button" @click=${()=>this.#t("attach-request")}>Edit as text anyway</button>
      </div>`:o`
      <textarea class="editor ${this.isWrapped?"is-wrapped":""}" wrap=${this.isWrapped?"soft":"off"} spellcheck="false" autocomplete="off" autocapitalize="off"
        aria-label="JSON input" placeholder="Paste JSON here, open a file, or drop one anywhere on the tool."
        @input=${()=>this.#t("source-input")}></textarea>
      ${this.errorInfo?this.#r():n}
    `}#r(){const{message:e,line:t,column:r}=this.errorInfo;return o`<div class="error-bar" role="alert">
      <span class="error-text">Line ${t}, column ${r}: ${e}</span>
      <button class="tool-button" @click=${()=>this.revealError()}>Go to error</button>
    </div>`}#e(){return this.renderRoot.querySelector(".editor")}#t(e){this.dispatchEvent(new CustomEvent(e,{bubbles:!0,composed:!0}))}}customElements.define("json-source-pane",JsonSourcePane);
