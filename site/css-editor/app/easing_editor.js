import{LitElement as k,html as b,css as S,svg as C,nothing as M}from"lit";import{editorStyles as D}from"./editor_styles.js";import{renderPresetSection as _,renderHandle as f,handleStyles as R}from"./editor_controls.js";import{parseFunctionCall as N,splitTopLevel as I,parseNumberWithUnit as P,formatNumber as O,roundTo as d,clamp as c}from"./css_value_syntax.js";import{trackPointerDrag as L,arrowKeyDelta as T,emitEvent as v}from"./pointer_tracking.js";const m=-.5,r=1.5,g=r-m,u=2,z=.01,H=.1,q=1200,U=400,y=60,h=Object.freeze({linear:[0,0,1,1],ease:[.25,.1,.25,1],"ease-in":[.42,0,1,1],"ease-out":[0,0,.58,1],"ease-in-out":[.42,0,.58,1]}),x=[{label:"ease",css:"ease"},{label:"ease-in",css:"ease-in"},{label:"ease-out",css:"ease-out"},{label:"ease-in-out",css:"ease-in-out"},{label:"linear",css:"linear"},{label:"Out back",css:"cubic-bezier(0.34, 1.56, 0.64, 1)"},{label:"In back",css:"cubic-bezier(0.36, 0, 0.66, -0.56)"},{label:"Out expo",css:"cubic-bezier(0.16, 1, 0.3, 1)"},{label:"In-out cubic",css:"cubic-bezier(0.65, 0, 0.35, 1)"},{label:"Out quint",css:"cubic-bezier(0.22, 1, 0.36, 1)"},{label:"Snappy",css:"cubic-bezier(0.2, 0.9, 0.1, 1)"}];export const easingDefinition={id:"easing",label:"Easing curve",group:"Motion",properties:["transition-timing-function","animation-timing-function"],presets:x,parse:$,serialize:E,render:({model:i,onChange:e})=>b`<easing-editor .model=${i} @model-change=${e}></easing-editor>`};function $(i){const e=i.trim().toLowerCase();if(e in h)return w(h[e]);const s=N(i);if(!s||s.name!=="cubic-bezier")return null;const t=I(s.argumentsText,",").map(l=>{const n=P(l);return n&&n.unit===""?n.number:null});if(t.length!==4||t.includes(null))return null;const[a,,o]=t;return a<0||a>1||o<0||o>1?null:w(t)}function w([i,e,s,t]){return{x1:i,y1:e,x2:s,y2:t}}function E(i){const e=[i.x1,i.y1,i.x2,i.y2].map(t=>d(t,u));return Object.keys(h).find(t=>h[t].every((a,o)=>a===e[o]))??`cubic-bezier(${e.map(t=>O(t,u)).join(", ")})`}function A(i,e){return{left:i*100,top:(r-e)/g*100}}function G(i,e){return`${i} ${r-e}`}function Y({x1:i,y1:e,x2:s,y2:t}){const a=(l,n,p)=>3*(1-l)**2*l*n+3*(1-l)*l**2*p+l**3;return`M ${Array.from({length:y+1},(l,n)=>{const p=n/y;return G(a(p,i,s),a(p,e,t))}).join(" L ")}`}function K(){return matchMedia("(prefers-reduced-motion: reduce)").matches}class j extends k{static properties={model:{attribute:!1},durationMilliseconds:{state:!0}};static styles=[D,R,S`
    .layout {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 2rem;
      width: 100%;
    }

    .graph {
      position: relative;
      height: min(26rem, 56vh);
      aspect-ratio: 1 / 2;
      user-select: none;
    }

    .graph svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .unit-square {
      fill: rgb(127 127 127 / 0.12);
      stroke: currentColor;
      stroke-opacity: 0.35;
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
    }

    .diagonal {
      stroke: currentColor;
      stroke-opacity: 0.25;
      stroke-dasharray: 4 4;
      vector-effect: non-scaling-stroke;
    }

    .arm {
      stroke: currentColor;
      stroke-opacity: 0.6;
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
    }

    .curve {
      fill: none;
      stroke: var(--accent);
      stroke-width: 3;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }

    .lanes {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      width: min(18rem, 100%);
    }

    .lane-label {
      font-size: 0.75rem;
      opacity: 0.75;
    }

    .lane {
      position: relative;
      height: 2.4rem;
      border-radius: 999px;
      background: rgb(127 127 127 / 0.18);
    }

    .ball {
      position: absolute;
      top: 0.3rem;
      left: 0.3rem;
      width: 1.8rem;
      height: 1.8rem;
      border-radius: 50%;
      background: var(--accent);
    }

    .ball[data-reference] {
      background: currentColor;
      opacity: 0.45;
    }

    .grow-demo {
      display: flex;
      gap: 1rem;
      align-items: center;
      justify-content: center;
      height: 5rem;
    }

    .grow-square {
      width: 3.5rem;
      height: 3.5rem;
      border-radius: 12px;
      background: linear-gradient(135deg, #ff8a3d, #7c3aed);
    }
  `];constructor(){super(),this.durationMilliseconds=q,this.runningAnimations=[]}disconnectedCallback(){super.disconnectedCallback(),this.stopAnimations()}render(){if(!this.model)return M;const{x1:e,y1:s,x2:t,y2:a}=this.model,o=A(e,s),l=A(t,a);return b`
      <div class="preview">
        <preview-stage>
          <div class="layout">
            <div class="graph">
              <svg viewBox="0 0 1 ${g}" preserveAspectRatio="none" aria-hidden="true">
                ${C`
                  <rect class="unit-square" x="0" y=${r-1} width="1" height="1"></rect>
                  <line class="diagonal" x1="0" y1=${r} x2="1" y2=${r-1}></line>
                  <line class="arm" x1="0" y1=${r} x2=${e} y2=${r-s}></line>
                  <line class="arm" x1="1" y1=${r-1} x2=${t} y2=${r-a}></line>
                  <path class="curve" d=${Y(this.model)}></path>
                `}
              </svg>
              ${f({x:o.left,y:o.top,label:`First control point ${e}, ${s}`,onPointerDown:n=>this.startHandleDrag(n,"first"),onKeyDown:n=>this.nudgeHandle(n,"first")})}
              ${f({x:l.left,y:l.top,label:`Second control point ${t}, ${a}`,onPointerDown:n=>this.startHandleDrag(n,"second"),onKeyDown:n=>this.nudgeHandle(n,"second")})}
            </div>
            <div class="lanes">
              <div>
                <div class="lane-label">Your curve</div>
                <div class="lane"><span class="ball" data-animated></span></div>
              </div>
              <div>
                <div class="lane-label">linear, for comparison</div>
                <div class="lane"><span class="ball" data-reference></span></div>
              </div>
              <div class="grow-demo"><span class="grow-square"></span></div>
            </div>
          </div>
        </preview-stage>
      </div>
      <div class="controls">
        ${_(x,n=>v(this,"model-change",$(n)))}
        <section class="section">
          <h3 class="section-heading">Control points</h3>
          <scrub-number label="X1" min="0" max="1" step="0.01" .value=${e} @value-change=${n=>this.applyChanges({x1:c(n.detail,0,1)})}></scrub-number>
          <scrub-number label="Y1" min=${m} max=${r} step="0.01" .value=${s} @value-change=${n=>this.applyChanges({y1:n.detail})}></scrub-number>
          <scrub-number label="X2" min="0" max="1" step="0.01" .value=${t} @value-change=${n=>this.applyChanges({x2:c(n.detail,0,1)})}></scrub-number>
          <scrub-number label="Y2" min=${m} max=${r} step="0.01" .value=${a} @value-change=${n=>this.applyChanges({y2:n.detail})}></scrub-number>
          <p class="hint">X values must stay between 0 and 1. Y values outside 0–1 overshoot, which gives a bounce or anticipation.</p>
        </section>
        <section class="section">
          <h3 class="section-heading">Preview</h3>
          <scrub-number label="Duration" unit="ms" min="200" max="4000" step="50" .value=${this.durationMilliseconds}
            @value-change=${n=>{this.durationMilliseconds=Math.max(50,n.detail)}}></scrub-number>
          <div class="row"><button class="button" type="button" @click=${()=>this.restartAnimations()}>Replay</button></div>
        </section>
      </div>
    `}updated(e){(e.has("model")||e.has("durationMilliseconds"))&&this.restartAnimations()}restartAnimations(){if(this.stopAnimations(),!this.model)return;const e={duration:this.durationMilliseconds,iterations:K()?1:1/0,direction:"alternate",endDelay:U,fill:"both"},s=[{left:"0.3rem"},{left:"calc(100% - 2.1rem)"}],t=E(this.model);this.runningAnimations=[this.renderRoot.querySelector("[data-animated]").animate(s,{...e,easing:t}),this.renderRoot.querySelector("[data-reference]").animate(s,{...e,easing:"linear"}),this.renderRoot.querySelector(".grow-square").animate([{transform:"scale(0.4) rotate(0deg)"},{transform:"scale(1.3) rotate(90deg)"}],{...e,easing:t})]}stopAnimations(){this.runningAnimations.forEach(e=>e.cancel()),this.runningAnimations=[]}startHandleDrag(e,s){const t=this.renderRoot.querySelector(".graph");e.currentTarget.focus(),L(e,t,a=>{const o=d(c(a.x,0,1),u),l=d(c(r-a.y*g,m,r),u);this.applyChanges(s==="first"?{x1:o,y1:l}:{x2:o,y2:l})},{isImmediate:!1})}nudgeHandle(e,s){const t=T(e,{step:z,largeStep:H});if(!t)return;e.preventDefault();const[a,o]=s==="first"?["x1","y1"]:["x2","y2"];this.applyChanges({[a]:d(c(this.model[a]+t.x,0,1),u),[o]:d(c(this.model[o]-t.y,m,r),u)})}applyChanges(e){v(this,"model-change",{...this.model,...e})}}customElements.define("easing-editor",j);
