import{LitElement as b,html as a,css as f,nothing as c}from"lit";import{baseStyles as h,checkerboardStyles as p,panelStyles as $}from"./editor_styles.js";import{replaceAt as u,removeAt as v,moveItem as d}from"./editor_controls.js";import{splitWhitespace as g,parseFunctionCall as k}from"./css_value_syntax.js";import{emitEvent as y}from"./pointer_tracking.js";export const PARAMETER_TYPES=Object.freeze({NUMBER:"number",COLOR:"color"});export function parseFunctionList(s,e){if(s.trim().toLowerCase()==="none")return{items:[]};const t=[];for(const n of g(s)){const i=k(n),l=i&&e.find(r=>r.cssNames.includes(i.name)),o=l?.parseCall(i.name,i.argumentsText);if(!o)return null;t.push({kindName:l.name,values:o})}return{items:t}}export function serializeFunctionList(s,e,t){return s.items.length===0?"none":s.items.map(n=>m(e,n.kindName).formatCall(n.values,t)).join(" ")}function m(s,e){return s.find(t=>t.name===e)}class x extends b{static properties={kinds:{attribute:!1},model:{attribute:!1},colorFormat:{},heading:{}};static styles=[h,p,$,f`
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
  `];render(){if(!this.model)return c;const{items:e}=this.model;return a`
      <h3 class="section-heading">${this.heading}</h3>
      ${e.length===0?a`<p class="hint">Nothing applied yet. Add a function below.</p>`:c}
      ${e.map((t,n)=>this.renderItem(t,n,e.length))}
      <div class="row add-row">
        <select aria-label="Function to add" @change=${this.addItem}>
          <option value="">+ Add function…</option>
          ${this.kinds.map(t=>a`<option value=${t.name}>${t.label}</option>`)}
        </select>
      </div>
    `}renderItem(e,t,n){const i=m(this.kinds,e.kindName);return a`
      <div class="function-item">
        <div class="function-header">
          <span class="function-name">${i.label}</span>
          <button class="button button--icon button--small" type="button" aria-label="Move ${i.label} up" ?disabled=${t===0}
            @click=${()=>this.emitItems(d(this.model.items,t,-1))}>↑</button>
          <button class="button button--icon button--small" type="button" aria-label="Move ${i.label} down" ?disabled=${t===n-1}
            @click=${()=>this.emitItems(d(this.model.items,t,1))}>↓</button>
          <button class="button button--icon button--small" type="button" aria-label="Remove ${i.label}"
            @click=${()=>this.emitItems(v(this.model.items,t))}>×</button>
        </div>
        ${i.parameters.map((l,o)=>this.renderParameter(e,t,l,o))}
      </div>
    `}renderParameter(e,t,n,i){const l=o=>{const r=u(e.values,i,o);this.emitItems(u(this.model.items,t,{...e,values:r}))};return n.type===PARAMETER_TYPES.COLOR?a`<color-field label=${n.label} .color=${e.values[i]} .colorFormat=${this.colorFormat}
        @color-change=${o=>l(o.detail)}></color-field>`:a`<scrub-number label=${n.label} unit=${n.unit} min=${n.min} max=${n.max}
      step=${n.step} .value=${e.values[i]} @value-change=${o=>l(o.detail)}></scrub-number>`}addItem(e){const t=m(this.kinds,e.target.value);if(e.target.value="",!t)return;const n=t.parameters.map(i=>typeof i.defaultValue=="object"?{...i.defaultValue}:i.defaultValue);this.emitItems([...this.model.items,{kindName:t.name,values:n}])}emitItems(e){y(this,"model-change",{...this.model,items:e})}}customElements.define("function-list-controls",x);
