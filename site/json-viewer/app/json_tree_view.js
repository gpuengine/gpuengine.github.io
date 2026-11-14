import{LitElement as b,html as n,css as E,nothing as h}from"lit";import{NODE_TYPE as d}from"./json_index.js";import{boxSizingStyles as T,jsonTokenStyles as S}from"./shared_styles.js";const a=22,$=16,R=6,y=12,m=150,w=4e3,v=4e6,x=Object.freeze({PIXEL:0,LINE:1,PAGE:2}),C=Object.freeze({CENTER:"center",NEAREST:"nearest"}),p=Object.freeze({DECODED_STRING:"decoded-string",RAW_STRING_CONTENT:"raw-string-content",RAW_LITERAL:"raw-literal"}),I=/[\n\r]/,N={[d.NULL]:"is-null",[d.BOOLEAN]:"is-boolean",[d.NUMBER]:"is-number",[d.STRING]:"is-string"};export class JsonTreeView extends b{static properties={rowCount:{type:Number},layoutRevision:{type:Number},selectedNodeIndex:{type:Number},highlightQuery:{type:String},isHighlightCaseSensitive:{type:Boolean},isEditable:{type:Boolean},placeholderText:{type:String},rowProvider:{attribute:!1},nodeTextProvider:{attribute:!1},editHandler:{attribute:!1},editState:{state:!0}};static styles=[T,S,E`
    :host {
      display: block;
      position: relative;
      min-height: 0;
      font: 13px/${a}px var(--mono);
    }

    .scroller {
      position: absolute;
      inset: 0;
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      outline: none;
    }

    .scroller:focus-visible {
      box-shadow: inset 0 0 0 2px var(--accent);
    }

    .rows {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
    }

    .row {
      position: relative;
      height: ${a}px;
      padding-right: 0.75rem;
      white-space: pre;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: default;
    }

    .row:hover {
      background: var(--json-hover);
    }

    .row.is-selected {
      background: var(--json-selected);
      box-shadow: inset 2px 0 0 var(--accent);
    }

    .row-actions {
      position: absolute;
      top: 1px;
      right: 0.4rem;
      display: none;
      gap: 0.25rem;
    }

    .row:hover .row-actions, .row.is-selected .row-actions {
      display: flex;
    }

    .copy-button {
      height: ${a-2}px;
      padding: 0 0.45rem;
      border: 1px solid var(--line);
      border-radius: 4px;
      background: var(--surface-raised);
      color: var(--muted);
      font: 500 11px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
      cursor: pointer;
    }

    .copy-button:hover {
      border-color: var(--accent);
      color: var(--text);
    }

    @media (hover: none) {
      .row:hover:not(.is-selected) .row-actions {
        display: none;
      }
    }

    .toggle, .toggle-spacer {
      display: inline-block;
      width: 1rem;
      text-align: center;
      color: var(--muted);
    }

    .toggle {
      cursor: pointer;
    }

    .toggle:hover {
      color: var(--text);
    }

    .key { color: var(--json-key); }
    .array-position { color: var(--json-punctuation); font-size: 11px; }
    .punctuation { color: var(--json-punctuation); }
    .is-string { color: var(--json-string); }
    .is-number { color: var(--json-number); }
    .is-boolean { color: var(--json-boolean); }
    .is-null { color: var(--json-null); font-style: italic; }

    .collapsed-summary {
      padding: 0 0.3rem;
      margin: 0 0.15rem;
      border-radius: 4px;
      background: var(--surface-raised);
      color: var(--muted);
      cursor: pointer;
    }

    .child-count {
      margin-left: 0.6rem;
      color: var(--muted);
      font-size: 11px;
    }

    mark {
      background: var(--json-match);
      color: inherit;
      border-radius: 2px;
    }

    .inline-editor {
      font: inherit;
      height: ${a-2}px;
      min-width: 12rem;
      width: 50%;
      padding: 0 0.3rem;
      border: 1px solid var(--accent);
      border-radius: 4px;
      background: var(--bg);
      color: var(--text);
      outline: none;
    }

    .inline-editor.has-error {
      border-color: #f87171;
    }

    .edit-error {
      margin-left: 0.5rem;
      color: #f87171;
      font: 12px system-ui, sans-serif;
    }

    .placeholder {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 2rem;
      text-align: center;
      color: var(--muted);
      font: 0.95rem/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
      pointer-events: none;
    }
  `];#t=null;#e=new Map;#s=0;#i=0;#l=-1;#o={start:0,end:0};#c=!1;#h=-1;#u=new ResizeObserver(([t])=>{this.#i=t.contentRect.height,this.requestUpdate()});constructor(){super(),this.rowCount=0,this.layoutRevision=0,this.selectedNodeIndex=-1,this.highlightQuery="",this.isHighlightCaseSensitive=!1,this.isEditable=!1,this.placeholderText="",this.rowProvider=null,this.nodeTextProvider=null,this.editHandler=null,this.editState=null}firstUpdated(){this.#t=this.renderRoot.querySelector(".scroller"),this.#u.observe(this.#t),this.#t.addEventListener("wheel",t=>this.#O(t),{passive:!1})}disconnectedCallback(){super.disconnectedCallback(),this.#u.disconnect()}willUpdate(t){t.has("layoutRevision")&&(this.#e.clear(),this.editState=null,this.#s=Math.min(this.#s,this.#d()))}updated(){this.editState?.needsFocus&&this.#M(),this.#k()}focusTree(){this.#t?.focus({preventScroll:!0})}scrollToRow(t,e=C.NEAREST){if(t<0)return;const s=t*a,i=this.#i;if(e===C.CENTER){this.#r(s-(i-a)/2);return}const o=this.#y();s<o?this.#r(s):s+a>o+i&&this.#r(s+a-i)}render(){const t=this.#y(),e=Math.floor(t/a),s=Math.ceil(this.#i/a)+1,i=Math.max(0,e-y),o=Math.min(this.rowCount,e+s+y);this.#o={start:i,end:o};const c=(this.#t?this.#t.scrollTop:0)-(t-i*a),g=[];for(let u=i;u<o;u++)g.push(u);return n`
      <div class="scroller" tabindex="0" role="tree" aria-label="JSON tree"
        @scroll=${this.#N} @keydown=${this.#D} @click=${this.#_} @dblclick=${this.#A}>
        <div style="height: ${this.#m()}px"></div>
        <div class="rows" style="transform: translateY(${c}px)">${g.map(u=>this.#S(u))}</div>
      </div>
      ${this.rowCount===0&&this.placeholderText?n`<div class="placeholder">${this.placeholderText}</div>`:h}
    `}#S(t){const e=this.#e.get(t);if(!e)return n`<div class="row"></div>`;const s=!e.isClosing&&e.nodeIndex===this.selectedNodeIndex,i=e.type===d.ARRAY||e.type===d.OBJECT;return n`<div class="row ${s?"is-selected":""}" data-row-index=${t}
      role="treeitem" aria-level=${e.depth+1} aria-selected=${s?"true":"false"}
      aria-expanded=${i&&!e.isClosing&&e.childCount>0?String(!e.isCollapsed):h}
      style="padding-left: ${R+e.depth*$}px">${this.#R(e,i)}${this.#$(e)}</div>`}#$(t){return t.isClosing||this.editState?.nodeIndex===t.nodeIndex?h:n`<span class="row-actions">
      ${t.keyText!==null?n`<button class="copy-button" type="button" data-copy="key" title="Copy key">Copy key</button>`:h}
      <button class="copy-button" type="button" data-copy="value" title="Copy value">Copy value</button>
    </span>`}#R(t,e){const s=t.hasTrailingComma?n`<span class="punctuation">,</span>`:h;if(t.isClosing)return n`<span class="toggle-spacer"></span><span class="punctuation">${f(t.type)}</span>${s}`;const i=this.#w(t);if(!e)return n`<span class="toggle-spacer"></span>${i}${this.#I(t)}${s}`;const o=n`<span class="punctuation">${P(t.type)}</span>`;if(t.childCount===0)return n`<span class="toggle-spacer"></span>${i}${o}<span class="punctuation">${f(t.type)}</span>${s}`;const l=n`<span class="toggle" data-action="toggle">${t.isCollapsed?"\u25B8":"\u25BE"}</span>`;return t.isCollapsed?n`${l}${i}${o}<span class="collapsed-summary" data-action="toggle">…</span><span class="punctuation">${f(t.type)}</span>${s}<span class="child-count">${_(t)}</span>`:n`${l}${i}${o}`}#w(t){return this.#g(t,"key")?n`${this.#p()}<span class="punctuation">: </span>`:t.keyText!==null?n`<span class="key" data-part="key">"${this.#f(t.keyText)}${t.isKeyTruncated?"\u2026":""}"</span><span class="punctuation">: </span>`:t.arrayPosition!==null?n`<span class="array-position">${t.arrayPosition}</span><span class="punctuation">: </span>`:h}#I(t){return this.#g(t,"value")?this.#p():n`<span class="${N[t.type]}" data-part="value">${this.#f(t.valueText)}${t.isValueTruncated?"\u2026":""}</span>`}#p(){const{draft:t,errorMessage:e}=this.editState;return n`<input class="inline-editor ${e?"has-error":""}" .value=${t} spellcheck="false" aria-label="Edit JSON value"
      @input=${s=>{this.editState={...this.editState,draft:s.target.value,errorMessage:null}}}
      @keydown=${this.#H} @blur=${()=>this.#E()}
      @click=${s=>s.stopPropagation()} @dblclick=${s=>s.stopPropagation()}
    >${e?n`<span class="edit-error">${e}</span>`:h}`}#f(t){const e=this.highlightQuery;if(!e)return t;const s=this.isHighlightCaseSensitive?t:t.toLowerCase(),i=this.isHighlightCaseSensitive?e:e.toLowerCase();if(s.length!==t.length)return t;const o=[];let l=0;for(let c=s.indexOf(i);c!==-1;c=s.indexOf(i,l))o.push(t.slice(l,c),n`<mark>${t.slice(c,c+i.length)}</mark>`),l=c+i.length;return o.length===0?t:(o.push(t.slice(l)),o)}#g(t,e){return this.editState!==null&&this.editState.nodeIndex===t.nodeIndex&&this.editState.part===e}#N(){const t=this.#t.scrollTop;if(t===this.#l){this.#l=-1;return}this.#s=t*this.#a(),this.requestUpdate()}#O(t){if(this.#a()===1)return;t.preventDefault();const e=t.deltaMode===x.LINE?t.deltaY*a:t.deltaMode===x.PAGE?t.deltaY*this.#i:t.deltaY;this.#r(this.#s+e)}#r(t){if(!this.#t)return;const e=Math.max(0,Math.min(t,this.#d()));this.#s=e,this.#t.scrollTop=e/this.#a(),this.#l=this.#t.scrollTop,this.requestUpdate()}#y(){return this.#t&&this.#a()===1&&(this.#s=this.#t.scrollTop),this.#s}#m(){return Math.min(this.rowCount*a,v)}#d(){return Math.max(0,this.rowCount*a-this.#i)}#a(){const t=this.#m()-this.#i,e=this.#d();return this.rowCount*a<=v||t<=0?1:e/t}async#k(){const{start:t,end:e}=this.#o;if(this.#c||!this.rowProvider||this.rowCount===0||this.#h===this.layoutRevision||this.#P(t,e))return;const s=Math.max(0,t-m),i=Math.min(this.rowCount,e+m);this.#c=!0;try{const{layoutRevision:o,rows:l}=await this.rowProvider(s,i-s);if(o!==this.layoutRevision)return;this.#e.size+l.length>w&&this.#e.clear();for(const c of l)this.#e.set(c.rowIndex,c)}catch{this.#h=this.layoutRevision}finally{this.#c=!1,this.requestUpdate()}}#P(t,e){for(let s=t;s<e;s++)if(!this.#e.has(s))return!1;return!0}#v(t){const e=t.target.closest(".row[data-row-index]");return e?this.#e.get(Number(e.dataset.rowIndex)):void 0}#_(t){const e=this.#v(t);if(!e)return;const s=t.target.closest("[data-copy]");if(s){this.#n("node-copy",{nodeIndex:e.nodeIndex,part:s.dataset.copy});return}t.target.closest("[data-action=toggle]")&&this.#n("node-toggle",{nodeIndex:e.nodeIndex}),this.#n("node-select",{nodeIndex:e.nodeIndex})}#A(t){const e=this.#v(t),s=t.target.closest("[data-part]");!e||e.isClosing||!s||t.target.closest("[data-copy]")||this.#b(e,s.dataset.part)}#D(t){if(t.target!==this.#t)return;const e=this.#L(),i={ArrowDown:()=>this.#x(e?e.rowIndex+1:this.#o.start),ArrowUp:()=>this.#x(e?e.rowIndex-1:this.#o.start),ArrowRight:()=>this.#C(e,!0),ArrowLeft:()=>this.#C(e,!1),Enter:()=>e&&this.#b(e,"value")}[t.key];i&&(t.preventDefault(),i())}#x(t){if(t<0||t>=this.rowCount)return;const e=this.#e.get(t);e&&(this.#n("node-select",{nodeIndex:e.nodeIndex}),this.scrollToRow(t))}#C(t,e){!t||t.isClosing||t.childCount===void 0||t.childCount===0||t.isCollapsed===e&&this.#n("node-toggle",{nodeIndex:t.nodeIndex})}#L(){for(const t of this.#e.values())if(!t.isClosing&&t.nodeIndex===this.selectedNodeIndex)return t}async#b(t,e){const s=t.type===d.ARRAY||t.type===d.OBJECT;if(!this.isEditable||!this.nodeTextProvider||e==="key"&&t.keyText===null||e==="value"&&s)return;const i=await this.nodeTextProvider(t.nodeIndex,e),o=e==="key"||t.type===d.STRING,{draft:l,encoding:c}=O(i,o);this.editState={nodeIndex:t.nodeIndex,part:e,draft:l,initialDraft:l,encoding:c,errorMessage:null,needsFocus:!0,isCommitting:!1}}#M(){const t=this.renderRoot.querySelector(".inline-editor");t&&(this.editState.needsFocus=!1,t.focus(),t.select())}#H(t){t.stopPropagation(),t.key==="Escape"?(t.preventDefault(),this.#T()):t.key==="Enter"&&(t.preventDefault(),this.#E())}async#E(){const t=this.editState;if(!t||t.isCommitting)return;if(t.draft===t.initialDraft){this.#T();return}this.editState={...t,isCommitting:!0};const e=await this.editHandler({nodeIndex:t.nodeIndex,part:t.part,replacementText:k(t.draft,t.encoding)});this.editState!==null&&(e.isSaved?this.editState=null:this.editState={...this.editState,isCommitting:!1,errorMessage:e.message})}#T(){this.editState=null,this.focusTree()}#n(t,e){this.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}}function O(r,t){if(!t)return{draft:r,encoding:p.RAW_LITERAL};const e=JSON.parse(r);return I.test(e)?{draft:r.slice(1,-1),encoding:p.RAW_STRING_CONTENT}:{draft:e,encoding:p.DECODED_STRING}}function k(r,t){return t===p.DECODED_STRING?JSON.stringify(r):t===p.RAW_STRING_CONTENT?`"${r}"`:r.trim()}function P(r){return r===d.OBJECT?"{":"["}function f(r){return r===d.OBJECT?"}":"]"}function _(r){const t=r.type===d.OBJECT?"key":"item";return`${r.childCount.toLocaleString()} ${t}${r.childCount===1?"":"s"}`}customElements.define("json-tree-view",JsonTreeView);
