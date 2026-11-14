import{LitElement as v,html as l,css as m,nothing as n}from"lit";import{baseStyles as x,checkerboardStyles as f}from"./editor_styles.js";import{trackPointerDrag as h,arrowKeyDelta as c,emitEvent as d}from"./pointer_tracking.js";import{clamp as e}from"./css_value_syntax.js";import{parseColor as $,formatColor as i,colorsAreEqual as w,rgbToHsv as E,hsvToRgb as g,COLOR_FORMATS as o}from"./color_model.js";const u=360,b=.01,y=.1;export class ColorPicker extends v{static properties={color:{attribute:!1},hsv:{state:!0}};static styles=[x,f,m`
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .saturation-value {
      position: relative;
      height: 9.5rem;
      border-radius: 8px;
      background-image: linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent);
      touch-action: none;
      cursor: crosshair;
      user-select: none;
    }

    .thumb {
      position: absolute;
      width: 0.9rem;
      height: 0.9rem;
      border: 2px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 0 1px rgb(0 0 0 / 0.5), 0 1px 4px rgb(0 0 0 / 0.4);
      transform: translate(-50%, -50%);
      pointer-events: none;
    }

    .slider-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .sliders {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .track {
      position: relative;
      height: 0.8rem;
      border-radius: 999px;
      touch-action: none;
      cursor: pointer;
      user-select: none;
    }

    .track .thumb {
      top: 50%;
    }

    .hue-track {
      background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
    }

    .alpha-track {
      background: linear-gradient(to right, transparent, var(--opaque)), var(--checkerboard);
      background-size: auto, 8px 8px;
    }

    .current {
      width: 2rem;
      height: 2rem;
      flex: none;
      border-radius: 8px;
      background: linear-gradient(var(--current), var(--current)), var(--checkerboard);
      box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.2);
    }
  `];render(){if(!this.color||!this.hsv)return n;const{hue:t,saturation:r,value:a}=this.hsv,s=i({...this.color,alpha:1},o.RGB),p=i(this.color,o.RGB);return l`
      <div class="saturation-value" style="background-color: hsl(${t} 100% 50%)" role="slider" tabindex="0"
        aria-label="Saturation and brightness" aria-valuetext="saturation ${Math.round(r*100)}%, brightness ${Math.round(a*100)}%"
        @pointerdown=${this.startSaturationValueDrag} @keydown=${this.handleSaturationValueKey}>
        <span class="thumb" style="left: ${r*100}%; top: ${(1-a)*100}%; background: ${s}"></span>
      </div>
      <div class="slider-row">
        <div class="sliders">
          <div class="track hue-track" role="slider" tabindex="0" aria-label="Hue" aria-valuemin="0" aria-valuemax="360"
            aria-valuenow=${Math.round(t)} @pointerdown=${this.startHueDrag} @keydown=${this.handleHueKey}>
            <span class="thumb" style="left: ${t/u*100}%; background: hsl(${t} 100% 50%)"></span>
          </div>
          <div class="track alpha-track" style="--opaque: ${s}" role="slider" tabindex="0" aria-label="Opacity"
            aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(this.color.alpha*100)}
            @pointerdown=${this.startAlphaDrag} @keydown=${this.handleAlphaKey}>
            <span class="thumb" style="left: ${this.color.alpha*100}%; background: ${p}"></span>
          </div>
        </div>
        <span class="current" style="--current: ${p}" aria-hidden="true"></span>
      </div>
    `}willUpdate(t){if(!t.has("color")||!this.color||this.hsv&&w(g(this.hsv,this.color.alpha),this.color))return;const r=E(this.color);if(!this.hsv){this.hsv=r;return}const a=r.value===0,s=r.saturation===0;this.hsv={hue:a||s?this.hsv.hue:r.hue,saturation:a?this.hsv.saturation:r.saturation,value:r.value}}startSaturationValueDrag(t){t.currentTarget.focus(),h(t,t.currentTarget,r=>{this.updateHsv({saturation:e(r.x,0,1),value:e(1-r.y,0,1)})})}startHueDrag(t){t.currentTarget.focus(),h(t,t.currentTarget,r=>{this.updateHsv({hue:e(r.x,0,1)*u})})}startAlphaDrag(t){t.currentTarget.focus(),h(t,t.currentTarget,r=>{this.emitColor({...this.color,alpha:Math.round(e(r.x,0,1)*100)/100})})}handleSaturationValueKey(t){const r=c(t,{step:b,largeStep:y});r&&(t.preventDefault(),this.updateHsv({saturation:e(this.hsv.saturation+r.x,0,1),value:e(this.hsv.value-r.y,0,1)}))}handleHueKey(t){const r=c(t);r&&(t.preventDefault(),this.updateHsv({hue:e(this.hsv.hue+(r.x||-r.y),0,u)}))}handleAlphaKey(t){const r=c(t,{step:b,largeStep:y});if(!r)return;t.preventDefault();const a=Math.round(e(this.color.alpha+(r.x||-r.y),0,1)*100)/100;this.emitColor({...this.color,alpha:a})}updateHsv(t){this.hsv={...this.hsv,...t},this.emitColor(g(this.hsv,this.color.alpha))}emitColor(t){d(this,"color-change",t)}}export class ColorField extends v{static properties={label:{},color:{attribute:!1},colorFormat:{},isExpanded:{type:Boolean,reflect:!0,attribute:"expanded"},isTextInvalid:{state:!0}};static styles=[x,f,m`
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .field {
      display: grid;
      grid-template-columns: 5.5rem 1.9rem minmax(0, 1fr);
      align-items: center;
      gap: 0.5rem;
    }

    .label {
      color: var(--muted);
    }

    .swatch {
      width: 1.9rem;
      height: 1.9rem;
      padding: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: linear-gradient(var(--swatch), var(--swatch)), var(--checkerboard);
      cursor: pointer;
    }

    :host([expanded]) .swatch {
      border-color: var(--accent);
    }

    .text-input {
      width: 100%;
      min-width: 0;
    }

    color-picker {
      padding: 0.6rem;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--bg);
    }

    :host([hide-label]) .field {
      grid-template-columns: 1.9rem minmax(0, 1fr);
    }

    :host([hide-label]) .label {
      display: none;
    }
  `];constructor(){super(),this.label="Color",this.colorFormat=o.HEX,this.isExpanded=!1,this.isTextInvalid=!1}render(){return this.color?l`
      <div class="field">
        <span class="label">${this.label}</span>
        <button class="swatch" type="button" style="--swatch: ${i(this.color,o.RGB)}"
          aria-label="${this.isExpanded?"Close":"Open"} ${this.label} picker" aria-expanded=${String(this.isExpanded)}
          @click=${()=>{this.isExpanded=!this.isExpanded}}></button>
        <input class="text-input" spellcheck="false" aria-label=${this.label} aria-invalid=${String(this.isTextInvalid)}
          @input=${this.handleTextInput} @blur=${this.syncTextInput}>
      </div>
      ${this.isExpanded?l`<color-picker .color=${this.color} @color-change=${this.forwardColor}></color-picker>`:n}
    `:n}updated(){const t=this.renderRoot.querySelector(".text-input");t&&this.renderRoot.activeElement!==t&&this.syncTextInput()}syncTextInput(){const t=this.renderRoot.querySelector(".text-input");t&&(t.value=i(this.color,this.colorFormat),this.isTextInvalid=!1)}handleTextInput(t){const r=$(t.target.value);this.isTextInvalid=!r,r&&d(this,"color-change",r)}forwardColor(t){d(this,"color-change",t.detail)}}customElements.define("color-picker",ColorPicker),customElements.define("color-field",ColorField);
