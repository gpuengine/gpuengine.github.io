// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const FLOATS_PER_VERT = 15;
const STREET_FRAME_FLOAT_OFFSET = 12;
const BYTES_PER_VERT = FLOATS_PER_VERT * 4;
const MAX_SEGMENTS = 180;
const VERTS_PER_SEGMENT = 7200;
const DYNAMIC_MESH_MAX_VERTS = 16200;
const STREAMED_SLOT_VERTS = MAX_SEGMENTS * VERTS_PER_SEGMENT;
const DYNAMIC_VERT_OFFSET = STREAMED_SLOT_VERTS;
const TOTAL_BUFFER_VERTS = DYNAMIC_VERT_OFFSET + DYNAMIC_MESH_MAX_VERTS;
const FLOATS_PER_TRIANGLE = 3 * FLOATS_PER_VERT;

const NO_STREET_FRAME_MARKER = -1;
const DETAIL_MATERIAL_OFFSET = 64;
const ROAD_MARKING_MATERIAL_OFFSET = 32;
const ROAD_MARKING_FADE_START_METERS = 55;
const ROAD_MARKING_FADE_END_METERS = 90;
const LIVE_WEATHER_COLOR = Object.freeze({ road: 1, shoulder: 2, stripe: 3, water: 4 });

function liveWeatherColor(slot, shade = 1) {
  return [-slot, shade, 0];
}
const STREET_FRAME_FLAG_STRIDE = 64;
const STREET_FRAME_FLAG = Object.freeze({ leftSidewalkLamps: 1, rightSidewalkLamps: 2 });

const WORLD_AXIS_STREET_FRAME = Object.freeze({
  writeCoordinates(point, vertices, index) {
    vertices[index] = point[0];
    vertices[index + 1] = point[2];
    vertices[index + 2] = NO_STREET_FRAME_MARKER;
  }
});

let activeStreetFrame = WORLD_AXIS_STREET_FRAME;
let isBuildingDetailGeometry = false;
let isBuildingRoadMarkingGeometry = false;

function withDetailGeometry(buildGeometry) {
  const wasBuildingDetail = isBuildingDetailGeometry;
  isBuildingDetailGeometry = true;
  try {
    return buildGeometry();
  } finally {
    isBuildingDetailGeometry = wasBuildingDetail;
  }
}

function withRoadMarkingGeometry(buildGeometry) {
  const wasBuildingRoadMarking = isBuildingRoadMarkingGeometry;
  isBuildingRoadMarkingGeometry = true;
  try {
    return buildGeometry();
  } finally {
    isBuildingRoadMarkingGeometry = wasBuildingRoadMarking;
  }
}

function distanceFadingMaterialOffset() {
  if (isBuildingDetailGeometry) return DETAIL_MATERIAL_OFFSET;
  if (isBuildingRoadMarkingGeometry) return ROAD_MARKING_MATERIAL_OFFSET;
  return 0;
}

function withStreetFrame(streetFrame, buildGeometry) {
  const previousFrame = activeStreetFrame;
  activeStreetFrame = streetFrame;
  try {
    return buildGeometry();
  } finally {
    activeStreetFrame = previousFrame;
  }
}

function pushTriangle(vertices, offset, pointA, pointB, pointC, color, material = 0.0, variant = 0.5, occlusionA = 1.0, occlusionB = 1.0, occlusionC = 1.0) {
  if (offset + FLOATS_PER_TRIANGLE > vertices.length) return offset;
  const edgeAX = pointB[0] - pointA[0], edgeAY = pointB[1] - pointA[1], edgeAZ = pointB[2] - pointA[2];
  const edgeBX = pointC[0] - pointA[0], edgeBY = pointC[1] - pointA[1], edgeBZ = pointC[2] - pointA[2];
  let normalX = edgeAY * edgeBZ - edgeAZ * edgeBY;
  let normalY = edgeAZ * edgeBX - edgeAX * edgeBZ;
  let normalZ = edgeAX * edgeBY - edgeAY * edgeBX;
  const normalLength = Math.hypot(normalX, normalY, normalZ) || 1.0;
  normalX /= normalLength; normalY /= normalLength; normalZ /= normalLength;

  const points = [pointA, pointB, pointC];
  const occlusions = [occlusionA, occlusionB, occlusionC];
  for (let i = 0; i < 3; i++) {
    const point = points[i];
    vertices[offset++] = point[0];
    vertices[offset++] = point[1];
    vertices[offset++] = point[2];
    vertices[offset++] = normalX;
    vertices[offset++] = normalY;
    vertices[offset++] = normalZ;
    vertices[offset++] = color[0];
    vertices[offset++] = color[1];
    vertices[offset++] = color[2];
    vertices[offset++] = material + distanceFadingMaterialOffset();
    vertices[offset++] = variant;
    vertices[offset++] = occlusions[i];
    activeStreetFrame.writeCoordinates(point, vertices, offset);
    offset += FLOATS_PER_VERT - STREET_FRAME_FLOAT_OFFSET;
  }
  return offset;
}

function pushQuad(vertices, offset, pointA, pointB, pointC, pointD, color, material = 0.0, variant = 0.5, occlusion = 1.0) {
  offset = pushTriangle(vertices, offset, pointA, pointB, pointC, color, material, variant, occlusion, occlusion, occlusion);
  offset = pushTriangle(vertices, offset, pointA, pointC, pointD, color, material, variant, occlusion, occlusion, occlusion);
  return offset;
}

function transformPoint(localX, localY, localZ, originX, originY, originZ, yaw, pitch, roll) {
  const cosRoll = Math.cos(roll), sinRoll = Math.sin(roll);
  const rolledX = localX * cosRoll - localY * sinRoll;
  const rolledY = localX * sinRoll + localY * cosRoll;
  const rolledZ = localZ;

  const cosPitch = Math.cos(pitch), sinPitch = Math.sin(pitch);
  const pitchedX = rolledX;
  const pitchedY = rolledY * cosPitch - rolledZ * sinPitch;
  const pitchedZ = rolledY * sinPitch + rolledZ * cosPitch;

  const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);
  const turnedX = pitchedX * cosYaw + pitchedZ * sinYaw;
  const turnedY = pitchedY;
  const turnedZ = -pitchedX * sinYaw + pitchedZ * cosYaw;

  return [turnedX + originX, turnedY + originY, turnedZ + originZ];
}

const MATERIAL = Object.freeze({
  TERRAIN: 0,
  PAVING: 1,
  METAL: 2,
  GLOW: 3,
  WATER: 4,
  STONE: 5,
  FOLIAGE: 6,
  ASHLAR: 7,
  WOOD: 8,
  PLASTER: 9,
  MARBLE: 10,
  CAR_PAINT: 11,
  CAR_GLASS: 12,
  CHROME: 13
});

const LAWN_TERRAIN_VARIANT = 0.25;
const DRY_GRASS_TERRAIN_VARIANT = 0.55;
const HUSK_GRASS_COLOR = Object.freeze([0.62, 0.50, 0.32]);
const PLASTER_PANEL_VARIANT = 0.7;
const PLASTER_PANEL_VARIANT_FLOOR = 0.55;
const DRY_GRASS_VARIANT_FLOOR = 0.45;
const ROCK_TERRAIN_VARIANT_FLOOR = 0.75;

const PAVED_VARIANT_FLOOR = 0.6;
const PAVING_PATTERN_VARIANT = Object.freeze({ setts: 0.65, herringbone: 0.73, slab: 0.8 });

function pushBox(vertices, offset, { center, size, yaw = 0, pitch = 0, roll = 0, color, material = MATERIAL.TERRAIN, occlusion = 1.0, variant = 0.4 }) {
  registerSolidBox({ center, size, yaw, pitch, roll });
  const [centerX, centerY, centerZ] = center;
  const [sizeX, sizeY, sizeZ] = size;
  const halfX = sizeX * 0.5, halfY = sizeY * 0.5, halfZ = sizeZ * 0.5;
  const corners = [
    transformPoint(-halfX, -halfY, -halfZ, centerX, centerY, centerZ, yaw, pitch, roll),
    transformPoint( halfX, -halfY, -halfZ, centerX, centerY, centerZ, yaw, pitch, roll),
    transformPoint( halfX,  halfY, -halfZ, centerX, centerY, centerZ, yaw, pitch, roll),
    transformPoint(-halfX,  halfY, -halfZ, centerX, centerY, centerZ, yaw, pitch, roll),
    transformPoint(-halfX, -halfY,  halfZ, centerX, centerY, centerZ, yaw, pitch, roll),
    transformPoint( halfX, -halfY,  halfZ, centerX, centerY, centerZ, yaw, pitch, roll),
    transformPoint( halfX,  halfY,  halfZ, centerX, centerY, centerZ, yaw, pitch, roll),
    transformPoint(-halfX,  halfY,  halfZ, centerX, centerY, centerZ, yaw, pitch, roll)
  ];
  offset = pushQuad(vertices, offset, corners[0], corners[1], corners[2], corners[3], color, material, variant, occlusion);
  offset = pushQuad(vertices, offset, corners[5], corners[4], corners[7], corners[6], color, material, variant, occlusion);
  offset = pushQuad(vertices, offset, corners[3], corners[2], corners[6], corners[7], color, material, variant, occlusion * 1.05);
  offset = pushQuad(vertices, offset, corners[4], corners[5], corners[1], corners[0], color, material, variant, occlusion * 0.65);
  offset = pushQuad(vertices, offset, corners[4], corners[0], corners[3], corners[7], color, material, variant, occlusion * 0.92);
  offset = pushQuad(vertices, offset, corners[1], corners[5], corners[6], corners[2], color, material, variant, occlusion * 0.92);
  return offset;
}

function pushRoundedDome(vertices, offset, centerX, centerY, centerZ, radiusX, radiusY, radiusZ, slices, stacks, color, material = 0.0, variant = 0.5, buryDepth = 0.0) {
  for (let stack = 0; stack < stacks; stack++) {
    const lowerFraction = stack / stacks;
    const upperFraction = (stack + 1) / stacks;
    const lowerLatitude = -0.32 * Math.PI + lowerFraction * (0.82 * Math.PI);
    const upperLatitude = -0.32 * Math.PI + upperFraction * (0.82 * Math.PI);

    const lowerRingY = stack === 0 && buryDepth > 0 ? -buryDepth : Math.sin(lowerLatitude) * radiusY;
    const upperRingY = Math.sin(upperLatitude) * radiusY;
    const lowerRingScale = Math.cos(lowerLatitude);
    const upperRingScale = Math.cos(upperLatitude);

    const lowerOcclusion = clamp(0.65 + lowerFraction * 0.42, 0.55, 1.1);
    const upperOcclusion = clamp(0.65 + upperFraction * 0.42, 0.55, 1.1);

    for (let slice = 0; slice < slices; slice++) {
      const angleStart = (slice / slices) * Math.PI * 2;
      const angleEnd = ((slice + 1) / slices) * Math.PI * 2;

      const lowerStartPoint = [centerX + Math.cos(angleStart) * lowerRingScale * radiusX, centerY + lowerRingY, centerZ + Math.sin(angleStart) * lowerRingScale * radiusZ];
      const lowerEndPoint = [centerX + Math.cos(angleEnd) * lowerRingScale * radiusX, centerY + lowerRingY, centerZ + Math.sin(angleEnd) * lowerRingScale * radiusZ];
      const upperEndPoint = [centerX + Math.cos(angleEnd) * upperRingScale * radiusX, centerY + upperRingY, centerZ + Math.sin(angleEnd) * upperRingScale * radiusZ];
      const upperStartPoint = [centerX + Math.cos(angleStart) * upperRingScale * radiusX, centerY + upperRingY, centerZ + Math.sin(angleStart) * upperRingScale * radiusZ];

      offset = pushTriangle(vertices, offset, lowerStartPoint, upperEndPoint, lowerEndPoint, color, material, variant, lowerOcclusion, upperOcclusion, lowerOcclusion);
      offset = pushTriangle(vertices, offset, lowerStartPoint, upperStartPoint, upperEndPoint, color, material, variant, lowerOcclusion, upperOcclusion, upperOcclusion);
    }
  }
  return offset;
}

function pushGroundTriangle(vertices, offset, pointA, pointB, pointC, color, material, variant, occlusion) {
  const edgeAX = pointB[0] - pointA[0], edgeAZ = pointB[2] - pointA[2];
  const edgeBX = pointC[0] - pointA[0], edgeBZ = pointC[2] - pointA[2];
  const normalY = edgeAZ * edgeBX - edgeAX * edgeBZ;
  return normalY <= 0
    ? pushTriangle(vertices, offset, pointA, pointB, pointC, color, material, variant, occlusion, occlusion, occlusion)
    : pushTriangle(vertices, offset, pointA, pointC, pointB, color, material, variant, occlusion, occlusion, occlusion);
}

function pushGroundQuad(vertices, offset, pointA, pointB, pointC, pointD, color, material, variant, occlusion) {
  offset = pushGroundTriangle(vertices, offset, pointA, pointB, pointC, color, material, variant, occlusion);
  return pushGroundTriangle(vertices, offset, pointA, pointC, pointD, color, material, variant, occlusion);
}
