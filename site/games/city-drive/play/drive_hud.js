// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar
const CITY_DRIVE_HUD_MARKUP=`
<div id="border-alert-overlay"></div>

<header class="hud-layer hud-header">
  <div class="hud-group hud-group-left hud-title-block">
    <span class="mono hud-title">City Drive</span>
    <span id="biome-label" class="mono hud-biome-label">Manhattan \u2022 Crisp Morning</span>
    <span id="street-label" class="mono hud-street-label">5TH AVENUE \u2022 BLOCK 1</span>
    <span id="intersection-guide" class="mono hud-intersection-guide scenery-metric-dist">NEXT CROSSROAD \u2022 STRAIGHT</span>
  </div>

  <div class="hud-header-controls">
    <button id="btn-camera" class="scenery-ctrl active-sky" title="Cycle Camera View (C)">
      <span class="scenery-ctrl-text"><span id="camera-label">Chase Cam</span> [C]</span>
      <div class="scenery-ctrl-line"></div>
    </button>
    <span class="hud-divider"></span>
    <div data-shell-toolbar class="hud-toolbar-slot"></div>
  </div>
</header>

<div class="hud-layer hud-group hud-group-left hud-side-panel hud-side-panel-left">
  <span class="hud-group-caption">DRIVE ASSIST</span>
  <button id="btn-cruise" class="scenery-ctrl scenery-ctrl--start" title="Toggle Cruise Control (X)">
    <span class="toggle-row">
      <span id="cruise-dot" class="toggle-dot"></span>
      <span class="scenery-ctrl-text scenery-ctrl-text--regular">CRUISE [X]</span>
    </span>
    <div class="scenery-ctrl-line"></div>
  </button>
  <button id="btn-autosteer" class="scenery-ctrl scenery-ctrl--start" title="Toggle Zen Auto-Steer (Z)">
    <span class="toggle-row">
      <span id="autosteer-dot" class="toggle-dot"></span>
      <span class="scenery-ctrl-text scenery-ctrl-text--regular">ZEN STEER [Z]</span>
    </span>
    <div class="scenery-ctrl-line"></div>
  </button>
  <button id="btn-traffic" class="scenery-ctrl scenery-ctrl--start" title="Toggle Other Vehicles & Pedestrians (T)">
    <span class="toggle-row">
      <span id="traffic-dot" class="toggle-dot"></span>
      <span class="scenery-ctrl-text scenery-ctrl-text--regular">TRAFFIC [T]</span>
    </span>
    <div class="scenery-ctrl-line"></div>
  </button>
  <button id="btn-reset-car" class="scenery-ctrl scenery-ctrl--start" title="Center car back on road (R)">
    <span class="toggle-row">
      <span class="toggle-dot is-spacer"></span>
      <span class="scenery-ctrl-text scenery-ctrl-text--regular">RESET ROAD [R]</span>
    </span>
    <div class="scenery-ctrl-line"></div>
  </button>
</div>

<div class="hud-layer hud-group hud-group-right hud-side-panel hud-side-panel-right">
  <span class="hud-group-caption">WEATHER [B]</span>
  <button class="biome-btn scenery-ctrl scenery-ctrl--end active-amber" data-biome="0"><span class="scenery-ctrl-text scenery-ctrl-text--small">Morning</span><div class="scenery-ctrl-line"></div></button>
  <button class="biome-btn scenery-ctrl scenery-ctrl--end" data-biome="1"><span class="scenery-ctrl-text scenery-ctrl-text--small">Noon</span><div class="scenery-ctrl-line"></div></button>
  <button class="biome-btn scenery-ctrl scenery-ctrl--end" data-biome="2"><span class="scenery-ctrl-text scenery-ctrl-text--small">Sunset</span><div class="scenery-ctrl-line"></div></button>
  <button class="biome-btn scenery-ctrl scenery-ctrl--end" data-biome="3"><span class="scenery-ctrl-text scenery-ctrl-text--small">Dusk</span><div class="scenery-ctrl-line"></div></button>
  <button class="biome-btn scenery-ctrl scenery-ctrl--end" data-biome="4"><span class="scenery-ctrl-text scenery-ctrl-text--small">Night</span><div class="scenery-ctrl-line"></div></button>
  <button class="biome-btn scenery-ctrl scenery-ctrl--end" data-biome="5"><span class="scenery-ctrl-text scenery-ctrl-text--small">Rain</span><div class="scenery-ctrl-line"></div></button>
  <button id="btn-auto-morph" class="scenery-ctrl scenery-ctrl--end active-emerald" title="Toggle Automatic Weather Morphing">
    <span class="scenery-ctrl-text scenery-ctrl-text--small">Morph:ON</span>
    <div class="scenery-ctrl-line"></div>
  </button>
</div>

<div id="mobile-touch-controls" class="touch-zone">
  <div class="hud-layer mobile-toggle-row">
    <button id="btn-mobile-cruise" class="scenery-ctrl scenery-ctrl--compact">
      <span class="toggle-row toggle-row--tight">
        <span id="mobile-cruise-dot" class="toggle-dot"></span>
        <span class="scenery-ctrl-text scenery-ctrl-text--tiny">CRUISE</span>
      </span>
      <div class="scenery-ctrl-line"></div>
    </button>

    <button id="btn-mobile-autosteer" class="scenery-ctrl scenery-ctrl--compact">
      <span class="toggle-row toggle-row--tight">
        <span id="mobile-autosteer-dot" class="toggle-dot"></span>
        <span class="scenery-ctrl-text scenery-ctrl-text--tiny">ZEN STEER</span>
      </span>
      <div class="scenery-ctrl-line"></div>
    </button>

    <button id="btn-mobile-weather" class="scenery-ctrl scenery-ctrl--compact active-amber">
      <span class="scenery-ctrl-text scenery-ctrl-text--tiny">WEATHER</span>
      <div class="scenery-ctrl-line"></div>
    </button>

    <button id="btn-mobile-reset" class="scenery-ctrl scenery-ctrl--compact">
      <span class="scenery-ctrl-text scenery-ctrl-text--tiny">RESET</span>
      <div class="scenery-ctrl-line"></div>
    </button>
  </div>

  <div class="mobile-pedal-row">
    <div id="touch-steer-pad" class="touch-zone steer-pad">
      <button id="touch-left" type="button" class="mobile-pedal pedal-steer">
        <span class="scenery-ctrl-text pedal-glyph">\u25C0</span>
        <span class="mono pedal-caption">LEFT</span>
      </button>
      <div class="steer-pad-center">
        <div id="touch-steer-knob" class="steer-knob"></div>
        <span class="mono steer-pad-caption">SLIDE</span>
      </div>
      <button id="touch-right" type="button" class="mobile-pedal pedal-steer">
        <span class="scenery-ctrl-text pedal-glyph">\u25B6</span>
        <span class="mono pedal-caption">RIGHT</span>
      </button>
    </div>

    <div class="touch-zone pedal-cluster">
      <button id="touch-handbrake" type="button" class="mobile-pedal pedal-drift">
        <span class="scenery-ctrl-text pedal-glyph">DRIFT</span>
        <span class="mono pedal-caption">HOLD</span>
      </button>
      <button id="touch-brake" type="button" class="mobile-pedal pedal-brake">
        <span class="scenery-ctrl-text pedal-glyph">\u25BC</span>
        <span class="mono pedal-caption">BRAKE</span>
      </button>
      <button id="touch-gas" type="button" class="mobile-pedal pedal-gas">
        <span class="scenery-ctrl-text pedal-glyph">\u25B2</span>
        <span class="mono pedal-caption">DRIVE</span>
      </button>
    </div>
  </div>
</div>

<canvas id="minimap-canvas" class="hud-layer"></canvas>

<footer class="hud-layer hud-footer">
  <div class="hud-footer-readouts">
    <div class="scenery-metric speed-readout">
      <div class="speed-readout-row">
        <span id="speed-value" class="mono speed-value scenery-metric-speed">0</span>
        <span class="mono speed-unit">KM/H</span>
        <span class="speed-separator">&bull;</span>
        <span id="distance-value" class="mono distance-value scenery-metric-dist">0.00 km</span>
      </div>
    </div>
    <div class="speed-bar-track">
      <div id="speed-bar" class="speed-bar" style="width: 0%"></div>
    </div>
    <div class="road-state">
      <span id="road-state-dot" class="road-state-dot is-road"></span>
      <span id="road-state-label" class="mono road-state-label">On Avenue</span>
    </div>
  </div>

  <div class="hud-footer-keys">
    <div class="hud-group hud-group-right key-legend">
      <span class="mono key-legend-line is-rose">[V] RECORD &bull; [N] STOP</span>
    </div>
  </div>
</footer>
`,HUD_FULL_SCALE_SPEED_KMH=240,SURFACE_LABELS={sidewalk:"On Sidewalk",lawn:"Cruising Park Lawn",plaza:"Plaza / Forecourt"},WATER_ZONE_SUFFIXES=[" \u2022 CONSERVATORY LAKE"," \u2022 CASCADE WATER PLAZA"," \u2022 YACHT MARINA"],FIELD_ZONE_SUFFIXES=[" \u2022 WILDFLOWER MEADOW"," \u2022 GOLDEN WHEAT FIELDS"," \u2022 OPEN PASTURE"],PARK_ZONE_SUFFIXES=[" \u2022 CHERRY BLOSSOM PARK"," \u2022 BETHESDA FOUNTAIN PARK"," \u2022 BOTANICAL GARDENS"],ROAD_STATE_DOT_CLASSES={collision:"road-state-dot is-collision",offRoad:"road-state-dot is-off-road",intersection:"road-state-dot is-intersection",road:"road-state-dot is-road"},TOGGLE_DOT_INACTIVE_CLASS="toggle-dot",TOGGLE_DOT_SKY_CLASS="toggle-dot is-sky",TOGGLE_DOT_EMERALD_CLASS="toggle-dot is-emerald",STEER_PAD_KNOB_TRAVEL_PIXELS=18,STEER_PAD_MIN_HALF_SPAN_PIXELS=24,STEER_PAD_HALF_SPAN_FRACTION=.42,STEER_PAD_HIGHLIGHT_THRESHOLD=.2,DRIVE_KEY_ACTIONS={KeyC:cycleCamera,KeyB:()=>selectBiome(environment.biomeIndex+1),KeyT:toggleTrafficAndPeople,KeyZ:toggleAutoSteer,KeyX:toggleCruiseHold,KeyR:resetCarToRoad,KeyQ:()=>toggleTurnIntent(-1),KeyE:()=>toggleTurnIntent(1)},cityDriveHud=mountDriveHud(),hudElements={speedValue:document.getElementById("speed-value"),speedBar:document.getElementById("speed-bar"),distanceValue:document.getElementById("distance-value"),biomeLabel:document.getElementById("biome-label"),streetLabel:document.getElementById("street-label"),intersectionGuide:document.getElementById("intersection-guide"),roadStateDot:document.getElementById("road-state-dot"),roadStateLabel:document.getElementById("road-state-label"),borderAlert:document.getElementById("border-alert-overlay")};function updateDrivingHud(e,t,s){updateSpeedAndDistance(e);const l=carLocation.kind==="junction",n=l?"CROSSROAD":carLocation.edge.name;hudElements.biomeLabel.textContent=`${t.name}${describeZoneSuffix(s)}`,updateLocationLabels({blockInfo:s,isOnJunction:l,streetName:n}),updateBorderAlert();const r=describeRoadState(s,l);hudElements.roadStateLabel.textContent=r.label,hudElements.roadStateDot.className=r.dotClass}function updateBiomeButtonsUI(){const e=activeBiomeIndex();cityDriveHud.querySelectorAll(".biome-btn").forEach(t=>{t.classList.toggle("active-amber",parseInt(t.dataset.biome,10)===e)})}function handleDriveKeyDown(e){const t=DRIVE_KEY_ACTIONS[e.code];return!t||e.repeat?!1:(t(),!0)}function bindDriveHudControls(){bindDriveHudButtons(),bindDriveTouchPedals(),bindDriveSteerPad()}function mountDriveHud(){const e=document.createElement("div");return e.innerHTML=CITY_DRIVE_HUD_MARKUP,document.getElementById("hud-layer").appendChild(e),e.querySelector("[data-shell-toolbar]").appendChild(document.getElementById("shell-toolbar")),e}function updateSpeedAndDistance(e){hudElements.speedValue.textContent=e;const t=clamp(e/240*100,0,100);hudElements.speedBar.style.width=`${t}%`;const s=(state.car.distanceMeters/1e3).toFixed(2);hudElements.distanceValue.textContent=`${s} km`}function describeZoneSuffix(e){return e.overBridgeStyle>=0?` \u2022 ${overBridgeStyleName(e.overBridgeStyle)}`:e.leftIsValley||e.rightIsValley?WATER_ZONE_SUFFIXES[e.waterStyle]||" \u2022 WATERFRONT":e.leftIsPark||e.rightIsPark?PARK_ZONE_SUFFIXES[e.parkTheme]||" \u2022 CENTRAL PARK":e.leftIsField||e.rightIsField?FIELD_ZONE_SUFFIXES[e.fieldStyle]||" \u2022 OPEN FIELDS":e.isWideBoulevardBlock?" \u2022 GRAND BOULEVARD":" \u2022 MIDTOWN GRID"}function updateLocationLabels({blockInfo:e,isOnJunction:t,streetName:s}){const l=state.crossroad;if(hudElements.streetLabel&&(hudElements.streetLabel.textContent=t?"ON THE CROSSROAD \u2022 DRIVE INTO ANY STREET":`${s} \u2022 ${e.district.name} \u2022 BLOCK ${e.blockNumber+1}`),hudElements.intersectionGuide){const n=state.turnIntent<0?"LEFT":state.turnIntent>0?"RIGHT":"STRAIGHT";hudElements.intersectionGuide.textContent=l.inside?`AT CROSSROAD \u2022 HEADING ${n}`:`NEXT CROSSROAD ${Math.round(l.distance)} M \u2022 ${n}`}}function updateBorderAlert(){hudElements.borderAlert&&hudElements.borderAlert.classList.toggle("active",state.car.collisionFlashTimer>0)}function describeRoadState(e,t){const s=state.car;return s.collisionFlashTimer>0?{label:"Collision! Reverse / Steer Clear",dotClass:ROAD_STATE_DOT_CLASSES.collision}:s.offRoad||s.surface==="plaza"?{label:SURFACE_LABELS[s.surface]||"Off Road",dotClass:ROAD_STATE_DOT_CLASSES.offRoad}:t||e.isIntersection?{label:t?"Crossroad \u2022 Pick Any Street":"Manhattan Intersection",dotClass:ROAD_STATE_DOT_CLASSES.intersection}:e.isWideBoulevardBlock?{label:"On Grand Boulevard",dotClass:ROAD_STATE_DOT_CLASSES.road}:{label:"On Manhattan Avenue",dotClass:ROAD_STATE_DOT_CLASSES.road}}function cycleCamera(){state.cameraMode=nextCameraMode(state.cameraMode),document.getElementById("camera-label").textContent=CAMERA_MODES[state.cameraMode].label}function toggleCruiseHold(){state.cruiseHold=!state.cruiseHold,showToggleIndicators({isActive:state.cruiseHold,dotIds:["cruise-dot","mobile-cruise-dot"],buttonIds:["btn-cruise","btn-mobile-cruise"],activeDotClass:TOGGLE_DOT_SKY_CLASS,activeButtonClass:"active-sky"})}function toggleAutoSteer(){state.autoSteer=!state.autoSteer,showToggleIndicators({isActive:state.autoSteer,dotIds:["autosteer-dot","mobile-autosteer-dot"],buttonIds:["btn-autosteer","btn-mobile-autosteer"],activeDotClass:TOGGLE_DOT_EMERALD_CLASS,activeButtonClass:"active-emerald"})}function toggleTrafficAndPeople(){state.trafficEnabled=!state.trafficEnabled,state.trafficEnabled||(state.car.colliding=!1,state.car.collisionFlashTimer=0),document.getElementById("btn-traffic").classList.toggle("active-emerald",state.trafficEnabled),document.getElementById("traffic-dot").className=state.trafficEnabled?TOGGLE_DOT_EMERALD_CLASS:TOGGLE_DOT_INACTIVE_CLASS}function showToggleIndicators({isActive:e,dotIds:t,buttonIds:s,activeDotClass:l,activeButtonClass:n}){for(const r of t){const c=document.getElementById(r);c&&(c.className=e?l:TOGGLE_DOT_INACTIVE_CLASS)}for(const r of s){const c=document.getElementById(r);c&&c.classList.toggle(n,e)}}function toggleTurnIntent(e){state.turnIntent=state.turnIntent===e?0:e}function showAutoMorphState(e){const t=environment.autoMorph?"Morph:ON":"Morph:OFF";e.innerHTML=`<span class="scenery-ctrl-text scenery-ctrl-text--small">${t}</span><div class="scenery-ctrl-line"></div>`,e.classList.toggle("active-emerald",environment.autoMorph)}function bindDriveHudButtons(){const e=(t,s)=>document.getElementById(t).addEventListener("click",s);e("btn-camera",cycleCamera),e("btn-cruise",toggleCruiseHold),e("btn-autosteer",toggleAutoSteer),e("btn-traffic",toggleTrafficAndPeople),e("btn-reset-car",resetCarToRoad),e("btn-mobile-cruise",toggleCruiseHold),e("btn-mobile-autosteer",toggleAutoSteer),e("btn-mobile-weather",()=>selectBiome(environment.biomeIndex+1)),e("btn-mobile-reset",resetCarToRoad),e("btn-auto-morph",t=>{environment.autoMorph=!environment.autoMorph,showAutoMorphState(t.currentTarget)}),cityDriveHud.querySelectorAll(".biome-btn").forEach(t=>{t.addEventListener("click",()=>selectBiome(parseInt(t.dataset.biome,10)))})}function bindDriveTouchPedals(){bindHoldButton({element:document.getElementById("touch-left"),keyName:"left",activeClass:"active-pedal-sky"}),bindHoldButton({element:document.getElementById("touch-right"),keyName:"right",activeClass:"active-pedal-sky"}),bindHoldButton({element:document.getElementById("touch-gas"),keyName:"up",activeClass:"active-pedal-emerald"}),bindHoldButton({element:document.getElementById("touch-brake"),keyName:"down",activeClass:"active-pedal-amber"}),bindHoldButton({element:document.getElementById("touch-handbrake"),keyName:"space",activeClass:"active-pedal-amber"})}function bindDriveSteerPad(){const e=document.getElementById("touch-steer-pad"),t=document.getElementById("touch-steer-knob"),s=document.getElementById("touch-left"),l=document.getElementById("touch-right");let n=null;const r=a=>{t.style.transform=`translateX(${(a*STEER_PAD_KNOB_TRAVEL_PIXELS).toFixed(1)}px)`,s.classList.toggle("active-pedal-sky",a<-STEER_PAD_HIGHLIGHT_THRESHOLD),l.classList.toggle("active-pedal-sky",a>STEER_PAD_HIGHLIGHT_THRESHOLD)},c=a=>{const o=e.getBoundingClientRect(),u=o.left+o.width*.5,p=Math.max(STEER_PAD_MIN_HALF_SPAN_PIXELS,o.width*STEER_PAD_HALF_SPAN_FRACTION),i=clamp((a-u)/p,-1,1);playerInput.touchSteerValue=-i,r(i)};e.addEventListener("pointerdown",a=>{a.preventDefault(),n=a.pointerId,e.setPointerCapture(a.pointerId),c(a.clientX)}),e.addEventListener("pointermove",a=>{a.pointerId===n&&c(a.clientX)});const d=a=>{a.pointerId===n&&(n=null,playerInput.touchSteerValue=0,playerInput.keys.left=!1,playerInput.keys.right=!1,r(0))};e.addEventListener("pointerup",d),e.addEventListener("pointercancel",d)}
