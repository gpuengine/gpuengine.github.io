// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const VIEW_BEHIND_WEIGHT = 2.6;
const MAX_VIEW_COST = 760;
const VISIBLE_REFRESH_INTERVAL_SECONDS = 0.25;
const GRAPH_EVICTION_INTERVAL_SECONDS = 2.0;
const SEGMENT_BUILDS_PER_FRAME = 5;
const VISIBLE_SEED_RADIUS = 140.0;
const MAX_SEGMENTS_PER_EDGE = 128;
const NEW_EDGE_REBUILD_REACH = FAR_REACH + 30.0;
const NEW_EDGE_REBUILD_NODE_STEP = 4;

const segmentStreaming = {
  slotKeys: new Array(MAX_SEGMENTS).fill(null),
  slotItems: new Array(MAX_SEGMENTS).fill(null),
  keyToSlot: new Map(),
  freeSlots: Array.from({ length: MAX_SEGMENTS }, (_, slot) => MAX_SEGMENTS - 1 - slot),
  pendingBuilds: [],
  latestRequestBySlot: new Map(),
  visibleItems: [],
  secondsUntilVisibleRefresh: 0,
  secondsUntilEviction: 0,
  geometryBuffer: new Float32Array(VERTS_PER_SEGMENT * FLOATS_PER_VERT)
};

function streamWorldAroundCar(car, renderer, dt) {
  updateCarLocation(car);
  segmentStreaming.secondsUntilVisibleRefresh -= dt;
  if (segmentStreaming.secondsUntilVisibleRefresh <= 0) {
    segmentStreaming.secondsUntilVisibleRefresh = VISIBLE_REFRESH_INTERVAL_SECONDS;
    syncVisibleSlots(renderer);
  }
  segmentStreaming.secondsUntilEviction -= dt;
  if (segmentStreaming.secondsUntilEviction <= 0) {
    segmentStreaming.secondsUntilEviction = GRAPH_EVICTION_INTERVAL_SECONDS;
    evictFarGraph(car);
  }
  processPendingBuilds(renderer, SEGMENT_BUILDS_PER_FRAME);
}

function syncVisibleSlots(renderer) {
  const streaming = segmentStreaming;
  streaming.visibleItems = computeVisibleSet(state.car);
  const wantedKeys = new Set(streaming.visibleItems.map(item => item.key));
  for (let slot = 0; slot < MAX_SEGMENTS; slot++) {
    if (streaming.slotKeys[slot] !== null && !wantedKeys.has(streaming.slotKeys[slot])) {
      releaseSlot(renderer, slot);
    }
  }
  streaming.pendingBuilds = streaming.pendingBuilds.filter(item => streaming.keyToSlot.has(item.key));
  for (const item of streaming.visibleItems) {
    if (streaming.keyToSlot.has(item.key)) continue;
    if (!streaming.freeSlots.length) break;
    claimSlot(item);
  }
  const costByKey = new Map(streaming.visibleItems.map(item => [item.key, item.cost]));
  streaming.pendingBuilds.sort((a, b) => (costByKey.get(a.key) || 0) - (costByKey.get(b.key) || 0));
}

function processPendingBuilds(renderer, budget) {
  startWorldBuildService({
    onBuilt: (request, result) => applyWorkerBuild(renderer, request, result),
    onRequestFailed: (request, requestId) => rebuildOnMainThread(renderer, request, requestId)
  });
  if (isWorldBuildServiceActive()) {
    dispatchPendingBuildsToWorkers();
    return;
  }
  if (isWorldBuildServiceLoading()) return;
  const streaming = segmentStreaming;
  for (let built = 0; built < budget && streaming.pendingBuilds.length; built++) {
    const item = streaming.pendingBuilds.shift();
    const slot = streaming.keyToSlot.get(item.key);
    if (slot === undefined) continue;
    uploadSlotItem(renderer, slot, item);
  }
}

function dispatchPendingBuildsToWorkers() {
  const streaming = segmentStreaming;
  while (streaming.pendingBuilds.length && hasWorldBuildCapacity()) {
    const item = streaming.pendingBuilds.shift();
    const slot = streaming.keyToSlot.get(item.key);
    if (slot === undefined) continue;
    streaming.latestRequestBySlot.set(slot, requestWorldBuild({ item, slot }));
  }
}

function isCurrentSlotRequest(request, requestId) {
  const streaming = segmentStreaming;
  return streaming.latestRequestBySlot.get(request.slot) === requestId && streaming.slotItems[request.slot] === request.item;
}

function applyWorkerBuild(renderer, request, result) {
  if (!isCurrentSlotRequest(request, result.requestId)) return;
  segmentStreaming.latestRequestBySlot.delete(request.slot);
  Object.assign(slotItemAnchor(request.item), result.anchorUpdates);
  renderer.uploadSegmentSlot(request.slot, result.vertexData, result.vertexCount);
  renderer.setSlotTrees(request.slot, result.trees);
}

function rebuildOnMainThread(renderer, request, requestId) {
  if (!isCurrentSlotRequest(request, requestId)) return;
  segmentStreaming.latestRequestBySlot.delete(request.slot);
  uploadSlotItem(renderer, request.slot, request.item);
}

function queueRebuildOfSlotsNear(newEdge) {
  const streaming = segmentStreaming;
  for (const item of streaming.slotItems) {
    if (!item || item.edge === newEdge || streaming.pendingBuilds.includes(item)) continue;
    if (isNearEdgeNodes(slotItemAnchor(item), newEdge, NEW_EDGE_REBUILD_REACH)) streaming.pendingBuilds.push(item);
  }
}

function isSegmentStreamed(edge, edgePosition) {
  return segmentStreaming.keyToSlot.has(segmentSlotKey(edge, segmentIndexAt(edge, edgePosition)));
}

function isSegmentBuilt(edge, edgePosition) {
  const key = segmentSlotKey(edge, segmentIndexAt(edge, edgePosition));
  const slot = segmentStreaming.keyToSlot.get(key);
  if (slot === undefined || segmentStreaming.latestRequestBySlot.has(slot)) return false;
  return !segmentStreaming.pendingBuilds.some(item => item.key === key);
}

function isInitialWorldBuilt() {
  const streaming = segmentStreaming;
  return streaming.keyToSlot.size > 0 && streaming.pendingBuilds.length === 0 && streaming.latestRequestBySlot.size === 0;
}

function visibleStreamItems() {
  return segmentStreaming.visibleItems;
}

function obstacleListsNear(x, z, radius) {
  const lists = [];
  const radiusSquared = radius * radius;
  for (const item of segmentStreaming.slotItems) {
    if (!item) continue;
    const anchor = slotItemAnchor(item);
    const offsetX = anchor.x - x;
    const offsetZ = anchor.z - z;
    if (offsetX * offsetX + offsetZ * offsetZ > radiusSquared) continue;
    lists.push(anchor.obstacles);
  }
  return lists;
}

function segmentIndexAt(edge, edgePosition) {
  return clamp(Math.floor(edgePosition), 0, edge.segmentCount - 1);
}

function segmentSlotKey(edge, segmentIndex) {
  return edge.id * MAX_SEGMENTS_PER_EDGE + segmentIndex;
}

function junctionSlotKey(junction) {
  return -junction.id;
}

function slotItemAnchor(item) {
  return item.edge ? item.edge.nodes[item.segmentIndex] : item.junction;
}

function claimSlot(item) {
  const streaming = segmentStreaming;
  const slot = streaming.freeSlots.pop();
  streaming.keyToSlot.set(item.key, slot);
  streaming.slotKeys[slot] = item.key;
  streaming.slotItems[slot] = item;
  streaming.pendingBuilds.push(item);
}

function releaseSlot(renderer, slot) {
  const streaming = segmentStreaming;
  streaming.keyToSlot.delete(streaming.slotKeys[slot]);
  streaming.latestRequestBySlot.delete(slot);
  slotItemAnchor(streaming.slotItems[slot]).obstacles = [];
  streaming.slotKeys[slot] = null;
  streaming.slotItems[slot] = null;
  streaming.freeSlots.push(slot);
  renderer.clearSegmentSlot(slot);
}

function uploadSlotItem(renderer, slot, item) {
  const geometryBuffer = segmentStreaming.geometryBuffer;
  const { result: vertexCount, trees } = collectTreeInstances(() => buildSlotGeometry(item, geometryBuffer));
  drapeVerticesOnTerrain(geometryBuffer, vertexCount);
  renderer.uploadSegmentSlot(slot, geometryBuffer, vertexCount);
  renderer.setSlotTrees(slot, trees);
}

function buildSlotGeometry(item, geometryBuffer) {
  if (item.edge) {
    return buildRoadSegmentGeometry(item.edge.nodes[item.segmentIndex], item.edge.nodes[item.segmentIndex + 1], geometryBuffer);
  }
  return buildJunctionGeometry(item.junction, geometryBuffer);
}

function isNearEdgeNodes(point, edge, reach) {
  for (let nodeIndex = 0; nodeIndex <= edge.segmentCount; nodeIndex += NEW_EDGE_REBUILD_NODE_STEP) {
    const node = edge.nodes[nodeIndex];
    if (Math.hypot(node.x - point.x, node.z - point.z) < reach) return true;
  }
  return false;
}

function computeVisibleSet(car) {
  const items = [];
  const seenKeys = new Set();
  const walkers = [];
  const travelSign = car.speed >= -0.5 ? 1 : -1;
  const travelX = -Math.sin(car.heading) * travelSign;
  const travelZ = -Math.cos(car.heading) * travelSign;

  const startWalker = (edge, segmentIndex, step, cost, weight) => {
    walkers.push({ edge, segmentIndex, step, cost, weight });
  };
  const startWalkerIntoArm = (arm, cost, weight) => {
    if (arm.end === "a") startWalker(arm.edge, 0, 1, cost, weight);
    else startWalker(arm.edge, arm.edge.segmentCount - 1, -1, cost, weight);
  };
  const addJunction = (junction, cost) => {
    const key = junctionSlotKey(junction);
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    items.push({ key, junction, cost });
    ensureJunctionArms(junction);
    return true;
  };

  if (carLocation.kind === "edge") {
    const currentEdge = carLocation.edge;
    const carSegment = segmentIndexAt(currentEdge, carLocation.edgePosition);
    const node = currentEdge.nodes[carSegment];
    const aheadStep = (node.forwardX * travelX + node.forwardZ * travelZ) >= 0 ? 1 : -1;
    startWalker(currentEdge, carSegment, aheadStep, 0, 1.0);
    startWalker(currentEdge, carSegment - aheadStep, -aheadStep, SEG_LENGTH * VIEW_BEHIND_WEIGHT, VIEW_BEHIND_WEIGHT);
  } else {
    addJunction(carLocation.junction, 0);
    for (const arm of carLocation.junction.arms) {
      if (!arm.edge) continue;
      const alignment = -Math.sin(arm.heading) * travelX - Math.cos(arm.heading) * travelZ;
      const weight = alignment > 0.3 ? 1.0 : (alignment > -0.5 ? 1.4 : VIEW_BEHIND_WEIGHT);
      startWalkerIntoArm(arm, SEG_LENGTH * weight, weight);
    }
  }

  for (const edge of roadGraph.edges.values()) {
    if (edge === carLocation.edge || !edgeMayBeWithin(edge, car.x, car.z, VISIBLE_SEED_RADIUS)) continue;
    const nearest = nearestPointOnEdge(edge, car.x, car.z);
    if (nearest.distance > VISIBLE_SEED_RADIUS) continue;
    startWalker(edge, nearest.segmentIndex, 1, nearest.distance, 1.0);
    startWalker(edge, nearest.segmentIndex - 1, -1, nearest.distance + SEG_LENGTH, 1.0);
  }

  while (items.length < MAX_SEGMENTS && walkers.length) {
    let cheapestIndex = 0;
    for (let index = 1; index < walkers.length; index++) {
      if (walkers[index].cost < walkers[cheapestIndex].cost) cheapestIndex = index;
    }
    const walker = walkers[cheapestIndex];
    if (walker.cost > MAX_VIEW_COST) break;
    if (walker.segmentIndex < 0 || walker.segmentIndex >= walker.edge.segmentCount) {
      walkers.splice(cheapestIndex, 1);
      const reachedJunction = walker.segmentIndex < 0 ? walker.edge.ja : walker.edge.jb;
      if (!addJunction(reachedJunction, walker.cost)) continue;
      for (const arm of reachedJunction.arms) {
        if (arm.edge && arm.edge !== walker.edge) startWalkerIntoArm(arm, walker.cost + SEG_LENGTH * walker.weight, walker.weight);
      }
      continue;
    }
    const key = segmentSlotKey(walker.edge, walker.segmentIndex);
    if (seenKeys.has(key)) {
      walkers.splice(cheapestIndex, 1);
      continue;
    }
    seenKeys.add(key);
    items.push({ key, edge: walker.edge, segmentIndex: walker.segmentIndex, cost: walker.cost });
    walker.segmentIndex += walker.step;
    walker.cost += SEG_LENGTH * walker.weight;
  }
  return items;
}
