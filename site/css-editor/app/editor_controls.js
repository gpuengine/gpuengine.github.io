import{LitElement as d,html as s,css as o,svg as y,nothing as k}from"lit";import{baseStyles as u,checkerboardStyles as $}from"./editor_styles.js";import{trackPointerDrag as m,arrowKeyDelta as f,emitEvent as l}from"./pointer_tracking.js";import{clamp as b,roundTo as w}from"./css_value_syntax.js";const S=2,E=10,v=15,p=360,g=Object.freeze(["checker","light","dark"]),x="css-editor-backdrop";export class ScrubNumber extends d{static properties={label:{},value:{type:Number},min:{type:Number},max:{type:Number},step:{type:Number},unit:{}};static styles=[u,o`
    :host {
      display: grid;
      grid-template-columns: 5.5rem minmax(0, 1fr) 4.6rem;
      align-items: center;
      gap: 0.5rem;
    }

    .label {
      color: var(--muted);
      cursor: ew-resize;
      user-select: none;
      touch-action: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .label:hover {
      color: var(--text);
    }

    input[type="range"] {
      width: 100%;
      margin: 0;
      accent-color: var(--accent);
    }

    .number {
      display: flex;
      align-items: center;
      height: 1.75rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--bg);
    }

    .number:focus-within {
      border-color: var(--accent);
    }

    input[type="number"] {
      width: 100%;
      min-width: 0;
      padding: 0 0 0 0.4rem;
      border: 0;
      background: none;
      font: 0.78rem var(--mono);
      outline: none;
      appearance: textfield;
      -moz-appearance: textfield;
    }

    input[type="number"]::-webkit-inner-spin-button {
      display: none;
    }

    .unit {
      padding-right: 0.4rem;
      color: var(--muted);
      font: 0.72rem var(--mono);
    }
  `];constructor(){super(),this.label="",this.value=0,this.min=0,this.max=100,this.step=1,this.unit=""}render(){return s`
      <span class="label" title="Drag to adjust" @pointerdown=${this.startScrub}>${this.label}</span>
      <input type="range" aria-label=${this.label} min=${this.min} max=${this.max} step=${this.step}
        .value=${String(b(this.value,this.min,this.max))} @input=${this.handleRangeInput}>
      <span class="number">
        <input type="number" aria-label="${this.label} value" step=${this.step} @input=${this.handleNumberInput} @blur=${this.syncNumberInput}>
        <span class="unit">${this.unit}</span>
      </span>
    `}updated(){const e=this.renderRoot.querySelector('input[type="number"]');(!(this.renderRoot.activeElement===e)||Number(e.value)!==this.value)&&this.syncNumberInput()}syncNumberInput(){this.renderRoot.querySelector('input[type="number"]').value=String(this.value)}handleRangeInput(e){this.emitValue(Number(e.target.value))}handleNumberInput(e){const t=e.target.valueAsNumber;Number.isFinite(t)&&this.emitValue(t)}startScrub(e){if(e.button!==0)return;e.preventDefault();const t=e.clientX,r=this.value;m(e,this,(n,i)=>{const c=Math.round((i.clientX-t)/S),h=i.shiftKey?E:1;this.emitValue(r+c*this.step*h)},{isImmediate:!1})}emitValue(e){l(this,"value-change",w(e,N(this.step)))}}export class SegmentedChoice extends d{static properties={label:{},options:{attribute:!1},value:{}};static styles=[u,o`
    :host {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 0;
    }

    .button {
      border-radius: 0;
      margin-left: -1px;
    }

    .button:first-child {
      margin-left: 0;
      border-radius: 6px 0 0 6px;
    }

    .button:last-child {
      border-radius: 0 6px 6px 0;
    }
  `];constructor(){super(),this.options=[]}render(){return s`<span role="group" aria-label=${this.label??""} style="display: contents">${this.options.map(e=>s`
      <button class="button" type="button" aria-pressed=${String(e.value===this.value)}
        @click=${()=>l(this,"value-change",e.value)}>${e.label}</button>
    `)}</span>`}}export class XyPad extends d{static properties={x:{type:Number},y:{type:Number},range:{type:Number},label:{}};static styles=[u,o`
    :host {
      display: block;
      width: 8.5rem;
      flex: none;
    }

    .pad {
      position: relative;
      aspect-ratio: 1;
      border: 1px solid var(--line);
      border-radius: 8px;
      background:
        linear-gradient(var(--line), var(--line)) center / 1px 100% no-repeat,
        linear-gradient(var(--line), var(--line)) center / 100% 1px no-repeat,
        var(--bg);
      touch-action: none;
      cursor: crosshair;
      user-select: none;
    }

    svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;
      pointer-events: none;
    }

    line {
      stroke: var(--accent);
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
    }

    circle {
      fill: var(--accent);
      stroke: var(--surface);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
    }
  `];constructor(){super(),this.x=0,this.y=0,this.range=50,this.label="Offset"}render(){const e=50+b(this.x/this.range,-1,1)*50,t=50+b(this.y/this.range,-1,1)*50;return s`
      <div class="pad" role="slider" tabindex="0" aria-label=${this.label}
        aria-valuetext="x ${this.x}, y ${this.y}" @pointerdown=${this.startDrag} @keydown=${this.handleKeyDown}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1="50" y1="50" x2=${e} y2=${t}></line>
        </svg>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx=${e} cy=${t} r="6"></circle>
        </svg>
      </div>
    `}startDrag(e){const t=e.currentTarget;t.focus(),m(e,t,r=>{const n=i=>Math.round((b(i,0,1)-.5)*2*this.range);l(this,"value-change",{x:n(r.x),y:n(r.y)})})}handleKeyDown(e){const t=f(e);t&&(e.preventDefault(),l(this,"value-change",{x:this.x+t.x,y:this.y+t.y}))}}export class AngleDial extends d{static properties={angle:{type:Number},label:{}};static styles=[u,o`
    :host {
      display: inline-block;
      flex: none;
    }

    .dial {
      position: relative;
      width: 3.4rem;
      height: 3.4rem;
      border: 1px solid var(--line);
      border-radius: 50%;
      background: var(--bg);
      touch-action: none;
      cursor: grab;
      user-select: none;
    }

    .hand {
      position: absolute;
      left: calc(50% - 1px);
      top: 12%;
      width: 2px;
      height: 38%;
      border-radius: 1px;
      background: var(--accent);
      transform-origin: 50% 100%;
    }

    .hand::before {
      content: "";
      position: absolute;
      left: 50%;
      top: 0;
      width: 0.6rem;
      height: 0.6rem;
      border-radius: 50%;
      background: var(--accent);
      transform: translate(-50%, -50%);
    }
  `];constructor(){super(),this.angle=0,this.label="Angle"}render(){return s`
      <div class="dial" role="slider" tabindex="0" aria-label=${this.label} aria-valuemin="0" aria-valuemax="360"
        aria-valuenow=${this.angle} @pointerdown=${this.startDrag} @keydown=${this.handleKeyDown}>
        <span class="hand" style="transform: rotate(${this.angle}deg)"></span>
      </div>
    `}startDrag(e){const t=e.currentTarget;t.focus(),m(e,t,(r,n)=>{const c=(Math.atan2(r.x-.5,.5-r.y)*180/Math.PI+p)%p,h=n.shiftKey?v:1;l(this,"value-change",Math.round(c/h)*h%p)})}handleKeyDown(e){const t=f(e,{step:1,largeStep:v});if(!t)return;e.preventDefault();const r=t.x||-t.y;l(this,"value-change",(this.angle+r+p)%p)}}export class PreviewStage extends d{static properties={backdrop:{state:!0}};static styles=[u,$,o`
    :host {
      position: relative;
      display: block;
      min-height: 0;
      overflow: hidden;
    }

    .stage {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 2.5rem 1.5rem;
      overflow: auto;
    }

    .stage[data-backdrop="checker"] {
      background: var(--checkerboard);
      color: #1c1612;
    }

    .stage[data-backdrop="light"] {
      background: #f5f1ed;
      color: #1c1612;
    }

    .stage[data-backdrop="dark"] {
      background: #14110f;
      color: #ede7e2;
    }

    .backdrop-choice {
      position: absolute;
      top: 0.6rem;
      right: 0.6rem;
      z-index: 2;
      display: flex;
      gap: 0.3rem;
      padding: 0.25rem;
      border-radius: 999px;
      background: rgb(0 0 0 / 0.35);
      backdrop-filter: blur(6px);
    }

    .backdrop-button {
      width: 1.2rem;
      height: 1.2rem;
      padding: 0;
      border: 2px solid transparent;
      border-radius: 50%;
      cursor: pointer;
    }

    .backdrop-button[aria-pressed="true"] {
      border-color: var(--accent);
    }

    .backdrop-button[data-backdrop="checker"] {
      background: repeating-conic-gradient(#cfc8c2 0 25%, #fbf9f7 0 50%) 0 0 / 6px 6px;
    }

    .backdrop-button[data-backdrop="light"] {
      background: #f5f1ed;
    }

    .backdrop-button[data-backdrop="dark"] {
      background: #14110f;
      box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.3);
    }
  `];constructor(){super(),this.backdrop=D()}render(){return s`
      <div class="stage" data-backdrop=${this.backdrop}><slot></slot></div>
      <div class="backdrop-choice" role="group" aria-label="Preview background">
        ${g.map(e=>s`
          <button class="backdrop-button" type="button" data-backdrop=${e} aria-label="${e} background"
            aria-pressed=${String(e===this.backdrop)} @click=${()=>this.chooseBackdrop(e)}></button>
        `)}
      </div>
    `}chooseBackdrop(e){this.backdrop=e;try{localStorage.setItem(x,e)}catch{return}}}export function renderHandle({x:a,y:e,label:t,isSelected:r=!1,onPointerDown:n,onKeyDown:i,onDoubleClick:c}){return s`<button class="handle" type="button" aria-label=${t} aria-pressed=${String(r)}
    style="left: ${a}%; top: ${e}%" @pointerdown=${n} @keydown=${i} @dblclick=${c}></button>`}export function renderPresetSection(a,e,t=()=>k){return s`
    <section class="section">
      <h3 class="section-heading">Presets</h3>
      <div class="preset-list">
        ${a.map(r=>s`
          <button class="preset-button" type="button" title=${r.css} @click=${()=>e(r.css)}>
            ${t(r)}${r.label}
          </button>
        `)}
      </div>
    </section>
  `}export function replaceAt(a,e,t){return a.map((r,n)=>n===e?t:r)}export function removeAt(a,e){return a.filter((t,r)=>r!==e)}export function moveItem(a,e,t){const r=e+t;if(r<0||r>=a.length)return a;const n=[...a];return[n[e],n[r]]=[n[r],n[e]],n}export const handleStyles=o`
  .handle {
    position: absolute;
    z-index: 3;
    width: 0.95rem;
    height: 0.95rem;
    margin: -0.475rem 0 0 -0.475rem;
    padding: 0;
    border: 2px solid #fff;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 1px rgb(0 0 0 / 0.45), 0 2px 6px rgb(0 0 0 / 0.35);
    cursor: grab;
    touch-action: none;
  }

  .handle::after {
    content: "";
    position: absolute;
    inset: -0.6rem;
  }

  .handle[aria-pressed="true"] {
    background: #fff;
    border-color: var(--accent);
  }

  .handle:active {
    cursor: grabbing;
  }
`;export function renderOutlinePath(a){return y`<path d=${a} fill="none" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"></path>
    <path d=${a} fill="none" stroke="#000" stroke-width="1" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"></path>`}function N(a){const[,e=""]=String(a).split(".");return e.length}function D(){try{const a=localStorage.getItem(x);return g.includes(a)?a:g[0]}catch{return g[0]}}customElements.define("scrub-number",ScrubNumber),customElements.define("segmented-choice",SegmentedChoice),customElements.define("xy-pad",XyPad),customElements.define("angle-dial",AngleDial),customElements.define("preview-stage",PreviewStage);
