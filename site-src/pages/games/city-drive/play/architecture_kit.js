// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const ROUND_COLUMN_SIDE_COUNT = 8;
const COLUMN_TOP_TAPER = 0.88;
const STEP_FOOTING_DEPTH = 1.2;

const STONE_TONES = Object.freeze({
  limestone: [0.74, 0.70, 0.62],
  paleLimestone: [0.80, 0.77, 0.70],
  granite: [0.48, 0.47, 0.45],
  darkGranite: [0.36, 0.37, 0.39],
  sandstone: [0.70, 0.60, 0.46],
  brownstone: [0.50, 0.35, 0.28],
  portland: [0.84, 0.82, 0.76],
  slate: [0.26, 0.28, 0.31],
  copper: [0.28, 0.50, 0.43],
  bronze: [0.36, 0.27, 0.18],
  ironBlack: [0.10, 0.11, 0.12],
  stucco: [0.92, 0.90, 0.85],
  darkGlass: [0.12, 0.16, 0.21]
});

const MARBLE_TONES = Object.freeze([
  [0.84, 0.83, 0.80],
  [0.82, 0.80, 0.76],
  [0.80, 0.82, 0.83]
]);

const BRUTALIST_CONCRETE = Object.freeze([0.60, 0.59, 0.56]);
const BRUTALIST_ROOF_SLAB_METERS = 0.6;
const BRUTALIST_PLANT_ROOM = Object.freeze({ heightMeters: 1.6, footprintShare: 0.5, minimumHalfSizeMeters: 2.5 });

const ASHLAR_TONES = Object.freeze({
  ivoryMarble: [0.84, 0.81, 0.75],
  warmSandstone: [0.74, 0.65, 0.54],
  greyGranite: [0.60, 0.59, 0.57],
  travertine: [0.78, 0.72, 0.62]
});

function subtractPoints(pointA, pointB) {
  return [pointA[0] - pointB[0], pointA[1] - pointB[1], pointA[2] - pointB[2]];
}

function averagePoints(points) {
  const sum = [0, 0, 0];
  for (const point of points) {
    sum[0] += point[0];
    sum[1] += point[1];
    sum[2] += point[2];
  }
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length];
}

function triangleFacesViewer(pointA, pointB, pointC, viewerDirection) {
  const edgeA = subtractPoints(pointB, pointA);
  const edgeB = subtractPoints(pointC, pointA);
  const normalX = edgeA[1] * edgeB[2] - edgeA[2] * edgeB[1];
  const normalY = edgeA[2] * edgeB[0] - edgeA[0] * edgeB[2];
  const normalZ = edgeA[0] * edgeB[1] - edgeA[1] * edgeB[0];
  return normalX * viewerDirection[0] + normalY * viewerDirection[1] + normalZ * viewerDirection[2] <= 0;
}

function pushFacingTriangle(vertices, offset, pointA, pointB, pointC, viewerDirection, surface) {
  const { color, material, variant = 0.1, occlusion = 0.96 } = surface;
  return triangleFacesViewer(pointA, pointB, pointC, viewerDirection)
    ? pushTriangle(vertices, offset, pointA, pointB, pointC, color, material, variant, occlusion, occlusion, occlusion)
    : pushTriangle(vertices, offset, pointA, pointC, pointB, color, material, variant, occlusion, occlusion, occlusion);
}

function pushFacingQuad(vertices, offset, pointA, pointB, pointC, pointD, viewerDirection, surface) {
  offset = pushFacingTriangle(vertices, offset, pointA, pointB, pointC, viewerDirection, surface);
  return pushFacingTriangle(vertices, offset, pointA, pointC, pointD, viewerDirection, surface);
}

function pushConvexFaces(vertices, offset, faces, solidCenter, surface) {
  for (const face of faces) {
    const viewerDirection = subtractPoints(averagePoints(face), solidCenter);
    offset = pushFacingTriangle(vertices, offset, face[0], face[1], face[2], viewerDirection, surface);
    if (face.length === 4) offset = pushFacingTriangle(vertices, offset, face[0], face[2], face[3], viewerDirection, surface);
  }
  return offset;
}

function pushEightCornerSolid(vertices, offset, corners, surface) {
  const [c0, c1, c2, c3, c4, c5, c6, c7] = corners;
  const faces = [
    [c0, c1, c2, c3],
    [c5, c4, c7, c6],
    [c3, c2, c6, c7],
    [c4, c5, c1, c0],
    [c4, c0, c3, c7],
    [c1, c5, c6, c2]
  ];
  return pushConvexFaces(vertices, offset, faces, averagePoints(corners), surface);
}

function pushRoundColumn(vertices, offset, { x, y, z, height, radius, yaw = 0, color, material, variant = 0.1, capitalColor = null }) {
  registerSolidVolume({ centerX: x, centerZ: z, sizeAcross: radius * 2, sizeAlong: radius * 2, yaw, bottomY: y, topY: y + height });
  const plinthSize = radius * 2.7;
  offset = pushBox(vertices, offset, { center: [x, y + 0.2, z], size: [plinthSize, 0.4, plinthSize], yaw, color, material, occlusion: 0.94, variant });
  const shaftBottom = y + 0.4;
  const shaftTop = y + height - 0.5;
  const shaftCenter = [x, (shaftBottom + shaftTop) * 0.5, z];
  const faces = [];
  for (let sideIndex = 0; sideIndex < ROUND_COLUMN_SIDE_COUNT; sideIndex++) {
    const angleStart = yaw + (sideIndex / ROUND_COLUMN_SIDE_COUNT) * Math.PI * 2;
    const angleEnd = yaw + ((sideIndex + 1) / ROUND_COLUMN_SIDE_COUNT) * Math.PI * 2;
    const topRadius = radius * COLUMN_TOP_TAPER;
    faces.push([
      [x + Math.cos(angleStart) * radius, shaftBottom, z + Math.sin(angleStart) * radius],
      [x + Math.cos(angleEnd) * radius, shaftBottom, z + Math.sin(angleEnd) * radius],
      [x + Math.cos(angleEnd) * topRadius, shaftTop, z + Math.sin(angleEnd) * topRadius],
      [x + Math.cos(angleStart) * topRadius, shaftTop, z + Math.sin(angleStart) * topRadius]
    ]);
  }
  offset = pushConvexFaces(vertices, offset, faces, shaftCenter, { color, material, variant, occlusion: 0.98 });
  return pushBox(vertices, offset, {
    center: [x, shaftTop + 0.25, z],
    size: [plinthSize * 0.95, 0.5, plinthSize * 0.95],
    yaw,
    color: capitalColor || color,
    material,
    occlusion: 1.0,
    variant
  });
}

function pushOctagonalPrism(vertices, offset, { x, y, z, bottom, top, radius, sideCount = ROUND_COLUMN_SIDE_COUNT, color, material, variant = 0.1 }) {
  registerSolidVolume({ centerX: x, centerZ: z, sizeAcross: radius * 2, sizeAlong: radius * 2, yaw: 0, bottomY: y + bottom, topY: y + top });
  const faces = [];
  const topCap = [];
  for (let sideIndex = 0; sideIndex < sideCount; sideIndex++) {
    const angleStart = (sideIndex / sideCount) * Math.PI * 2;
    const angleEnd = ((sideIndex + 1) / sideCount) * Math.PI * 2;
    faces.push([
      [x + Math.cos(angleStart) * radius, y + bottom, z + Math.sin(angleStart) * radius],
      [x + Math.cos(angleEnd) * radius, y + bottom, z + Math.sin(angleEnd) * radius],
      [x + Math.cos(angleEnd) * radius, y + top, z + Math.sin(angleEnd) * radius],
      [x + Math.cos(angleStart) * radius, y + top, z + Math.sin(angleStart) * radius]
    ]);
    topCap.push([x + Math.cos(angleStart) * radius, y + top, z + Math.sin(angleStart) * radius]);
  }
  offset = pushConvexFaces(vertices, offset, faces, [x, y + (bottom + top) * 0.5, z], { color, material, variant, occlusion: 0.97 });
  for (let sideIndex = 1; sideIndex < sideCount - 1; sideIndex++) {
    offset = pushFacingTriangle(vertices, offset, topCap[0], topCap[sideIndex], topCap[sideIndex + 1], [0, 1, 0], { color, material, variant, occlusion: 1.0 });
  }
  return offset;
}

function pushFlatConcreteRoof(vertices, offset, { x, y, z, halfAcross, halfAlong, yaw, color = BRUTALIST_CONCRETE }) {
  offset = pushBox(vertices, offset, { center: [x, y + BRUTALIST_ROOF_SLAB_METERS * 0.5, z], size: [halfAcross * 2, BRUTALIST_ROOF_SLAB_METERS, halfAlong * 2], yaw, color, material: MATERIAL.PLASTER, occlusion: 1.0, variant: PLASTER_PANEL_VARIANT });
  if (Math.min(halfAcross, halfAlong) < BRUTALIST_PLANT_ROOM.minimumHalfSizeMeters) return offset;
  const plantRoomBottom = y + BRUTALIST_ROOF_SLAB_METERS;
  const plantRoomColor = [color[0] * 0.9, color[1] * 0.9, color[2] * 0.9];
  return pushBox(vertices, offset, { center: [x, plantRoomBottom + BRUTALIST_PLANT_ROOM.heightMeters * 0.5, z], size: [halfAcross * BRUTALIST_PLANT_ROOM.footprintShare * 2, BRUTALIST_PLANT_ROOM.heightMeters, halfAlong * BRUTALIST_PLANT_ROOM.footprintShare * 2], yaw, color: plantRoomColor, material: MATERIAL.PLASTER, occlusion: 0.95, variant: PLASTER_PANEL_VARIANT });
}

function lotPoint(lot, lateral, along, height = 0) {
  return [
    lot.x + lot.rightX * lateral * lot.side + lot.forwardX * along,
    lot.y + height,
    lot.z + lot.rightZ * lateral * lot.side + lot.forwardZ * along
  ];
}

function pushLotBox(offset, lot, { lateral, along = 0, bottom, height, across, length, color, material, variant = 0.1, occlusion = 0.96 }) {
  const center = lotPoint(lot, lateral, along, bottom + height * 0.5);
  return pushBox(lot.vertices, offset, { center, size: [across, height, length], yaw: lot.yaw, color, material, occlusion, variant });
}

function pushLotColumn(offset, lot, { lateral, along, bottom, height, radius, color, material = MATERIAL.MARBLE, capitalColor = null }) {
  const base = lotPoint(lot, lateral, along, bottom);
  return pushRoundColumn(lot.vertices, offset, { x: base[0], y: base[1], z: base[2], height, radius, yaw: lot.yaw, color, material, capitalColor });
}

function pushLotFrontSteps(offset, lot, { frontLateral, along = 0, length, topHeight, stepCount, treadDepth, color, material = MATERIAL.STONE }) {
  const riser = topHeight / stepCount;
  for (let step = 0; step < stepCount; step++) {
    const stepDepthToTerrace = (stepCount - step) * treadDepth;
    offset = pushLotBox(offset, lot, {
      lateral: frontLateral - stepDepthToTerrace * 0.5,
      along,
      bottom: -STEP_FOOTING_DEPTH,
      height: riser * (step + 1) + STEP_FOOTING_DEPTH,
      across: stepDepthToTerrace,
      length,
      color: step % 2 === 0 ? color : [color[0] * 0.95, color[1] * 0.95, color[2] * 0.95],
      material,
      variant: 0.1,
      occlusion: 0.9 + step * 0.01
    });
  }
  return offset;
}

function pushLotFacadeWindowGrid(offset, lot, { faceLateral, along = 0, firstFloor, floorCount, floorHeight, columnCount, bayWidth, windowWidth, windowHeight, glassColor = STONE_TONES.darkGlass, frameColor = null }) {
  for (let floor = 0; floor < floorCount; floor++) {
    for (let column = 0; column < columnCount; column++) {
      const windowAlong = along + (column - (columnCount - 1) * 0.5) * bayWidth;
      const windowBottom = firstFloor + floor * floorHeight;
      offset = pushLotBox(offset, lot, {
        lateral: faceLateral - 0.04,
        along: windowAlong,
        bottom: windowBottom,
        height: windowHeight,
        across: 0.14,
        length: windowWidth,
        color: glassColor,
        material: MATERIAL.METAL,
        occlusion: 0.95
      });
      if (frameColor) {
        offset = pushLotBox(offset, lot, {
          lateral: faceLateral - 0.08,
          along: windowAlong,
          bottom: windowBottom - 0.16,
          height: 0.16,
          across: 0.24,
          length: windowWidth + 0.3,
          color: frameColor,
          material: MATERIAL.STONE,
          occlusion: 1.0
        });
      }
    }
  }
  return offset;
}
