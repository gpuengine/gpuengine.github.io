// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const CAR_HALF_WIDTH = 1.02;
const CAR_HALF_LENGTH = 2.22;
const OBSTACLE_SEPARATION_MARGIN = 0.02;
const HEAD_ON_IMPACT_ALIGNMENT = 0.75;
const HEAD_ON_BOUNCE_MIN_SPEED = 2.0;
const HEAD_ON_BOUNCE_FRACTION = 0.22;
const WALL_SCRAPE_SPEED_LOSS = 0.9;
const PEDESTRIAN_HALF_SIZE = 0.42;
const MAX_ROAD_SPEED = 62.0;
const MAX_OFFROAD_SPEED = 30.0;
const MAX_REVERSE_SPEED = -16.0;
const HILL_GRAVITY_PULL = 4.5;
const STRAIGHT_THROUGH_SPEED = 20.0;
const LEFT_TURN_SPEED = 10.0;
const RIGHT_TURN_SPEED = 8.0;
const CROSSROAD_ASSIST_LEAD = 3.0;
const MANUAL_STEER_HOLD_SECONDS = 0.9;
const SHORELINE_FOOTPRINT_MARGIN_METERS = 0.3;
const OBSTACLE_GATHER_RADIUS = FAR_REACH + 30.0;
const DRIVE_LIMIT_RETURN_SPEED = 5.0;
const DRIVE_LIMIT_RESPONSE_PER_SECOND = 10.0;
const GROUND_SETTLE_PER_SECOND = 18.0;
const CURB_CLIMB_PER_SECOND = 16.0;
const MAX_CURB_SINK = 0.2;

const JUNCTION_BLOCK_INFO = {
  active: true, inBlockIdx: 1, blockNumber: 0, isIntersection: true, isCrosswalk: false, isMidBlockCrossing: false,
  pavementStyle: 0, isWideBoulevardBlock: false,
  roadHalfWidth: 5.6, overBridgeStyle: -1, leftIsPark: false, rightIsPark: false,
  parkTheme: 0, leftIsField: false, rightIsField: false, fieldStyle: 0, leftIsValley: false, rightIsValley: false, waterStyle: 0, waterSide: 1
};

function updateSimulation(dt, renderer, sound) {
  advanceWeatherMorph(dt, state.car.speed);
  const biome = getBlendedBiome();
  const car = state.car;

  streamWorldAroundCar(car, renderer, dt);
  const roadFrame = readRoadFrameUnderCar(car);
  const crossroad = updateCrossroadAhead(car, dt);
  classifyCarSurface(car, roadFrame);
  if (state.trafficEnabled) updateTrafficAndPedestrians(dt);

  const controls = readDriveControls();
  applyThrottleAndBrakes(car, controls, dt);
  if (state.autoSteer) keepDistanceFromTrafficAhead(car, dt);
  const assistPlan = planCrossroadAssist(car, crossroad);
  slowForCrossroad(car, crossroad, assistPlan, dt);
  car.braking = controls.braking || controls.handbrake;
  turnCar(car, decideSteering(car, roadFrame, crossroad, assistPlan, dt), controls.handbrake, dt);

  const axes = carAxes(car);
  const hitTraffic = moveCarResolvingTraffic(car, axes, dt);
  keepCarOnLand(car, axes, dt);
  const hitProp = handleObstacleContact(car, axes);
  const hitSomething = hitTraffic || hitProp;
  updateCollisionFeedback(car, hitSomething, sound, dt);
  if (!car.offRoad && !hitSomething && car.speed > 0) car.distanceMeters += car.speed * dt;

  followGround(car, roadFrame, axes, dt);
  updateSuspension(car, dt);
  spawnDriveParticles(car, axes, roadFrame, biome, controls.handbrake);
  advanceParticles(dt);

  const dynamicMesh = uploadDynamicDriveMesh(car, renderer, biome);
  updateDriveCamera(car, axes, dt);
  writeDriveUniforms(renderer, biome, car, axes);
  updateDriveSoundAndHud(car, roadFrame, sound, biome, controls.accelerating, dt);
  return dynamicMesh;
}

function readRoadFrameUnderCar(car) {
  if (carLocation.kind !== "edge") {
    const junction = carLocation.junction;
    return {
      onEdge: false,
      startNode: null,
      endNode: null,
      segmentFraction: 0,
      centerX: junction.x, centerY: junction.y, centerZ: junction.z,
      heading: car.heading,
      rightX: Math.cos(car.heading), rightZ: -Math.sin(car.heading),
      lateralOffset: 0,
      blockInfo: JUNCTION_BLOCK_INFO,
      travelDirection: 1
    };
  }
  const currentEdge = carLocation.edge;
  const segmentIndex = clamp(Math.floor(carLocation.edgePosition), 0, currentEdge.segmentCount - 1);
  const startNode = currentEdge.nodes[segmentIndex];
  const endNode = currentEdge.nodes[segmentIndex + 1];
  const segmentFraction = clamp(carLocation.edgePosition - segmentIndex, 0, 1);
  const centerX = lerp(startNode.x, endNode.x, segmentFraction);
  const centerZ = lerp(startNode.z, endNode.z, segmentFraction);
  let rightX = lerp(startNode.rightX, endNode.rightX, segmentFraction);
  let rightZ = lerp(startNode.rightZ, endNode.rightZ, segmentFraction);
  const rightLength = Math.hypot(rightX, rightZ) || 1;
  rightX /= rightLength;
  rightZ /= rightLength;
  const travelHeading = car.speed >= -0.5 ? car.heading : car.heading + Math.PI;
  return {
    onEdge: true,
    startNode,
    endNode,
    segmentFraction,
    centerX,
    centerY: lerp(startNode.y, endNode.y, segmentFraction),
    centerZ,
    heading: lerp(startNode.heading, endNode.heading, segmentFraction),
    rightX,
    rightZ,
    lateralOffset: (car.x - centerX) * rightX + (car.z - centerZ) * rightZ,
    blockInfo: startNode.info,
    travelDirection: Math.cos(travelHeading - startNode.heading) >= 0 ? 1 : -1
  };
}

function classifyCarSurface(car, roadFrame) {
  const blockInfo = roadFrame.blockInfo;
  const distanceFromCenter = Math.abs(roadFrame.lateralOffset);
  const carSide = roadFrame.lateralOffset < 0 ? -1 : 1;
  if (!roadFrame.onEdge) {
    const distanceFromJunction = Math.hypot(car.x - roadFrame.centerX, car.z - roadFrame.centerZ);
    car.surface = distanceFromJunction <= carLocation.junction.radius + 0.3 ? "cross" : "plaza";
  } else if (distanceFromCenter <= blockInfo.roadHalfWidth - 0.08) {
    car.surface = "road";
  } else if (blockInfo.isIntersection && distanceFromCenter < PARALLEL_STREET_LAT) {
    car.surface = "cross";
  } else if (distanceFromCenter <= blockInfo.roadHalfWidth + 2.8) {
    car.surface = "sidewalk";
  } else if (sideIsParkOf(blockInfo, carSide) && distanceFromCenter < blockInfo.roadHalfWidth + PARK_LAWN_DEPTH_METERS && !(carSide < 0 ? roadFrame.startNode.hidesLeftSide : roadFrame.startNode.hidesRightSide)) {
    car.surface = "lawn";
  } else {
    car.surface = "plaza";
  }
  car.offRoad = car.surface !== "road" && car.surface !== "cross";
}

function readDriveControls() {
  return {
    accelerating: playerInput.keys.up || state.cruiseHold,
    braking: playerInput.keys.down,
    handbrake: playerInput.keys.space
  };
}

function applyThrottleAndBrakes(car, controls, dt) {
  const maxSpeed = car.offRoad ? MAX_OFFROAD_SPEED : MAX_ROAD_SPEED;
  if (controls.accelerating && !controls.braking) {
    const accelForce = (1.0 - (car.speed / maxSpeed) * 0.45) * 19.5;
    car.speed += accelForce * dt;
    car.accelPitch = lerp(car.accelPitch, 0.024, dt * 8);
  } else if (controls.braking) {
    if (car.speed > 1.0) {
      car.speed -= 34.0 * dt;
      car.accelPitch = lerp(car.accelPitch, -0.038, dt * 10);
    } else {
      car.speed -= 14.5 * dt;
    }
  } else {
    car.speed *= (1.0 - 0.32 * dt);
    car.accelPitch = lerp(car.accelPitch, 0.0, dt * 6);
  }
  if (controls.handbrake) car.speed *= (1.0 - 1.35 * dt);
  if (car.offRoad) car.speed *= (1.0 - 0.65 * dt);
  car.speed -= Math.sin(car.pitch) * HILL_GRAVITY_PULL * dt;
  car.speed = clamp(car.speed, MAX_REVERSE_SPEED, maxSpeed);
}

function planCrossroadAssist(car, crossroad) {
  const choices = crossroad.choices;
  const wantsAssist = (state.turnIntent < 0 && choices.left) || (state.turnIntent > 0 && choices.right) || state.autoSteer;
  const targetArm = wantsAssist && car.speed > 0.5 ? armForTurnIntent(choices, state.turnIntent, crossroad.junction) : null;
  const isTurning = !!targetArm && targetArm !== choices.straight;
  const turnSpeedCap = isTurning ? (targetArm === choices.left ? LEFT_TURN_SPEED : RIGHT_TURN_SPEED) : STRAIGHT_THROUGH_SPEED;
  return { targetArm, turnSpeedCap };
}

function slowForCrossroad(car, crossroad, assistPlan, dt) {
  if (!assistPlan.targetArm || crossroad.distance >= 90) return;
  const cap = assistPlan.turnSpeedCap;
  const approachCap = crossroad.inside
    ? cap
    : Math.sqrt(cap * cap + 2.0 * 9.0 * Math.max(0, crossroad.distance - 6.0));
  if (car.speed > approachCap) {
    car.speed = Math.max(approachCap, car.speed - 42.0 * dt);
    car.accelPitch = lerp(car.accelPitch, -0.03, dt * 8);
  }
}

function decideSteering(car, roadFrame, crossroad, assistPlan, dt) {
  let steerTarget = readSteeringInput();
  const manualSteer = Math.abs(steerTarget) > 0.01;
  state.manualSteerHold = manualSteer ? MANUAL_STEER_HOLD_SECONDS : Math.max(0, state.manualSteerHold - dt);
  if (roadFrame.onEdge) {
    const offsetInTravelDirection = roadFrame.lateralOffset * roadFrame.travelDirection;
    if (offsetInTravelDirection < -0.8) state.laneSide = -1;
    else if (offsetInTravelDirection > 0.8) state.laneSide = 1;
  }
  const laneSide = state.laneSide;
  const targetArm = assistPlan.targetArm;
  const assistActive = targetArm && !manualSteer &&
    crossroad.fromEdge && (crossroad.inside || crossroad.distance < CROSSROAD_ASSIST_LEAD);
  if (assistActive) {
    const lane = laneOffsetFor(armEndNode(targetArm, TURN_EXIT_AIM_SEGMENTS).info);
    const path = junctionTurnPath(crossroad.junction, crossroad.fromEdge, crossroad.fromEnd, targetArm);
    const aimPoint = junctionPathAim(path, car, targetArm, lane);
    steerTarget = pursuitSteer(car, aimPoint.x, aimPoint.z);
  } else if (roadFrame.onEdge && !manualSteer && state.manualSteerHold <= 0 && (state.autoSteer || state.turnAlignTimer > 0)) {
    steerTarget = laneFollowSteer(car, carLocation.edge, carLocation.edgePosition, roadFrame.travelDirection, laneSide);
    if (!state.autoSteer && Math.abs(steerTarget) < 0.02) state.turnAlignTimer = 0;
  }
  if (roadFrame.onEdge && state.wasOnJunction) {
    state.turnAlignTimer = 3.0;
    state.turnIntent = 0;
  }
  state.wasOnJunction = !roadFrame.onEdge;
  return steerTarget;
}

function readSteeringInput() {
  let steer = 0;
  if (playerInput.keys.left) steer += 1.0;
  if (playerInput.keys.right) steer -= 1.0;
  if (Math.abs(playerInput.touchSteerValue) > 0.01) steer = clamp(steer + playerInput.touchSteerValue, -1.0, 1.0);
  return steer;
}

function pursuitSteer(car, aimX, aimZ) {
  const headingError = wrapAngle(Math.atan2(-(aimX - car.x), -(aimZ - car.z)) - car.heading);
  return clamp(headingError * 2.4, -1.0, 1.0);
}

function laneFollowSteer(car, edge, edgePosition, travelDir, laneSide) {
  const lookMeters = Math.max(9.0, Math.abs(car.speed) * 0.75);
  const target = clamp(edgePosition + travelDir * lookMeters / SEG_LENGTH, 0, edge.segmentCount);
  const sample = sampleEdge(edge, target);
  const lane = laneOffsetFor(sample.info) * travelDir * laneSide;
  const aimX = sample.x + sample.rightX * lane;
  const aimZ = sample.z + sample.rightZ * lane;
  const headingError = wrapAngle(Math.atan2(-(aimX - car.x), -(aimZ - car.z)) - car.heading);
  return clamp(headingError * 2.2, -0.9, 0.9);
}

function turnCar(car, steerTarget, handbrake, dt) {
  const speedSteerFactor = 1.0 / (1.0 + Math.abs(car.speed) * 0.019);
  car.steerAngle = lerp(car.steerAngle, steerTarget, dt * 9.5);
  const turnRate = car.steerAngle * (1.75 + (handbrake ? 0.85 : 0.0)) * speedSteerFactor;
  if (Math.abs(car.speed) > 0.2) {
    const drivingDirection = car.speed >= 0 ? 1 : -1;
    car.heading += turnRate * drivingDirection * dt * Math.min(1.0, Math.abs(car.speed) / 5.0);
  }
}

function carAxes(car) {
  return {
    forwardX: -Math.sin(car.heading),
    forwardY: Math.sin(car.pitch),
    forwardZ: -Math.cos(car.heading),
    rightX: Math.cos(car.heading),
    rightZ: -Math.sin(car.heading)
  };
}

function moveCarResolvingTraffic(car, axes, dt) {
  const stepX = axes.forwardX * car.speed * dt;
  const stepZ = axes.forwardZ * car.speed * dt;
  const nextX = car.x + stepX;
  const nextZ = car.z + stepZ;
  const blocked = state.trafficEnabled &&
    (pushCarOutOfVehicles(car, axes, nextX, nextZ) || pushCarOutOfPedestrians(car, axes, nextX, nextZ));
  if (!blocked) {
    car.x += stepX;
    car.z += stepZ;
  }
  return blocked;
}

function pushCarOutOfVehicles(car, axes, nextX, nextZ) {
  for (const vehicle of state.traffic) {
    if (vehicle.mode === "hidden") continue;
    const offsetX = nextX - vehicle.x;
    const offsetZ = nextZ - vehicle.z;
    if (offsetX * offsetX + offsetZ * offsetZ > 64.0) continue;
    const along = offsetX * axes.forwardX + offsetZ * axes.forwardZ;
    const across = offsetX * axes.rightX + offsetZ * axes.rightZ;
    const minAcross = CAR_HALF_WIDTH + vehicle.width * 0.48;
    const minAlong = CAR_HALF_LENGTH + vehicle.length * 0.48;
    if (Math.abs(across) >= minAcross || Math.abs(along) >= minAlong) continue;
    const overlapAcross = minAcross - Math.abs(across);
    const overlapAlong = minAlong - Math.abs(along);
    if (overlapAlong < overlapAcross) {
      const alongSign = along >= 0 ? 1 : -1;
      car.x += axes.forwardX * alongSign * (overlapAlong + 0.08);
      car.z += axes.forwardZ * alongSign * (overlapAlong + 0.08);
      if (along < 0 && car.speed > 0) {
        car.speed = -Math.max(2.5, Math.min(8.0, car.speed * 0.35));
      } else if (along > 0 && car.speed < 0) {
        car.speed = 2.0;
      }
    } else {
      const acrossSign = across >= 0 ? 1 : -1;
      car.x += axes.rightX * acrossSign * (overlapAcross + 0.08);
      car.z += axes.rightZ * acrossSign * (overlapAcross + 0.08);
      car.speed *= 0.55;
    }
    return true;
  }
  return false;
}

function pushCarOutOfPedestrians(car, axes, nextX, nextZ) {
  for (const pedestrian of state.pedestrians) {
    if (pedestrian.hidden) continue;
    const offsetX = nextX - pedestrian.x;
    const offsetZ = nextZ - pedestrian.z;
    if (offsetX * offsetX + offsetZ * offsetZ > 25.0) continue;
    const along = offsetX * axes.forwardX + offsetZ * axes.forwardZ;
    const across = offsetX * axes.rightX + offsetZ * axes.rightZ;
    if (Math.abs(across) >= CAR_HALF_WIDTH + PEDESTRIAN_HALF_SIZE || Math.abs(along) >= CAR_HALF_LENGTH + PEDESTRIAN_HALF_SIZE) continue;
    const isDrivingTowardPedestrian = (along < 0) === (car.speed > 0);
    if (!isDrivingTowardPedestrian) continue;
    car.speed = 0;
    return true;
  }
  return false;
}

function keepCarOnLand(car, axes, dt) {
  const escape = shorelineEscapeForFootprint(carFootprintCorners(car, axes, SHORELINE_FOOTPRINT_MARGIN_METERS));
  if (!escape) return;
  glideBackInside(car, axes, escape.outwardX, escape.outwardZ, escape.excess, dt);
}

function carFootprintCorners(car, axes, marginMeters) {
  const halfLength = CAR_HALF_LENGTH + marginMeters;
  const halfWidth = CAR_HALF_WIDTH + marginMeters;
  const corners = [];
  for (const along of [-halfLength, halfLength]) {
    for (const across of [-halfWidth, halfWidth]) {
      corners.push([car.x + axes.forwardX * along + axes.rightX * across, car.z + axes.forwardZ * along + axes.rightZ * across]);
    }
  }
  return corners;
}

function glideBackInside(car, axes, outwardX, outwardZ, excess, dt) {
  const outwardSpeed = Math.max(0, car.speed * (axes.forwardX * outwardX + axes.forwardZ * outwardZ));
  const maxStep = (outwardSpeed + DRIVE_LIMIT_RETURN_SPEED) * dt;
  const step = Math.min(excess * Math.min(1.0, dt * DRIVE_LIMIT_RESPONSE_PER_SECOND), maxStep);
  car.x -= outwardX * step;
  car.z -= outwardZ * step;
  car.speed *= (1.0 - Math.min(1.0, 2.0 * dt));
}

function handleObstacleContact(car, axes) {
  const obstacleHit = resolveObstacleCollisions(car, axes);
  if (!obstacleHit) return false;
  const travelSign = car.speed >= 0 ? 1 : -1;
  const intoObstacle = -(axes.forwardX * obstacleHit.nx + axes.forwardZ * obstacleHit.nz) * travelSign;
  if (intoObstacle <= 0) return true;
  if (intoObstacle > HEAD_ON_IMPACT_ALIGNMENT) {
    car.speed = Math.abs(car.speed) > HEAD_ON_BOUNCE_MIN_SPEED ? -car.speed * HEAD_ON_BOUNCE_FRACTION : 0.0;
    return true;
  }
  car.speed *= 1.0 - intoObstacle * WALL_SCRAPE_SPEED_LOSS;
  return true;
}

function resolveObstacleCollisions(car, axes) {
  let strongestHit = null;
  const carBox = { rightX: axes.rightX, rightZ: axes.rightZ, forwardX: axes.forwardX, forwardZ: axes.forwardZ, halfWidth: CAR_HALF_WIDTH, halfLength: CAR_HALF_LENGTH };
  const carReach = Math.hypot(CAR_HALF_WIDTH, CAR_HALF_LENGTH);
  for (const obstacles of obstacleListsNear(car.x, car.z, OBSTACLE_GATHER_RADIUS)) {
    for (const obstacle of obstacles) {
      const reach = Math.hypot(obstacle.halfWidth, obstacle.halfDepth) + carReach;
      const toCarX = car.x - obstacle.x;
      const toCarZ = car.z - obstacle.z;
      if (toCarX * toCarX + toCarZ * toCarZ > reach * reach) continue;
      const push = boxSeparation(carBox, toCarX, toCarZ, obstacle);
      if (!push) continue;
      car.x += push.nx * (push.depth + OBSTACLE_SEPARATION_MARGIN);
      car.z += push.nz * (push.depth + OBSTACLE_SEPARATION_MARGIN);
      if (!strongestHit || push.depth > strongestHit.depth) strongestHit = push;
    }
  }
  return strongestHit;
}

function boxSeparation(carBox, toCarX, toCarZ, obstacle) {
  const obstacleRightX = obstacle.rightX, obstacleRightZ = obstacle.rightZ;
  const obstacleForwardX = -obstacle.rightZ, obstacleForwardZ = obstacle.rightX;
  const candidateAxes = [
    [carBox.rightX, carBox.rightZ], [carBox.forwardX, carBox.forwardZ],
    [obstacleRightX, obstacleRightZ], [obstacleForwardX, obstacleForwardZ]
  ];
  let best = null;
  for (const [axisX, axisZ] of candidateAxes) {
    const carExtent = carBox.halfWidth * Math.abs(carBox.rightX * axisX + carBox.rightZ * axisZ) + carBox.halfLength * Math.abs(carBox.forwardX * axisX + carBox.forwardZ * axisZ);
    const obstacleExtent = obstacle.halfWidth * Math.abs(obstacleRightX * axisX + obstacleRightZ * axisZ) + obstacle.halfDepth * Math.abs(obstacleForwardX * axisX + obstacleForwardZ * axisZ);
    const centerGap = toCarX * axisX + toCarZ * axisZ;
    const depth = carExtent + obstacleExtent - Math.abs(centerGap);
    if (depth <= 0) return null;
    if (!best || depth < best.depth) {
      const awayFromObstacle = centerGap >= 0 ? 1 : -1;
      best = { nx: axisX * awayFromObstacle, nz: axisZ * awayFromObstacle, depth };
    }
  }
  return best;
}

function updateCollisionFeedback(car, hitSomething, sound, dt) {
  if (hitSomething) {
    if (!car.colliding) sound.playCollisionBump();
    car.colliding = true;
    car.collisionFlashTimer = 0.38;
    return;
  }
  car.colliding = false;
  car.collisionFlashTimer = Math.max(0.0, car.collisionFlashTimer - dt);
}

function followGround(car, roadFrame, axes, dt) {
  const groundY = terrainHeightAt(car.x, car.z) + roadFrame.centerY + groundOffsetUnder(roadFrame, car.x, car.z);
  let terrainPitch = terrainPitchAlong(car.x, car.z, car.heading, CAR_HALF_LENGTH);
  let terrainRoll = terrainRollAcross(car.x, car.z, car.heading, CAR_HALF_WIDTH);
  if (car.offRoad || car.surface === "plaza") {
    const frontHeight = groundOffsetUnder(roadFrame, car.x + axes.forwardX * 1.6, car.z + axes.forwardZ * 1.6);
    const backHeight = groundOffsetUnder(roadFrame, car.x - axes.forwardX * 1.6, car.z - axes.forwardZ * 1.6);
    const rightHeight = groundOffsetUnder(roadFrame, car.x + axes.rightX * 0.9, car.z + axes.rightZ * 0.9);
    const leftHeight = groundOffsetUnder(roadFrame, car.x - axes.rightX * 0.9, car.z - axes.rightZ * 0.9);
    terrainPitch += Math.atan2(frontHeight - backHeight, 3.2);
    terrainRoll += Math.atan2(rightHeight - leftHeight, 1.8);
  }
  const settleRate = car.y < groundY ? CURB_CLIMB_PER_SECOND : GROUND_SETTLE_PER_SECOND;
  car.y = Math.max(groundY - MAX_CURB_SINK, lerp(car.y, groundY, Math.min(1.0, dt * settleRate)));
  car.pitch = lerp(car.pitch, terrainPitch, dt * 10.0);
  car.roll = lerp(car.roll, terrainRoll, dt * 10.0);
  car.steerRoll = lerp(car.steerRoll, car.steerAngle * (car.speed / 45.0) * 0.085, dt * 8.0);
}

function groundOffsetUnder(roadFrame, worldX, worldZ) {
  if (!roadFrame.onEdge) {
    const distance = Math.hypot(worldX - roadFrame.centerX, worldZ - roadFrame.centerZ);
    return distance <= carLocation.junction.radius + 0.4 ? 0.0 : 0.18;
  }
  const lateral = (worldX - roadFrame.centerX) * roadFrame.rightX + (worldZ - roadFrame.centerZ) * roadFrame.rightZ;
  return lerp(
    groundHeightAtLateral(roadFrame.startNode, lateral, worldX, worldZ),
    groundHeightAtLateral(roadFrame.endNode, lateral, worldX, worldZ),
    roadFrame.segmentFraction
  );
}

function updateSuspension(car, dt) {
  car.wheelSpin = (car.wheelSpin + car.speed * dt * 1.4) % (Math.PI * 2);
  const bobFrequency = car.offRoad ? 22.0 : 11.0;
  const bobAmplitude = (car.offRoad ? 0.045 : 0.010) * Math.min(1.0, Math.abs(car.speed) / 20.0);
  car.suspBob = Math.sin(environment.time * bobFrequency) * bobAmplitude;
}

function writeDriveUniforms(renderer, biome, car, axes) {
  const fieldOfView = (58 + clamp(car.speed / 65.0, 0, 1) * 12) * (Math.PI / 180);
  writeFrameUniforms(renderer, { camera: state.cam, biome, fieldOfView, nearPlane: 0.35, farPlane: 520.0 });
  setUniformVec4(renderer.uniformData, UNIFORM_VEC4_SLOT.carPosAndHeading, car.x, car.y, car.z, car.heading);
  setUniformVec4(renderer.uniformData, UNIFORM_VEC4_SLOT.carFwdAndSpeed, axes.forwardX, Math.sin(car.pitch), axes.forwardZ, car.speed);
}

function updateDriveSoundAndHud(car, roadFrame, sound, biome, accelerating, dt) {
  const speedKmh = Math.abs(Math.round(car.speed * 3.6));
  const blockInfo = roadFrame.blockInfo;
  const viaduct = roadFrame.onEdge ? getViaductProfile(roadFrame.startNode.index) : { isViaduct: false };
  const nearWaterOrBridge = blockInfo.leftIsValley || blockInfo.rightIsValley || viaduct.isViaduct;
  sound.update(speedKmh, accelerating, car.offRoad, dt, car.pitch, car.steerAngle, nearWaterOrBridge);
  updateDrivingHud(speedKmh, biome, blockInfo);
}
