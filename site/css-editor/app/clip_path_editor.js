import{LitElement as O,html as c,css as w,nothing as f}from"lit";import{editorStyles as k}from"./editor_styles.js";import{renderPresetSection as M,renderHandle as C,handleStyles as A,renderOutlinePath as H,replaceAt as P,removeAt as z}from"./editor_controls.js";import{splitTopLevel as _,splitWhitespace as v,parsePercent as x,parsePixels as j,parsePosition as Z,parseFunctionCall as U,compressBoxValues as W,formatNumber as E,roundTo as I,clamp as d}from"./css_value_syntax.js";import{trackPointerDrag as S,arrowKeyDelta as R,relativePointerPosition as F,emitEvent as Y}from"./pointer_tracking.js";const o=Object.freeze({POLYGON:"polygon",CIRCLE:"circle",ELLIPSE:"ellipse",INSET:"inset"}),p=Object.freeze({NONZERO:"nonzero",EVENODD:"evenodd"}),y=3,m=5,b=1,u=50,D=[{label:"Star",css:"polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)"},{label:"Triangle",css:"polygon(50% 0%, 100% 100%, 0% 100%)"},{label:"Trapezoid",css:"polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)"},{label:"Parallelogram",css:"polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%)"},{label:"Rhombus",css:"polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)"},{label:"Pentagon",css:"polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)"},{label:"Hexagon",css:"polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)"},{label:"Octagon",css:"polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)"},{label:"Arrow",css:"polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)"},{label:"Chevron",css:"polygon(75% 0%, 100% 50%, 75% 100%, 0% 100%, 25% 50%, 0% 0%)"},{label:"Plus",css:"polygon(35% 0%, 65% 0%, 65% 35%, 100% 35%, 100% 65%, 65% 65%, 65% 100%, 35% 100%, 35% 65%, 0% 65%, 0% 35%, 35% 35%)"},{label:"Speech bubble",css:"polygon(0% 0%, 100% 0%, 100% 75%, 75% 75%, 75% 100%, 50% 75%, 0% 75%)"},{label:"Circle",css:"circle(50% at 50% 50%)"},{label:"Ellipse",css:"ellipse(30% 45% at 50% 50%)"},{label:"Inset",css:"inset(10% 15% round 24px)"}],G=Object.freeze({fillRule:p.NONZERO,points:[{x:50,y:0},{x:100,y:100},{x:0,y:100}],circle:{radius:40,centerX:u,centerY:u},ellipse:{radiusX:35,radiusY:45,centerX:u,centerY:u},inset:{top:10,right:10,bottom:10,left:10,roundRadius:0}});export const clipPathDefinition={id:"clip-path",label:"Clip path",group:"Shape",properties:["clip-path"],presets:D,parse:L,serialize:T,render:({model:i,onChange:e})=>c`<clip-path-editor .model=${i} @model-change=${e}></clip-path-editor>`};function L(i){const e=U(i);if(!e)return null;const n=structuredClone({...G,shape:e.name}),s={[o.POLYGON]:K,[o.CIRCLE]:B,[o.ELLIPSE]:q,[o.INSET]:V}[e.name];if(!s)return null;const l=s(e.argumentsText);return l?{...n,...l}:null}function K(i){const e=_(i,","),n=e[0].toLowerCase(),t=Object.values(p).includes(n),s=(t?e.slice(1):e).map(l=>{const r=v(l).map(x);return r.length===2&&!r.includes(null)?{x:r[0],y:r[1]}:null});return s.length<y||s.includes(null)?null:{points:s,fillRule:t?n:p.NONZERO}}function B(i){const e=X(i,1);return e?{circle:{radius:e.radii[0]??u,centerX:e.centerX,centerY:e.centerY}}:null}function q(i){const e=X(i,2);if(!e||e.radii.length===1)return null;const[n=u,t=u]=e.radii;return{ellipse:{radiusX:n,radiusY:t,centerX:e.centerX,centerY:e.centerY}}}function X(i,e){const n=v(i),t=n.findIndex(a=>a.toLowerCase()==="at"),s=t===-1?n:n.slice(0,t);if(s.length>e)return null;const l=s.map(x);if(l.includes(null))return null;if(t===-1)return{radii:l,centerX:u,centerY:u};const r=Z(n,t+1);return!r||r.nextIndex!==n.length?null:{radii:l,centerX:r.x,centerY:r.y}}function V(i){const e=v(i),n=e.findIndex(h=>h.toLowerCase()==="round"),s=(n===-1?e:e.slice(0,n)).map(x);if(s.length===0||s.length>4||s.includes(null))return null;const[l,r=l,a=l,g=r]=s;let $=0;if(n!==-1){const h=e.slice(n+1);if($=h.length===1?j(h[0]):null,$===null)return null}return{inset:{top:l,right:r,bottom:a,left:g,roundRadius:$}}}function T(i){const e=n=>`${E(n,b)}%`;switch(i.shape){case o.CIRCLE:{const{radius:n,centerX:t,centerY:s}=i.circle;return`circle(${e(n)} at ${e(t)} ${e(s)})`}case o.ELLIPSE:{const{radiusX:n,radiusY:t,centerX:s,centerY:l}=i.ellipse;return`ellipse(${e(n)} ${e(t)} at ${e(s)} ${e(l)})`}case o.INSET:{const{top:n,right:t,bottom:s,left:l,roundRadius:r}=i.inset,a=W([n,t,s,l]).map(e).join(" ");return r>0?`inset(${a} round ${E(r)}px)`:`inset(${a})`}default:return`polygon(${i.fillRule===p.EVENODD?"evenodd, ":""}${i.points.map(t=>`${e(t.x)} ${e(t.y)}`).join(", ")})`}}function J(i,e){let n=0,t=1/0;return i.forEach((s,l)=>{const r=i[(l+1)%i.length],a=Q(e,s,r);a<t&&(t=a,n=l)}),n}function Q(i,e,n){const t=n.x-e.x,s=n.y-e.y,l=t*t+s*s,r=l===0?0:d(((i.x-e.x)*t+(i.y-e.y)*s)/l,0,1);return Math.hypot(i.x-(e.x+r*t),i.y-(e.y+r*s))}class ee extends O{static properties={model:{attribute:!1},selectedPointIndex:{state:!0},isSnapping:{state:!0},canvasWidthPixels:{state:!0}};static styles=[k,A,w`
    .canvas {
      position: relative;
      width: min(28rem, 100%);
      aspect-ratio: 1;
      user-select: none;
    }

    .ghost, .clipped {
      position: absolute;
      inset: 0;
      background: url("/site/media/hero-poster.jpg") center / cover, linear-gradient(135deg, #ff8a3d, #7c3aed);
    }

    .ghost {
      opacity: 0.22;
      border-radius: 4px;
    }

    .outline {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      overflow: visible;
      pointer-events: none;
    }

    .shape-thumbnail {
      width: 0.9rem;
      height: 0.9rem;
      background: var(--accent);
    }

    .point-editor {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
    }
  `];constructor(){super(),this.selectedPointIndex=0,this.isSnapping=!1,this.canvasWidthPixels=0,this.resizeObserver=new ResizeObserver(([e])=>{this.canvasWidthPixels=e.contentRect.width})}disconnectedCallback(){super.disconnectedCallback(),this.resizeObserver.disconnect()}firstUpdated(){this.resizeObserver.observe(this.renderRoot.querySelector(".canvas"))}willUpdate(){const e=Math.max(0,(this.model?.points.length??0)-1);this.selectedPointIndex>e&&(this.selectedPointIndex=e)}render(){return this.model?c`
      <div class="preview">
        <preview-stage>
          <div class="canvas" @dblclick=${this.insertPointAtPointer}>
            <div class="ghost"></div>
            <div class="clipped" style="clip-path: ${T(this.model)}"></div>
            <svg class="outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${H(this.outlinePathData())}</svg>
            ${this.renderHandles()}
          </div>
        </preview-stage>
      </div>
      <div class="controls">
        ${M(D,e=>this.applyPreset(e),e=>c`<span class="shape-thumbnail" style="clip-path: ${e.css}"></span>`)}
        <section class="section">
          <h3 class="section-heading">Shape</h3>
          <segmented-choice label="Clip shape" .value=${this.model.shape}
            .options=${[{value:"polygon",label:"Polygon"},{value:"circle",label:"Circle"},{value:"ellipse",label:"Ellipse"},{value:"inset",label:"Inset"}]}
            @value-change=${e=>this.applyChanges({shape:e.detail})}></segmented-choice>
          <label class="row"><input type="checkbox" .checked=${this.isSnapping} @change=${e=>{this.isSnapping=e.target.checked}}> Snap handles to ${m}% grid</label>
        </section>
        ${this.renderShapeControls()}
      </div>
    `:f}renderShapeControls(){switch(this.model.shape){case o.CIRCLE:return this.renderCircleControls();case o.ELLIPSE:return this.renderEllipseControls();case o.INSET:return this.renderInsetControls();default:return this.renderPolygonControls()}}renderPolygonControls(){const{points:e,fillRule:n}=this.model,t=e[this.selectedPointIndex],s=l=>this.applyChanges({points:P(e,this.selectedPointIndex,{...t,...l})});return c`
      <section class="section">
        <h3 class="section-heading">Points (${e.length})</h3>
        <p class="hint">Drag handles to reshape. Double-click the image to add a point on the nearest edge, double-click a handle to remove it.</p>
        ${t?c`
          <div class="point-editor">
            <scrub-number label="Point ${this.selectedPointIndex+1} X" unit="%" min="0" max="100" step="0.5" .value=${t.x}
              @value-change=${l=>s({x:l.detail})}></scrub-number>
            <scrub-number label="Point ${this.selectedPointIndex+1} Y" unit="%" min="0" max="100" step="0.5" .value=${t.y}
              @value-change=${l=>s({y:l.detail})}></scrub-number>
            <div class="row">
              <button class="button" type="button" @click=${()=>this.selectRelativePoint(-1)}>‹ Previous</button>
              <button class="button" type="button" @click=${()=>this.selectRelativePoint(1)}>Next ›</button>
              <button class="button" type="button" ?disabled=${e.length<=y}
                @click=${()=>this.removePoint(this.selectedPointIndex)}>Remove</button>
            </div>
          </div>
        `:f}
        <div class="row">
          <span class="row-label">Fill rule</span>
          <segmented-choice label="Fill rule" .value=${n}
            .options=${[{value:"nonzero",label:"nonzero"},{value:"evenodd",label:"evenodd"}]}
            @value-change=${l=>this.applyChanges({fillRule:l.detail})}></segmented-choice>
        </div>
      </section>
    `}renderCircleControls(){const e=this.model.circle,n=t=>this.applyChanges({circle:{...e,...t}});return c`
      <section class="section">
        <h3 class="section-heading">Circle</h3>
        <scrub-number label="Radius" unit="%" min="0" max="75" step="0.5" .value=${e.radius} @value-change=${t=>n({radius:Math.max(0,t.detail)})}></scrub-number>
        <scrub-number label="Center X" unit="%" min="0" max="100" step="0.5" .value=${e.centerX} @value-change=${t=>n({centerX:t.detail})}></scrub-number>
        <scrub-number label="Center Y" unit="%" min="0" max="100" step="0.5" .value=${e.centerY} @value-change=${t=>n({centerY:t.detail})}></scrub-number>
      </section>
    `}renderEllipseControls(){const e=this.model.ellipse,n=t=>this.applyChanges({ellipse:{...e,...t}});return c`
      <section class="section">
        <h3 class="section-heading">Ellipse</h3>
        <scrub-number label="Radius X" unit="%" min="0" max="100" step="0.5" .value=${e.radiusX} @value-change=${t=>n({radiusX:Math.max(0,t.detail)})}></scrub-number>
        <scrub-number label="Radius Y" unit="%" min="0" max="100" step="0.5" .value=${e.radiusY} @value-change=${t=>n({radiusY:Math.max(0,t.detail)})}></scrub-number>
        <scrub-number label="Center X" unit="%" min="0" max="100" step="0.5" .value=${e.centerX} @value-change=${t=>n({centerX:t.detail})}></scrub-number>
        <scrub-number label="Center Y" unit="%" min="0" max="100" step="0.5" .value=${e.centerY} @value-change=${t=>n({centerY:t.detail})}></scrub-number>
      </section>
    `}renderInsetControls(){const e=this.model.inset,n=t=>this.applyChanges({inset:{...e,...t}});return c`
      <section class="section">
        <h3 class="section-heading">Inset</h3>
        ${["top","right","bottom","left"].map(t=>c`
          <scrub-number label=${t[0].toUpperCase()+t.slice(1)} unit="%" min="0" max="100" step="0.5" .value=${e[t]}
            @value-change=${s=>n({[t]:d(s.detail,0,100)})}></scrub-number>
        `)}
        <scrub-number label="Round" unit="px" min="0" max="200" .value=${e.roundRadius}
          @value-change=${t=>n({roundRadius:Math.max(0,t.detail)})}></scrub-number>
      </section>
    `}renderHandles(){switch(this.model.shape){case o.CIRCLE:{const{radius:e,centerX:n,centerY:t}=this.model.circle;return[this.renderDragHandle({x:n,y:t,label:"Circle center"},s=>({circle:{...this.model.circle,centerX:s.x,centerY:s.y}})),this.renderDragHandle({x:n+e,y:t,label:"Circle radius"},s=>({circle:{...this.model.circle,radius:I(Math.hypot(s.x-this.model.circle.centerX,s.y-this.model.circle.centerY),b)}}))]}case o.ELLIPSE:{const{radiusX:e,radiusY:n,centerX:t,centerY:s}=this.model.ellipse;return[this.renderDragHandle({x:t,y:s,label:"Ellipse center"},l=>({ellipse:{...this.model.ellipse,centerX:l.x,centerY:l.y}})),this.renderDragHandle({x:t+e,y:s,label:"Ellipse horizontal radius"},l=>({ellipse:{...this.model.ellipse,radiusX:Math.abs(l.x-this.model.ellipse.centerX)}})),this.renderDragHandle({x:t,y:s+n,label:"Ellipse vertical radius"},l=>({ellipse:{...this.model.ellipse,radiusY:Math.abs(l.y-this.model.ellipse.centerY)}}))]}case o.INSET:{const{top:e,right:n,bottom:t,left:s}=this.model.inset,l=(s+100-n)/2,r=(e+100-t)/2;return[this.renderDragHandle({x:l,y:e,label:"Top inset"},a=>({inset:{...this.model.inset,top:a.y}})),this.renderDragHandle({x:100-n,y:r,label:"Right inset"},a=>({inset:{...this.model.inset,right:100-a.x}})),this.renderDragHandle({x:l,y:100-t,label:"Bottom inset"},a=>({inset:{...this.model.inset,bottom:100-a.y}})),this.renderDragHandle({x:s,y:r,label:"Left inset"},a=>({inset:{...this.model.inset,left:a.x}}))]}default:return this.model.points.map((e,n)=>C({x:e.x,y:e.y,label:`Point ${n+1}`,isSelected:n===this.selectedPointIndex,onPointerDown:t=>this.startPointDrag(t,n),onKeyDown:t=>this.handlePointKey(t,n),onDoubleClick:t=>{t.stopPropagation(),this.removePoint(n)}}))}}renderDragHandle({x:e,y:n,label:t},s){return C({x:e,y:n,label:t,onPointerDown:l=>{l.currentTarget.focus(),S(l,this.canvas,r=>this.applyChanges(s(this.toPercentPoint(r))),{isImmediate:!1})},onKeyDown:l=>{const r=R(l,{step:.5,largeStep:m});r&&(l.preventDefault(),this.applyChanges(s({x:e+r.x,y:n+r.y})))}})}outlinePathData(){switch(this.model.shape){case o.CIRCLE:{const{radius:e,centerX:n,centerY:t}=this.model.circle;return N(n,t,e,e)}case o.ELLIPSE:{const{radiusX:e,radiusY:n,centerX:t,centerY:s}=this.model.ellipse;return N(t,s,e,n)}case o.INSET:{const{top:e,right:n,bottom:t,left:s,roundRadius:l}=this.model.inset,r=Math.max(0,100-s-n),a=Math.max(0,100-e-t),g=Math.min(this.canvasWidthPixels?l/this.canvasWidthPixels*100:0,r/2,a/2);return te(s,e,r,a,g)}default:return`M ${this.model.points.map(e=>`${e.x} ${e.y}`).join(" L ")} Z`}}get canvas(){return this.renderRoot.querySelector(".canvas")}toPercentPoint(e){const n=this.isSnapping?m:10**-b,t=s=>I(Math.round(d(s,0,1)*100/n)*n,b);return{x:t(e.x),y:t(e.y)}}startPointDrag(e,n){this.selectedPointIndex=n,e.currentTarget.focus(),S(e,this.canvas,t=>{this.applyChanges({points:P(this.model.points,n,this.toPercentPoint(t))})},{isImmediate:!1})}handlePointKey(e,n){if(this.selectedPointIndex=n,e.key==="Delete"||e.key==="Backspace"){e.preventDefault(),this.removePoint(n);return}const t=R(e,{step:.5,largeStep:m});if(!t)return;e.preventDefault();const s=this.model.points[n],l={x:d(s.x+t.x,0,100),y:d(s.y+t.y,0,100)};this.applyChanges({points:P(this.model.points,n,l)})}insertPointAtPointer(e){if(this.model.shape!==o.POLYGON)return;const n=this.toPercentPoint(F(e,this.canvas)),t=J(this.model.points,n)+1,s=[...this.model.points.slice(0,t),n,...this.model.points.slice(t)];this.selectedPointIndex=t,this.applyChanges({points:s})}removePoint(e){this.model.points.length<=y||this.applyChanges({points:z(this.model.points,e)})}selectRelativePoint(e){const n=this.model.points.length;this.selectedPointIndex=(this.selectedPointIndex+e+n)%n}applyPreset(e){this.selectedPointIndex=0,Y(this,"model-change",L(e))}applyChanges(e){Y(this,"model-change",{...this.model,...e})}}function N(i,e,n,t){return`M ${i-n} ${e} a ${n} ${t} 0 1 0 ${n*2} 0 a ${n} ${t} 0 1 0 ${-n*2} 0 Z`}function te(i,e,n,t,s){return s<=0?`M ${i} ${e} h ${n} v ${t} h ${-n} Z`:`M ${i+s} ${e} h ${n-2*s} a ${s} ${s} 0 0 1 ${s} ${s} v ${t-2*s}
    a ${s} ${s} 0 0 1 ${-s} ${s} h ${-(n-2*s)} a ${s} ${s} 0 0 1 ${-s} ${-s}
    v ${-(t-2*s)} a ${s} ${s} 0 0 1 ${s} ${-s} Z`}customElements.define("clip-path-editor",ee);
