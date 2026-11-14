// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const TERRAIN_MAX_GRADE = 0.15;

const TERRAIN_SWELL_SHAPES = Object.freeze([
  { relativeAmplitude: 1.0, wavelengthMeters: 440, directionAngle: 0.35 },
  { relativeAmplitude: 0.8, wavelengthMeters: 360, directionAngle: 2.2 },
  { relativeAmplitude: 0.35, wavelengthMeters: 210, directionAngle: 4.4 }
]);

const TERRAIN_SWELLS = buildTerrainSwells();

function buildTerrainSwells() {
  const steepestCombinedGrade = TERRAIN_SWELL_SHAPES.reduce(
    (sum, shape) => sum + shape.relativeAmplitude * (Math.PI * 2 / shape.wavelengthMeters), 0);
  const amplitudeScale = TERRAIN_MAX_GRADE / steepestCombinedGrade;
  return TERRAIN_SWELL_SHAPES.map((shape, index) => ({
    amplitudeMeters: shape.relativeAmplitude * amplitudeScale,
    wavenumber: Math.PI * 2 / shape.wavelengthMeters,
    directionX: Math.cos(shape.directionAngle),
    directionZ: Math.sin(shape.directionAngle),
    phase: seededRandom(17.3 + index * 5.1) * Math.PI * 2
  }));
}

const TERRAIN_MAX_CURVATURE = TERRAIN_SWELLS.reduce((sum, swell) => sum + swell.amplitudeMeters * swell.wavenumber * swell.wavenumber, 0);

function terrainHeightAt(x, z) {
  let height = 0;
  for (const swell of TERRAIN_SWELLS) {
    height += swell.amplitudeMeters * Math.sin((x * swell.directionX + z * swell.directionZ) * swell.wavenumber + swell.phase);
  }
  return height;
}

function drapeVerticesOnTerrain(vertices, vertexCount) {
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    const base = vertex * FLOATS_PER_VERT;
    vertices[base + 1] += terrainHeightAt(vertices[base], vertices[base + 2]);
  }
  for (let triangle = 0; triangle + 2 < vertexCount; triangle += 3) {
    recomputeTriangleNormal(vertices, triangle * FLOATS_PER_VERT);
  }
}

function recomputeTriangleNormal(vertices, base) {
  const secondBase = base + FLOATS_PER_VERT;
  const thirdBase = base + FLOATS_PER_VERT * 2;
  const edgeAX = vertices[secondBase] - vertices[base];
  const edgeAY = vertices[secondBase + 1] - vertices[base + 1];
  const edgeAZ = vertices[secondBase + 2] - vertices[base + 2];
  const edgeBX = vertices[thirdBase] - vertices[base];
  const edgeBY = vertices[thirdBase + 1] - vertices[base + 1];
  const edgeBZ = vertices[thirdBase + 2] - vertices[base + 2];
  let normalX = edgeAY * edgeBZ - edgeAZ * edgeBY;
  let normalY = edgeAZ * edgeBX - edgeAX * edgeBZ;
  let normalZ = edgeAX * edgeBY - edgeAY * edgeBX;
  const normalLength = Math.hypot(normalX, normalY, normalZ);
  if (normalLength < 1e-9) return;
  normalX /= normalLength;
  normalY /= normalLength;
  normalZ /= normalLength;
  for (const vertexBase of [base, secondBase, thirdBase]) {
    vertices[vertexBase + 3] = normalX;
    vertices[vertexBase + 4] = normalY;
    vertices[vertexBase + 5] = normalZ;
  }
}

function terrainRollAcross(x, z, heading, halfSpanMeters) {
  const rightX = Math.cos(heading);
  const rightZ = -Math.sin(heading);
  const rightSide = terrainHeightAt(x + rightX * halfSpanMeters, z + rightZ * halfSpanMeters);
  const leftSide = terrainHeightAt(x - rightX * halfSpanMeters, z - rightZ * halfSpanMeters);
  return Math.atan2(rightSide - leftSide, halfSpanMeters * 2);
}

function terrainPitchAlong(x, z, heading, halfSpanMeters) {
  const forwardX = -Math.sin(heading);
  const forwardZ = -Math.cos(heading);
  const ahead = terrainHeightAt(x + forwardX * halfSpanMeters, z + forwardZ * halfSpanMeters);
  const behind = terrainHeightAt(x - forwardX * halfSpanMeters, z - forwardZ * halfSpanMeters);
  return Math.atan2(ahead - behind, halfSpanMeters * 2);
}

function sideIsParkOf(info, side) {
  return (side < 0 && info.leftIsPark) || (side > 0 && info.rightIsPark);
}

function sideIsFieldOf(info, side) {
  return (side < 0 && info.leftIsField) || (side > 0 && info.rightIsField);
}

function sideIsValleyOf(info, side) {
  return (side < 0 && info.leftIsValley) || (side > 0 && info.rightIsValley);
}

const OUTER_GROUND_BAND = 4;
const FIRST_ROLLING_PARK_BAND = 2;

const ROAD_SURFACE_HEIGHT_METERS = 0.0;
const SIDEWALK_HEIGHT_METERS = 0.18;
const GROUND_BAND_OFFSETS_METERS = Object.freeze([2.8, 7.2, 15.6, 27.6, 42.6]);

function groundHeightAtLateral(node, lateralOffset, worldX, worldZ) {
  const info = node.info;
  const distanceFromCenter = Math.abs(lateralOffset);
  const side = lateralOffset < 0 ? -1 : 1;
  if (distanceFromCenter <= info.roadHalfWidth) return ROAD_SURFACE_HEIGHT_METERS;
  if (side < 0 ? node.hidesLeftSide : node.hidesRightSide) return SIDEWALK_HEIGHT_METERS;
  if (info.isIntersection) return 0.02;
  const bandEdges = GROUND_BAND_OFFSETS_METERS.map(bandOffset => info.roadHalfWidth + bandOffset);
  if (distanceFromCenter <= bandEdges[0]) return SIDEWALK_HEIGHT_METERS;
  if (!sideIsParkOf(info, side) && !sideIsValleyOf(info, side)) return 0.2;
  for (let band = 0; band < bandEdges.length - 1; band++) {
    if (distanceFromCenter <= bandEdges[band + 1]) {
      const fraction = (distanceFromCenter - bandEdges[band]) / (bandEdges[band + 1] - bandEdges[band]);
      return lerp(bandHeightAt(worldX, worldZ, lateralOffset, band, info), bandHeightAt(worldX, worldZ, lateralOffset, band + 1, info), fraction);
    }
  }
  return SIDEWALK_HEIGHT_METERS;
}

function bandHeightAt(worldX, worldZ, lateralOffset, band, blockInfo) {
  const flatHeight = blockInfo.isIntersection ? 0.01 : SIDEWALK_HEIGHT_METERS;
  if (band === 0) return flatHeight;
  if (sideIsValleyOf(blockInfo, lateralOffset) && !blockInfo.isIntersection) {
    return valleyBandHeight(band, blockInfo);
  }
  const isParkBand = sideIsParkOf(blockInfo, lateralOffset) && band >= FIRST_ROLLING_PARK_BAND && band < OUTER_GROUND_BAND && !blockInfo.isIntersection;
  if (isParkBand) return parkBandHeight(worldX, worldZ, band, blockInfo);
  return flatHeight;
}

function valleyBandHeight(band, blockInfo) {
  if (band < 2 || band >= OUTER_GROUND_BAND) return SIDEWALK_HEIGHT_METERS;
  return lerp(SIDEWALK_HEIGHT_METERS, valleyBasinDepth(blockInfo.waterStyle), blockProgressEnvelope(blockInfo.inBlockIdx));
}

function valleyBasinDepth(waterStyle) {
  if (waterStyle === 0) return -1.45;
  if (waterStyle === 1) return -2.45;
  return -3.85;
}

function parkBandHeight(worldX, worldZ, band, blockInfo) {
  const parkEnvelope = blockProgressEnvelope(blockInfo.inBlockIdx) * Math.sin((band / OUTER_GROUND_BAND) * Math.PI);
  return SIDEWALK_HEIGHT_METERS + (Math.sin(worldX * 0.045 + worldZ * 0.045) * 0.5 + 0.5) * 1.15 * parkEnvelope;
}

function blockProgressEnvelope(indexInBlock) {
  const blockProgress = clamp((indexInBlock - 2) / (MANHATTAN_BLOCK_PERIOD - 3), 0.0, 1.0);
  return Math.sin(blockProgress * Math.PI);
}
