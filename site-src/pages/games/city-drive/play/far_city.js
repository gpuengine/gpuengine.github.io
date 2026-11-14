// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const PARALLEL_STREET_LAT = 64.0;

const PARALLEL_STREET_HALF_W = 4.5;

const FAR_LOT_CENTERS = [4.71, 8.47, 12.23, 15.99];

const FAR_CITY_PROBE_STEP_METERS = 6.0;

const UNDERLAY_HEIGHT = -0.12;

const UNDERLAY_STRIP_WIDTH = 12.0;

const UNDERLAY_COLOR = [0.50, 0.49, 0.47];

const FAR_PLAZA_HEIGHT_METERS = 0.18;
const FAR_PLAZA_COLOR = [0.52, 0.51, 0.49];
const FAR_SKIRT_COLOR = [0.40, 0.40, 0.41];
const FAR_SKIRT_BOTTOM_METERS = -2.6;
const QUAY_WALL_INSET_METERS = 0.05;
const NEAR_ROAD_EDGE_SEARCH_RADIUS_METERS = 260;
const FAR_TOWER_DEPTH_METERS = 13.5;
const FAR_TOWER_CROWN_CHANCE_THRESHOLD = 0.62;
const FAR_HOUSE = Object.freeze({ widthMeters: 11.0, depthMeters: 9.0, wallHeightMeters: 6.4, roofOverhangMeters: 0.5, podiumHeightMeters: 0.9 });
const FAR_HOUSE_ROOF_TONES = Object.freeze([[0.25, 0.27, 0.30], [0.23, 0.23, 0.24], [0.40, 0.38, 0.36]]);
const FAR_HOUSE_PODIUM_STONE = Object.freeze([0.55, 0.54, 0.51]);

function pushFarCityContent(vertices, offset, startNode, pointAlong, roadColor) {
  offset = pushUnderlayGround(vertices, offset, startNode, pointAlong);
  if (!startNode.edge) return offset;
  for (let side = -1; side <= 1; side += 2) {
    if (side < 0 ? startNode.hidesLeftSide : startNode.hidesRightSide) continue;
    offset = pushFarCitySide(vertices, offset, { startNode, pointAlong, roadColor, side });
  }
  return offset;
}

function pushUnderlayGround(vertices, offset, startNode, pointAlong) {
  const info = startNode.info;
  for (const side of [-1, 1]) {
    const isWaterSide = (side < 0 && info.leftIsValley) || (side > 0 && info.rightIsValley);
    const fromLateral = info.roadHalfWidth + (isWaterSide ? ROADSIDE_BAND_REACH_METERS : ROAD_SHOULDER_WIDTH_METERS);
    for (let lateral = fromLateral; lateral < FAR_REACH; lateral += UNDERLAY_STRIP_WIDTH) {
      const innerLateral = side * lateral;
      const outerLateral = side * Math.min(FAR_REACH, lateral + UNDERLAY_STRIP_WIDTH);
      offset = pushGroundQuad(
        vertices, offset,
        pointAlong(0, innerLateral, UNDERLAY_HEIGHT), pointAlong(1, innerLateral, UNDERLAY_HEIGHT),
        pointAlong(1, outerLateral, UNDERLAY_HEIGHT), pointAlong(0, outerLateral, UNDERLAY_HEIGHT),
        UNDERLAY_COLOR, MATERIAL.PAVING, 0.85, 0.9
      );
    }
    offset = pushQuayWall(vertices, offset, pointAlong, side * (FAR_REACH - QUAY_WALL_INSET_METERS));
  }
  return offset;
}

function pushQuayWall(vertices, offset, pointAlong, lateral) {
  return pushQuad(
    vertices, offset,
    pointAlong(0, lateral, UNDERLAY_HEIGHT), pointAlong(1, lateral, UNDERLAY_HEIGHT),
    pointAlong(1, lateral, FAR_SKIRT_BOTTOM_METERS), pointAlong(0, lateral, FAR_SKIRT_BOTTOM_METERS),
    FAR_SKIRT_COLOR, MATERIAL.STONE, 0.1, 0.8
  );
}

function pushFarCitySide(vertices, offset, farSide) {
  const { startNode, pointAlong, side } = farSide;
  const info = startNode.info;
  const isFarCitySuppressed = side < 0 ? startNode.hidesLeftFarCity : startNode.hidesRightFarCity;
  const isValleySide = (side < 0 && info.leftIsValley) || (side > 0 && info.rightIsValley);
  const probe = pointAlong(0.5, side * PARALLEL_STREET_LAT, 0);
  const isBlocked = isFarCitySuppressed || isNearOtherRoad(probe[0], probe[2], 10, startNode.edge);
  const bandEdge = info.roadHalfWidth + ROADSIDE_BAND_REACH_METERS;
  const streetOuter = PARALLEL_STREET_LAT + PARALLEL_STREET_HALF_W;
  const reach = isBlocked ? bandEdge : clearLateralReach(pointAlong, side, startNode.edge, bandEdge, FAR_REACH);

  if (reach <= bandEdge) return pushFarSkirt(vertices, offset, pointAlong, side * bandEdge);
  if (sideIsFieldOf(info, side)) return pushFarField(vertices, offset, farSide, bandEdge, reach);
  if (isValleySide || reach < streetOuter + FAR_CITY_PROBE_STEP_METERS) {
    offset = pushFarPlaza(vertices, offset, farSide, bandEdge, reach);
    return pushFarSkirt(vertices, offset, pointAlong, side * reach);
  }

  offset = pushParallelStreet(vertices, offset, farSide, bandEdge);
  offset = pushFarCurbFace(vertices, offset, pointAlong, side * streetOuter, 0, FAR_PLAZA_HEIGHT_METERS);
  offset = pushFarPlaza(vertices, offset, farSide, streetOuter, reach);
  offset = pushFarSkirt(vertices, offset, pointAlong, side * reach);
  return pushFarTowers(vertices, offset, farSide, reach);
}

function pushFarField(vertices, offset, { startNode, pointAlong, side }, from, to) {
  const { color, material, variant } = fieldFarSurface(startNode.info.fieldStyle);
  offset = pushFarStrip(vertices, offset, pointAlong, { from, to, side, height: FAR_PLAZA_HEIGHT_METERS, color, material, variant });
  plantFarFieldTreeLine({ pointAlong, side, segmentIndex: startNode.index, reach: to });
  return pushFarSkirt(vertices, offset, pointAlong, side * to);
}

function isNearOtherRoad(x, z, radius, ownEdge) {
  for (const junction of roadGraph.junctions.values()) {
    if (Math.hypot(junction.x - x, junction.z - z) < radius + junction.radius + 14) return true;
  }
  for (const edge of roadGraph.edges.values()) {
    if (edge === ownEdge) continue;
    const midNode = edge.nodes[edge.segmentCount >> 1];
    if (Math.hypot(midNode.x - x, midNode.z - z) > NEAR_ROAD_EDGE_SEARCH_RADIUS_METERS) continue;
    for (let nodeIndex = 0; nodeIndex <= edge.segmentCount; nodeIndex += 2) {
      const node = edge.nodes[nodeIndex];
      const offsetX = node.x - x;
      const offsetZ = node.z - z;
      const clearance = radius + node.info.roadHalfWidth + 10;
      if (offsetX * offsetX + offsetZ * offsetZ < clearance * clearance) return true;
    }
  }
  return false;
}

function clearLateralReach(pointAlong, side, ownEdge, fromLateral, toLateral) {
  for (let lateral = fromLateral; lateral <= toLateral; lateral += FAR_CITY_PROBE_STEP_METERS) {
    const probe = pointAlong(0.5, side * lateral, 0);
    if (isNearOtherRoad(probe[0], probe[2], 0, ownEdge)) return Math.max(fromLateral, lateral - FAR_CITY_PROBE_STEP_METERS);
  }
  return toLateral;
}

function pushFarStrip(vertices, offset, pointAlong, { from, to, side, height, color, variant, material = MATERIAL.PAVING }) {
  const near = Math.min(from * side, to * side);
  const far = Math.max(from * side, to * side);
  return pushGroundQuad(
    vertices, offset,
    pointAlong(0, near, height), pointAlong(1, near, height), pointAlong(1, far, height), pointAlong(0, far, height),
    color, material, variant, 0.96
  );
}

function pushFarPlaza(vertices, offset, { startNode, pointAlong, side }, from, to) {
  if (hasLawnFarGround(startNode)) {
    return pushFarStrip(vertices, offset, pointAlong, { from, to, side, height: FAR_PLAZA_HEIGHT_METERS, color: LAWN_GREEN, material: MATERIAL.TERRAIN, variant: LAWN_TERRAIN_VARIANT });
  }
  return pushFarStrip(vertices, offset, pointAlong, { from, to, side, height: FAR_PLAZA_HEIGHT_METERS, color: FAR_PLAZA_COLOR, variant: PAVING_PATTERN_VARIANT.slab });
}

function hasLawnFarGround(startNode) {
  return startNode.info.district.groundCover === GROUND_COVER.lawn;
}

function pushFarSkirt(vertices, offset, pointAlong, lateral) {
  return pushQuad(
    vertices, offset,
    pointAlong(0, lateral, FAR_PLAZA_HEIGHT_METERS), pointAlong(1, lateral, FAR_PLAZA_HEIGHT_METERS),
    pointAlong(1, lateral, FAR_SKIRT_BOTTOM_METERS), pointAlong(0, lateral, FAR_SKIRT_BOTTOM_METERS),
    FAR_SKIRT_COLOR, MATERIAL.STONE, 0.1, 0.8
  );
}

function pushFarCurbFace(vertices, offset, pointAlong, lateral, firstHeight, secondHeight) {
  return pushQuad(
    vertices, offset,
    pointAlong(0, lateral, firstHeight), pointAlong(1, lateral, firstHeight),
    pointAlong(1, lateral, secondHeight), pointAlong(0, lateral, secondHeight),
    FAR_PLAZA_COLOR, MATERIAL.PAVING, 0.8, 0.9
  );
}

function pushParallelStreet(vertices, offset, farSide, bandEdge) {
  const { startNode, pointAlong, roadColor, side } = farSide;
  const info = startNode.info;
  const streetInner = PARALLEL_STREET_LAT - PARALLEL_STREET_HALF_W;
  const streetOuter = PARALLEL_STREET_LAT + PARALLEL_STREET_HALF_W;
  const roadHeight = info.isIntersection ? 0.025 : 0.0;
  offset = pushFarStrip(vertices, offset, pointAlong, { from: streetInner, to: streetOuter, side, height: roadHeight, color: roadColor, variant: 0.35 });
  if (info.isIntersection) return offset;

  offset = pushFarPlaza(vertices, offset, farSide, bandEdge, streetInner);
  offset = pushFarCurbFace(vertices, offset, pointAlong, side * streetInner, FAR_PLAZA_HEIGHT_METERS, 0);
  if (startNode.index % 3 !== 0) {
    offset = pushFarStrip(vertices, offset, pointAlong, { from: PARALLEL_STREET_LAT - 0.12, to: PARALLEL_STREET_LAT + 0.12, side, height: 0.015, color: liveWeatherColor(LIVE_WEATHER_COLOR.stripe), variant: 0.2 });
  }
  if (info.inBlockIdx % 3 === 1) offset = pushParallelStreetLamp(vertices, offset, farSide, streetInner);
  return offset;
}

function pushParallelStreetLamp(vertices, offset, { startNode, pointAlong, side }, streetInner) {
  const yaw = startNode.heading;
  const pole = pointAlong(0.5, (streetInner - 1.0) * side, 0.18);
  offset = pushBox(vertices, offset, {
    center: [pole[0], pole[1] + 2.5, pole[2]],
    size: [0.22, 5.0, 0.22],
    yaw,
    color: [0.18, 0.20, 0.22],
    material: MATERIAL.METAL,
    occlusion: 0.92
  });
  return pushBox(vertices, offset, {
    center: [pole[0], pole[1] + 5.05, pole[2]],
    size: [0.55, 0.3, 0.55],
    yaw,
    color: [1.0, 0.88, 0.58],
    material: MATERIAL.GLOW,
    occlusion: 1.0
  });
}

function pushFarTowers(vertices, offset, farSide, reach) {
  const { startNode, pointAlong, side } = farSide;
  const info = startNode.info;
  const yaw = startNode.heading;
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const streetOuter = PARALLEL_STREET_LAT + PARALLEL_STREET_HALF_W;
  for (let lot = 0; lot < FAR_LOT_CENTERS.length; lot++) {
    const center = FAR_LOT_CENTERS[lot];
    if (Math.floor(center) !== info.inBlockIdx) continue;
    const forwardOffset = (center - Math.floor(center)) * SEG_LENGTH;
    const lotSeed = info.blockNumber * 31.7 + lot * 7.3 + side * 2.9;
    for (let row = 0; row < 2; row++) {
      const lateral = row === 0 ? streetOuter + 11.0 : FAR_REACH - 10.0;
      if (lateral + 8.0 > reach) continue;
      const towerSeed = seededRandom(lotSeed + row * 13.1);
      const facadeSeed = seededRandom(lotSeed * 1.7 + row * 5.3);
      const base = pointAlong(0, lateral * side, 0.18);
      const centerX = base[0] + forwardX * forwardOffset;
      const centerZ = base[2] + forwardZ * forwardOffset;
      if (isNearOtherRoad(centerX, centerZ, 11, startNode.edge)) continue;
      if (hasLawnFarGround(startNode)) {
        offset = pushFarHouse(vertices, offset, { center: [centerX, base[1], centerZ], yaw, houseSeed: towerSeed, facadeSeed, facadeTones: info.district.farFacadeTones });
        continue;
      }
      offset = pushFarTower(vertices, offset, {
        center: [centerX, base[1], centerZ],
        yaw,
        towerSeed,
        facadeSeed,
        facadeTones: info.district.farFacadeTones,
        towerHeight: (18 + Math.pow(towerSeed, 1.3) * (row === 0 ? 52 : 70)) * info.district.farTowerHeightScale
      });
    }
  }
  return offset;
}

function pushFarTower(vertices, offset, { center, yaw, towerSeed, facadeSeed, facadeTones, towerHeight }) {
  const [centerX, baseY, centerZ] = center;
  const tone = pickFromList(facadeTones, facadeSeed);
  const width = 15.0 - facadeSeed * 3.0;
  offset = pushBox(vertices, offset, {
    center: [centerX, baseY + (towerHeight - 12.0) * 0.5, centerZ],
    size: [width, towerHeight + 12.0, FAR_TOWER_DEPTH_METERS],
    yaw,
    color: tone,
    material: MATERIAL.STONE,
    occlusion: 0.94,
    variant: 0.5
  });
  offset = pushBox(vertices, offset, {
    center: [centerX, baseY + towerHeight + 0.5, centerZ],
    size: [width + 0.6, 1.0, 14.1],
    yaw,
    color: [tone[0] * 0.7, tone[1] * 0.7, tone[2] * 0.7],
    material: MATERIAL.STONE,
    occlusion: 0.98,
    variant: 0.1
  });
  const hasCrown = towerSeed > FAR_TOWER_CROWN_CHANCE_THRESHOLD;
  if (!hasCrown) return offset;
  const crownHeight = 8.0 + facadeSeed * 18.0;
  return pushBox(vertices, offset, {
    center: [centerX, baseY + towerHeight + crownHeight * 0.5, centerZ],
    size: [width * 0.6, crownHeight, 8.0],
    yaw,
    color: tone,
    material: MATERIAL.STONE,
    occlusion: 1.0,
    variant: 0.5
  });
}

function pushFarHouse(vertices, offset, { center, yaw, houseSeed, facadeSeed, facadeTones }) {
  const [centerX, baseY, centerZ] = center;
  const house = FAR_HOUSE;
  const wallTone = pickFromList(facadeTones, facadeSeed);
  offset = pushBox(vertices, offset, {
    center: [centerX, baseY + (house.podiumHeightMeters - 1.0) * 0.5, centerZ],
    size: [house.widthMeters + 1.2, house.podiumHeightMeters + 1.0, house.depthMeters + 2.4],
    yaw, color: FAR_HOUSE_PODIUM_STONE, material: MATERIAL.ASHLAR, occlusion: 0.94, variant: 0.2
  });
  const wallBottom = baseY + house.podiumHeightMeters;
  offset = pushBox(vertices, offset, {
    center: [centerX, wallBottom + house.wallHeightMeters * 0.5, centerZ],
    size: [house.widthMeters, house.wallHeightMeters, house.depthMeters],
    yaw, color: wallTone, material: MATERIAL.PLASTER, occlusion: 0.96, variant: PLASTER_PANEL_VARIANT
  });
  return pushFlatConcreteRoof(vertices, offset, {
    x: centerX, y: wallBottom + house.wallHeightMeters, z: centerZ,
    halfAcross: house.widthMeters * 0.5 + house.roofOverhangMeters,
    halfAlong: house.depthMeters * 0.5 + house.roofOverhangMeters,
    yaw,
    color: pickFromList(FAR_HOUSE_ROOF_TONES, houseSeed)
  });
}
