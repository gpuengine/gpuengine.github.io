import{LitElement as h,html as s,css as u,nothing as n}from"lit";import{editorStyles as g}from"./editor_styles.js";import{renderPresetSection as f}from"./editor_controls.js";import{parseColor as b,formatColor as a,contrastRatio as A,createColor as d,COLOR_FORMATS as c,COLOR_FORMAT_LABELS as v}from"./color_model.js";import{emitEvent as i}from"./pointer_tracking.js";const m=d(255,255,255),$=d(0,0,0),l=Object.freeze({AAA:7,AA:4.5,AA_LARGE:3}),w=1400,p=[{label:"Ember",css:"#ff8a3d"},{label:"Translucent",css:"rgb(61 139 255 / 0.6)"},{label:"Mint",css:"hsl(152 68% 52%)"},{label:"Vivid pink",css:"oklch(65% 0.26 350)"},{label:"Ink",css:"#1c1612"},{label:"Paper",css:"hwb(30 92% 2%)"}];export const colorDefinition={id:"color",label:"Color",group:"Color",properties:["background-color","background","color","border-color","fill","stroke","accent-color","outline-color"],presets:p,parse:e=>{const t=b(e);return t?{color:t}:null},serialize:(e,t)=>a(e.color,t),render:({model:e,colorFormat:t,onChange:r})=>s`<color-editor .model=${e} .colorFormat=${t}
    @model-change=${r}></color-editor>`};function y(e){return e>=l.AAA?"AAA":e>=l.AA?"AA":e>=l.AA_LARGE?"AA large":"Fails"}class C extends h{static properties={model:{attribute:!1},colorFormat:{},copiedFormat:{state:!0}};static styles=[g,u`
    .swatch {
      display: grid;
      place-items: center;
      width: min(22rem, 100%);
      aspect-ratio: 4 / 3;
      border-radius: 18px;
      background: linear-gradient(var(--swatch), var(--swatch)), var(--checkerboard);
      box-shadow: 0 0 0 1px rgb(0 0 0 / 0.08), 0 12px 32px rgb(0 0 0 / 0.18);
    }

    .sample-text {
      display: flex;
      gap: 1.25rem;
      font: 700 1.6rem/1 system-ui, -apple-system, "Segoe UI", sans-serif;
    }

    .format-list {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 0.35rem 0.6rem;
      align-items: center;
      margin: 0;
    }

    .format-list dt {
      color: var(--muted);
      font-size: 0.75rem;
    }

    .format-list dd {
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font: 0.78rem var(--mono);
    }

    .contrast {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }

    .contrast-card {
      padding: 0.55rem 0.7rem;
      border-radius: 8px;
      font-weight: 600;
    }

    .contrast-card small {
      display: block;
      font-weight: 400;
      opacity: 0.85;
    }
  `];constructor(){super(),this.colorFormat=c.HEX,this.copiedFormat=null}render(){if(!this.model)return n;const{color:t}=this.model,r=a(t,c.RGB);return s`
      <div class="preview">
        <preview-stage>
          <div class="swatch" style="--swatch: ${r}">
            <div class="sample-text"><span style="color: #fff">Aa</span><span style="color: #000">Aa</span></div>
          </div>
        </preview-stage>
      </div>
      <div class="controls">
        ${f(p,o=>i(this,"model-change",colorDefinition.parse(o)))}
        <section class="section">
          <h3 class="section-heading">Picker</h3>
          <color-picker .color=${t} @color-change=${o=>i(this,"model-change",{color:o.detail})}></color-picker>
          <color-field label="Value" .color=${t} .colorFormat=${this.colorFormat}
            @color-change=${o=>i(this,"model-change",{color:o.detail})}></color-field>
        </section>
        <section class="section">
          <h3 class="section-heading">All formats</h3>
          <dl class="format-list">
            ${Object.values(c).map(o=>this.renderFormatRow(t,o))}
          </dl>
        </section>
        <section class="section">
          <h3 class="section-heading">Text contrast (WCAG)</h3>
          <div class="contrast">
            ${[m,$].map(o=>this.renderContrastCard(t,o))}
          </div>
          ${t.alpha<1?s`<p class="hint">Contrast ignores transparency; check it against the real background.</p>`:n}
        </section>
      </div>
    `}renderFormatRow(t,r){const o=a(t,r);return s`
      <dt>${v[r]}</dt>
      <dd title=${o}>${o}</dd>
      <button class="button button--small" type="button" @click=${()=>this.copyFormat(r,o)}>
        ${this.copiedFormat===r?"Copied":"Copy"}
      </button>
    `}renderContrastCard(t,r){const o=A(t,r);return s`
      <div class="contrast-card" style="background: ${a({...t,alpha:1},c.RGB)}; color: ${a(r,c.HEX)}">
        ${o.toFixed(2)} : 1
        <small>${r===m?"White":"Black"} text · ${y(o)}</small>
      </div>
    `}async copyFormat(t,r){try{await navigator.clipboard.writeText(r)}catch{return}this.copiedFormat=t,clearTimeout(this.copiedTimer),this.copiedTimer=setTimeout(()=>{this.copiedFormat=null},w)}}customElements.define("color-editor",C);
