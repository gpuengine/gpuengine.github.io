// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const CAR_BODY_BAND = Object.freeze({ stepOverMeters: 0.38, roofMeters: 1.45 });
const MAX_UPRIGHT_TILT_RADIANS = 0.35;

let activeObstacleList = null;
let activeCollisionGroundY = 0;

function collectObstacles(obstacleList, buildGeometry, groundY = 0) {
  const previousList = activeObstacleList;
  const previousGroundY = activeCollisionGroundY;
  activeObstacleList = obstacleList;
  activeCollisionGroundY = groundY;
  try {
    return buildGeometry();
  } finally {
    activeObstacleList = previousList;
    activeCollisionGroundY = previousGroundY;
  }
}

function registerObstacle(kind, centerX, centerZ, sizeAcross, sizeAlong, yaw, topY = Infinity) {
  if (!activeObstacleList) return;
  activeObstacleList.push({
    kind,
    x: centerX,
    z: centerZ,
    halfWidth: sizeAcross * 0.5,
    halfDepth: sizeAlong * 0.5,
    rightX: Math.cos(yaw),
    rightZ: -Math.sin(yaw),
    topY
  });
}

function registerSolidVolume({ centerX, centerZ, sizeAcross, sizeAlong, yaw, bottomY, topY }) {
  if (!activeObstacleList) return;
  if (!reachesCarBody(bottomY, topY)) return;
  registerObstacle("solid", centerX, centerZ, sizeAcross, sizeAlong, yaw, topY);
}

function registerSolidBox({ center, size, yaw, pitch, roll }) {
  if (!activeObstacleList) return;
  if (Math.abs(pitch) + Math.abs(roll) > MAX_UPRIGHT_TILT_RADIANS) return;
  const halfHeight = size[1] * 0.5;
  registerSolidVolume({
    centerX: center[0], centerZ: center[2],
    sizeAcross: size[0], sizeAlong: size[2], yaw,
    bottomY: center[1] - halfHeight, topY: center[1] + halfHeight
  });
}

function reachesCarBody(bottomY, topY) {
  return topY > activeCollisionGroundY + CAR_BODY_BAND.stepOverMeters && bottomY < activeCollisionGroundY + CAR_BODY_BAND.roofMeters;
}
