// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const WORLD_BUILD_WORKER_URL = "world_build_worker.js";
const WORLD_BUILD_MAX_IN_FLIGHT_PER_WORKER = 3;
const WORLD_BUILD_SECOND_WORKER_MIN_CORES = 6;
const WORLD_BUILD_LOAD_TIMEOUT_MILLISECONDS = 10000;
const WORLD_BUILD_SCRIPTS_WITHOUT_WORKER_SUPPORT = Object.freeze(new Set([
  "renderer.js", "sound.js", "input.js", "recorder.js", "drive_hud.js", "drive_minimap.js",
  "city_drive_game.js", "app_shell.js", "hard_reload.js", "world_build_service.js", "post_processing.js", "sun_shadows.js", "world_shaders.js", "surface_textures.js"
]));

const worldBuildService = {
  workers: [],
  isLaunched: false,
  isStarted: false,
  isDisabled: false,
  loadTimeout: null,
  pendingFoliageAssets: null,
  nextRequestId: 1,
  inFlight: new Map(),
  onBuilt: null,
  onRequestFailed: null
};

function launchWorldBuildWorkers() {
  if (worldBuildService.isLaunched) return;
  worldBuildService.isLaunched = true;
  if (typeof Worker === "undefined") {
    worldBuildService.isDisabled = true;
    return;
  }
  const workerCount = (navigator.hardwareConcurrency || 2) >= WORLD_BUILD_SECOND_WORKER_MIN_CORES ? 2 : 1;
  try {
    for (let index = 0; index < workerCount; index++) worldBuildService.workers.push(spawnWorldBuildWorker());
  } catch {
    disableWorldBuildService();
    return;
  }
  worldBuildService.loadTimeout = setTimeout(() => {
    if (!worldBuildService.workers.some(entry => entry.isLoaded)) disableWorldBuildService();
  }, WORLD_BUILD_LOAD_TIMEOUT_MILLISECONDS);
}

function startWorldBuildService({ onBuilt, onRequestFailed }) {
  if (worldBuildService.isStarted) return;
  launchWorldBuildWorkers();
  worldBuildService.isStarted = true;
  worldBuildService.onBuilt = onBuilt;
  worldBuildService.onRequestFailed = onRequestFailed;
}

function requestFoliageAssets() {
  launchWorldBuildWorkers();
  const entry = worldBuildService.workers[0];
  if (worldBuildService.isDisabled || !entry) return Promise.resolve(buildFoliageAssets());
  return new Promise((resolve) => {
    worldBuildService.pendingFoliageAssets = resolve;
    entry.worker.postMessage({ type: "foliageAssets" });
  });
}

function settleFoliageAssets(foliageAssets) {
  const resolve = worldBuildService.pendingFoliageAssets;
  if (!resolve) return;
  worldBuildService.pendingFoliageAssets = null;
  resolve(foliageAssets);
}

function spawnWorldBuildWorker() {
  const worker = new Worker(WORLD_BUILD_WORKER_URL);
  const entry = { worker, isLoaded: false, graphSignature: null, edgeIdsKnownToWorker: new Set(), inFlightCount: 0 };
  worker.onmessage = (event) => handleWorkerMessage(entry, event.data);
  worker.onerror = () => disableWorldBuildService();
  worker.postMessage({ type: "load", worldSeed: WORLD_SEED, scriptUrls: worldBuildScriptUrls() });
  return entry;
}

function worldBuildScriptUrls() {
  const gameDirectoryUrl = new URL(".", new URL(WORLD_BUILD_WORKER_URL, location.href)).href;
  return [...document.querySelectorAll("script[src]")]
    .map(script => script.src)
    .filter(url => url.startsWith(gameDirectoryUrl) && !WORLD_BUILD_SCRIPTS_WITHOUT_WORKER_SUPPORT.has(url.split("/").pop()));
}

function hasWorldBuildCapacity() {
  return !!pickIdleWorldBuildWorker();
}

function pickIdleWorldBuildWorker() {
  if (worldBuildService.isDisabled) return null;
  let idlest = null;
  for (const entry of worldBuildService.workers) {
    if (!entry.isLoaded || entry.inFlightCount >= WORLD_BUILD_MAX_IN_FLIGHT_PER_WORKER) continue;
    if (!idlest || entry.inFlightCount < idlest.inFlightCount) idlest = entry;
  }
  return idlest;
}

function requestWorldBuild({ item, slot }) {
  const entry = pickIdleWorldBuildWorker();
  if (!entry) return false;
  syncRoadGraphToWorker(entry);
  const requestId = worldBuildService.nextRequestId++;
  worldBuildService.inFlight.set(requestId, { item, slot, entry });
  entry.inFlightCount++;
  const target = item.edge ? { edgeId: item.edge.id, segmentIndex: item.segmentIndex } : { junctionId: item.junction.id };
  entry.worker.postMessage({ type: "build", requestId, ...target });
  return requestId;
}

function syncRoadGraphToWorker(entry) {
  const signature = `${roadGraph.nextId}:${roadGraph.edges.size}:${roadGraph.junctions.size}`;
  if (entry.graphSignature === signature) return;
  entry.graphSignature = signature;
  entry.worker.postMessage({ type: "graphChanges", changes: describeRoadGraphChanges(entry.edgeIdsKnownToWorker) });
}

function handleWorkerMessage(entry, message) {
  if (message.type === "loaded") {
    entry.isLoaded = true;
    return;
  }
  if (message.type === "foliageAssets") {
    settleFoliageAssets(message.foliageAssets);
    return;
  }
  if (message.type !== "built") return;
  const request = worldBuildService.inFlight.get(message.requestId);
  if (!request) return;
  worldBuildService.inFlight.delete(message.requestId);
  entry.inFlightCount--;
  if (message.isMissing) {
    worldBuildService.onRequestFailed(request, message.requestId);
    return;
  }
  worldBuildService.onBuilt(request, message);
}

function disableWorldBuildService() {
  if (worldBuildService.isDisabled) return;
  worldBuildService.isDisabled = true;
  clearTimeout(worldBuildService.loadTimeout);
  for (const entry of worldBuildService.workers) entry.worker.terminate();
  if (worldBuildService.pendingFoliageAssets) settleFoliageAssets(buildFoliageAssets());
  const unfinished = [...worldBuildService.inFlight.entries()];
  worldBuildService.inFlight.clear();
  for (const [requestId, request] of unfinished) worldBuildService.onRequestFailed(request, requestId);
}

function isWorldBuildServiceActive() {
  return worldBuildService.isStarted && !worldBuildService.isDisabled && worldBuildService.workers.some(entry => entry.isLoaded);
}

function isWorldBuildServiceLoading() {
  return worldBuildService.isLaunched && !worldBuildService.isDisabled && !worldBuildService.workers.some(entry => entry.isLoaded);
}
