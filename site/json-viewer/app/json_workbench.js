import{LitElement as v,html as n,css as S,nothing as d}from"lit";import{JsonDocumentClient as y}from"./json_document_client.js";import{boxSizingStyles as w,toolbarStyles as $}from"./shared_styles.js";import"./json_source_pane.js";import"./json_tree_view.js";import"./json_search_bar.js";const x=16e6,T=2e5,I=5e6,u=Object.freeze({SMALL:120,MEDIUM:350,LARGE:800}),r=Object.freeze({DEFAULT:42,MIN:20,MAX:80,KEYBOARD_STEP:4}),m="json-viewer-split-percent",N=1800,D="  ",E="",o=Object.freeze({VALID:"valid",INVALID:"invalid",EMPTY:"empty"}),A={store:"Northwind Books",isOpen:!0,rating:4.7,manager:null,address:{street:"12 Harbour Road",city:"Lisbon",postcode:"1100-148",coordinates:[38.7071,-9.1355]},tags:["fiction","travel","children","caf\xE9"],books:[{id:1,title:"The Long Coast",author:"In\xEAs Duarte",price:18.5,inStock:!0,formats:["hardback","ebook"]},{id:2,title:"Maps of Small Islands",author:"Tom Reyes",price:24,inStock:!1,formats:["paperback"]},{id:3,title:"Night Trains",author:"Ada Okafor",price:12.99,inStock:!0,formats:[]}],openingHours:{monday:"09:00-19:00",saturday:"10:00-14:00",sunday:null}},p=new Intl.NumberFormat;export class JsonWorkbench extends v{static properties={documentState:{state:!0},rowCount:{state:!0},layoutRevision:{state:!0},selectedNode:{state:!0},search:{state:!0},searchAvailability:{state:!0},isSourceDetached:{state:!0},isSourceWrapped:{state:!0},splitPercent:{state:!0},notice:{state:!0},isDraggingFile:{state:!0}};static styles=[w,$,S`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
      background: var(--bg);
      font: 0.9rem/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
    }

    .panes {
      position: relative;
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(0, var(--split-percent)) 6px minmax(0, 1fr);
    }

    .pane {
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      background: var(--surface);
    }

    .pane-header {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      min-height: 2.75rem;
      padding: 0.4rem 0.6rem;
      border-bottom: 1px solid var(--line);
      overflow-x: auto;
      scrollbar-width: none;
    }

    .pane-title {
      margin: 0 0.4rem 0 0.2rem;
      font: 600 0.72rem var(--mono);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .pane-header json-search-bar {
      flex: 1;
      margin-left: 0.4rem;
    }

    .pane-body {
      position: relative;
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    json-source-pane, json-tree-view {
      flex: 1;
      min-height: 0;
    }

    .splitter {
      cursor: col-resize;
      background: var(--line);
      touch-action: none;
    }

    .splitter:hover, .splitter:focus-visible {
      background: var(--accent);
      outline: none;
    }

    .stale-banner {
      padding: 0.35rem 0.75rem;
      border-bottom: 1px solid var(--line);
      background: rgb(250 204 21 / 0.12);
      color: var(--text);
      font-size: 0.8rem;
    }

    .status-bar {
      display: flex;
      align-items: center;
      gap: 1rem;
      min-height: 2rem;
      padding: 0.25rem 0.75rem;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font: 0.75rem var(--mono);
      white-space: nowrap;
      overflow: hidden;
    }

    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .status-dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background: var(--muted);
    }

    .status-dot.is-valid { background: var(--success); }
    .status-dot.is-invalid { background: #f87171; }

    .selected-path {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--text);
      text-align: right;
    }

    .status-bar .tool-button {
      height: 1.5rem;
      font-size: 0.72rem;
    }

    .notice {
      color: var(--accent);
    }

    .drop-overlay {
      position: absolute;
      inset: 0;
      z-index: 5;
      display: grid;
      place-items: center;
      border: 2px dashed var(--accent);
      background: rgb(17 14 12 / 0.75);
      color: var(--text);
      font-size: 1.1rem;
      pointer-events: none;
    }

    .file-input {
      display: none;
    }

    @media (max-width: 800px) {
      .panes {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr) 1px minmax(0, 1.4fr);
      }

      .splitter {
        pointer-events: none;
      }

      .is-optional {
        display: none;
      }

      .pane-header {
        flex-wrap: wrap;
        overflow-x: visible;
      }

      .pane-header .tree-search {
        flex-basis: 100%;
        margin-left: 0;
      }

      .status-bar {
        gap: 0.5rem;
      }
    }
  `];#e=new y;#t="";#i="data.json";#r=0;#o=0;#n=0;#c=!1;#u=0;#p=e=>this.#z(e);constructor(){super(),this.documentState={status:o.EMPTY},this.rowCount=0,this.layoutRevision=0,this.selectedNode=null,this.search=f(),this.searchAvailability={isAvailable:!0,reason:""},this.isSourceDetached=!1,this.isSourceWrapped=!0,this.splitPercent=C(),this.notice="",this.isDraggingFile=!1,this.rowProvider=(e,t)=>this.#e.request("rows",{startRow:e,rowCount:t}),this.nodeTextProvider=async(e,t)=>(await this.#e.request("nodeText",{nodeIndex:e,part:t})).text,this.editHandler=e=>this.#J(e)}connectedCallback(){super.connectedCallback(),window.addEventListener("keydown",this.#p),this.#e.request("probeSearch").then(e=>{this.searchAvailability=e})}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("keydown",this.#p)}render(){const e=this.documentState.status===o.VALID;return n`
      <div class="panes" style="--split-percent: ${this.splitPercent}%"
        @dragover=${this.#k} @dragleave=${this.#L} @drop=${this.#R}>
        <section class="pane" aria-label="JSON input">
          <div class="pane-header">
            <h2 class="pane-title">Input</h2>
            <button class="tool-button" @click=${this.#M}>Open file</button>
            <button class="tool-button" ?disabled=${!e} @click=${()=>this.#b(D)}>Format</button>
            <button class="tool-button" ?disabled=${!e} @click=${()=>this.#b(E)}>Minify</button>
            <button class="tool-button" aria-pressed=${String(this.isSourceWrapped)} title="Wrap long lines"
              @click=${()=>{this.isSourceWrapped=!this.isSourceWrapped}}>Wrap</button>
            <button class="tool-button is-optional" ?disabled=${!this.#t} @click=${this.#P}>Copy</button>
            <button class="tool-button is-optional" ?disabled=${!this.#t} @click=${this.#q}>Download</button>
            <button class="tool-button is-optional" @click=${this.#A}>Sample</button>
            <button class="tool-button" ?disabled=${!this.#t} @click=${()=>this.#a("","data.json")}>Clear</button>
            <input class="file-input" type="file" accept=".json,application/json,text/plain" @change=${this.#C}>
          </div>
          <div class="pane-body">
            <json-source-pane .errorInfo=${this.documentState.status===o.INVALID?this.documentState.error:null}
              .isDetached=${this.isSourceDetached} .isWrapped=${this.isSourceWrapped} .detachedSummary=${`${this.#i} \xB7 ${b(this.#t.length)}`}
              @source-input=${this.#D} @attach-request=${this.#E}></json-source-pane>
          </div>
        </section>
        <div class="splitter" role="separator" aria-orientation="vertical" aria-label="Resize panes" tabindex="0"
          aria-valuemin=${r.MIN} aria-valuemax=${r.MAX} aria-valuenow=${Math.round(this.splitPercent)}
          @pointerdown=${this.#B} @keydown=${this.#Y}></div>
        <section class="pane" aria-label="JSON tree">
          <div class="pane-header">
            <h2 class="pane-title">Tree</h2>
            <button class="tool-button" ?disabled=${this.rowCount===0} @click=${()=>this.#v("expandAll")}>Expand all</button>
            <button class="tool-button" ?disabled=${this.rowCount===0} @click=${()=>this.#v("collapseAll")}>Collapse all</button>
            <json-search-bar class="tree-search" .resultLabel=${this.#N()} .hasResults=${this.search.nodeIndices.length>0}
              .isDisabled=${!this.searchAvailability.isAvailable} .disabledReason=${this.searchAvailability.reason||""}
              @search-change=${this.#V} @search-step=${this.#W}></json-search-bar>
          </div>
          <div class="pane-body">
            ${this.documentState.status===o.INVALID&&this.documentState.hasPreviousDocument?n`<div class="stale-banner">The input has an error. Showing the last valid JSON.</div>`:d}
            <json-tree-view .rowCount=${this.rowCount} .layoutRevision=${this.layoutRevision}
              .selectedNodeIndex=${this.selectedNode?this.selectedNode.nodeIndex:-1}
              .highlightQuery=${this.search.query} .isHighlightCaseSensitive=${this.search.isCaseSensitive}
              .isEditable=${e} .placeholderText=${this.#I()}
              .rowProvider=${this.rowProvider} .nodeTextProvider=${this.nodeTextProvider} .editHandler=${this.editHandler}
              @node-toggle=${this.#F} @node-select=${this.#O}
              @node-copy=${this.#U}></json-tree-view>
          </div>
        </section>
        ${this.isDraggingFile?n`<div class="drop-overlay">Drop a JSON file to open it</div>`:d}
      </div>
      ${this.#x()}
    `}#x(){const{status:e}=this.documentState;return n`<footer class="status-bar" aria-live="polite">
      <span class="status-chip"><span class="status-dot is-${e}"></span>${this.#T()}</span>
      ${this.search.milliseconds!==null?n`<span class="is-optional">WebGPU search ${this.search.milliseconds.toFixed(1)} ms</span>`:d}
      ${this.notice?n`<span class="notice">${this.notice}</span>`:d}
      <span class="selected-path" title=${this.selectedNode?.path??""}>${this.selectedNode?.path??""}</span>
      ${this.selectedNode?n`
        <button class="tool-button" @click=${this.#j}>Copy path</button>
        <button class="tool-button is-optional" @click=${this.#_}>Copy value</button>`:d}
    </footer>`}#T(){const e=this.documentState;return e.status===o.EMPTY?"No input":e.status===o.INVALID?`Invalid JSON at line ${e.error.line}`:n`Valid<span class="is-optional"> · ${p.format(e.nodeCount)} nodes · ${b(e.textLength)} · parsed in ${e.parseMilliseconds.toFixed(0)} ms</span>`}#I(){return this.documentState.status===o.INVALID?"Fix the error in the input to see the tree.":"Paste JSON on the left, open a file, or drop one here."}#N(){const{query:e,nodeIndices:t,activeMatch:i,isSearching:h,errorMessage:c,isTruncated:a}=this.search;if(!e)return"";if(h)return"\u2026";if(c)return c;if(t.length===0)return"No matches";const l=`${p.format(t.length)}${a?"+":""}`;return i>=0?`${p.format(i+1)} / ${l}`:`${l} ${t.length===1&&!a?"match":"matches"}`}#D(){clearTimeout(this.#r);const e=this.#s();this.#r=setTimeout(()=>{this.#t=e.readText(),this.#m()},M(this.#t.length))}async#m(){clearTimeout(this.#r);const e=++this.#o,t=await this.#e.request("load",{text:this.#t});e===this.#o&&this.#f(t)}#f(e){const t=this.documentState.nodeCount;this.documentState=e,this.rowCount=e.rowCount,this.layoutRevision=e.layoutRevision,e.status!==o.INVALID&&((e.status===o.EMPTY||e.nodeCount!==t)&&(this.selectedNode=null),this.search.query&&this.#y({shouldJumpToFirst:!1}))}#a(e,t){this.#t=e,this.#i=t,this.isSourceDetached=e.length>x,this.selectedNode=null,this.updateComplete.then(()=>{this.isSourceDetached||this.#s().setText(e)}),this.#m()}async#E(){this.isSourceDetached=!1,await this.updateComplete,await this.#s().updateComplete,this.#s().setText(this.#t)}async#b(e){const{text:t}=await this.#e.request("format",{indentUnit:e});this.#a(t,this.#i)}#A(){this.#a(JSON.stringify(A,null,2),"sample.json")}#M(){this.renderRoot.querySelector(".file-input").click()}async#C(e){const[t]=e.target.files;e.target.value="",t&&await this.#g(t)}async#g(e){this.#d(`Reading ${e.name}\u2026`),this.#a(await e.text(),e.name)}#k(e){e.dataTransfer.types.includes("Files")&&(e.preventDefault(),this.isDraggingFile=!0)}#L(e){e.relatedTarget&&this.renderRoot.contains(e.relatedTarget)||(this.isDraggingFile=!1)}async#R(e){e.preventDefault(),this.isDraggingFile=!1;const[t]=e.dataTransfer.files;t&&await this.#g(t)}async#P(){await this.#h(this.#t,"Copied input")}#q(){const e=document.createElement("a");e.href=URL.createObjectURL(new Blob([this.#t],{type:"application/json"})),e.download=this.#i,e.click(),setTimeout(()=>URL.revokeObjectURL(e.href),0)}async#v(e){this.#l(await this.#e.request(e))}#l({rowCount:e,layoutRevision:t}){this.rowCount=e,this.layoutRevision=t}async#F(e){this.#l(await this.#e.request("toggle",{nodeIndex:e.detail.nodeIndex}))}async#O(e){const t=await this.#e.request("describeNode",{nodeIndex:e.detail.nodeIndex});this.selectedNode=t}async#j(){await this.#h(this.selectedNode.path,"Copied path")}async#_(){await this.#S(this.selectedNode.nodeIndex,"value")}async#U(e){await this.#S(e.detail.nodeIndex,e.detail.part)}async#S(e,t){const{text:i}=await this.#e.request("copyPart",{nodeIndex:e,part:t});await this.#h(i,t==="key"?"Copied key":"Copied value")}async#J(e){try{const t=await this.#e.request("editNode",e);return this.#t=t.text,this.isSourceDetached||this.#s().setText(t.text),this.#o++,this.#f(t),{isSaved:!0}}catch(t){return{isSaved:!1,message:t.message}}}#V(e){this.search={...f(),...e.detail},this.#y({shouldJumpToFirst:!0})}async#y({shouldJumpToFirst:e}){const t=++this.#n;e&&(this.#c=!0);const{query:i,isCaseSensitive:h,scope:c}=this.search;if(!i||this.rowCount===0){this.search={...this.search,nodeIndices:new Int32Array(0),activeMatch:-1,isSearching:!1,milliseconds:null};return}this.search={...this.search,isSearching:!0,errorMessage:""};try{const a=await this.#e.request("search",{query:i,isCaseSensitive:h,scope:c});if(t!==this.#n)return;this.search={...this.search,nodeIndices:a.nodeIndices,isTruncated:a.isTruncated,milliseconds:a.milliseconds,activeMatch:-1,isSearching:!1};const l=this.#c;this.#c=!1,l&&a.nodeIndices.length>0&&await this.#w(0)}catch(a){if(t!==this.#n)return;this.search={...this.search,nodeIndices:new Int32Array(0),activeMatch:-1,isSearching:!1,errorMessage:a.message}}}async#W(e){const t=this.search.nodeIndices.length;if(t===0)return;const i=(this.search.activeMatch+e.detail.direction+t)%t;await this.#w(this.search.activeMatch<0&&e.detail.direction>0?0:i)}async#w(e){const t=this.search.nodeIndices[e];this.search={...this.search,activeMatch:e};const i=await this.#e.request("reveal",{nodeIndex:t});this.#l(i),this.selectedNode=await this.#e.request("describeNode",{nodeIndex:t}),await this.updateComplete,this.#H().scrollToRow(i.rowIndex,"center")}#z(e){!((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="f")||!this.searchAvailability.isAvailable||(e.preventDefault(),this.renderRoot.querySelector("json-search-bar").focusInput())}#B(e){const t=e.currentTarget,i=this.renderRoot.querySelector(".panes");t.setPointerCapture(e.pointerId);const h=a=>{const l=i.getBoundingClientRect();this.#$((a.clientX-l.left)/l.width*100)},c=()=>{t.removeEventListener("pointermove",h),t.removeEventListener("pointerup",c),g(this.splitPercent)};t.addEventListener("pointermove",h),t.addEventListener("pointerup",c)}#Y(e){const t={ArrowLeft:-r.KEYBOARD_STEP,ArrowRight:r.KEYBOARD_STEP};e.key in t&&(e.preventDefault(),this.#$(this.splitPercent+t[e.key]),g(this.splitPercent))}#$(e){this.splitPercent=Math.min(r.MAX,Math.max(r.MIN,e))}async#h(e,t){try{await navigator.clipboard.writeText(e),this.#d(t)}catch{this.#d("Copy was blocked by the browser")}}#d(e){clearTimeout(this.#u),this.notice=e,this.#u=setTimeout(()=>{this.notice=""},N)}#s(){return this.renderRoot.querySelector("json-source-pane")}#H(){return this.renderRoot.querySelector("json-tree-view")}}function f(){return{query:"",isCaseSensitive:!1,scope:"all",nodeIndices:new Int32Array(0),activeMatch:-1,isTruncated:!1,isSearching:!1,errorMessage:"",milliseconds:null}}function M(s){return s<T?u.SMALL:s<I?u.MEDIUM:u.LARGE}function b(s){return s<1024?`${s} B`:s<1024*1024?`${(s/1024).toFixed(1)} KB`:`${(s/(1024*1024)).toFixed(1)} MB`}function C(){try{const s=Number(localStorage.getItem(m));return s>=r.MIN&&s<=r.MAX?s:r.DEFAULT}catch{return r.DEFAULT}}function g(s){try{localStorage.setItem(m,String(Math.round(s)))}catch{return}}customElements.define("json-workbench",JsonWorkbench);
