import{LitElement as C,html as u,css as y,nothing as E}from"lit";import{editorStyles as F}from"./editor_styles.js";import{renderPresetSection as P}from"./editor_controls.js";import{parseFunctionList as V,serializeFunctionList as d,PARAMETER_TYPES as R}from"./function_list_editor.js";import{splitWhitespace as N,parseNumberWithUnit as A,parsePixels as f,parseAngleDegrees as k,formatNumber as h,formatLength as n,roundTo as b,clamp as c}from"./css_value_syntax.js";import{parseColor as L,formatColor as S,createColor as g,COLOR_FORMATS as x}from"./color_model.js";import{trackPointerDrag as D,emitEvent as v}from"./pointer_tracking.js";const $="/site/media/hero-poster.jpg",O=50,m=[T({name:"blur",label:"Blur",maximum:40,defaultValue:4}),i({name:"brightness",label:"Brightness",maximum:300,defaultValue:120}),i({name:"contrast",label:"Contrast",maximum:300,defaultValue:130}),i({name:"saturate",label:"Saturate",maximum:300,defaultValue:160}),i({name:"grayscale",label:"Grayscale",maximum:100,defaultValue:100}),i({name:"sepia",label:"Sepia",maximum:100,defaultValue:80}),i({name:"invert",label:"Invert",maximum:100,defaultValue:100}),i({name:"opacity",label:"Opacity",maximum:100,defaultValue:50}),{name:"hue-rotate",label:"Hue rotate",cssNames:["hue-rotate"],parameters:[{label:"Angle",unit:"deg",min:-180,max:180,step:1,defaultValue:90}],parseCall:(r,e)=>{const t=e===""?0:k(e);return t===null?null:[b(t,2)]},formatCall:([r])=>`hue-rotate(${h(r,1)}deg)`},{name:"drop-shadow",label:"Drop shadow",cssNames:["drop-shadow"],parameters:[{label:"X",unit:"px",min:-60,max:60,step:1,defaultValue:0},{label:"Y",unit:"px",min:-60,max:60,step:1,defaultValue:8},{label:"Blur",unit:"px",min:0,max:60,step:1,defaultValue:12},{label:"Color",type:R.COLOR,defaultValue:g(0,0,0,.5)}],parseCall:(r,e)=>_(e),formatCall:([r,e,t,s],l)=>`drop-shadow(${n(r,"px")} ${n(e,"px")} ${n(t,"px")} ${S(s,l)})`}],w=[{label:"Vintage",css:"sepia(60%) contrast(110%) brightness(105%) saturate(80%)"},{label:"Noir",css:"grayscale(100%) contrast(140%) brightness(90%)"},{label:"Vivid",css:"saturate(180%) contrast(110%)"},{label:"Faded",css:"contrast(80%) brightness(115%) saturate(70%)"},{label:"Night vision",css:"grayscale(100%) sepia(100%) hue-rotate(60deg) saturate(400%) brightness(80%)"},{label:"Frosted",css:"blur(6px) brightness(115%)"},{label:"Negative",css:"invert(100%) hue-rotate(180deg)"},{label:"Sticker",css:"drop-shadow(0 0 2px #fff) drop-shadow(0 6px 10px rgb(0 0 0 / 0.5))"}];export const filterDefinition={id:"filter",label:"Filter",group:"Effects",properties:["filter","backdrop-filter"],presets:w,parse:r=>V(r,m),serialize:(r,e)=>d(r,m,e),render:({model:r,colorFormat:e,onChange:t})=>u`<filter-editor .model=${r} .colorFormat=${e}
    @model-change=${t}></filter-editor>`};function T({name:r,label:e,maximum:t,defaultValue:s}){return{name:r,label:e,cssNames:[r],parameters:[{label:"Radius",unit:"px",min:0,max:t,step:.5,defaultValue:s}],parseCall:(l,o)=>{const a=o===""?0:f(o);return a===null||a<0?null:[a]},formatCall:([l])=>`${r}(${n(l,"px")})`}}function i({name:r,label:e,maximum:t,defaultValue:s}){return{name:r,label:e,cssNames:[r],parameters:[{label:"Amount",unit:"%",min:0,max:t,step:1,defaultValue:s}],parseCall:(l,o)=>{if(o==="")return[100];const a=A(o);return!a||!(a.unit===""||a.unit==="%")||a.number<0?null:[b(a.unit==="%"?a.number:a.number*100,2)]},formatCall:([l])=>`${r}(${h(l,1)}%)`}}function _(r){const e=[];let t=null;for(const a of N(r)){const p=f(a);if(p!==null){e.push(p);continue}if(t||(t=L(a),!t))return null}if(e.length<2||e.length>3)return null;const[s,l,o=0]=e;return[s,l,o,t??g(0,0,0,1)]}class I extends C{static properties={model:{attribute:!1},colorFormat:{},comparePercent:{state:!0}};static styles=[F,y`
    .compare {
      position: relative;
      width: min(40rem, 100%);
      aspect-ratio: 16 / 9;
      overflow: hidden;
      border-radius: 12px;
      user-select: none;
      touch-action: none;
      cursor: ew-resize;
    }

    .compare img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
    }

    .divider {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      margin-left: -1px;
      background: #fff;
      box-shadow: 0 0 0 1px rgb(0 0 0 / 0.3);
      pointer-events: none;
    }

    .divider::after {
      content: "⇆";
      position: absolute;
      top: 50%;
      left: 50%;
      display: grid;
      place-items: center;
      width: 1.8rem;
      height: 1.8rem;
      border-radius: 50%;
      background: #fff;
      color: #1c1612;
      font-size: 0.9rem;
      transform: translate(-50%, -50%);
      box-shadow: 0 2px 8px rgb(0 0 0 / 0.35);
    }

    .compare-label {
      position: absolute;
      bottom: 0.5rem;
      padding: 0.1rem 0.5rem;
      border-radius: 999px;
      background: rgb(0 0 0 / 0.55);
      color: #fff;
      font-size: 0.72rem;
      pointer-events: none;
    }
  `];constructor(){super(),this.comparePercent=O,this.colorFormat=x.HEX}render(){if(!this.model)return E;const e=d(this.model,m,x.RGB);return u`
      <div class="preview">
        <preview-stage>
          <div class="compare" role="slider" tabindex="0" aria-label="Before and after divider" aria-valuemin="0" aria-valuemax="100"
            aria-valuenow=${Math.round(this.comparePercent)} @pointerdown=${this.startCompareDrag} @keydown=${this.handleCompareKey}>
            <img src=${$} alt="">
            <img src=${$} alt="" style="filter: ${e}; clip-path: inset(0 0 0 ${this.comparePercent}%)">
            <span class="divider" style="left: ${this.comparePercent}%"></span>
            <span class="compare-label" style="left: 0.5rem">Original</span>
            <span class="compare-label" style="right: 0.5rem">Filtered</span>
          </div>
        </preview-stage>
      </div>
      <div class="controls">
        ${P(w,t=>v(this,"model-change",filterDefinition.parse(t)))}
        <section class="section">
          <function-list-controls heading="Filters, applied in order" .kinds=${m} .model=${this.model}
            .colorFormat=${this.colorFormat} @model-change=${t=>v(this,"model-change",t.detail)}></function-list-controls>
        </section>
      </div>
    `}startCompareDrag(e){e.currentTarget.focus(),D(e,e.currentTarget,t=>{this.comparePercent=c(t.x,0,1)*100})}handleCompareKey(e){const t=e.shiftKey?10:2;if(e.key==="ArrowLeft")this.comparePercent=c(this.comparePercent-t,0,100);else if(e.key==="ArrowRight")this.comparePercent=c(this.comparePercent+t,0,100);else return;e.preventDefault()}}customElements.define("filter-editor",I);
