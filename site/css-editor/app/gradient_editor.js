import{LitElement as j,html as p,css as K,nothing as u}from"lit";import{editorStyles as X}from"./editor_styles.js";import{renderPresetSection as Y,renderHandle as H,handleStyles as B}from"./editor_controls.js";import{splitTopLevel as F,splitWhitespace as w,parseAngleDegrees as b,parseNumberWithUnit as U,parsePosition as W,formatNumber as m,roundTo as h,clamp as f}from"./css_value_syntax.js";import{parseColor as q,formatColor as x,mixColors as Z,COLOR_FORMATS as $}from"./color_model.js";import{trackPointerDrag as E,arrowKeyDelta as A,emitEvent as V}from"./pointer_tracking.js";const l=Object.freeze({LINEAR:"linear",RADIAL:"radial",CONIC:"conic"}),S=Object.freeze({ELLIPSE:"ellipse",CIRCLE:"circle"}),y=Object.freeze(["farthest-corner","farthest-side","closest-corner","closest-side"]),L=y[0],N=180,C=50,J=360,I=2,D=Object.freeze(["","srgb","srgb-linear","oklab","oklch","lab","lch","hsl","hwb","display-p3"]),T=Object.freeze(["oklch","lch","hsl","hwb"]),O=Object.freeze(["","shorter","longer","increasing","decreasing"]),Q=/^(repeating-)?(linear|radial|conic)-gradient\(([\s\S]*)\)$/i,R=Object.freeze({top:0,right:90,bottom:180,left:270,"top right":45,"right top":45,"bottom right":135,"right bottom":135,"bottom left":225,"left bottom":225,"top left":315,"left top":315}),P=[{label:"Sunset",css:"linear-gradient(135deg, #ff8a3d 0%, #ff3d77 50%, #7c3aed 100%)"},{label:"Ocean",css:"linear-gradient(#0ea5e9, #1e3a8a)"},{label:"Vivid OKLCH",css:"linear-gradient(90deg in oklch, #ff0080, #00e5ff)"},{label:"Rainbow",css:"linear-gradient(90deg in hsl longer hue, #ff0000, #ff0000)"},{label:"Spotlight",css:"radial-gradient(circle at 30% 30%, #fff7ed 0%, #fb923c 35%, #7c2d12 100%)"},{label:"Color wheel",css:"conic-gradient(#ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)"},{label:"Pie chart",css:"conic-gradient(#ff8a3d 0% 35%, #3d8bff 35% 70%, #4ade80 70% 100%)"},{label:"Stripes",css:"repeating-linear-gradient(45deg, #1c1612 0 10px, #ff8a3d 10px 20px)"},{label:"Rings",css:"repeating-radial-gradient(circle, #3d8bff 0% 4%, #ede7e2 4% 8%)"}];let k=1;export const gradientDefinition={id:"gradient",label:"Gradient",group:"Color",properties:["background-image","background"],presets:P,parse:_,serialize:M,render:({model:s,colorFormat:e,onChange:t})=>p`<gradient-editor .model=${s} .colorFormat=${e}
    @model-change=${t}></gradient-editor>`};function _(s){const e=Q.exec(s.trim());if(!e)return null;const[,t,o,n]=e,i=o.toLowerCase(),r=F(n,","),c=G(r[0],i)!==null,a=c?{}:te(i,w(r[0]));if(!a)return null;const d=se(c?r:r.slice(1),i);return!d||d.length<I?null:{...ee(),...a,kind:i,isRepeating:!!t,stops:d}}function ee(){return{angle:N,sideKeyword:null,shape:S.ELLIPSE,size:L,centerX:C,centerY:C,fromAngle:0,interpolation:{space:"",hueMethod:""}}}function te(s,e){const t={};let o=0;for(;o<e.length;){const n=e[o].toLowerCase();if(n==="in"){const i=oe(e,o+1);if(!i)return null;t.interpolation=i.value,o=i.nextIndex}else if(n==="at"&&s!==l.LINEAR){const i=W(e,o+1);if(!i)return null;t.centerX=i.x,t.centerY=i.y,o=i.nextIndex}else if(n==="to"&&s===l.LINEAR){const i=ne(e,o+1);if(!i)return null;t.sideKeyword=i.keyword,t.angle=R[i.keyword],o=i.nextIndex}else if(n==="from"&&s===l.CONIC){const i=b(e[o+1]??"");if(i===null)return null;t.fromAngle=i,o+=2}else if(s===l.RADIAL&&Object.values(S).includes(n))t.shape=n,o+=1;else if(s===l.RADIAL&&y.includes(n))t.size=n,o+=1;else if(s===l.LINEAR&&b(n)!==null)t.angle=b(n),o+=1;else return null}return t}function oe(s,e){const t=s[e]?.toLowerCase();if(!t||!D.includes(t))return null;const o=s[e+1]?.toLowerCase(),n=O.includes(o)&&s[e+2]?.toLowerCase()==="hue";return{value:{space:t,hueMethod:n?o:""},nextIndex:e+(n?3:1)}}function ne(s,e){const t=s.slice(e,e+2).join(" ").toLowerCase();if(t in R&&t.includes(" "))return{keyword:t,nextIndex:e+2};const o=s[e]?.toLowerCase();return o in R?{keyword:o,nextIndex:e+1}:null}function G(s,e){const[t,...o]=w(s),n=q(t??"");if(!n||o.length>2)return null;if(o.length===0)return[{color:n,position:null}];const i=o.map(r=>ie(r,e));return i.includes(null)?null:i.map(r=>({color:n,position:r}))}function ie(s,e){const t=U(s);if(!t)return null;if(t.unit==="%")return t.number;if(t.unit===""&&t.number===0)return 0;if(t.unit==="px"&&e!==l.CONIC)return{pixels:t.number};if(e===l.CONIC){const o=b(s);return o===null?null:o/J*100}return null}function se(s,e){const t=[];for(const a of s){const d=G(a,e);if(!d)return null;t.push(...d)}const o=t.some(a=>typeof a.position=="object"&&a.position!==null),n=t.some(a=>typeof a.position=="number"&&a.position!==0);if(o&&n)return null;const i=o?"px":"%",r=t.map(a=>typeof a.position=="object"&&a.position!==null?a.position.pixels:a.position),c=re(r,i);return t.map((a,d)=>({id:k++,color:a.color,position:c[d],unit:i}))}function re(s,e){const t=[...s],o=t.length-1;t[0]===null&&(t[0]=0),t[o]===null&&(t[o]=e==="%"?100:Math.max(0,...t.filter(i=>i!==null)));let n=0;for(let i=1;i<=o;i+=1){if(t[i]===null)continue;const r=i-n;for(let c=n+1;c<i;c+=1){const a=(c-n)/r;t[c]=t[n]+(t[i]-t[n])*a}n=i}return t.map(i=>h(i,2))}function M(s,e){const t=`${s.isRepeating?"repeating-":""}${s.kind}-gradient`,o=v(s.stops).map(i=>`${x(i.color,e)} ${z(i)}`),n=ae(s);return`${t}(${[n,...o].filter(Boolean).join(", ")})`}function ae(s){const e=[];s.kind===l.LINEAR&&(s.sideKeyword?e.push(`to ${s.sideKeyword}`):s.angle!==N&&e.push(`${m(s.angle,1)}deg`)),s.kind===l.RADIAL&&(s.shape===S.CIRCLE&&e.push(S.CIRCLE),s.size!==L&&e.push(s.size)),s.kind===l.CONIC&&s.fromAngle!==0&&e.push(`from ${m(s.fromAngle,1)}deg`);const t=s.centerX===C&&s.centerY===C;return s.kind!==l.LINEAR&&!t&&e.push(`at ${m(s.centerX,1)}% ${m(s.centerY,1)}%`),s.interpolation.space&&e.push(le(s.interpolation)),e.join(" ")}function le({space:s,hueMethod:e}){return e&&T.includes(s)?`in ${s} ${e} hue`:`in ${s}`}function z(s){return s.position===0?"0":`${m(s.position,2)}${s.unit}`}function v(s){return[...s].sort((e,t)=>e.position-t.position)}function ce(s,e){const t=v(s),o=t.findIndex(c=>c.position>=e);if(o===-1)return{...t.at(-1).color};if(o===0)return{...t[0].color};const n=t[o-1],i=t[o],r=i.position-n.position;return Z(n.color,i.color,r===0?0:(e-n.position)/r)}function g(s){return s[0]?.unit!=="px"?100:Math.max(100,...s.map(e=>e.position))}class pe extends j{static properties={model:{attribute:!1},colorFormat:{},selectedStopId:{state:!0}};static styles=[X,B,K`
    .gradient-box {
      position: relative;
      width: min(100%, 40rem);
      aspect-ratio: 16 / 10;
      border-radius: 14px;
      box-shadow: 0 0 0 1px rgb(0 0 0 / 0.08), 0 12px 32px rgb(0 0 0 / 0.18);
    }

    .stops-bar {
      position: relative;
      height: 1.6rem;
      margin: 0 0.5rem 1.4rem;
      border-radius: 6px;
      background: var(--bar-gradient), var(--checkerboard);
      box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.15);
      cursor: copy;
      touch-action: none;
    }

    .stop-handle {
      position: absolute;
      top: calc(100% + 0.15rem);
      width: 1.1rem;
      height: 1.1rem;
      margin-left: -0.55rem;
      padding: 0;
      border: 2px solid var(--surface);
      border-radius: 4px;
      background: linear-gradient(var(--stop-color), var(--stop-color)), var(--checkerboard);
      box-shadow: 0 0 0 1px var(--line);
      cursor: grab;
      touch-action: none;
    }

    .stop-handle::before {
      content: "";
      position: absolute;
      left: 50%;
      bottom: 100%;
      width: 2px;
      height: 1rem;
      background: var(--muted);
      transform: translateX(-50%);
    }

    .stop-handle[aria-pressed="true"] {
      box-shadow: 0 0 0 2px var(--accent);
    }

    .stop-handle[aria-pressed="true"]::before {
      background: var(--accent);
    }

    .angle-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .angle-row scrub-number {
      flex: 1;
      min-width: 0;
      grid-template-columns: 3rem minmax(0, 1fr) 4.2rem;
    }

    select {
      flex: 1;
      min-width: 0;
    }
  `];constructor(){super(),this.selectedStopId=null,this.colorFormat=$.HEX}willUpdate(){const e=this.model?.stops.some(t=>t.id===this.selectedStopId);this.model&&!e&&(this.selectedStopId=this.model.stops[0]?.id??null)}render(){if(!this.model)return u;const e=M(this.model,$.RGB),t=this.model.kind!==l.LINEAR;return p`
      <div class="preview">
        <preview-stage>
          <div class="gradient-box" style="background-image: ${e}">
            ${t?H({x:this.model.centerX,y:this.model.centerY,label:"Gradient center",onPointerDown:o=>this.startCenterDrag(o),onKeyDown:o=>this.nudgeCenter(o)}):u}
          </div>
        </preview-stage>
      </div>
      <div class="controls">
        ${Y(P,o=>this.emitModel(_(o)))}
        ${this.renderTypeSection()}
        ${this.renderStopsSection()}
      </div>
    `}renderTypeSection(){const{kind:e,isRepeating:t,interpolation:o}=this.model;return p`
      <section class="section">
        <h3 class="section-heading">Type</h3>
        <div class="row">
          <segmented-choice label="Gradient type" .value=${e}
            .options=${[{value:"linear",label:"Linear"},{value:"radial",label:"Radial"},{value:"conic",label:"Conic"}]}
            @value-change=${n=>this.applyChanges({kind:n.detail})}></segmented-choice>
          <button class="button" type="button" aria-pressed=${String(t)}
            @click=${()=>this.applyChanges({isRepeating:!t})}>Repeating</button>
        </div>
        ${e===l.LINEAR?this.renderAngleRow("Angle",this.model.angle,n=>this.applyChanges({angle:n,sideKeyword:null})):u}
        ${e===l.CONIC?this.renderAngleRow("From",this.model.fromAngle,n=>this.applyChanges({fromAngle:n})):u}
        ${e===l.RADIAL?this.renderRadialShapeControls():u}
        ${e!==l.LINEAR?p`
          <scrub-number label="Center X" unit="%" min="0" max="100" .value=${this.model.centerX}
            @value-change=${n=>this.applyChanges({centerX:n.detail})}></scrub-number>
          <scrub-number label="Center Y" unit="%" min="0" max="100" .value=${this.model.centerY}
            @value-change=${n=>this.applyChanges({centerY:n.detail})}></scrub-number>
        `:u}
        <div class="row">
          <span class="row-label">Blend in</span>
          <select aria-label="Interpolation color space" @change=${n=>this.applyChanges({interpolation:{...o,space:n.target.value}})}>
            ${D.map(n=>p`<option value=${n} ?selected=${n===o.space}>${n||"default (sRGB)"}</option>`)}
          </select>
        </div>
        ${T.includes(o.space)?p`
          <div class="row">
            <span class="row-label">Hue path</span>
            <select aria-label="Hue interpolation" @change=${n=>this.applyChanges({interpolation:{...o,hueMethod:n.target.value}})}>
              ${O.map(n=>p`<option value=${n} ?selected=${n===o.hueMethod}>${n||"shorter (default)"}</option>`)}
            </select>
          </div>
        `:u}
      </section>
    `}renderAngleRow(e,t,o){return p`
      <div class="angle-row">
        <angle-dial label=${e} .angle=${t} @value-change=${n=>o(n.detail)}></angle-dial>
        <scrub-number label=${e} unit="deg" min="0" max="360" .value=${h(t,1)}
          @value-change=${n=>o(n.detail)}></scrub-number>
      </div>
    `}renderRadialShapeControls(){return p`
      <div class="row">
        <span class="row-label">Shape</span>
        <segmented-choice label="Radial shape" .value=${this.model.shape}
          .options=${[{value:"ellipse",label:"Ellipse"},{value:"circle",label:"Circle"}]}
          @value-change=${e=>this.applyChanges({shape:e.detail})}></segmented-choice>
      </div>
      <div class="row">
        <span class="row-label">Size</span>
        <select aria-label="Radial size" @change=${e=>this.applyChanges({size:e.target.value})}>
          ${y.map(e=>p`<option value=${e} ?selected=${e===this.model.size}>${e}</option>`)}
        </select>
      </div>
    `}renderStopsSection(){const{stops:e}=this.model,t=g(e),o=v(e).map(i=>`${x(i.color,$.RGB)} ${i.position/t*100}%`),n=e.find(i=>i.id===this.selectedStopId);return p`
      <section class="section">
        <h3 class="section-heading">
          Color stops
          <span class="row">
            <button class="button button--small" type="button" @click=${this.reverseStops}>Reverse</button>
            <button class="button button--small" type="button" @click=${this.spaceStopsEvenly}>Even</button>
          </span>
        </h3>
        <div class="stops-bar" style="--bar-gradient: linear-gradient(to right, ${o.join(", ")})"
          title="Click to add a stop" @pointerdown=${this.addStopAtPointer}>
          ${e.map(i=>p`
            <button class="stop-handle" type="button" style="left: ${i.position/t*100}%; --stop-color: ${x(i.color,$.RGB)}"
              aria-label="Color stop at ${z(i)}" aria-pressed=${String(i.id===this.selectedStopId)}
              @pointerdown=${r=>this.startStopDrag(r,i.id)} @keydown=${r=>this.handleStopKey(r,i)}></button>
          `)}
        </div>
        <p class="hint">Click the bar to add a stop, drag stops to move them, press Delete to remove the selected one.</p>
        ${n?p`
          <color-field label="Stop color" .color=${n.color} .colorFormat=${this.colorFormat}
            @color-change=${i=>this.updateStop(n.id,{color:i.detail})}></color-field>
          <scrub-number label="Position" unit=${n.unit} min="0" max=${t} step="0.5" .value=${n.position}
            @value-change=${i=>this.updateStop(n.id,{position:i.detail})}></scrub-number>
          <div class="row">
            <button class="button" type="button" ?disabled=${e.length<=I}
              @click=${()=>this.removeStop(n.id)}>Remove stop</button>
          </div>
        `:u}
      </section>
    `}startCenterDrag(e){const t=this.renderRoot.querySelector(".gradient-box");e.currentTarget.focus(),E(e,t,o=>{this.applyChanges({centerX:h(f(o.x,0,1)*100,1),centerY:h(f(o.y,0,1)*100,1)})},{isImmediate:!1})}nudgeCenter(e){const t=A(e);t&&(e.preventDefault(),this.applyChanges({centerX:f(this.model.centerX+t.x,0,100),centerY:f(this.model.centerY+t.y,0,100)}))}addStopAtPointer(e){if(e.target!==e.currentTarget||e.button!==0)return;const t=e.currentTarget,o=g(this.model.stops),n=f((e.clientX-t.getBoundingClientRect().left)/t.clientWidth,0,1),i=h(n*o,1),r=this.model.stops[0].unit,c={id:k++,color:ce(this.model.stops,i),position:i,unit:r};this.selectedStopId=c.id,this.applyChanges({stops:[...this.model.stops,c]}),this.startStopDrag(e,c.id)}startStopDrag(e,t){e.stopPropagation(),this.selectedStopId=t;const o=this.renderRoot.querySelector(".stops-bar"),n=g(this.model.stops);E(e,o,i=>{this.updateStop(t,{position:h(f(i.x,0,1)*n,1)})},{isImmediate:!1})}handleStopKey(e,t){if(this.selectedStopId=t.id,e.key==="Delete"||e.key==="Backspace"){e.preventDefault(),this.removeStop(t.id);return}const o=A(e);o&&(e.preventDefault(),this.updateStop(t.id,{position:f(t.position+(o.x||-o.y),0,g(this.model.stops))}))}removeStop(e){this.model.stops.length<=I||this.applyChanges({stops:this.model.stops.filter(t=>t.id!==e)})}reverseStops(){const e=g(this.model.stops);this.applyChanges({stops:this.model.stops.map(t=>({...t,position:h(e-t.position,2)}))})}spaceStopsEvenly(){const e=g(this.model.stops),t=this.model.stops.length-1,o=v(this.model.stops);this.applyChanges({stops:o.map((n,i)=>({...n,position:h(i/t*e,2)}))})}updateStop(e,t){this.applyChanges({stops:this.model.stops.map(o=>o.id===e?{...o,...t}:o)})}applyChanges(e){this.emitModel({...this.model,...e})}emitModel(e){V(this,"model-change",e)}}customElements.define("gradient-editor",pe);
