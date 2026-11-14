// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const TRAFFIC_VEHICLE_COUNT = 12;
const PEDESTRIAN_COUNT = 8;
const HIDDEN_ACTOR_ELEVATION = -50;
const TRAFFIC_LOOKAHEAD_METERS = 18.0;
const TRAFFIC_STOP_GAP_METERS = 7.0;
const PEDESTRIAN_STOP_GAP_METERS = 4.0;
const FOLLOW_SPEED_PER_METER_OF_GAP = 1.6;
const FOLLOW_BRAKE_PER_SECOND = 6.0;
const FOLLOW_LANE_HALF_WIDTH = 2.4;
const CONVOY_GAP_SEGMENTS = 6.5;
const CONVOY_SPEED_FACTOR = 0.9;
const JUNCTION_CROSSING_SPEED_FACTOR = 0.6;
const MIN_CROSSING_PATH_METERS = 4;
const VEHICLE_PITCH_PROBE_METERS = 1.6;
const VEHICLE_SPAWN_COST_RANGE = { min: 70, max: 520, minDistanceFromCar: 45 };
const PEDESTRIAN_SPAWN_COST_RANGE = { min: 25, max: 320, minDistanceFromCar: 18 };
const PEDESTRIAN_CURB_OFFSET = 0.95;
const PEDESTRIAN_STRIDE_RATE = 4.2;
const PEDESTRIAN_CROSSING_CHANCE = 0.55;
const YELLOW_CAB_CHANCE = 0.48;
const YELLOW_CAB_COLOR = [0.98, 0.76, 0.10];
const VEHICLE_TRIM_COLOR = [0.88, 0.90, 0.94];
const PEDESTRIAN_PANTS_COLOR = [0.16, 0.20, 0.28];

const TRAFFIC_COLORS = [
  [0.20, 0.58, 0.86],
  [0.95, 0.72, 0.18],
  [0.24, 0.76, 0.52],
  [0.86, 0.88, 0.92],
  [0.68, 0.34, 0.88],
  [0.94, 0.44, 0.22],
  [0.28, 0.32, 0.40]
];

const VEHICLE_TYPES = [
  { type: "truck", minRoll: 0.76, width: 2.28, length: 6.6, height: 2.45, minSpeed: 11.0, speedRange: 10.0 },
  { type: "suv", minRoll: 0.42, width: 2.05, length: 4.65, height: 1.68, minSpeed: 13.0, speedRange: 14.0 },
  { type: "sedan", minRoll: 0.0, width: 1.92, length: 4.25, height: 1.38, minSpeed: 14.0, speedRange: 16.0 }
];

function initTrafficAndPedestrians() {
  state.traffic = Array.from({ length: TRAFFIC_VEHICLE_COUNT }, createTrafficVehicle);
  state.pedestrians = Array.from({ length: PEDESTRIAN_COUNT }, createPedestrian);
}

function updateTrafficAndPedestrians(dt) {
  for (const vehicle of state.traffic) {
    vehicle.speed = vehicle.baseSpeed;
    slowBehindConvoyLeader(vehicle, state.traffic);
    yieldToPlayerCar(vehicle, state.car);
    updateVehicle(vehicle, dt);
  }
  for (const pedestrian of state.pedestrians) updatePedestrian(pedestrian, dt);
}

function keepDistanceFromTrafficAhead(car, dt) {
  if (!state.trafficEnabled || car.speed <= 0) return;
  let safeSpeed = Infinity;
  for (const vehicle of state.traffic) {
    if (vehicle.mode === "hidden") continue;
    const gap = distanceAheadInLane(car.x, car.z, car.heading, vehicle.x, vehicle.z);
    if (gap !== Infinity) safeSpeed = Math.min(safeSpeed, followingSpeedBehind(vehicle.speed, gap, TRAFFIC_STOP_GAP_METERS));
  }
  for (const pedestrian of state.pedestrians) {
    if (pedestrian.hidden) continue;
    const gap = distanceAheadInLane(car.x, car.z, car.heading, pedestrian.x, pedestrian.z);
    if (gap !== Infinity) safeSpeed = Math.min(safeSpeed, followingSpeedBehind(0, gap, PEDESTRIAN_STOP_GAP_METERS));
  }
  if (car.speed > safeSpeed) car.speed = lerp(car.speed, safeSpeed, Math.min(1.0, dt * FOLLOW_BRAKE_PER_SECOND));
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function pickSpawnSegment(spawnRange) {
  const car = state.car;
  const candidates = visibleStreamItems().filter(item => {
    if (!item.edge || item.cost < spawnRange.min || item.cost > spawnRange.max) return false;
    const node = item.edge.nodes[item.segmentIndex];
    return Math.hypot(node.x - car.x, node.z - car.z) >= spawnRange.minDistanceFromCar;
  });
  return candidates.length ? pickRandom(candidates) : null;
}

function createTrafficVehicle() {
  const typeRoll = Math.random();
  const vehicleType = VEHICLE_TYPES.find(candidate => typeRoll > candidate.minRoll) || VEHICLE_TYPES[VEHICLE_TYPES.length - 1];
  const baseSpeed = vehicleType.minSpeed + Math.random() * vehicleType.speedRange;
  const isYellowCab = vehicleType.type === "sedan" && Math.random() < YELLOW_CAB_CHANCE;
  return {
    edge: null,
    edgePosition: 0,
    travelDirection: 1,
    laneLat: LANE_OFFSET + (Math.random() - 0.5) * 0.45,
    mode: "hidden",
    crossing: null,
    speed: baseSpeed,
    baseSpeed,
    type: vehicleType.type,
    width: vehicleType.width,
    length: vehicleType.length,
    height: vehicleType.height,
    color: isYellowCab ? YELLOW_CAB_COLOR : pickRandom(TRAFFIC_COLORS),
    secondaryColor: VEHICLE_TRIM_COLOR,
    x: 0, y: HIDDEN_ACTOR_ELEVATION, z: 0,
    heading: 0, pitch: 0, roll: 0,
    wheelSpin: Math.random() * Math.PI * 2
  };
}

function hideVehicle(vehicle) {
  vehicle.mode = "hidden";
  vehicle.y = HIDDEN_ACTOR_ELEVATION;
}

function respawnVehicle(vehicle) {
  const item = pickSpawnSegment(VEHICLE_SPAWN_COST_RANGE);
  if (!item) {
    hideVehicle(vehicle);
    return;
  }
  vehicle.edge = item.edge;
  vehicle.edgePosition = item.segmentIndex + 0.5;
  vehicle.travelDirection = Math.random() < 0.5 ? 1 : -1;
  vehicle.mode = "edge";
  vehicle.crossing = null;
  vehicle.speed = vehicle.baseSpeed;
}

function vehicleLaneOffset(vehicle, info) {
  return laneOffsetFor(info, vehicle.laneLat);
}

function slowBehindConvoyLeader(vehicle, traffic) {
  if (vehicle.mode !== "edge") return;
  for (const other of traffic) {
    if (other === vehicle || other.mode !== "edge" || other.edge !== vehicle.edge || other.travelDirection !== vehicle.travelDirection) continue;
    const gapAheadSegments = (other.edgePosition - vehicle.edgePosition) * vehicle.travelDirection;
    if (gapAheadSegments > 0 && gapAheadSegments < CONVOY_GAP_SEGMENTS) {
      vehicle.speed = Math.min(vehicle.speed, other.speed * CONVOY_SPEED_FACTOR);
    }
  }
}

function beginVehicleCrossing(vehicle) {
  const isAtEdgeEnd = vehicle.edgePosition >= vehicle.edge.segmentCount;
  const junction = isAtEdgeEnd ? vehicle.edge.jb : vehicle.edge.ja;
  const exitArms = junction.arms.filter(arm => arm.edge && arm.edge !== vehicle.edge &&
    isSegmentBuilt(arm.edge, arm.end === "a" ? 0 : arm.edge.segmentCount - 1));
  if (!exitArms.length) {
    respawnVehicle(vehicle);
    return;
  }
  const exitArm = pickRandom(exitArms);
  const entryNode = isAtEdgeEnd ? vehicle.edge.nodes[vehicle.edge.segmentCount] : vehicle.edge.nodes[0];
  const entryPoint = lanePointOnNode(entryNode, vehicleLaneOffset(vehicle, entryNode.info) * vehicle.travelDirection);
  const exitDirection = armOutwardSign(exitArm);
  const exitNode = armEndNode(exitArm, 0);
  const exitPoint = lanePointOnNode(exitNode, vehicleLaneOffset(vehicle, exitNode.info) * exitDirection);
  const controlPoint = { x: junction.x, z: junction.z };
  const pathLength = Math.hypot(controlPoint.x - entryPoint.x, controlPoint.z - entryPoint.z) + Math.hypot(exitPoint.x - controlPoint.x, exitPoint.z - controlPoint.z);
  vehicle.mode = "cross";
  vehicle.crossing = {
    path: { p0: entryPoint, p1: controlPoint, p2: exitPoint },
    progress: 0,
    pathLength: Math.max(pathLength, MIN_CROSSING_PATH_METERS),
    toEdge: exitArm.edge,
    toEdgePosition: exitArm.end === "a" ? 0.02 : exitArm.edge.segmentCount - 0.02,
    toTravelDirection: exitDirection
  };
}

function updateVehicle(vehicle, dt) {
  if (vehicle.mode === "hidden") {
    respawnVehicle(vehicle);
    if (vehicle.mode === "hidden") return;
  }
  vehicle.wheelSpin = (vehicle.wheelSpin + vehicle.speed * dt * 1.3) % (Math.PI * 2);
  if (vehicle.mode === "cross") {
    advanceVehicleThroughJunction(vehicle, dt);
    if (vehicle.mode === "cross") return;
  }
  vehicle.edgePosition += (vehicle.travelDirection * vehicle.speed * dt) / SEG_LENGTH;
  if (vehicle.edgePosition >= vehicle.edge.segmentCount || vehicle.edgePosition <= 0) {
    beginVehicleCrossing(vehicle);
    return;
  }
  if (!isSegmentStreamed(vehicle.edge, vehicle.edgePosition)) {
    respawnVehicle(vehicle);
    return;
  }
  const sample = sampleEdge(vehicle.edge, vehicle.edgePosition);
  const lanePoint = lanePointOnNode(sample, vehicleLaneOffset(vehicle, sample.info) * vehicle.travelDirection);
  const heading = vehicle.travelDirection > 0 ? sample.heading : sample.heading + Math.PI;
  placeVehicleOnTerrain(vehicle, lanePoint, heading);
}

function advanceVehicleThroughJunction(vehicle, dt) {
  const crossing = vehicle.crossing;
  crossing.progress += (vehicle.speed * JUNCTION_CROSSING_SPEED_FACTOR * dt) / crossing.pathLength;
  if (crossing.progress >= 1) {
    vehicle.mode = "edge";
    vehicle.edge = crossing.toEdge;
    vehicle.edgePosition = crossing.toEdgePosition;
    vehicle.travelDirection = crossing.toTravelDirection;
    vehicle.crossing = null;
    return;
  }
  const tangent = quadraticBezierTangent(crossing.path, crossing.progress);
  placeVehicleOnTerrain(vehicle, quadraticBezierPoint(crossing.path, crossing.progress), Math.atan2(-tangent.x, -tangent.z));
}

function placeVehicleOnTerrain(vehicle, point, heading) {
  vehicle.x = point.x;
  vehicle.z = point.z;
  vehicle.y = terrainHeightAt(point.x, point.z);
  vehicle.heading = heading;
  vehicle.pitch = terrainPitchAlong(point.x, point.z, heading, VEHICLE_PITCH_PROBE_METERS);
  vehicle.roll = 0;
}

function createPedestrian() {
  return {
    edge: null,
    edgePosition: 0,
    lat: 6.0,
    dirLat: 1,
    crossing: false,
    hidden: true,
    walkSpeed: 1.55 + Math.random() * 1.15,
    alongDir: Math.random() < 0.5 ? 1 : -1,
    walkPhase: Math.random() * Math.PI * 2,
    shirtColor: pickRandom(TRAFFIC_COLORS),
    pantsColor: PEDESTRIAN_PANTS_COLOR,
    x: 0, y: HIDDEN_ACTOR_ELEVATION, z: 0,
    heading: 0
  };
}

function respawnPedestrian(pedestrian) {
  const item = pickSpawnSegment(PEDESTRIAN_SPAWN_COST_RANGE);
  if (!item) {
    pedestrian.hidden = true;
    pedestrian.y = HIDDEN_ACTOR_ELEVATION;
    return;
  }
  const startSide = Math.random() < 0.5 ? -1 : 1;
  pedestrian.edge = item.edge;
  pedestrian.edgePosition = item.segmentIndex + 0.5;
  pedestrian.crossing = Math.random() < PEDESTRIAN_CROSSING_CHANCE;
  pedestrian.lat = startSide * (item.edge.nodes[item.segmentIndex].info.roadHalfWidth + PEDESTRIAN_CURB_OFFSET);
  pedestrian.dirLat = -startSide;
  pedestrian.alongDir = Math.random() < 0.5 ? 1 : -1;
  pedestrian.hidden = false;
}

function updatePedestrian(pedestrian, dt) {
  if (pedestrian.hidden) {
    respawnPedestrian(pedestrian);
    if (pedestrian.hidden) return;
  }
  pedestrian.walkPhase = (pedestrian.walkPhase + dt * pedestrian.walkSpeed * PEDESTRIAN_STRIDE_RATE) % (Math.PI * 2);
  walkPedestrian(pedestrian, dt);
  const isOffStreamedRoad = pedestrian.edgePosition < 0.5 || pedestrian.edgePosition > pedestrian.edge.segmentCount - 0.5 ||
    !isSegmentStreamed(pedestrian.edge, pedestrian.edgePosition);
  if (isOffStreamedRoad) {
    respawnPedestrian(pedestrian);
    return;
  }
  const sample = sampleEdge(pedestrian.edge, pedestrian.edgePosition);
  const position = lanePointOnNode(sample, pedestrian.lat);
  pedestrian.x = position.x;
  pedestrian.z = position.z;
  pedestrian.y = terrainHeightAt(position.x, position.z);
  pedestrian.heading = pedestrian.crossing
    ? (sample.heading + (pedestrian.dirLat > 0 ? -Math.PI * 0.5 : Math.PI * 0.5))
    : (pedestrian.alongDir > 0 ? sample.heading : sample.heading + Math.PI);
}

function walkPedestrian(pedestrian, dt) {
  const info = pedestrian.edge.nodes[segmentIndexAt(pedestrian.edge, pedestrian.edgePosition)].info;
  const sidewalkLat = info.roadHalfWidth + PEDESTRIAN_CURB_OFFSET;
  if (pedestrian.crossing) {
    pedestrian.lat += pedestrian.dirLat * pedestrian.walkSpeed * dt;
    if (pedestrian.lat > sidewalkLat) { pedestrian.lat = sidewalkLat; pedestrian.dirLat = -1; }
    else if (pedestrian.lat < -sidewalkLat) { pedestrian.lat = -sidewalkLat; pedestrian.dirLat = 1; }
    return;
  }
  pedestrian.lat = (pedestrian.lat >= 0 ? 1 : -1) * sidewalkLat;
  pedestrian.edgePosition += (pedestrian.alongDir * pedestrian.walkSpeed * dt) / SEG_LENGTH;
}

function distanceAheadInLane(fromX, fromZ, heading, targetX, targetZ) {
  const forwardX = -Math.sin(heading);
  const forwardZ = -Math.cos(heading);
  const offsetX = targetX - fromX;
  const offsetZ = targetZ - fromZ;
  const ahead = offsetX * forwardX + offsetZ * forwardZ;
  const sideways = Math.abs(offsetX * forwardZ - offsetZ * forwardX);
  return ahead > 0 && ahead < TRAFFIC_LOOKAHEAD_METERS && sideways < FOLLOW_LANE_HALF_WIDTH ? ahead : Infinity;
}

function followingSpeedBehind(leaderSpeed, gapMeters, stopGapMeters) {
  if (gapMeters <= stopGapMeters) return 0;
  return Math.max(0, leaderSpeed) + (gapMeters - stopGapMeters) * FOLLOW_SPEED_PER_METER_OF_GAP;
}

function yieldToPlayerCar(vehicle, car) {
  if (vehicle.mode === "hidden") return;
  const gap = distanceAheadInLane(vehicle.x, vehicle.z, vehicle.heading, car.x, car.z);
  if (gap === Infinity) return;
  vehicle.speed = Math.min(vehicle.speed, followingSpeedBehind(0, gap, TRAFFIC_STOP_GAP_METERS));
}
