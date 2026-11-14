import{LitElement as w,html as g,css as y,nothing as C}from"lit";import{editorStyles as k}from"./editor_styles.js";import{renderPresetSection as A}from"./editor_controls.js";import{parseFunctionList as X,serializeFunctionList as b}from"./function_list_editor.js";import{splitTopLevel as x,parseNumberWithUnit as D,parsePixels as h,parseAngleDegrees as v,formatNumber as m,formatLength as l,roundTo as o}from"./css_value_syntax.js";import{emitEvent as $}from"./pointer_tracking.js";const S=Object.freeze({x:0,y:1}),c=[{name:"translate",label:"Translate",cssNames:["translate","translatex","translatey"],parameters:[{label:"X",unit:"px",min:-200,max:200,step:1,defaultValue:40},{label:"Y",unit:"px",min:-200,max:200,step:1,defaultValue:0}],parseCall:(e,t)=>d(e,t,h,0),formatCall:([e,t])=>`translate(${l(e,"px")}, ${l(t,"px")})`},p({name:"rotate",label:"Rotate",cssNames:["rotate","rotatez"],defaultValue:15}),{name:"scale",label:"Scale",cssNames:["scale","scalex","scaley"],parameters:[{label:"X",unit:"\xD7",min:0,max:3,step:.05,defaultValue:1.2},{label:"Y",unit:"\xD7",min:0,max:3,step:.05,defaultValue:1.2}],parseCall:(e,t)=>{const s=d(e,t,R,1);return s&&e==="scale"&&x(t,",").length===1&&(s[1]=s[0]),s},formatCall:([e,t])=>e===t?`scale(${m(e,3)})`:`scale(${m(e,3)}, ${m(t,3)})`},{name:"skew",label:"Skew",cssNames:["skew","skewx","skewy"],parameters:[{label:"X",unit:"deg",min:-70,max:70,step:1,defaultValue:10},{label:"Y",unit:"deg",min:-70,max:70,step:1,defaultValue:0}],parseCall:(e,t)=>d(e,t,v,0),formatCall:([e,t])=>`skew(${l(e,"deg")}, ${l(t,"deg")})`},p({name:"rotateX",label:"Rotate X (3D)",cssNames:["rotatex"],defaultValue:30}),p({name:"rotateY",label:"Rotate Y (3D)",cssNames:["rotatey"],defaultValue:30}),{name:"perspective",label:"Perspective",cssNames:["perspective"],parameters:[{label:"Distance",unit:"px",min:100,max:2e3,step:10,defaultValue:600}],parseCall:(e,t)=>{const s=h(t);return s===null||s<0?null:[s]},formatCall:([e])=>`perspective(${l(e,"px")})`}],N=[{label:"Tilted card",css:"perspective(800px) rotateX(20deg) rotateY(-25deg)"},{label:"Lift",css:"translate(0, -8px) scale(1.04)"},{label:"Slant",css:"skew(-12deg, 0)"},{label:"Spin",css:"rotate(45deg)"},{label:"Mirror",css:"scale(-1, 1)"},{label:"Isometric",css:"rotate(-30deg) skew(30deg, 0) scale(1, 0.86)"},{label:"Flip up",css:"perspective(600px) rotateX(55deg)"}];export const transformDefinition={id:"transform",label:"Transform",group:"Shape",properties:["transform"],presets:N,parse:e=>X(e,c),serialize:e=>b(e,c),render:({model:e,onChange:t})=>g`<transform-editor .model=${e} @model-change=${t}></transform-editor>`};function p({name:e,label:t,cssNames:s,defaultValue:n}){return{name:e,label:t,cssNames:s,parameters:[{label:"Angle",unit:"deg",min:-180,max:180,step:1,defaultValue:n}],parseCall:(a,i)=>{const r=v(i);return r===null?null:[o(r,2)]},formatCall:([a])=>`${e}(${l(a,"deg")})`}}function d(e,t,s,n){const a=x(t,","),i=e.at(-1);if(i in S){const u=a.length===1?s(a[0]):null;if(u===null)return null;const f=[n,n];return f[S[i]]=o(u,3),f}if(a.length>2)return null;const r=a.map(s);return r.includes(null)?null:[o(r[0],3),o(r[1]??n,3)]}function R(e){const t=D(e);return t?t.unit==="%"?t.number/100:t.unit===""?t.number:null:null}class T extends w{static properties={model:{attribute:!1}};static styles=[k,y`
    .scene {
      position: relative;
      width: 11rem;
      aspect-ratio: 1;
    }

    .ghost, .card {
      position: absolute;
      inset: 0;
      border-radius: 14px;
    }

    .ghost {
      border: 2px dashed currentColor;
      opacity: 0.35;
    }

    .card {
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, #ff8a3d, #ff3d77 55%, #7c3aed);
      color: #fff;
      font: 800 2.2rem/1 system-ui, -apple-system, "Segoe UI", sans-serif;
      box-shadow: 0 14px 34px rgb(0 0 0 / 0.25);
      transition: transform 0.08s linear;
    }
  `];render(){if(!this.model)return C;const t=b(this.model,c);return g`
      <div class="preview">
        <preview-stage>
          <div class="scene">
            <div class="ghost"></div>
            <div class="card" style="transform: ${t}">Aa</div>
          </div>
        </preview-stage>
      </div>
      <div class="controls">
        ${A(N,s=>$(this,"model-change",transformDefinition.parse(s)))}
        <section class="section">
          <function-list-controls heading="Functions, applied in order" .kinds=${c} .model=${this.model}
            @model-change=${s=>$(this,"model-change",s.detail)}></function-list-controls>
          <p class="hint">Order matters: each function transforms the result of the ones before it. Put perspective first for 3D rotations.</p>
        </section>
      </div>
    `}}customElements.define("transform-editor",T);
