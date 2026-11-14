// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const OFF_ROAD_RELOCATE_MARGIN = 6.0;

const RELOCATE_SEARCH_RADIUS = 260.0;

const TURN_PATH_SAMPLES = 20;

const TURN_PATH_EXIT_PROGRESS = 0.85;

const TURN_PATH_AIM_LEAD = 0.3;

const TURN_EXIT_AIM_SEGMENTS = 4;

const EDGE_TRACKING_SEGMENT_WINDOW = 2;

const RELOCATE_MIN_IMPROVEMENT_METERS = 1.0;

const JUNCTION_ENTRY_MARGIN_METERS = 0.5;

const JUNCTION_BOUNCE_WINDOW_SECONDS = 1.5;

const JUNCTION_EXIT_MIN_ALIGNMENT = 0.62;

const TURN_STRAIGHT_MAX_ANGLE_RADIANS = 0.62;

const TURN_MAX_ANGLE_RADIANS = 2.55;

function moveCarLocationToEdge(nearest) {
  carLocation.kind = "edge";
  carLocation.edge = nearest.edge;
  carLocation.edgePosition = nearest.edgePosition;
  carLocation.junction = null;
}

function placeCarOnEdge(edge, edgePosition, travelDirection) {
  const sample = sampleEdge(edge, edgePosition);
  const lanePoint = lanePointOnNode(sample, laneOffsetFor(sample.info) * travelDirection);
  state.car.x = lanePoint.x;
  state.car.z = lanePoint.z;
  state.car.y = terrainHeightAt(lanePoint.x, lanePoint.z);
  state.car.heading = travelDirection > 0 ? sample.heading : sample.heading + Math.PI;
  state.car.pitch = 0;
  state.car.roll = 0;
  carLocation.kind = "edge";
  carLocation.edge = edge;
  carLocation.edgePosition = edgePosition;
  carLocation.junction = null;
}

function initWorldGraph(renderer) {
  const rng = makeRng(roadGraph.seedBase + 7);
  const start = createJunction(0, 0, Math.PI, rng).junction;
  ensureJunctionArms(start);
  let bestArm = null;
  for (const arm of start.arms) {
    if (!arm.edge) continue;
    if (!bestArm || Math.abs(wrapAngle(arm.heading)) < Math.abs(wrapAngle(bestArm.heading))) bestArm = arm;
  }
  placeCarOnEdge(bestArm.edge, 7.5, 1);
  state.car.speed = 22.0;
  syncVisibleSlots(renderer);
  processPendingBuilds(renderer, MAX_SEGMENTS);
  initTrafficAndPedestrians();
}

function resetCarToRoad() {
  if (carLocation.kind === "edge") {
    const currentEdge = carLocation.edge;
    const node = currentEdge.nodes[clamp(Math.round(carLocation.edgePosition), 0, currentEdge.segmentCount)];
    const travelDirection = (Math.cos(state.car.heading - node.heading) >= 0) ? 1 : -1;
    placeCarOnEdge(currentEdge, clamp(carLocation.edgePosition, 1.5, currentEdge.segmentCount - 1.5), travelDirection);
  } else {
    const arm = carLocation.junction.arms.find(candidate => candidate.edge);
    if (!arm) return;
    placeCarOnEdge(arm.edge, arm.end === "a" ? 2.5 : arm.edge.segmentCount - 2.5, armOutwardSign(arm));
  }
  state.car.speed = 14.0;
  state.car.colliding = false;
  state.turnIntent = 0;
}

function updateCarLocation(car) {
  if (carLocation.kind === "edge") {
    trackCarAlongEdge(car);
    return;
  }
  trackCarInsideJunction(car);
}

function trackCarAlongEdge(car) {
  const currentEdge = carLocation.edge;
  const closest = closestPointNearEdgePosition(currentEdge, carLocation.edgePosition, car);
  carLocation.edgePosition = closest.segmentIndex + closest.fraction;
  const distanceFromCenterline = Math.sqrt(closest.distanceSquared);
  if (relocateIfFarOffEdge(car, currentEdge, closest.segmentIndex, distanceFromCenterline)) return;
  const junctionPastEnd = junctionBeyondEdgeEnd(currentEdge, carLocation.edgePosition);
  if (junctionPastEnd && isCarWithinJunctionEntry(car, junctionPastEnd)) enterJunction(car, currentEdge, junctionPastEnd);
}

function closestPointNearEdgePosition(edge, edgePosition, car) {
  const baseSegment = Math.floor(edgePosition);
  const firstSegment = Math.max(0, baseSegment - EDGE_TRACKING_SEGMENT_WINDOW);
  const lastSegment = Math.min(edge.segmentCount - 1, baseSegment + EDGE_TRACKING_SEGMENT_WINDOW);
  const closest = { segmentIndex: 0, fraction: 0, distanceSquared: Infinity };
  for (let segmentIndex = firstSegment; segmentIndex <= lastSegment; segmentIndex++) {
    const fromNode = edge.nodes[segmentIndex];
    const toNode = edge.nodes[segmentIndex + 1];
    const segmentX = toNode.x - fromNode.x, segmentZ = toNode.z - fromNode.z;
    const segmentLengthSquared = segmentX * segmentX + segmentZ * segmentZ || 1;
    const fraction = ((car.x - fromNode.x) * segmentX + (car.z - fromNode.z) * segmentZ) / segmentLengthSquared;
    const clampedFraction = clamp(fraction, 0, 1);
    const gapX = fromNode.x + segmentX * clampedFraction - car.x;
    const gapZ = fromNode.z + segmentZ * clampedFraction - car.z;
    const distanceSquared = gapX * gapX + gapZ * gapZ;
    if (distanceSquared < closest.distanceSquared) {
      closest.distanceSquared = distanceSquared;
      closest.segmentIndex = segmentIndex;
      closest.fraction = fraction;
    }
  }
  return closest;
}

function relocateIfFarOffEdge(car, currentEdge, segmentIndex, distanceFromCenterline) {
  const offRoadDistance = distanceFromCenterline - currentEdge.nodes[segmentIndex].info.roadHalfWidth;
  const isFarOffRoad = offRoadDistance > OFF_ROAD_RELOCATE_MARGIN;
  if (!isFarOffRoad) return false;
  const nearest = nearestEdgePoint(car.x, car.z, RELOCATE_SEARCH_RADIUS);
  const isCloserOtherEdge = nearest && nearest.edge !== currentEdge && nearest.distance < distanceFromCenterline - RELOCATE_MIN_IMPROVEMENT_METERS;
  if (!isCloserOtherEdge) return false;
  moveCarLocationToEdge(nearest);
  return true;
}

function junctionBeyondEdgeEnd(edge, edgePosition) {
  if (edgePosition < 0) return edge.ja;
  if (edgePosition > edge.segmentCount) return edge.jb;
  return null;
}

function isCarWithinJunctionEntry(car, junction) {
  return Math.hypot(car.x - junction.x, car.z - junction.z) < junction.radius + JUNCTION_ENTRY_MARGIN_METERS;
}

function enterJunction(car, fromEdge, junction) {
  const isBounceBack = carLocation.lastJunction === junction && environment.time - carLocation.lastJunctionTime < JUNCTION_BOUNCE_WINDOW_SECONDS;
  carLocation.kind = "junction";
  carLocation.junction = junction;
  if (isBounceBack) {
    state.turnIntent = carLocation.lastIntent;
  } else {
    carLocation.fromEdge = fromEdge;
    carLocation.fromEnd = junction === fromEdge.jb ? "b" : "a";
    carLocation.entryHeading = car.speed >= 0 ? car.heading : car.heading + Math.PI;
  }
  carLocation.edge = null;
}

function trackCarInsideJunction(car) {
  const junction = carLocation.junction;
  const offsetFromCenterX = car.x - junction.x;
  const offsetFromCenterZ = car.z - junction.z;
  const distanceFromCenter = Math.hypot(offsetFromCenterX, offsetFromCenterZ);
  if (distanceFromCenter <= junction.radius) return;
  const exitArm = armAlignedWithOffset(junction, offsetFromCenterX, offsetFromCenterZ, distanceFromCenter);
  if (!exitArm) {
    relocateIfStrayedFromJunction(car, junction, distanceFromCenter);
    return;
  }
  exitJunctionOntoArm(car, junction, exitArm);
}

function armAlignedWithOffset(junction, offsetX, offsetZ, distanceFromCenter) {
  let bestArm = null;
  let bestAlignment = JUNCTION_EXIT_MIN_ALIGNMENT;
  for (const arm of junction.arms) {
    if (!arm.edge) continue;
    const alignment = (offsetX * -Math.sin(arm.heading) + offsetZ * -Math.cos(arm.heading)) / distanceFromCenter;
    if (alignment > bestAlignment) { bestAlignment = alignment; bestArm = arm; }
  }
  return bestArm;
}

function relocateIfStrayedFromJunction(car, junction, distanceFromCenter) {
  if (distanceFromCenter <= junction.radius + OFF_ROAD_RELOCATE_MARGIN) return;
  const nearest = nearestEdgePoint(car.x, car.z, RELOCATE_SEARCH_RADIUS);
  if (nearest && nearest.distance < distanceFromCenter - junction.radius) moveCarLocationToEdge(nearest);
}

function exitJunctionOntoArm(car, junction, arm) {
  carLocation.lastJunction = junction;
  carLocation.lastJunctionTime = environment.time;
  carLocation.lastIntent = state.turnIntent;
  carLocation.kind = "edge";
  carLocation.edge = arm.edge;
  carLocation.edgePosition = arm.end === "a" ? 0 : arm.edge.segmentCount;
  carLocation.junction = null;
  trackCarAlongEdge(car);
}

function aheadJunctionInfo(car) {
  const travelSign = car.speed >= -0.5 ? 1 : -1;
  const travelHeading = travelSign > 0 ? car.heading : car.heading + Math.PI;
  if (carLocation.kind === "junction") {
    return { junction: carLocation.junction, distance: 0, inside: true, approachHeading: carLocation.entryHeading, fromEdge: carLocation.fromEdge, fromEnd: carLocation.fromEnd };
  }
  const edge = carLocation.edge;
  const node = edge.nodes[clamp(Math.floor(carLocation.edgePosition), 0, edge.segmentCount)];
  const alongNodes = Math.cos(travelHeading - node.heading) >= 0;
  const nextJunction = alongNodes ? edge.jb : edge.ja;
  const distance = Math.max(0, (alongNodes ? (edge.segmentCount - carLocation.edgePosition) : carLocation.edgePosition) * SEG_LENGTH);
  const endNode = alongNodes ? edge.nodes[edge.segmentCount] : edge.nodes[0];
  return {
    junction: nextJunction,
    distance,
    inside: false,
    approachHeading: alongNodes ? endNode.heading : endNode.heading + Math.PI,
    fromEdge: edge,
    fromEnd: alongNodes ? "b" : "a"
  };
}

function junctionTurnPath(junction, fromEdge, fromEnd, arm) {
  const endNode = fromEnd === "b" ? fromEdge.nodes[fromEdge.segmentCount] : fromEdge.nodes[0];
  const entrySign = fromEnd === "b" ? 1 : -1;
  const entryPoint = lanePointOnNode(endNode, laneOffsetFor(endNode.info) * entrySign);
  const entryDirectionX = endNode.forwardX * entrySign, entryDirectionZ = endNode.forwardZ * entrySign;
  const outNode = armEndNode(arm, 0);
  const outSign = armOutwardSign(arm);
  const exitPoint = lanePointOnNode(outNode, laneOffsetFor(outNode.info) * outSign);
  const exitDirectionX = outNode.forwardX * outSign, exitDirectionZ = outNode.forwardZ * outSign;
  const determinant = -entryDirectionX * exitDirectionZ + exitDirectionX * entryDirectionZ;
  let cornerPoint = { x: (entryPoint.x + exitPoint.x) * 0.5, z: (entryPoint.z + exitPoint.z) * 0.5 };
  if (Math.abs(determinant) > 0.15) {
    const gapX = exitPoint.x - entryPoint.x, gapZ = exitPoint.z - entryPoint.z;
    const distanceToCorner = (gapX * -exitDirectionZ + exitDirectionX * gapZ) / determinant;
    if (distanceToCorner > 0 && distanceToCorner < junction.radius * 2.2) cornerPoint = { x: entryPoint.x + entryDirectionX * distanceToCorner, z: entryPoint.z + entryDirectionZ * distanceToCorner };
  }
  return { p0: entryPoint, p1: cornerPoint, p2: exitPoint };
}

function junctionPathAim(path, car, arm, lane) {
  let closestProgress = 0;
  let closestDistanceSquared = Infinity;
  for (let sampleIndex = 0; sampleIndex <= TURN_PATH_SAMPLES; sampleIndex++) {
    const progress = sampleIndex / TURN_PATH_SAMPLES;
    const pathPoint = quadraticBezierPoint(path, progress);
    const distanceSquared = (pathPoint.x - car.x) ** 2 + (pathPoint.z - car.z) ** 2;
    if (distanceSquared < closestDistanceSquared) {
      closestDistanceSquared = distanceSquared;
      closestProgress = progress;
    }
  }
  if (closestProgress >= TURN_PATH_EXIT_PROGRESS) return armLanePoint(arm, TURN_EXIT_AIM_SEGMENTS, lane);
  return quadraticBezierPoint(path, Math.min(1, closestProgress + TURN_PATH_AIM_LEAD));
}

function classifyJunctionArms(junction, approachHeading, fromEdge) {
  const bestArmBySlot = { left: null, straight: null, right: null };
  const bestDeviationBySlot = { left: Infinity, straight: Infinity, right: Infinity };
  for (const arm of junction.arms) {
    if (!arm.edge) continue;
    if (fromEdge && arm.edge === fromEdge) continue;
    const relativeHeading = wrapAngle(arm.heading - approachHeading);
    if (Math.abs(relativeHeading) > TURN_MAX_ANGLE_RADIANS) continue;
    let slot;
    let idealRelativeHeading;
    if (Math.abs(relativeHeading) < TURN_STRAIGHT_MAX_ANGLE_RADIANS) { slot = "straight"; idealRelativeHeading = 0; }
    else if (relativeHeading > 0) { slot = "left"; idealRelativeHeading = Math.PI * 0.5; }
    else { slot = "right"; idealRelativeHeading = -Math.PI * 0.5; }
    const deviation = Math.abs(relativeHeading - idealRelativeHeading);
    if (deviation < bestDeviationBySlot[slot]) { bestDeviationBySlot[slot] = deviation; bestArmBySlot[slot] = arm; }
  }
  return bestArmBySlot;
}

function armForTurnIntent(choices, intent, junction) {
  if (intent < 0 && choices.left) return choices.left;
  if (intent > 0 && choices.right) return choices.right;
  if (choices.straight) return choices.straight;
  const side = junction.seed > 0.5 ? choices.left || choices.right : choices.right || choices.left;
  if (side) return side;
  return junction.arms.find(candidate => candidate.edge) || null;
}

function updateCrossroadAhead(car, dt) {
  const crossroad = aheadJunctionInfo(car);
  crossroad.choices = classifyJunctionArms(crossroad.junction, crossroad.approachHeading, crossroad.fromEdge);
  state.crossroad = crossroad;
  state.turnAlignTimer = Math.max(0.0, state.turnAlignTimer - dt);
  return crossroad;
}
