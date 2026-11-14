import{LitElement as f,html as s,css as v,svg as g,nothing as b}from"lit";import{baseStyles as x,checkerboardStyles as S}from"./editor_styles.js";import{parseDeclaration as y,formatDeclaration as E}from"./css_value_syntax.js";import{COLOR_FORMATS as l,COLOR_FORMAT_LABELS as w}from"./color_model.js";import{colorDefinition as k}from"./color_editor.js";import{gradientDefinition as $}from"./gradient_editor.js";import{boxShadowDefinition as C,textShadowDefinition as I}from"./shadow_editor.js";import{filterDefinition as D}from"./filter_editor.js";import{clipPathDefinition as O}from"./clip_path_editor.js";import{borderRadiusDefinition as T}from"./border_radius_editor.js";import{transformDefinition as R}from"./transform_editor.js";import{easingDefinition as F}from"./easing_editor.js";import"./editor_controls.js";import"./color_picker.js";const c=[k,$,C,I,D,O,T,R,F],z=["Color","Effects","Shape","Motion"],A=Object.freeze({color:"background: #ff8a3d; border-radius: 50%",gradient:"background: linear-gradient(135deg, #ff8a3d, #ff3d77, #7c3aed)","box-shadow":"background: #fff; box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.25), 2px 2px 0 #ff8a3d",filter:"background: linear-gradient(135deg, #ff8a3d, #3d8bff); filter: blur(1.5px)","clip-path":"background: #ff8a3d; clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)","border-radius":"background: #ff8a3d; border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%",transform:"background: #ff8a3d; transform: perspective(40px) rotateY(-35deg) rotate(-8deg)"}),u="css-editor-color-format",_=1600,L="Edit or paste any value or declaration here, e.g. box-shadow: 0 4px 12px #0003";export class CssWorkbench extends f{static properties={activeEditorId:{state:!0},editorStates:{state:!0},colorFormat:{state:!0},sourceError:{state:!0},notice:{state:!0}};static styles=[x,S,v`
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
  `];constructor(){super(),this.editorStates=Object.fromEntries(c.map(t=>[t.id,p(t)])),this.activeEditorId=c[0].id,this.colorFormat=H(),this.sourceError=null,this.notice=null,this.restoreFromHash()}get activeDefinition(){return c.find(t=>t.id===this.activeEditorId)}get activeState(){return this.editorStates[this.activeEditorId]}render(){const t=this.activeDefinition,{model:e,property:i}=this.activeState;return s`
      <nav class="editor-nav" aria-label="CSS property">
        ${z.map(r=>s`
          <h2 class="nav-group-heading">${r}</h2>
          ${c.filter(a=>a.group===r).map(a=>s`
            <button class="nav-button" type="button" aria-current=${a.id===this.activeEditorId?"page":"false"}
              @click=${()=>this.selectEditor(a.id)}>
              ${N(a.id)}${a.label}
            </button>
          `)}
        `)}
      </nav>
      <div class="workspace">
        <div class="editor-slot">
          ${t.render({model:e,colorFormat:this.colorFormat,onChange:r=>this.handleModelChange(r.detail)})}
        </div>
        <section class="output" aria-label="Generated CSS">
          <div class="output-header">
            <h2 class="output-title">CSS</h2>
            ${t.properties.length>1?s`
              <label class="output-option"><span class="option-label">Property</span>
                <select aria-label="Property" @change=${r=>this.changeProperty(r.target.value)}>
                  ${t.properties.map(r=>s`<option value=${r} ?selected=${r===i}>${r}</option>`)}
                </select>
              </label>
            `:b}
            <label class="output-option"><span class="option-label">Colors</span>
              <select aria-label="Color format" @change=${r=>this.changeColorFormat(r.target.value)}>
                ${Object.values(l).map(r=>s`<option value=${r} ?selected=${r===this.colorFormat}>${w[r]}</option>`)}
              </select>
            </label>
            <button class="button" type="button" @click=${this.resetActiveEditor}>Reset</button>
            <button class="button" type="button" @click=${()=>this.copyText(this.serializeActiveValue(),"Value copied")}>Copy value</button>
            <button class="button button--primary" type="button" @click=${()=>this.copyText(this.canonicalSource(),"CSS copied")}>Copy CSS</button>
          </div>
          <textarea class="source" spellcheck="false" autocapitalize="off" aria-label="CSS declaration, editable"
            aria-invalid=${String(!!this.sourceError)} aria-describedby="source-status"
            @input=${this.handleSourceInput} @blur=${this.handleSourceBlur}></textarea>
          <p class="source-status" id="source-status" role="status" ?data-error=${!!this.sourceError}>
            ${this.sourceError??this.notice??L}
          </p>
        </section>
      </div>
    `}updated(t){const e=this.renderRoot.querySelector(".source");this.renderRoot.activeElement!==e&&(e.value=this.canonicalSource()),t.has("activeEditorId")&&this.renderRoot.querySelector('.nav-button[aria-current="page"]').scrollIntoView({block:"nearest",inline:"nearest"})}serializeActiveValue(){return this.activeDefinition.serialize(this.activeState.model,this.colorFormat)}canonicalSource(){return E(this.activeState.property,this.serializeActiveValue())}selectEditor(t){this.activeEditorId=t,this.sourceError=null,this.writeHash()}handleModelChange(t){t&&(this.setEditorState(this.activeEditorId,{...this.activeState,model:t}),this.sourceError=null,this.writeHash())}changeProperty(t){this.setEditorState(this.activeEditorId,{...this.activeState,property:t})}changeColorFormat(t){this.colorFormat=t;try{localStorage.setItem(u,t)}catch{return}}resetActiveEditor(){this.setEditorState(this.activeEditorId,p(this.activeDefinition)),this.sourceError=null,this.writeHash()}handleSourceInput(t){const e=t.target.value;if(!e.trim()){this.sourceError=null;return}const i=this.importSource(e);this.sourceError=i.error??null,i.error||this.writeHash()}handleSourceBlur(t){this.sourceError||(t.target.value=this.canonicalSource())}importSource(t){const{property:e,value:i}=y(t),r=c.filter(n=>n!==this.activeDefinition),a=e?c.filter(n=>n.properties.includes(e)):[this.activeDefinition,...r];if(e&&a.length===0)return{error:`\u201C${e}\u201D isn't one of the properties this tool edits.`};for(const n of a){const d=n.parse(i);if(!d)continue;const h=this.editorStates[n.id].property,m=e??h;return this.setEditorState(n.id,{model:d,property:m}),this.activeEditorId=n.id,{}}return{error:`Can't read this as ${e??"a supported value"}. Check the syntax; lengths need px or % units.`}}setEditorState(t,e){this.editorStates={...this.editorStates,[t]:e}}async copyText(t,e){try{await navigator.clipboard.writeText(t),this.showNotice(e)}catch{this.showNotice("Copy failed. Select the text and copy it manually.")}}showNotice(t){this.notice=t,clearTimeout(this.noticeTimer),this.noticeTimer=setTimeout(()=>{this.notice=null},_)}writeHash(){const t=new URLSearchParams({editor:this.activeEditorId,value:this.serializeActiveValue()});history.replaceState(null,"",`#${t}`)}restoreFromHash(){const t=new URLSearchParams(location.hash.slice(1)),e=c.find(r=>r.id===t.get("editor"));if(!e)return;this.activeEditorId=e.id;const i=t.has("value")?e.parse(t.get("value")):null;i&&this.setEditorState(e.id,{...this.editorStates[e.id],model:i})}}function p(o){return{model:o.parse(o.presets[0].css),property:o.properties[0]}}function N(o){return o==="text-shadow"?s`<span class="nav-icon" style="text-shadow: 2px 2px 0 #3d8bff">T</span>`:o==="easing"?s`<span class="nav-icon">${g`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 15 C 8 15, 7 1, 15 1" fill="none" stroke="#ff8a3d" stroke-width="2.2" stroke-linecap="round"></path></svg>`}</span>`:s`<span class="nav-icon" style=${A[o]}></span>`}function H(){try{const o=localStorage.getItem(u);return Object.values(l).includes(o)?o:l.HEX}catch{return l.HEX}}customElements.define("css-workbench",CssWorkbench);
