// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const IMMERSIVE_PEEK_MILLISECONDS = 2400;
const FRAME_PACING_TOLERANCE_MILLISECONDS = 3;
const MAX_FRAME_SECONDS = 0.05;
const RENDER_SCALE_CHECK_SECONDS = 2.0;
const MIN_RENDER_SCALE = 0.55;
const SLOW_FRAME_RATIO = 1.25;
const FAST_FRAME_RATIO = 1.035;
const RENDER_SCALE_STEP_DOWN = 0.88;
const RENDER_SCALE_STEP_UP = 1.06;
const RENDER_SCALE_CHANGE_THRESHOLD = 0.01;
const FRAME_TIME_SMOOTHING = 0.05;
const MIN_CANVAS_WIDTH_PIXELS = 320;
const MIN_CANVAS_HEIGHT_PIXELS = 180;
const PERFORMANCE_PROFILE_STORAGE_KEY = "slow-horizons-performance-profile";

const BATTERY_FRAME_INTERVAL_MILLISECONDS = 1000 / 45;

const PERFORMANCE_PROFILES = Object.freeze({
  cool: { frameIntervalMilliseconds: 1000 / 30, maxDevicePixelRatio: 1.0, powerPreference: "low-power", renderQuality: "cool", label: "Cool:ON" },
  full: { frameIntervalMilliseconds: 1000 / 60, maxDevicePixelRatio: 1.5, powerPreference: "high-performance", renderQuality: "full", label: "Cool:OFF" }
});

const shell = {
  isImmersive: false,
  peekTimeout: null,
  performanceProfileName: readSavedPerformanceProfileName(),
  isOnBattery: false,
  onPerformanceProfileChange: null
};

function readSavedPerformanceProfileName() {
  try {
    const saved = localStorage.getItem(PERFORMANCE_PROFILE_STORAGE_KEY);
    return PERFORMANCE_PROFILES[saved] ? saved : "full";
  } catch {
    return "full";
  }
}

function activePerformanceProfile() {
  return PERFORMANCE_PROFILES[shell.performanceProfileName];
}

function togglePerformanceProfile() {
  shell.performanceProfileName = shell.performanceProfileName === "cool" ? "full" : "cool";
  try {
    localStorage.setItem(PERFORMANCE_PROFILE_STORAGE_KEY, shell.performanceProfileName);
  } catch {}
  updatePerformanceButton();
  if (shell.onPerformanceProfileChange) shell.onPerformanceProfileChange();
}

function updatePerformanceButton() {
  const isCool = shell.performanceProfileName === "cool";
  document.getElementById("performance-label").textContent = activePerformanceProfile().label;
  document.getElementById("btn-performance").classList.toggle("active-emerald", isCool);
}

function toggleImmersiveMode(forceValue) {
  shell.isImmersive = typeof forceValue === "boolean" ? forceValue : !shell.isImmersive;
  document.body.classList.toggle("immersive-mode", shell.isImmersive);
  if (shell.isImmersive) triggerImmersivePeek();
  else document.body.classList.remove("show-immersive-peek");
}

function triggerImmersivePeek() {
  if (!shell.isImmersive) return;
  document.body.classList.add("show-immersive-peek");
  clearTimeout(shell.peekTimeout);
  shell.peekTimeout = setTimeout(() => {
    document.body.classList.remove("show-immersive-peek");
  }, IMMERSIVE_PEEK_MILLISECONDS);
}

function toggleSound(sound) {
  const isOn = sound.toggle();
  document.getElementById("audio-label").textContent = isOn ? "Sound:ON" : "Sound:OFF";
  document.getElementById("btn-audio").classList.toggle("active-sky", isOn);
}

function handleShellKeyDown(event, { sound, raiseToFullQuality }) {
  switch (event.code) {
    case "KeyH":
      toggleImmersiveMode();
      return true;
    case "KeyM":
      toggleSound(sound);
      return true;
    case "KeyK":
      togglePerformanceProfile();
      return true;
    case "KeyV":
      if (!event.repeat) startRecording({ sound, raiseToFullQuality });
      return true;
    case "KeyN":
      if (!event.repeat) stopRecording();
      return true;
  }
  return false;
}

function bindShellKeyboard(shellServices) {
  window.addEventListener("keydown", (event) => {
    if (CODES_THAT_SCROLL_THE_PAGE.includes(event.code)) event.preventDefault();
    if (isRecordingDialogOpen()) {
      if (event.code === "Escape") closeRecordingDialog();
      return;
    }
    if (handleShellKeyDown(event, shellServices)) return;
    setHeldKey(event.code, true);
    CityDriveGame.handleKeyDown(event);
  });
  window.addEventListener("keyup", (event) => {
    setHeldKey(event.code, false);
  });
}

function bindShellControls(shellServices) {
  const { sound, canvas } = shellServices;
  const unlockAudioOnce = () => sound.unlockIfNeeded();
  window.addEventListener("keydown", unlockAudioOnce, { passive: true });
  window.addEventListener("pointerdown", unlockAudioOnce, { passive: true });
  window.addEventListener("touchstart", unlockAudioOnce, { passive: true });
  window.addEventListener("mousemove", triggerImmersivePeek);

  document.getElementById("rec-save").addEventListener("click", saveRecordingToDisk);
  document.getElementById("rec-discard").addEventListener("click", closeRecordingDialog);
  document.getElementById("rec-ok").addEventListener("click", closeRecordingDialog);
  document.getElementById("btn-audio").addEventListener("click", () => toggleSound(sound));
  document.getElementById("btn-performance").addEventListener("click", togglePerformanceProfile);
  document.getElementById("btn-immersive").addEventListener("click", () => toggleImmersiveMode(true));
  document.getElementById("btn-restore-ui").addEventListener("click", () => toggleImmersiveMode(false));

  bindShellKeyboard(shellServices);
  bindCanvasTouchMovement({ canvas, onTouchStart: triggerImmersivePeek });
}

function showStartupFailure(message) {
  document.getElementById("startup-failure-reason").textContent = message;
  document.getElementById("startup-failure").classList.add("is-visible");
}

window.addEventListener("load", async () => {
  const canvas = document.getElementById("gpu-canvas");
  const renderer = new HorizonRenderer(canvas);
  const sound = new SoundEngine();
  let renderScale = 1.0;
  let averageFrameSeconds = activeTargetFrameSeconds();
  let secondsSinceScaleCheck = 0;

  function handleResize() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, activePerformanceProfile().maxDevicePixelRatio) * renderScale;
    canvas.width = Math.max(MIN_CANVAS_WIDTH_PIXELS, Math.floor(canvas.clientWidth * pixelRatio)) & ~1;
    canvas.height = Math.max(MIN_CANVAS_HEIGHT_PIXELS, Math.floor(canvas.clientHeight * pixelRatio)) & ~1;
    renderer.resizeRenderTargets();
  }

  function raiseToFullQuality() {
    if (renderScale === 1.0) return;
    renderScale = 1.0;
    handleResize();
  }

  const foliageAssetsReady = requestFoliageAssets();
  try {
    await renderer.init({
      powerPreference: activePerformanceProfile().powerPreference,
      qualityName: activePerformanceProfile().renderQuality,
      leafAtlasMipChainReady: foliageAssetsReady.then(foliageAssets => foliageAssets.leafAtlasMipChain)
    });
  } catch (error) {
    showStartupFailure(error.message);
    return;
  }
  handleResize();
  new ResizeObserver(handleResize).observe(canvas);
  updatePerformanceButton();
  shell.onPerformanceProfileChange = () => {
    renderScale = 1.0;
    averageFrameSeconds = activeTargetFrameSeconds();
    renderer.setRenderQuality(activePerformanceProfile().renderQuality);
    handleResize();
  };
  watchBatteryPower(() => {
    averageFrameSeconds = activeTargetFrameSeconds();
  });

  bindShellControls({ sound, canvas, raiseToFullQuality });
  sound.unlockIfNeeded();
  const gameContext = { renderer, sound };
  const { treeSpeciesMeshes } = await foliageAssetsReady;
  CityDriveGame.start({ ...gameContext, treeSpeciesMeshes });

  let lastTime = performance.now();
  let hasStartupWorldLoaded = false;

  function adaptRenderScale(dt) {
    averageFrameSeconds = lerp(averageFrameSeconds, dt, FRAME_TIME_SMOOTHING);
    secondsSinceScaleCheck += dt;
    if (secondsSinceScaleCheck < RENDER_SCALE_CHECK_SECONDS || isRecording()) return;
    secondsSinceScaleCheck = 0;
    const nextScale = chooseRenderScale(averageFrameSeconds, renderScale);
    if (Math.abs(nextScale - renderScale) > RENDER_SCALE_CHANGE_THRESHOLD) {
      renderScale = nextScale;
      handleResize();
    }
  }

  function animate(now) {
    requestAnimationFrame(animate);
    if (now - lastTime < activeFrameIntervalMilliseconds() - FRAME_PACING_TOLERANCE_MILLISECONDS) return;
    const dt = Math.min((now - lastTime) * 0.001, MAX_FRAME_SECONDS);
    lastTime = now;

    if (!hasStartupWorldLoaded) {
      if (!CityDriveGame.isWorldReady()) {
        CityDriveGame.prepareWorld(dt, gameContext);
        return;
      }
      hasStartupWorldLoaded = true;
    }
    adaptRenderScale(dt);
    environment.time += dt;
    renderer.renderFrame(CityDriveGame.update(dt, gameContext));
  }

  requestAnimationFrame(animate);
});

function activeFrameIntervalMilliseconds() {
  const profileInterval = activePerformanceProfile().frameIntervalMilliseconds;
  return shell.isOnBattery ? Math.max(profileInterval, BATTERY_FRAME_INTERVAL_MILLISECONDS) : profileInterval;
}

function activeTargetFrameSeconds() {
  return activeFrameIntervalMilliseconds() / 1000;
}

async function watchBatteryPower(onChange) {
  if (!navigator.getBattery) return;
  try {
    const battery = await navigator.getBattery();
    const readChargingState = () => {
      shell.isOnBattery = !battery.charging;
      onChange();
    };
    battery.addEventListener("chargingchange", readChargingState);
    readChargingState();
  } catch {}
}

function chooseRenderScale(averageFrameSeconds, renderScale) {
  const targetFrameSeconds = activeTargetFrameSeconds();
  if (averageFrameSeconds > targetFrameSeconds * SLOW_FRAME_RATIO) return Math.max(MIN_RENDER_SCALE, renderScale * RENDER_SCALE_STEP_DOWN);
  if (averageFrameSeconds < targetFrameSeconds * FAST_FRAME_RATIO) return Math.min(1.0, renderScale * RENDER_SCALE_STEP_UP);
  return renderScale;
}
