import{LitElement as S,html as l,css as I,nothing as n}from"lit";import{editorStyles as E}from"./editor_styles.js";import{renderPresetSection as O,replaceAt as X,removeAt as B}from"./editor_controls.js";import{splitTopLevel as T,splitWhitespace as A,parsePixels as C,formatLength as d}from"./css_value_syntax.js";import{parseColor as _,formatColor as h,createColor as p,COLOR_FORMATS as x}from"./color_model.js";import{emitEvent as F}from"./pointer_tracking.js";const c=Object.freeze({BOX:"box",TEXT:"text"}),M=2,R=50,j=p(0,0,0,1),g=Object.freeze({isInset:!1,offsetX:0,offsetY:8,blur:16,spread:0,color:p(0,0,0,.2)}),D=[{label:"Layered",css:"0 1px 2px rgb(0 0 0 / 0.07), 0 2px 4px rgb(0 0 0 / 0.07), 0 4px 8px rgb(0 0 0 / 0.07), 0 8px 16px rgb(0 0 0 / 0.07), 0 16px 32px rgb(0 0 0 / 0.07)"},{label:"Soft",css:"0 10px 30px rgb(0 0 0 / 0.15)"},{label:"Lifted",css:"0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)"},{label:"Hard offset",css:"8px 8px 0 #1c1612"},{label:"Inset",css:"inset 0 2px 6px rgb(0 0 0 / 0.35)"},{label:"Glow",css:"0 0 12px rgb(255 138 61 / 0.9), 0 0 40px rgb(255 138 61 / 0.5)"},{label:"Neumorphic",css:"12px 12px 24px #c9c4bf, -12px -12px 24px #ffffff"},{label:"Focus ring",css:"0 0 0 2px #ffffff, 0 0 0 5px #ff8a3d"}],N=[{label:"Retro",css:"3px 3px 0 #ff8a3d, 6px 6px 0 #3d8bff"},{label:"Soft",css:"0 2px 6px rgb(0 0 0 / 0.35)"},{label:"Neon",css:"0 0 4px #fff, 0 0 12px #ff3df2, 0 0 28px #ff3df2"},{label:"Outline",css:"1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000"},{label:"Emboss",css:"-1px -1px 0 rgb(255 255 255 / 0.6), 1px 1px 0 rgb(0 0 0 / 0.4)"},{label:"Long",css:"1px 1px 0 #c2410c, 2px 2px 0 #c2410c, 3px 3px 0 #c2410c, 4px 4px 0 #c2410c, 5px 5px 0 #c2410c, 6px 6px 0 #c2410c"}];export const boxShadowDefinition=y({id:"box-shadow",label:"Box shadow",variant:c.BOX,presets:D}),textShadowDefinition=y({id:"text-shadow",label:"Text shadow",variant:c.TEXT,presets:N});function y({id:o,label:e,variant:t,presets:s}){const r={id:o,label:e,group:"Effects",properties:[o],presets:s,parse:a=>P(a,t),serialize:(a,i)=>$(a,t,i),render:({model:a,colorFormat:i,onChange:f})=>l`<shadow-editor .variant=${t} .definition=${r}
      .model=${a} .colorFormat=${i} @model-change=${f}></shadow-editor>`};return r}function P(o,e){if(o.trim().toLowerCase()==="none")return{layers:[]};const t=T(o,",").map(s=>Y(s,e));return t.includes(null)?null:{layers:t}}function Y(o,e){const t=e===c.BOX,s=t?4:3,r=[];let a=!1,i=null;for(const u of A(o)){if(t&&!a&&u.toLowerCase()==="inset"){a=!0;continue}const b=C(u);if(b!==null){r.push(b);continue}if(i||(i=_(u),!i))return null}if(r.length<M||r.length>s)return null;const[f,w,m=0,L=0]=r;return m<0?null:{isInset:a,offsetX:f,offsetY:w,blur:m,spread:L,color:i??{...j}}}function $(o,e,t){return o.layers.length===0?"none":o.layers.map(s=>v(s,e,t)).join(", ")}function v(o,e,t){const s=[d(o.offsetX,"px"),d(o.offsetY,"px"),d(o.blur,"px")];return e===c.BOX&&(o.spread!==0&&s.push(d(o.spread,"px")),o.isInset&&s.unshift("inset")),s.push(h(o.color,t)),s.join(" ")}class V extends S{static properties={variant:{},definition:{attribute:!1},model:{attribute:!1},colorFormat:{},selectedIndex:{state:!0},subjectColor:{state:!0}};static styles=[E,I`
    .box {
      width: min(12rem, 60%);
      aspect-ratio: 1;
      border-radius: 18px;
    }

    .text {
      max-width: 100%;
      padding: 0.5rem;
      font: 800 clamp(2.6rem, 8vw, 5.5rem)/1.1 system-ui, -apple-system, "Segoe UI", sans-serif;
      letter-spacing: -0.02em;
      text-align: center;
      outline: none;
      overflow-wrap: anywhere;
    }

    .layer-editor {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      padding: 0.75rem;
      border: 1px solid var(--line);
      border-radius: 8px;
    }

    .offset-row {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    .offset-numbers {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
    }

    .offset-numbers scrub-number {
      grid-template-columns: 1.2rem minmax(0, 1fr) 4.2rem;
    }
  `];constructor(){super(),this.selectedIndex=0,this.subjectColor=null,this.colorFormat=x.HEX}willUpdate(){const e=Math.max(0,(this.model?.layers.length??0)-1);this.selectedIndex>e&&(this.selectedIndex=e)}get isBoxVariant(){return this.variant===c.BOX}render(){if(!this.model)return n;const e=$(this.model,this.variant,x.RGB),t=this.subjectColor??(this.isBoxVariant?p(255,255,255):p(28,22,18)),s=h(t,x.RGB);return l`
      <div class="preview">
        <preview-stage>
          ${this.isBoxVariant?l`<div class="box" style="box-shadow: ${e}; background: ${s}"></div>`:l`<div class="text" contenteditable="plaintext-only" spellcheck="false" aria-label="Sample text, editable"
                style="text-shadow: ${e}; color: ${s}">Shadow</div>`}
        </preview-stage>
      </div>
      <div class="controls">
        ${O(this.definition.presets,r=>this.applyPreset(r))}
        ${this.renderLayerList()}
        ${this.renderLayerEditor()}
        <section class="section">
          <h3 class="section-heading">Preview</h3>
          <color-field label=${this.isBoxVariant?"Box color":"Text color"} .color=${t} .colorFormat=${this.colorFormat}
            @color-change=${r=>{this.subjectColor=r.detail}}></color-field>
        </section>
      </div>
    `}renderLayerList(){return l`
      <section class="section">
        <h3 class="section-heading">
          Layers
          <button class="button button--small" type="button" @click=${this.addLayer}>+ Add layer</button>
        </h3>
        ${this.model.layers.length===0?l`<p class="hint">No shadow. Add a layer to start.</p>`:n}
        <ul class="item-list">
          ${this.model.layers.map((e,t)=>l`
            <li class="item" aria-current=${String(t===this.selectedIndex)}>
              <button class="item-select" type="button" @click=${()=>{this.selectedIndex=t}}>
                <span class="item-swatch" style="--swatch: ${h(e.color,x.RGB)}"></span>
                <span class="item-summary">${v(e,this.variant,this.colorFormat)}</span>
              </button>
              <button class="button button--icon button--small" type="button" aria-label="Remove layer ${t+1}"
                @click=${()=>this.removeLayer(t)}>×</button>
            </li>
          `)}
        </ul>
      </section>
    `}renderLayerEditor(){const e=this.model.layers[this.selectedIndex];if(!e)return n;const t=s=>this.updateLayer({...e,...s});return l`
      <section class="section">
        <h3 class="section-heading">Layer ${this.selectedIndex+1}</h3>
        <div class="layer-editor">
          <div class="offset-row">
            <xy-pad .x=${e.offsetX} .y=${e.offsetY} .range=${R} label="Shadow offset"
              @value-change=${s=>t({offsetX:s.detail.x,offsetY:s.detail.y})}></xy-pad>
            <div class="offset-numbers">
              <scrub-number label="X" unit="px" min="-100" max="100" .value=${e.offsetX}
                @value-change=${s=>t({offsetX:s.detail})}></scrub-number>
              <scrub-number label="Y" unit="px" min="-100" max="100" .value=${e.offsetY}
                @value-change=${s=>t({offsetY:s.detail})}></scrub-number>
            </div>
          </div>
          <scrub-number label="Blur" unit="px" min="0" max="120" .value=${e.blur}
            @value-change=${s=>t({blur:Math.max(0,s.detail)})}></scrub-number>
          ${this.isBoxVariant?l`
            <scrub-number label="Spread" unit="px" min="-60" max="60" .value=${e.spread}
              @value-change=${s=>t({spread:s.detail})}></scrub-number>
          `:n}
          <color-field label="Color" .color=${e.color} .colorFormat=${this.colorFormat}
            @color-change=${s=>t({color:s.detail})}></color-field>
          ${this.isBoxVariant?l`
            <div class="row">
              <span class="row-label">Type</span>
              <segmented-choice label="Shadow type" .value=${e.isInset?"inset":"outset"}
                .options=${[{value:"outset",label:"Drop"},{value:"inset",label:"Inset"}]}
                @value-change=${s=>t({isInset:s.detail==="inset"})}></segmented-choice>
            </div>
          `:n}
        </div>
      </section>
    `}applyPreset(e){this.selectedIndex=0,this.emitModel(this.definition.parse(e))}addLayer(){const e=[...this.model.layers,{...g,color:{...g.color}}];this.selectedIndex=e.length-1,this.emitModel({layers:e})}removeLayer(e){const t=B(this.model.layers,e);this.selectedIndex=Math.max(0,Math.min(this.selectedIndex,t.length-1)),this.emitModel({layers:t})}updateLayer(e){this.emitModel({layers:X(this.model.layers,this.selectedIndex,e)})}emitModel(e){F(this,"model-change",e)}}customElements.define("shadow-editor",V);
