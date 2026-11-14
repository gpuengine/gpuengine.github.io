// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const BASELINE_ROAD_HALF_WIDTH = 5.4;
const BACKDROP_TOWER_PERIOD = 4;
const BACKDROP_TOWER_PHASE = 3;

const COLONNADE_COLUMN_SPACING = 3.8;

const STOOP_STEP_COUNT = 7;
const STOOP_STEP_RISE = 0.25;
const STOOP_TREAD_DEPTH = 0.3;
const STOOP_WIDTH = 2.2;

const CORNER_BUILDING_STYLE_COUNT = 6;
const SETBACK_CROWN_CORNER_STYLES = Object.freeze([0, 3]);
const WATER_TANK_CORNER_STYLE = 1;
const LOFT_CORNER_STYLE = 4;
const TURRET_CORNER_STYLE = 5;
const TURRET_CORNER_VERTEX_RESERVE = 1100;
const PLAIN_CORNER_VERTEX_RESERVE = 400;

const MASONRY_CORNER_TONES = Object.freeze([
  [0.74, 0.70, 0.62],
  [0.54, 0.34, 0.26],
  [0.62, 0.64, 0.67],
  [0.78, 0.75, 0.69]
]);

function pushManhattanBuildingBlock(vertices, offset, placement) {
  const lot = describeBuildingLot({ vertices, ...placement });
  offset = pushBuildingPlinth(offset, lot);
  offset = pushSidewalkFurniture(offset, lot);
  offset = pushPlannedFrontage(offset, lot, Math.floor(lot.segIndex / MANHATTAN_BLOCK_PERIOD));
  offset = pushStreetCorner(offset, lot);
  offset = pushBackdropTower(offset, lot);
  return offset;
}

function describeBuildingLot(placement) {
  const { yaw, side, segIndex, roadHalfWidth } = placement;
  return {
    ...placement,
    rightX: Math.cos(yaw),
    rightZ: -Math.sin(yaw),
    forwardX: -Math.sin(yaw),
    forwardZ: -Math.cos(yaw),
    faceDir: -side,
    shiftLateral: roadHalfWidth - BASELINE_ROAD_HALF_WIDTH,
    primarySeed: seededRandom(segIndex * 37.0 + side * 13.0),
    secondarySeed: seededRandom(segIndex * 71.0 + side * 29.0)
  };
}

function lotCrossOffset(lot, signedLateral) {
  return { x: lot.x + lot.rightX * signedLateral, z: lot.z + lot.rightZ * signedLateral };
}

function pushOrientedStoneBox(offset, site, { center, size, color, occlusion, variant }) {
  return pushBox(site.vertices, offset, { center, size, yaw: site.yaw, color, material: MATERIAL.STONE, occlusion, variant });
}

function pushBuildingPlinth(offset, lot) {
  const plinthCenter = lotPoint(lot, 26.0 + lot.shiftLateral, SEG_LENGTH * 0.5, -5.8);
  const hasLawnGround = lot.district.groundCover === GROUND_COVER.lawn;
  return pushBox(lot.vertices, offset, {
    center: plinthCenter,
    size: [36.5, 12.0, SEG_LENGTH + 0.05],
    yaw: lot.yaw,
    color: hasLawnGround ? LAWN_GREEN : [0.44, 0.43, 0.41],
    material: hasLawnGround ? MATERIAL.TERRAIN : MATERIAL.STONE,
    occlusion: 0.92,
    variant: hasLawnGround ? 0.25 : 0.1
  });
}

function pushBackdropTower(offset, lot) {
  if (lot.inBlockIdx % BACKDROP_TOWER_PERIOD !== BACKDROP_TOWER_PHASE) return offset;
  const skyline = lot.district.backdropTower;
  if (!skyline) return offset;
  const { y, side, shiftLateral, primarySeed, secondarySeed } = lot;
  const tower = lotCrossOffset(lot, (36.0 + shiftLateral + primarySeed * 8.0) * side);
  const towerHeight = skyline.minHeightMeters + secondarySeed * skyline.heightRangeMeters;
  const towerColor = primarySeed > 0.5 ? skyline.colors[0] : skyline.colors[1];
  offset = pushOrientedStoneBox(offset, lot, {
    center: [tower.x, y + (towerHeight - 12.0) * 0.5, tower.z],
    size: [15.2, towerHeight + 12.0, 16.2],
    color: towerColor,
    occlusion: 0.92,
    variant: 0.5
  });
  return pushOrientedStoneBox(offset, lot, {
    center: [tower.x, y + towerHeight + 0.6, tower.z],
    size: [16.0, 1.2, 17.0],
    color: [0.38, 0.37, 0.35],
    occlusion: 0.96,
    variant: 0.1
  });
}

function pushLimestoneSetbackTower(offset, lot) {
  const { side, shiftLateral, primarySeed, secondarySeed } = lot;
  const palette = {
    limestone: secondarySeed > 0.5 ? [0.74, 0.70, 0.62] : [0.66, 0.63, 0.57],
    graniteBase: [0.48, 0.47, 0.45],
    crownStone: [0.58, 0.56, 0.52]
  };
  const building = lotCrossOffset(lot, (16.8 + shiftLateral + secondarySeed * 2.0) * side);
  const baseTierHeight = 18.0 + primarySeed * 9.0;
  const middleTierHeight = baseTierHeight + 16.0 + secondarySeed * 12.0;
  const topTierHeight = middleTierHeight + 12.0 + primarySeed * 10.0;

  offset = pushSetbackTiers(offset, lot, building, { baseTierHeight, middleTierHeight, topTierHeight }, palette);
  return pushLimestoneEntrance(offset, lot, building, palette.graniteBase);
}

function pushSetbackTiers(offset, lot, building, { baseTierHeight, middleTierHeight, topTierHeight }, { limestone, graniteBase, crownStone }) {
  const y = lot.y;
  offset = pushOrientedStoneBox(offset, lot, {
    center: [building.x, y + 2.2 - 5.0, building.z],
    size: [13.2, 14.4, 15.2],
    color: graniteBase,
    occlusion: 0.94,
    variant: 0.15
  });
  offset = pushOrientedStoneBox(offset, lot, {
    center: [building.x, y + baseTierHeight * 0.5, building.z],
    size: [12.6, baseTierHeight, 14.6],
    color: limestone,
    occlusion: 0.96,
    variant: 0.55
  });
  offset = pushOrientedStoneBox(offset, lot, {
    center: [building.x, y + baseTierHeight + 0.45, building.z],
    size: [13.3, 0.9, 15.3],
    color: crownStone,
    occlusion: 1.0,
    variant: 0.1
  });
  offset = pushOrientedStoneBox(offset, lot, {
    center: [building.x, y + middleTierHeight * 0.5, building.z],
    size: [9.4, middleTierHeight, 10.8],
    color: limestone,
    occlusion: 0.98,
    variant: 0.55
  });
  offset = pushOrientedStoneBox(offset, lot, {
    center: [building.x, y + topTierHeight * 0.5, building.z],
    size: [6.0, topTierHeight, 6.6],
    color: crownStone,
    occlusion: 1.0,
    variant: 0.2
  });
  return pushFlatConcreteRoof(lot.vertices, offset, { x: building.x, y: y + topTierHeight, z: building.z, halfAcross: 3.3, halfAlong: 3.6, yaw: lot.yaw });
}

function pushLimestoneEntrance(offset, lot, building, frameColor) {
  const { vertices, y, yaw, rightX, rightZ, faceDir } = lot;
  const entranceX = building.x + rightX * (faceDir * 6.45);
  const entranceZ = building.z + rightZ * (faceDir * 6.45);
  offset = pushOrientedStoneBox(offset, lot, {
    center: [entranceX, y + 2.6, entranceZ],
    size: [0.85, 5.2, 4.6],
    color: frameColor,
    occlusion: 0.95,
    variant: 0.1
  });
  return pushBox(vertices, offset, {
    center: [entranceX + rightX * (faceDir * 0.25), y + 2.1, entranceZ + rightZ * (faceDir * 0.25)],
    size: [0.22, 3.4, 2.4],
    yaw,
    color: [0.95, 0.82, 0.56],
    material: MATERIAL.GLOW,
    occlusion: 1.0
  });
}

function pushColonnadeTower(offset, lot) {
  const { y, side, faceDir, shiftLateral, primarySeed, secondarySeed } = lot;
  const travertine = secondarySeed > 0.5 ? [0.72, 0.69, 0.63] : [0.62, 0.64, 0.67];
  const darkGranite = [0.40, 0.41, 0.44];
  const buildingLateral = (17.4 + shiftLateral + primarySeed * 2.0) * side;
  const building = lotCrossOffset(lot, buildingLateral);
  const towerHeight = 28.0 + secondarySeed * 20.0;

  offset = pushOrientedStoneBox(offset, lot, {
    center: [building.x, y + 2.5 - 5.0, building.z],
    size: [12.8, 15.0, 14.8],
    color: darkGranite,
    occlusion: 0.94,
    variant: 0.15
  });
  offset = pushOrientedStoneBox(offset, lot, {
    center: [building.x, y + towerHeight * 0.5, building.z],
    size: [12.0, towerHeight, 14.0],
    color: travertine,
    occlusion: 0.97,
    variant: 0.55
  });
  offset = pushColonnadeColumns(offset, lot, buildingLateral + faceDir * 6.35);
  offset = pushOrientedStoneBox(offset, lot, {
    center: [building.x, y + 8.6, building.z],
    size: [13.2, 1.1, 14.7],
    color: darkGranite,
    occlusion: 0.95,
    variant: 0.1
  });
  return pushColonnadeCrown(offset, lot, building, towerHeight, darkGranite);
}

function pushColonnadeColumns(offset, lot, columnLateral) {
  const { vertices, x, y, z, yaw, rightX, rightZ, forwardX, forwardZ, primarySeed } = lot;
  const marble = MARBLE_TONES[Math.floor(primarySeed * MARBLE_TONES.length) % MARBLE_TONES.length];
  for (let columnIndex = -1; columnIndex <= 1; columnIndex++) {
    offset = pushRoundColumn(vertices, offset, {
      x: x + rightX * columnLateral + forwardX * (columnIndex * COLONNADE_COLUMN_SPACING),
      y: y + 0.18,
      z: z + rightZ * columnLateral + forwardZ * (columnIndex * COLONNADE_COLUMN_SPACING),
      height: 8.25,
      radius: 0.5,
      yaw,
      color: marble,
      material: MATERIAL.MARBLE
    });
  }
  return offset;
}

function pushColonnadeCrown(offset, lot, building, towerHeight, corniceColor) {
  const y = lot.y;
  offset = pushOrientedStoneBox(offset, lot, {
    center: [building.x, y + towerHeight + 0.6, building.z],
    size: [12.9, 1.2, 14.9],
    color: corniceColor,
    occlusion: 0.98,
    variant: 0.1
  });
  return pushOrientedStoneBox(offset, lot, {
    center: [building.x, y + towerHeight + 2.8, building.z],
    size: [9.6, 3.4, 11.4],
    color: [0.28, 0.50, 0.43],
    occlusion: 1.0,
    variant: 0.15
  });
}

function pushBrownstoneRowhouse(offset, lot) {
  const { y, side, forwardX, forwardZ, shiftLateral, primarySeed, secondarySeed } = lot;
  const brownstoneColor = secondarySeed > 0.5 ? [0.54, 0.34, 0.26] : [0.48, 0.36, 0.30];
  const corniceColor = [0.32, 0.28, 0.26];
  const building = lotCrossOffset(lot, (15.4 + shiftLateral) * side);
  const rowHeight = 16.5 + primarySeed * 7.5;

  offset = pushOrientedStoneBox(offset, lot, {
    center: [building.x, y - 5.0, building.z],
    size: [11.2, 10.2, 15.2],
    color: corniceColor,
    occlusion: 0.90,
    variant: 0.1
  });
  offset = pushOrientedStoneBox(offset, lot, {
    center: [building.x, y + rowHeight * 0.5, building.z],
    size: [10.8, rowHeight, 14.8],
    color: brownstoneColor,
    occlusion: 0.95,
    variant: 0.55
  });
  offset = pushOrientedStoneBox(offset, lot, {
    center: [building.x, y + rowHeight + 0.5, building.z],
    size: [11.6, 1.0, 15.5],
    color: corniceColor,
    occlusion: 0.92,
    variant: 0.1
  });
  const faceLateral = 15.4 + shiftLateral - 5.4;
  offset = pushBrownstoneAwning(offset, lot, building);
  offset = pushBrownstoneStoop(offset, lot, { faceLateral, stoneColor: brownstoneColor, ironColor: corniceColor });
  return pushRooftopWaterTank(offset, lot, {
    x: building.x + forwardX * 2.5,
    roofY: y + rowHeight,
    z: building.z + forwardZ * 2.5,
    standColor: corniceColor
  });
}

function pushBrownstoneAwning(offset, lot, building) {
  const { y, rightX, rightZ, forwardX, forwardZ, faceDir, primarySeed } = lot;
  const awningColor = primarySeed > 0.5 ? [0.18, 0.42, 0.30] : [0.58, 0.20, 0.22];
  const awningAlong = (primarySeed > 0.5 ? -1 : 1) * 3.6;
  const frontX = building.x + rightX * (faceDir * 5.55) + forwardX * awningAlong;
  const frontZ = building.z + rightZ * (faceDir * 5.55) + forwardZ * awningAlong;
  return pushOrientedStoneBox(offset, lot, {
    center: [frontX, y + 3.4, frontZ],
    size: [1.35, 0.45, 5.6],
    color: awningColor,
    occlusion: 0.9,
    variant: 0.1
  });
}

function pushBrownstoneStoop(offset, lot, { faceLateral, stoneColor, ironColor }) {
  const stoopAlong = (lot.primarySeed > 0.5 ? 1 : -1) * 3.2;
  const parlorHeight = STOOP_STEP_COUNT * STOOP_STEP_RISE;
  offset = pushLotFrontSteps(offset, lot, {
    frontLateral: faceLateral,
    along: stoopAlong,
    length: STOOP_WIDTH,
    topHeight: parlorHeight,
    stepCount: STOOP_STEP_COUNT,
    treadDepth: STOOP_TREAD_DEPTH,
    color: stoneColor
  });
  const stoopRun = STOOP_STEP_COUNT * STOOP_TREAD_DEPTH;
  const stoop = { faceLateral, stoopAlong, parlorHeight, stoopRun, stoneColor, ironColor };
  for (const end of [-1, 1]) {
    offset = pushStoopRailing(offset, lot, stoop, stoopAlong + end * (STOOP_WIDTH * 0.5 + 0.16));
  }
  return pushStoopDoorway(offset, lot, stoop);
}

function pushStoopRailing(offset, lot, { faceLateral, parlorHeight, stoopRun, stoneColor, ironColor }, railAlong) {
  return withDetailGeometry(() => {
    offset = pushLotBox(offset, lot, {
      lateral: faceLateral - stoopRun * 0.5,
      along: railAlong,
      bottom: 0,
      height: parlorHeight * 0.55,
      across: stoopRun,
      length: 0.32,
      color: [stoneColor[0] * 0.86, stoneColor[1] * 0.86, stoneColor[2] * 0.86],
      material: MATERIAL.STONE
    });
    offset = pushLotBox(offset, lot, {
      lateral: faceLateral - stoopRun * 0.3,
      along: railAlong,
      bottom: parlorHeight * 0.55,
      height: parlorHeight * 0.45 + 0.6,
      across: stoopRun * 0.6,
      length: 0.32,
      color: [stoneColor[0] * 0.86, stoneColor[1] * 0.86, stoneColor[2] * 0.86],
      material: MATERIAL.STONE
    });
    return pushLotBox(offset, lot, {
      lateral: faceLateral - stoopRun * 0.5,
      along: railAlong,
      bottom: parlorHeight + 0.7,
      height: 0.06,
      across: stoopRun,
      length: 0.06,
      color: ironColor,
      material: MATERIAL.METAL,
      occlusion: 0.9
    });
  });
}

function pushStoopDoorway(offset, lot, { faceLateral, stoopAlong, parlorHeight }) {
  offset = pushLotBox(offset, lot, { lateral: faceLateral - 0.1, along: stoopAlong, bottom: parlorHeight, height: 2.7, across: 0.2, length: 1.3, color: [0.20, 0.12, 0.08], material: MATERIAL.WOOD, occlusion: 0.9 });
  return pushLotBox(offset, lot, { lateral: faceLateral - 0.12, along: stoopAlong, bottom: parlorHeight + 2.8, height: 0.42, across: 0.16, length: 1.2, color: [1.0, 0.86, 0.56], material: MATERIAL.GLOW, occlusion: 1.0 });
}

function pushRooftopWaterTank(offset, site, { x, roofY, z, standColor }) {
  offset = pushOrientedStoneBox(offset, site, {
    center: [x, roofY + 1.6, z],
    size: [1.2, 2.2, 1.2],
    color: standColor,
    occlusion: 0.85,
    variant: 0.1
  });
  return pushOrientedStoneBox(offset, site, { center: [x, roofY + 3.9, z], size: [2.6, 2.4, 2.6], color: BRUTALIST_CONCRETE, occlusion: 0.95, variant: 0.1 });
}

function pushFountainPlazaTower(offset, lot) {
  const { y, side, shiftLateral, secondarySeed } = lot;
  const bronzeStone = [0.42, 0.40, 0.38];
  const creamTravertine = [0.78, 0.75, 0.69];
  const building = lotCrossOffset(lot, (20.5 + shiftLateral) * side);
  const towerHeight = 34.0 + secondarySeed * 22.0;

  offset = pushOrientedStoneBox(offset, lot, {
    center: [building.x, y - 5.0, building.z],
    size: [12.6, 10.5, 14.6],
    color: bronzeStone,
    occlusion: 0.92,
    variant: 0.1
  });
  offset = pushOrientedStoneBox(offset, lot, {
    center: [building.x, y + towerHeight * 0.5, building.z],
    size: [11.8, towerHeight, 13.8],
    color: creamTravertine,
    occlusion: 0.97,
    variant: 0.55
  });
  offset = pushOrientedStoneBox(offset, lot, {
    center: [building.x, y + towerHeight + 0.8, building.z],
    size: [12.4, 1.4, 14.4],
    color: bronzeStone,
    occlusion: 1.0,
    variant: 0.1
  });
  return pushPlazaFountain(offset, lot, creamTravertine);
}

function pushPlazaFountain(offset, lot, basinColor) {
  const { vertices, y, yaw, side, shiftLateral, primarySeed } = lot;
  const fountain = lotCrossOffset(lot, (11.4 + shiftLateral) * side);
  registerObstacle("barrier", fountain.x, fountain.z, 4.2, 5.6, yaw);
  offset = pushOrientedStoneBox(offset, lot, {
    center: [fountain.x, y + 0.35, fountain.z],
    size: [4.2, 0.75, 5.6],
    color: basinColor,
    occlusion: 0.95,
    variant: 0.1
  });
  offset = pushBox(vertices, offset, {
    center: [fountain.x, y + 0.76, fountain.z],
    size: [3.5, 0.12, 4.8],
    yaw,
    color: [0.16, 0.52, 0.72],
    material: MATERIAL.WATER,
    occlusion: 1.5,
    variant: 0.85
  });
  return pushWaterSplashCrests(vertices, offset, fountain.x, y + 0.82, fountain.z, yaw, primarySeed);
}

function pushCornerBuilding(vertices, offset, x, y, z, yaw, size, rng) {
  const corner = { vertices, x, y, z, yaw, size };
  if (!hasVertexRoom(offset, PLAIN_CORNER_VERTEX_RESERVE)) return offset;
  const styleIndex = Math.floor(rng() * (CORNER_BUILDING_STYLE_COUNT + CORNER_LANDMARK_STYLES.length));
  const style = styleIndex % CORNER_BUILDING_STYLE_COUNT;
  if (styleIndex >= CORNER_BUILDING_STYLE_COUNT) {
    const landmark = CORNER_LANDMARK_STYLES[styleIndex - CORNER_BUILDING_STYLE_COUNT];
    if (hasVertexRoom(offset, landmark.vertexReserve)) return landmark.build(offset, corner, rng);
    return pushMasonryCornerBuilding(offset, corner, style, rng);
  }
  if (style === TURRET_CORNER_STYLE && hasVertexRoom(offset, TURRET_CORNER_VERTEX_RESERVE)) return pushTurretCornerBuilding(offset, corner, rng);
  if (style === LOFT_CORNER_STYLE) return pushLoftCornerBuilding(offset, corner, rng);
  return pushMasonryCornerBuilding(offset, corner, style, rng);
}

function hasVertexRoom(offset, reservedVertexCount) {
  return offset + reservedVertexCount * FLOATS_PER_VERT < VERTS_PER_SEGMENT * FLOATS_PER_VERT;
}

function pushTurretCornerBuilding(offset, corner, rng) {
  const { vertices, x, y, z, yaw, size } = corner;
  const bodyHeight = 18 + rng() * 16;
  const tone = rng() > 0.5 ? STONE_TONES.limestone : ASHLAR_TONES.warmSandstone;
  const isAshlar = tone === ASHLAR_TONES.warmSandstone;
  offset = pushCornerBodyAndCornice(offset, corner, { bodyHeight, bodyColor: tone, bodyMaterial: isAshlar ? MATERIAL.ASHLAR : MATERIAL.STONE, bodyOcclusion: 0.96, corniceColor: STONE_TONES.portland });
  const turretX = x + Math.sin(yaw) * size * 0.5;
  const turretZ = z + Math.cos(yaw) * size * 0.5;
  const turretRadius = size * 0.26;
  const turretTop = bodyHeight + 5.0;
  offset = pushOctagonalPrism(vertices, offset, { x: turretX, y, z: turretZ, bottom: -2.0, top: turretTop, radius: turretRadius, color: isAshlar ? STONE_TONES.sandstone : tone, material: MATERIAL.STONE, variant: 0.55 });
  offset = pushFlatConcreteRoof(vertices, offset, { x: turretX, y: y + turretTop, z: turretZ, halfAcross: turretRadius * 1.1, halfAlong: turretRadius * 1.1, yaw });
  return pushCornerEntranceGlow(offset, corner);
}

function pushLoftCornerBuilding(offset, corner, rng) {
  const { vertices, x, y, z, yaw, size } = corner;
  const bodyHeight = 14 + rng() * 14;
  const facadeStone = rng() > 0.5 ? STONE_TONES.sandstone : STONE_TONES.granite;
  const finColor = [0.12, 0.13, 0.14];
  offset = pushCornerBodyAndCornice(offset, corner, { bodyHeight, bodyColor: facadeStone, bodyMaterial: MATERIAL.ASHLAR, bodyOcclusion: 0.95, corniceColor: STONE_TONES.portland });
  const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
  for (const side of [-1, 1]) {
    const finX = x + rightX * side * (size * 0.5 + 0.45);
    const finZ = z + rightZ * side * (size * 0.5 + 0.45);
    offset = pushBox(vertices, offset, {
      center: [finX, y + bodyHeight * 0.55, finZ],
      size: [0.7, bodyHeight * 0.8, size * 0.42],
      yaw,
      color: finColor,
      material: MATERIAL.METAL,
      occlusion: 0.9
    });
  }
  return pushBox(vertices, offset, {
    center: [x, y + bodyHeight + 2.2, z],
    size: [2.2, 2.6, 2.2],
    yaw,
    color: [0.44, 0.32, 0.20],
    material: MATERIAL.FOLIAGE,
    occlusion: 0.9,
    variant: 0.1
  });
}

function pushMasonryCornerBuilding(offset, corner, style, rng) {
  const { x, y, z, size } = corner;
  const bodyHeight = 16 + Math.pow(rng(), 1.2) * 46;
  const tone = MASONRY_CORNER_TONES[style % MASONRY_CORNER_TONES.length];
  const trim = [tone[0] * 0.66, tone[1] * 0.66, tone[2] * 0.66];
  offset = pushOrientedStoneBox(offset, corner, {
    center: [x, y - 4.0, z],
    size: [size + 0.6, 8.4, size + 0.6],
    color: trim,
    occlusion: 0.92,
    variant: 0.1
  });
  offset = pushOrientedStoneBox(offset, corner, {
    center: [x, y + bodyHeight * 0.5, z],
    size: [size, bodyHeight, size],
    color: tone,
    occlusion: 0.96,
    variant: 0.55
  });
  offset = pushOrientedStoneBox(offset, corner, {
    center: [x, y + bodyHeight + 0.5, z],
    size: [size + 0.8, 1.0, size + 0.8],
    color: trim,
    occlusion: 1.0,
    variant: 0.1
  });
  offset = pushMasonryCornerRoof(offset, corner, { style, roofY: y + bodyHeight, tone, trim }, rng);
  return pushCornerEntranceGlow(offset, corner);
}

function pushMasonryCornerRoof(offset, corner, { style, roofY, tone, trim }, rng) {
  const { x, z, size } = corner;
  if (SETBACK_CROWN_CORNER_STYLES.includes(style)) return pushSetbackCornerCrown(offset, corner, { roofY, tone, trim }, rng);
  if (style === WATER_TANK_CORNER_STYLE) return pushRooftopWaterTank(offset, corner, { x, roofY, z, standColor: trim });
  return pushOrientedStoneBox(offset, corner, {
    center: [x, roofY + 1.7, z],
    size: [size * 0.7, 2.4, size * 0.7],
    color: [0.28, 0.50, 0.43],
    occlusion: 1.0,
    variant: 0.15
  });
}

function pushSetbackCornerCrown(offset, corner, { roofY, tone, trim }, rng) {
  const { x, z, size } = corner;
  const crownHeight = 10 + rng() * 22;
  offset = pushOrientedStoneBox(offset, corner, {
    center: [x, roofY + crownHeight * 0.5, z],
    size: [size * 0.66, crownHeight, size * 0.66],
    color: tone,
    occlusion: 0.98,
    variant: 0.55
  });
  return pushOrientedStoneBox(offset, corner, {
    center: [x, roofY + crownHeight + 0.4, z],
    size: [size * 0.72, 0.8, size * 0.72],
    color: trim,
    occlusion: 1.0,
    variant: 0.1
  });
}

function pushCornerBodyAndCornice(offset, corner, { bodyHeight, bodyColor, bodyMaterial, bodyOcclusion, corniceColor }) {
  const { vertices, x, y, z, yaw, size } = corner;
  offset = pushBox(vertices, offset, {
    center: [x, y + (bodyHeight - 4) * 0.5, z],
    size: [size, bodyHeight + 4, size],
    yaw,
    color: bodyColor,
    material: bodyMaterial,
    occlusion: bodyOcclusion,
    variant: 0.55
  });
  return pushOrientedStoneBox(offset, corner, {
    center: [x, y + bodyHeight + 0.45, z],
    size: [size + 0.7, 0.9, size + 0.7],
    color: corniceColor,
    occlusion: 1.0,
    variant: 0.1
  });
}

function pushCornerEntranceGlow(offset, corner) {
  const { vertices, x, y, z, yaw, size } = corner;
  return pushBox(vertices, offset, {
    center: [x, y + 1.6, z],
    size: [size + 0.25, 0.32, size + 0.25],
    yaw,
    color: [1.0, 0.86, 0.6],
    material: MATERIAL.GLOW,
    occlusion: 1.0
  });
}
