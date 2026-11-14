// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const CITY_DRIVE_HUD_MARKUP = `
<div id="border-alert-overlay"></div>

<header class="hud-layer hud-header">
  <div class="hud-group hud-group-left hud-title-block">
    <span class="mono hud-title">City Drive</span>
    <span id="biome-label" class="mono hud-biome-label">Manhattan • Crisp Morning</span>
    <span id="street-label" class="mono hud-street-label">5TH AVENUE • BLOCK 1</span>
    <span id="intersection-guide" class="mono hud-intersection-guide scenery-metric-dist">NEXT CROSSROAD • STRAIGHT</span>
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
        <span class="scenery-ctrl-text pedal-glyph">◀</span>
        <span class="mono pedal-caption">LEFT</span>
      </button>
      <div class="steer-pad-center">
        <div id="touch-steer-knob" class="steer-knob"></div>
        <span class="mono steer-pad-caption">SLIDE</span>
      </div>
      <button id="touch-right" type="button" class="mobile-pedal pedal-steer">
        <span class="scenery-ctrl-text pedal-glyph">▶</span>
        <span class="mono pedal-caption">RIGHT</span>
      </button>
    </div>

    <div class="touch-zone pedal-cluster">
      <button id="touch-handbrake" type="button" class="mobile-pedal pedal-drift">
        <span class="scenery-ctrl-text pedal-glyph">DRIFT</span>
        <span class="mono pedal-caption">HOLD</span>
      </button>
      <button id="touch-brake" type="button" class="mobile-pedal pedal-brake">
        <span class="scenery-ctrl-text pedal-glyph">▼</span>
        <span class="mono pedal-caption">BRAKE</span>
      </button>
      <button id="touch-gas" type="button" class="mobile-pedal pedal-gas">
        <span class="scenery-ctrl-text pedal-glyph">▲</span>
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
`;

const HUD_FULL_SCALE_SPEED_KMH = 240;

const SURFACE_LABELS = {
  sidewalk: "On Sidewalk",
  lawn: "Cruising Park Lawn",
  plaza: "Plaza / Forecourt"
};

const WATER_ZONE_SUFFIXES = [" • CONSERVATORY LAKE", " • CASCADE WATER PLAZA", " • YACHT MARINA"];
const FIELD_ZONE_SUFFIXES = [" • WILDFLOWER MEADOW", " • GOLDEN WHEAT FIELDS", " • OPEN PASTURE"];
const PARK_ZONE_SUFFIXES = [" • CHERRY BLOSSOM PARK", " • BETHESDA FOUNTAIN PARK", " • BOTANICAL GARDENS"];

const ROAD_STATE_DOT_CLASSES = {
  collision: "road-state-dot is-collision",
  offRoad: "road-state-dot is-off-road",
  intersection: "road-state-dot is-intersection",
  road: "road-state-dot is-road"
};

const TOGGLE_DOT_INACTIVE_CLASS = "toggle-dot";
const TOGGLE_DOT_SKY_CLASS = "toggle-dot is-sky";
const TOGGLE_DOT_EMERALD_CLASS = "toggle-dot is-emerald";

const STEER_PAD_KNOB_TRAVEL_PIXELS = 18;
const STEER_PAD_MIN_HALF_SPAN_PIXELS = 24;
const STEER_PAD_HALF_SPAN_FRACTION = 0.42;
const STEER_PAD_HIGHLIGHT_THRESHOLD = 0.2;

const DRIVE_KEY_ACTIONS = {
  KeyC: cycleCamera,
  KeyB: () => selectBiome(environment.biomeIndex + 1),
  KeyT: toggleTrafficAndPeople,
  KeyZ: toggleAutoSteer,
  KeyX: toggleCruiseHold,
  KeyR: resetCarToRoad,
  KeyQ: () => toggleTurnIntent(-1),
  KeyE: () => toggleTurnIntent(1)
};

const cityDriveHud = mountDriveHud();

const hudElements = {
  speedValue: document.getElementById("speed-value"),
  speedBar: document.getElementById("speed-bar"),
  distanceValue: document.getElementById("distance-value"),
  biomeLabel: document.getElementById("biome-label"),
  streetLabel: document.getElementById("street-label"),
  intersectionGuide: document.getElementById("intersection-guide"),
  roadStateDot: document.getElementById("road-state-dot"),
  roadStateLabel: document.getElementById("road-state-label"),
  borderAlert: document.getElementById("border-alert-overlay"),
};

function updateDrivingHud(speedKmh, biome, blockInfo) {
  updateSpeedAndDistance(speedKmh);
  const isOnJunction = carLocation.kind === "junction";
  const streetName = isOnJunction ? "CROSSROAD" : carLocation.edge.name;
  hudElements.biomeLabel.textContent = `${biome.name}${describeZoneSuffix(blockInfo)}`;
  updateLocationLabels({ blockInfo, isOnJunction, streetName });
  updateBorderAlert();
  const roadState = describeRoadState(blockInfo, isOnJunction);
  hudElements.roadStateLabel.textContent = roadState.label;
  hudElements.roadStateDot.className = roadState.dotClass;
}

function updateBiomeButtonsUI() {
  const activeIndex = activeBiomeIndex();
  cityDriveHud.querySelectorAll(".biome-btn").forEach(button => {
    button.classList.toggle("active-amber", parseInt(button.dataset.biome, 10) === activeIndex);
  });
}

function handleDriveKeyDown(event) {
  const action = DRIVE_KEY_ACTIONS[event.code];
  if (!action || event.repeat) return false;
  action();
  return true;
}

function bindDriveHudControls() {
  bindDriveHudButtons();
  bindDriveTouchPedals();
  bindDriveSteerPad();
}

function mountDriveHud() {
  const hud = document.createElement("div");
  hud.innerHTML = CITY_DRIVE_HUD_MARKUP;
  document.getElementById("hud-layer").appendChild(hud);
  hud.querySelector("[data-shell-toolbar]").appendChild(document.getElementById("shell-toolbar"));
  return hud;
}

function updateSpeedAndDistance(speedKmh) {
  hudElements.speedValue.textContent = speedKmh;
  const speedPercent = clamp((speedKmh / HUD_FULL_SCALE_SPEED_KMH) * 100, 0, 100);
  hudElements.speedBar.style.width = `${speedPercent}%`;

  const distanceKilometers = (state.car.distanceMeters / 1000).toFixed(2);
  hudElements.distanceValue.textContent = `${distanceKilometers} km`;
}

function describeZoneSuffix(blockInfo) {
  if (blockInfo.overBridgeStyle >= 0) return ` • ${overBridgeStyleName(blockInfo.overBridgeStyle)}`;
  if (blockInfo.leftIsValley || blockInfo.rightIsValley) {
    return WATER_ZONE_SUFFIXES[blockInfo.waterStyle] || " • WATERFRONT";
  }
  if (blockInfo.leftIsPark || blockInfo.rightIsPark) {
    return PARK_ZONE_SUFFIXES[blockInfo.parkTheme] || " • CENTRAL PARK";
  }
  if (blockInfo.leftIsField || blockInfo.rightIsField) {
    return FIELD_ZONE_SUFFIXES[blockInfo.fieldStyle] || " • OPEN FIELDS";
  }
  return blockInfo.isWideBoulevardBlock ? " • GRAND BOULEVARD" : " • MIDTOWN GRID";
}

function updateLocationLabels({ blockInfo, isOnJunction, streetName }) {
  const crossroad = state.crossroad;
  if (hudElements.streetLabel) {
    hudElements.streetLabel.textContent = isOnJunction
      ? "ON THE CROSSROAD • DRIVE INTO ANY STREET"
      : `${streetName} • ${blockInfo.district.name} • BLOCK ${blockInfo.blockNumber + 1}`;
  }
  if (hudElements.intersectionGuide) {
    const intentWord = state.turnIntent < 0 ? "LEFT" : (state.turnIntent > 0 ? "RIGHT" : "STRAIGHT");
    hudElements.intersectionGuide.textContent = crossroad.inside
      ? `AT CROSSROAD • HEADING ${intentWord}`
      : `NEXT CROSSROAD ${Math.round(crossroad.distance)} M • ${intentWord}`;
  }
}

function updateBorderAlert() {
  if (!hudElements.borderAlert) return;
  hudElements.borderAlert.classList.toggle("active", state.car.collisionFlashTimer > 0);
}

function describeRoadState(blockInfo, isOnJunction) {
  const car = state.car;
  if (car.collisionFlashTimer > 0) {
    return { label: "Collision! Reverse / Steer Clear", dotClass: ROAD_STATE_DOT_CLASSES.collision };
  }
  if (car.offRoad || car.surface === "plaza") {
    return {
      label: SURFACE_LABELS[car.surface] || "Off Road",
      dotClass: ROAD_STATE_DOT_CLASSES.offRoad
    };
  }
  if (isOnJunction || blockInfo.isIntersection) {
    return { label: isOnJunction ? "Crossroad • Pick Any Street" : "Manhattan Intersection", dotClass: ROAD_STATE_DOT_CLASSES.intersection };
  }
  if (blockInfo.isWideBoulevardBlock) {
    return { label: "On Grand Boulevard", dotClass: ROAD_STATE_DOT_CLASSES.road };
  }
  return { label: "On Manhattan Avenue", dotClass: ROAD_STATE_DOT_CLASSES.road };
}

function cycleCamera() {
  state.cameraMode = nextCameraMode(state.cameraMode);
  document.getElementById("camera-label").textContent = CAMERA_MODES[state.cameraMode].label;
}

function toggleCruiseHold() {
  state.cruiseHold = !state.cruiseHold;
  showToggleIndicators({
    isActive: state.cruiseHold,
    dotIds: ["cruise-dot", "mobile-cruise-dot"],
    buttonIds: ["btn-cruise", "btn-mobile-cruise"],
    activeDotClass: TOGGLE_DOT_SKY_CLASS,
    activeButtonClass: "active-sky"
  });
}

function toggleAutoSteer() {
  state.autoSteer = !state.autoSteer;
  showToggleIndicators({
    isActive: state.autoSteer,
    dotIds: ["autosteer-dot", "mobile-autosteer-dot"],
    buttonIds: ["btn-autosteer", "btn-mobile-autosteer"],
    activeDotClass: TOGGLE_DOT_EMERALD_CLASS,
    activeButtonClass: "active-emerald"
  });
}

function toggleTrafficAndPeople() {
  state.trafficEnabled = !state.trafficEnabled;
  if (!state.trafficEnabled) {
    state.car.colliding = false;
    state.car.collisionFlashTimer = 0;
  }
  document.getElementById("btn-traffic").classList.toggle("active-emerald", state.trafficEnabled);
  document.getElementById("traffic-dot").className = state.trafficEnabled ? TOGGLE_DOT_EMERALD_CLASS : TOGGLE_DOT_INACTIVE_CLASS;
}

function showToggleIndicators({ isActive, dotIds, buttonIds, activeDotClass, activeButtonClass }) {
  for (const dotId of dotIds) {
    const dot = document.getElementById(dotId);
    if (dot) dot.className = isActive ? activeDotClass : TOGGLE_DOT_INACTIVE_CLASS;
  }
  for (const buttonId of buttonIds) {
    const button = document.getElementById(buttonId);
    if (button) button.classList.toggle(activeButtonClass, isActive);
  }
}

function toggleTurnIntent(direction) {
  state.turnIntent = state.turnIntent === direction ? 0 : direction;
}

function showAutoMorphState(button) {
  const label = environment.autoMorph ? "Morph:ON" : "Morph:OFF";
  button.innerHTML = `<span class="scenery-ctrl-text scenery-ctrl-text--small">${label}</span><div class="scenery-ctrl-line"></div>`;
  button.classList.toggle("active-emerald", environment.autoMorph);
}

function bindDriveHudButtons() {
  const onClick = (id, action) => document.getElementById(id).addEventListener("click", action);
  onClick("btn-camera", cycleCamera);
  onClick("btn-cruise", toggleCruiseHold);
  onClick("btn-autosteer", toggleAutoSteer);
  onClick("btn-traffic", toggleTrafficAndPeople);
  onClick("btn-reset-car", resetCarToRoad);
  onClick("btn-mobile-cruise", toggleCruiseHold);
  onClick("btn-mobile-autosteer", toggleAutoSteer);
  onClick("btn-mobile-weather", () => selectBiome(environment.biomeIndex + 1));
  onClick("btn-mobile-reset", resetCarToRoad);
  onClick("btn-auto-morph", (event) => {
    environment.autoMorph = !environment.autoMorph;
    showAutoMorphState(event.currentTarget);
  });
  cityDriveHud.querySelectorAll(".biome-btn").forEach(button => {
    button.addEventListener("click", () => selectBiome(parseInt(button.dataset.biome, 10)));
  });
}

function bindDriveTouchPedals() {
  bindHoldButton({ element: document.getElementById("touch-left"), keyName: "left", activeClass: "active-pedal-sky" });
  bindHoldButton({ element: document.getElementById("touch-right"), keyName: "right", activeClass: "active-pedal-sky" });
  bindHoldButton({ element: document.getElementById("touch-gas"), keyName: "up", activeClass: "active-pedal-emerald" });
  bindHoldButton({ element: document.getElementById("touch-brake"), keyName: "down", activeClass: "active-pedal-amber" });
  bindHoldButton({ element: document.getElementById("touch-handbrake"), keyName: "space", activeClass: "active-pedal-amber" });
}

function bindDriveSteerPad() {
  const steerPad = document.getElementById("touch-steer-pad");
  const steerKnob = document.getElementById("touch-steer-knob");
  const leftPedal = document.getElementById("touch-left");
  const rightPedal = document.getElementById("touch-right");
  let steerPointerId = null;

  const showSteer = (normalizedSteer) => {
    steerKnob.style.transform = `translateX(${(normalizedSteer * STEER_PAD_KNOB_TRAVEL_PIXELS).toFixed(1)}px)`;
    leftPedal.classList.toggle("active-pedal-sky", normalizedSteer < -STEER_PAD_HIGHLIGHT_THRESHOLD);
    rightPedal.classList.toggle("active-pedal-sky", normalizedSteer > STEER_PAD_HIGHLIGHT_THRESHOLD);
  };
  const steerFromClientX = (clientX) => {
    const rect = steerPad.getBoundingClientRect();
    const center = rect.left + rect.width * 0.5;
    const halfSpan = Math.max(STEER_PAD_MIN_HALF_SPAN_PIXELS, rect.width * STEER_PAD_HALF_SPAN_FRACTION);
    const normalizedSteer = clamp((clientX - center) / halfSpan, -1.0, 1.0);
    playerInput.touchSteerValue = -normalizedSteer;
    showSteer(normalizedSteer);
  };

  steerPad.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    steerPointerId = event.pointerId;
    steerPad.setPointerCapture(event.pointerId);
    steerFromClientX(event.clientX);
  });
  steerPad.addEventListener("pointermove", (event) => {
    if (event.pointerId === steerPointerId) steerFromClientX(event.clientX);
  });
  const endSteer = (event) => {
    if (event.pointerId !== steerPointerId) return;
    steerPointerId = null;
    playerInput.touchSteerValue = 0;
    playerInput.keys.left = false;
    playerInput.keys.right = false;
    showSteer(0);
  };
  steerPad.addEventListener("pointerup", endSteer);
  steerPad.addEventListener("pointercancel", endSteer);
}
