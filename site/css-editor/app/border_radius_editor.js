import{LitElement as I,html as p,css as N,nothing as L}from"lit";import{editorStyles as P}from"./editor_styles.js";import{renderPresetSection as M,renderHandle as R,handleStyles as $,replaceAt as m}from"./editor_controls.js";import{splitTopLevel as w,splitWhitespace as y,parseNumberWithUnit as H,compressBoxValues as k,formatLength as D,roundTo as v,clamp as b}from"./css_value_syntax.js";import{trackPointerDrag as B,emitEvent as g}from"./pointer_tracking.js";const d=Object.freeze({PERCENT:"%",PIXELS:"px"}),h=Object.freeze({ALL:"all",CORNERS:"corners",ELLIPTICAL:"elliptical"}),O=Object.freeze({[h.ALL]:0,[h.CORNERS]:1,[h.ELLIPTICAL]:2}),u=Object.freeze([{name:"Top left",isLeft:!0,isTop:!0},{name:"Top right",isLeft:!1,isTop:!0},{name:"Bottom right",isLeft:!1,isTop:!1},{name:"Bottom left",isLeft:!0,isTop:!1}]),c=Object.freeze({HORIZONTAL:"horizontal",VERTICAL:"vertical"}),Z=Object.freeze({[d.PERCENT]:100,[d.PIXELS]:240}),x=Object.freeze({[d.PERCENT]:1,[d.PIXELS]:0}),E=[{label:"Blob",css:"30% 70% 70% 30% / 30% 30% 70% 70%"},{label:"Rounded",css:"16px"},{label:"Pill",css:"999px"},{label:"Circle",css:"50%"},{label:"Leaf",css:"0 70%"},{label:"Drop",css:"50% 50% 50% 0"},{label:"Tab",css:"16px 16px 0 0"},{label:"Hand-drawn",css:"255px 15px 225px 15px / 15px 225px 15px 255px"}];export const borderRadiusDefinition={id:"border-radius",label:"Border radius",group:"Shape",properties:["border-radius"],presets:E,parse:z,serialize:S,render:({model:l,onChange:e})=>p`<border-radius-editor .model=${l} @model-change=${e}></border-radius-editor>`};function z(l){const e=w(l,"/");if(e.length>2)return null;const t=e.map(n=>y(n).map(H)),i=t.flat();if(i.includes(null)||t.some(n=>n.length===0||n.length>4))return null;const s=new Set(i.filter(n=>!(n.unit===""&&n.number===0)).map(n=>n.unit));if(s.size>1)return null;const r=s.values().next().value??d.PIXELS;if(!Object.values(d).includes(r)||i.some(n=>n.number<0))return null;const a=T(t[0].map(n=>n.number)),o=t[1]?T(t[1].map(n=>n.number)):[...a];return{unit:r,horizontal:a,vertical:o}}function T([l,e=l,t=l,i=e]){return[l,e,t,i]}function S(l){const e=s=>k(s).map(r=>D(r,l.unit,x[l.unit])).join(" "),t=e(l.horizontal),i=e(l.vertical);return t===i?t:`${t} / ${i}`}function C(l){return l.horizontal.every((t,i)=>t===l.vertical[i])?l.horizontal.every(t=>t===l.horizontal[0])?h.ALL:h.CORNERS:h.ELLIPTICAL}class U extends I{static properties={model:{attribute:!1},linkMode:{state:!0},boxSize:{state:!0}};static styles=[P,$,N`
    .box {
      position: relative;
      width: min(22rem, 100%);
      aspect-ratio: 3 / 2;
    }

    .shape {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, #ff8a3d, #ff3d77 55%, #7c3aed);
      box-shadow: 0 14px 34px rgb(0 0 0 / 0.25);
    }

    .frame {
      position: absolute;
      inset: 0;
      border: 1px dashed currentColor;
      opacity: 0.35;
      pointer-events: none;
    }
  `];constructor(){super(),this.linkMode=h.ALL,this.boxSize={width:0,height:0},this.resizeObserver=new ResizeObserver(([e])=>{this.boxSize={width:e.contentRect.width,height:e.contentRect.height}})}firstUpdated(){this.resizeObserver.observe(this.renderRoot.querySelector(".box"))}disconnectedCallback(){super.disconnectedCallback(),this.resizeObserver.disconnect()}willUpdate(e){if(!e.has("model")||!this.model)return;const t=C(this.model);O[t]>O[this.linkMode]&&(this.linkMode=t)}render(){return this.model?p`
      <div class="preview">
        <preview-stage>
          <div class="box">
            <div class="frame"></div>
            <div class="shape" style="border-radius: ${S(this.model)}"></div>
            ${this.renderHandles()}
          </div>
        </preview-stage>
      </div>
      <div class="controls">
        ${M(E,e=>this.applyPreset(e))}
        <section class="section">
          <h3 class="section-heading">Settings</h3>
          <div class="row">
            <span class="row-label">Unit</span>
            <segmented-choice label="Unit" .value=${this.model.unit}
              .options=${[{value:"px",label:"px"},{value:"%",label:"%"}]}
              @value-change=${e=>this.convertUnit(e.detail)}></segmented-choice>
          </div>
          <div class="row">
            <span class="row-label">Link</span>
            <segmented-choice label="Link corners" .value=${this.linkMode}
              .options=${[{value:"all",label:"All"},{value:"corners",label:"Per corner"},{value:"elliptical",label:"Elliptical"}]}
              @value-change=${e=>this.changeLinkMode(e.detail)}></segmented-choice>
          </div>
          <p class="hint">Drag the handles on the edges of the shape. Elliptical mode gives each corner a separate horizontal and vertical radius.</p>
        </section>
        <section class="section">
          <h3 class="section-heading">Radii</h3>
          ${this.renderRadiusFields()}
        </section>
      </div>
    `:L}renderRadiusFields(){const{unit:e,horizontal:t,vertical:i}=this.model,s=(r,a,o)=>p`<scrub-number label=${r} unit=${e} min="0" max=${Z[e]}
      step=${e===d.PERCENT?.5:1} .value=${a} @value-change=${n=>o(Math.max(0,n.detail))}></scrub-number>`;return this.linkMode===h.ALL?s("Radius",t[0],r=>this.setRadius({cornerIndex:0,axis:c.HORIZONTAL,value:r})):this.linkMode===h.CORNERS?u.map((r,a)=>s(r.name,t[a],o=>this.setRadius({cornerIndex:a,axis:c.HORIZONTAL,value:o}))):u.flatMap((r,a)=>[s(`${r.name} X`,t[a],o=>this.setRadius({cornerIndex:a,axis:c.HORIZONTAL,value:o})),s(`${r.name} Y`,i[a],o=>this.setRadius({cornerIndex:a,axis:c.VERTICAL,value:o}))])}renderHandles(){return this.boxSize.width?u.flatMap((e,t)=>{const i=this.toPercentOfBox(this.model.horizontal[t],c.HORIZONTAL),s=this.toPercentOfBox(this.model.vertical[t],c.VERTICAL);return[R({x:e.isLeft?i:100-i,y:e.isTop?0:100,label:`${e.name} horizontal radius`,onPointerDown:r=>this.startHandleDrag(r,t,c.HORIZONTAL)}),R({x:e.isLeft?0:100,y:e.isTop?s:100-s,label:`${e.name} vertical radius`,onPointerDown:r=>this.startHandleDrag(r,t,c.VERTICAL)})]}):L}toPercentOfBox(e,t){if(this.model.unit===d.PERCENT)return b(e,0,100);const i=t===c.HORIZONTAL?this.boxSize.width:this.boxSize.height;return b(e/i*100,0,100)}fromFractionOfBox(e,t){const i=b(e,0,1);if(this.model.unit===d.PERCENT)return v(i*100,1);const s=t===c.HORIZONTAL?this.boxSize.width:this.boxSize.height;return Math.round(i*s)}startHandleDrag(e,t,i){const s=u[t],r=this.renderRoot.querySelector(".box");e.currentTarget.focus(),B(e,r,a=>{const o=i===c.HORIZONTAL?s.isLeft?a.x:1-a.x:s.isTop?a.y:1-a.y;this.setRadius({cornerIndex:t,axis:i,value:this.fromFractionOfBox(o,i)})},{isImmediate:!1})}setRadius({cornerIndex:e,axis:t,value:i}){const{horizontal:s,vertical:r}=this.model;if(this.linkMode===h.ALL){const o=s.map(()=>i);this.applyChanges({horizontal:o,vertical:[...o]});return}if(this.linkMode===h.CORNERS){this.applyChanges({horizontal:m(s,e,i),vertical:m(r,e,i)});return}const a=t===c.HORIZONTAL?s:r;this.applyChanges({[t]:m(a,e,i)})}changeLinkMode(e){this.linkMode=e;const{horizontal:t}=this.model;if(e===h.ALL){const i=t.map(()=>t[0]);this.applyChanges({horizontal:i,vertical:[...i]})}else e===h.CORNERS&&this.applyChanges({vertical:[...t]})}convertUnit(e){if(e===this.model.unit||!this.boxSize.width)return;const t=x[e],i=(o,n)=>{const f=n===c.HORIZONTAL?this.boxSize.width:this.boxSize.height,A=e===d.PIXELS?o/100*f:o/f*100;return v(A,t)},s=this.model.horizontal.map(o=>i(o,c.HORIZONTAL)),a=this.linkMode===h.ELLIPTICAL?this.model.vertical.map(o=>i(o,c.VERTICAL)):[...s];this.applyChanges({unit:e,horizontal:s,vertical:a})}applyPreset(e){const t=z(e);this.linkMode=C(t),g(this,"model-change",t)}applyChanges(e){g(this,"model-change",{...this.model,...e})}}customElements.define("border-radius-editor",U);
