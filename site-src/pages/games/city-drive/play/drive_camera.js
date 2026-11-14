// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const CAMERA_MODES = [
  { label: "Chase Cam", distance: 7.4, height: 2.45, lookDistance: 14.0, lookHeight: 0.85, stiffness: 8.5 },
  { label: "Action Low", distance: 5.2, height: 1.45, lookDistance: 18.0, lookHeight: 0.55, stiffness: 12.0 },
  { label: "Hood Cam", mountedOnHood: true },
  { label: "Heli Cam", distance: 14.5, height: 6.8, lookDistance: 18.0, lookHeight: 0.5, stiffness: 5.5 }
];

const HOOD_EYE_OFFSET = { up: 0.64, forward: -1.05 };
const HOOD_LOOK_OFFSET = { up: 0.46, forward: -28.0 };
const HOOD_MOUNT_HEIGHT = 0.42;

const CAMERA_WALL_CLEARANCE_METERS = 0.6;
const CAMERA_MIN_FOLLOW_DISTANCE_METERS = 1.2;
const CAMERA_OBSTACLE_SEARCH_RADIUS_METERS = FAR_REACH + 30.0;

function isHoodCamera(cameraMode) {
  return Boolean(CAMERA_MODES[cameraMode].mountedOnHood);
}

function nextCameraMode(cameraMode) {
  return (cameraMode + 1) % CAMERA_MODES.length;
}

function updateDriveCamera(car, axes, dt) {
  const mode = CAMERA_MODES[state.cameraMode];
  if (mode.mountedOnHood) {
    placeHoodCamera(car);
    return;
  }
  const camera = state.cam;
  const follow = Math.min(1.0, dt * mode.stiffness);
  const lookFollow = Math.min(1.0, follow * 1.2);
  camera.x = lerp(camera.x, car.x - axes.forwardX * mode.distance, follow);
  camera.y = lerp(camera.y, car.y - axes.forwardY * mode.distance + mode.height, follow);
  camera.z = lerp(camera.z, car.z - axes.forwardZ * mode.distance, follow);
  camera.lookX = lerp(camera.lookX, car.x + axes.forwardX * mode.lookDistance, lookFollow);
  camera.lookY = lerp(camera.lookY, car.y + axes.forwardY * mode.lookDistance + mode.lookHeight, lookFollow);
  camera.lookZ = lerp(camera.lookZ, car.z + axes.forwardZ * mode.lookDistance, lookFollow);
  keepCameraOutOfObstacles(camera, car);
}

function keepCameraOutOfObstacles(camera, car) {
  const ray = { fromX: car.x, fromZ: car.z, deltaX: camera.x - car.x, deltaZ: camera.z - car.z };
  const rayLength = Math.hypot(ray.deltaX, ray.deltaZ);
  if (rayLength <= CAMERA_MIN_FOLLOW_DISTANCE_METERS) return;
  const cameraHeightAboveTerrain = camera.y - terrainHeightAt(camera.x, camera.z);
  const hitFraction = nearestObstacleHitFraction(ray, cameraHeightAboveTerrain);
  if (hitFraction === null) return;
  const keptFraction = Math.max(CAMERA_MIN_FOLLOW_DISTANCE_METERS / rayLength, hitFraction);
  camera.x = ray.fromX + ray.deltaX * keptFraction;
  camera.z = ray.fromZ + ray.deltaZ * keptFraction;
}

function nearestObstacleHitFraction(ray, cameraHeightAboveTerrain) {
  let nearestFraction = null;
  for (const obstacles of obstacleListsNear(ray.fromX, ray.fromZ, CAMERA_OBSTACLE_SEARCH_RADIUS_METERS)) {
    for (const obstacle of obstacles) {
      if (obstacle.topY < cameraHeightAboveTerrain) continue;
      const entryFraction = rayEntryIntoObstacle(ray, obstacle, CAMERA_WALL_CLEARANCE_METERS) ?? rayEntryIntoObstacle(ray, obstacle, 0);
      if (entryFraction === null) continue;
      if (nearestFraction === null || entryFraction < nearestFraction) nearestFraction = entryFraction;
    }
  }
  return nearestFraction;
}

function rayEntryIntoObstacle(ray, obstacle, clearanceMeters) {
  const forwardX = -obstacle.rightZ, forwardZ = obstacle.rightX;
  const offsetX = ray.fromX - obstacle.x, offsetZ = ray.fromZ - obstacle.z;
  const slabs = [
    { start: offsetX * obstacle.rightX + offsetZ * obstacle.rightZ, step: ray.deltaX * obstacle.rightX + ray.deltaZ * obstacle.rightZ, halfExtent: obstacle.halfWidth + clearanceMeters },
    { start: offsetX * forwardX + offsetZ * forwardZ, step: ray.deltaX * forwardX + ray.deltaZ * forwardZ, halfExtent: obstacle.halfDepth + clearanceMeters }
  ];
  let entry = -Infinity, exit = Infinity;
  for (const { start, step, halfExtent } of slabs) {
    if (Math.abs(step) < 1e-9) {
      if (Math.abs(start) > halfExtent) return null;
      continue;
    }
    const firstCrossing = (-halfExtent - start) / step;
    const secondCrossing = (halfExtent - start) / step;
    entry = Math.max(entry, Math.min(firstCrossing, secondCrossing));
    exit = Math.min(exit, Math.max(firstCrossing, secondCrossing));
  }
  const isCarInsideBox = entry <= 0;
  if (entry > exit || exit <= 0 || entry > 1 || isCarInsideBox) return null;
  return entry;
}

function placeHoodCamera(car) {
  const mountY = car.y + HOOD_MOUNT_HEIGHT;
  const eye = transformPoint(0, HOOD_EYE_OFFSET.up, HOOD_EYE_OFFSET.forward, car.x, mountY, car.z, car.heading, car.pitch, car.roll);
  const look = transformPoint(0, HOOD_LOOK_OFFSET.up, HOOD_LOOK_OFFSET.forward, car.x, mountY, car.z, car.heading, car.pitch, car.roll);
  Object.assign(state.cam, { x: eye[0], y: eye[1], z: eye[2], lookX: look[0], lookY: look[1], lookZ: look[2] });
}
