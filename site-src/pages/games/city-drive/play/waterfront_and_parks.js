// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const WATER_STYLE_LAKE_PROMENADE = 0;
const WATER_STYLE_CASCADE_FOUNTAIN = 1;
const WATERFRONT_LANDMARK_SLOT = 9;
const RIVER_PIER_SLOTS = Object.freeze([6, 12]);

const PARK_THEME_REFLECTING_FOUNTAIN = 0;
const PARK_THEME_CANOPY_PAVILION = 1;
const PARK_MONUMENT_SLOT = 9;
const PARK_LAWN_DEPTH_METERS = 41.6;
const PARK_BENCH_SLOT_PERIOD = 3;
const PARK_BENCH_SLOT_PHASE = 1;
const PARK_FOOTPATH_SETBACK_METERS = 6.8;
const PARK_BENCH_OFFSET_FROM_PATH_METERS = 1.75;

function pushManhattanWaterFeatureSide(vertices, offset, x, y, z, yaw, side, segIndex, inBlockIdx, roadHalfWidth, waterStyle) {
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  const primarySeed = seededRandom(segIndex * 53.0 + side * 11.0);
  const secondarySeed = seededRandom(segIndex * 97.0 + side * 23.0);

  const wallLateral = (roadHalfWidth + 3.4) * side;
  const wallX = x + rightX * wallLateral;
  const wallZ = z + rightZ * wallLateral;
  registerObstacle("barrier", wallX, wallZ, 1.0, SEG_LENGTH + 0.35, yaw);

  const shore = {
    x, y, z, yaw, side, segIndex, inBlockIdx, roadHalfWidth,
    rightX, rightZ, primarySeed, secondarySeed, wallX, wallZ,
    seawallLength: SEG_LENGTH + 0.35
  };

  if (waterStyle === WATER_STYLE_LAKE_PROMENADE) {
    offset = pushLakePromenadeShore(vertices, offset, shore);
  } else if (waterStyle === WATER_STYLE_CASCADE_FOUNTAIN) {
    offset = pushCascadeFountainShore(vertices, offset, shore);
  } else {
    offset = pushRiverPierShore(vertices, offset, shore);
  }
  return pushWaterfrontBackdrop(vertices, offset, shore);
}

function pushManhattanParkBlock(vertices, offset, x, y, z, yaw, side, segIndex, inBlockIdx, roadHalfWidth, parkTheme) {
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  const primarySeed = seededRandom(segIndex * 41.0 + side * 7.0);
  const secondarySeed = seededRandom(segIndex * 89.0 + side * 19.0);

  const park = { x, y, z, yaw, side, segIndex, inBlockIdx, roadHalfWidth, rightX, rightZ, primarySeed, secondarySeed };
  offset = pushParkFootpath(vertices, offset, park);

  if (inBlockIdx === PARK_MONUMENT_SLOT) {
    return pushParkMonument(vertices, offset, park, parkTheme);
  }
  if (primarySeed > 0.16) plantParkTreeAndGrove(park);
  return offset;
}

function pushWaterSplashCrests(vertices, offset, x, y, z, yaw, seed) {
  const foamWhite = [0.92, 0.97, 1.0];
  const sprayCyan = [0.68, 0.90, 0.98];
  for (let i = 0; i < 3; i++) {
    const angle = yaw + (i - 1) * 0.45 + seed * 1.5;
    const crestX = x + Math.cos(angle) * (0.9 + i * 0.55);
    const crestZ = z + Math.sin(angle) * (0.9 + i * 0.55);
    const crestHeight = 0.55 + ((seed * (i + 2)) % 0.65);
    offset = pushRoundedDome(vertices, offset, crestX, y + crestHeight * 0.35, crestZ, 0.85, crestHeight, 0.85, 6, 3, i % 2 === 0 ? foamWhite : sprayCyan, 4.0, 1.45, 0.35);
  }
  return offset;
}

function pushLakeSailboat(vertices, offset, x, y, z, yaw, scale = 1.0) {
  const hullColor = [0.92, 0.94, 0.98];
  const sailColor = [0.98, 0.86, 0.65];
  offset = pushBox(vertices, offset, {
    center: [x, y + 0.25 * scale, z],
    size: [1.4 * scale, 0.5 * scale, 3.6 * scale],
    yaw,
    color: hullColor,
    material: MATERIAL.METAL,
    occlusion: 1.0
  });
  const bowPoint = transformPoint(0, 0.5 * scale, -1.1 * scale, x, y, z, yaw, 0, 0);
  const sternPoint = transformPoint(0, 0.5 * scale,  1.2 * scale, x, y, z, yaw, 0, 0);
  const mastTop = transformPoint(0, 3.8 * scale,  0.0,         x, y, z, yaw, 0, 0);
  offset = pushTriangle(vertices, offset, bowPoint, sternPoint, mastTop, sailColor, MATERIAL.TERRAIN, 0.4, 1.0, 1.0, 1.05);
  offset = pushTriangle(vertices, offset, sternPoint, bowPoint, mastTop, sailColor, MATERIAL.TERRAIN, 0.4, 1.0, 1.0, 1.05);
  return offset;
}

function pushSeawall(vertices, offset, shore, { centerY, thickness, height, color, occlusion }) {
  return pushBox(vertices, offset, {
    center: [shore.wallX, centerY, shore.wallZ],
    size: [thickness, height, shore.seawallLength],
    yaw: shore.yaw,
    color,
    material: MATERIAL.STONE,
    occlusion,
    variant: 0.1
  });
}

function pushLakePromenadeShore(vertices, offset, shore) {
  const { y, side, inBlockIdx, roadHalfWidth, primarySeed, secondarySeed } = shore;
  const waterY = y - 0.55;
  offset = pushSeawall(vertices, offset, shore, { centerY: y - 2.2, thickness: 0.95, height: 5.8, color: [0.74, 0.71, 0.65], occlusion: 0.95 });

  if (inBlockIdx % 2 === 1) {
    plantPromenadeTree(shore);
  }

  if (inBlockIdx === WATERFRONT_LANDMARK_SLOT) {
    return pushLakeFootbridge(vertices, offset, shore, waterY);
  }
  if (inBlockIdx % 4 === 2) {
    const boatLateral = (roadHalfWidth + 16.0 + primarySeed * 10.0) * side;
    const { x: boatX, z: boatZ } = planarPointAcrossRoad(shore, boatLateral);
    return pushLakeSailboat(vertices, offset, boatX, waterY, boatZ, shore.yaw + secondarySeed * 3.14, 0.78);
  }
  return offset;
}

function plantPromenadeTree(shore) {
  const { y, side, segIndex, inBlockIdx, roadHalfWidth, primarySeed, secondarySeed } = shore;
  const { x: treeX, z: treeZ } = planarPointAcrossRoad(shore, (roadHalfWidth + 5.2) * side);
  const choice = chooseTreeFromSpecies(PROMENADE_TREE_SPECIES, { pickSeed: seededRandom(segIndex - inBlockIdx + side * 3.1), heightSeed: secondarySeed });
  plantStreetTree({
    x: treeX, y: y + 0.2, z: treeZ,
    ...choice,
    ...roadsideCrownLimits(choice.heightMeters, { overhangCrownRadiusMeters: 4.6, tightCrownRadiusMeters: 3.0 }),
    seed: primarySeed
  });
}

function pushLakeFootbridge(vertices, offset, shore, waterY) {
  const bridgeLateral = (shore.roadHalfWidth + 21.0) * shore.side;
  offset = pushBox(vertices, offset, {
    center: centerAcrossRoad(shore, bridgeLateral, waterY + 2.4),
    size: [24.0, 0.75, 3.6],
    yaw: shore.yaw,
    color: [0.88, 0.86, 0.82],
    material: MATERIAL.STONE,
    occlusion: 1.0,
    variant: 0.1
  });
  return pushBox(vertices, offset, {
    center: centerAcrossRoad(shore, bridgeLateral, waterY + 3.1),
    size: [24.0, 0.55, 3.8],
    yaw: shore.yaw,
    color: [0.72, 0.68, 0.62],
    material: MATERIAL.STONE,
    occlusion: 0.95,
    variant: 0.1
  });
}

function pushCascadeFountainShore(vertices, offset, shore) {
  const { y, side, inBlockIdx, roadHalfWidth, secondarySeed } = shore;
  const waterY = y - 1.35;
  offset = pushSeawall(vertices, offset, shore, { centerY: y - 2.6, thickness: 1.1, height: 6.5, color: [0.76, 0.73, 0.67], occlusion: 0.96 });
  offset = pushCascadeWaterfall(vertices, offset, shore, waterY);

  if (inBlockIdx % 3 === 1) {
    const { x: jetX, z: jetZ } = planarPointAcrossRoad(shore, (roadHalfWidth + 17.5) * side);
    offset = pushWaterSplashCrests(vertices, offset, jetX, waterY, jetZ, shore.yaw, secondarySeed);
  }
  return offset;
}

function pushCascadeWaterfall(vertices, offset, shore, waterY) {
  const { y, yaw, side, rightX, rightZ } = shore;
  const { x: cascadeX, z: cascadeZ } = planarPointAcrossRoad(shore, (shore.roadHalfWidth + 33.5) * side);
  offset = pushBox(vertices, offset, {
    center: [cascadeX, y + 1.8, cascadeZ],
    size: [4.2, 8.5, shore.seawallLength],
    yaw,
    color: [0.48, 0.49, 0.52],
    material: MATERIAL.STONE,
    occlusion: 0.94,
    variant: 0.1
  });
  offset = pushBox(vertices, offset, {
    center: [cascadeX - rightX * (side * 2.15), y + 1.6, cascadeZ - rightZ * (side * 2.15)],
    size: [0.35, 6.2, SEG_LENGTH * 0.82],
    yaw,
    color: [0.42, 0.82, 0.96],
    material: MATERIAL.WATER,
    occlusion: 2.2,
    variant: 1.15
  });
  return pushWaterSplashCrests(vertices, offset, cascadeX - rightX * (side * 2.8), waterY, cascadeZ - rightZ * (side * 2.8), yaw, shore.primarySeed);
}

function pushRiverPierShore(vertices, offset, shore) {
  const { x, y, z, yaw, side, inBlockIdx, roadHalfWidth, primarySeed } = shore;
  const waterY = y - 2.35;
  offset = pushSeawall(vertices, offset, shore, { centerY: y - 3.4, thickness: 0.95, height: 8.2, color: [0.50, 0.49, 0.47], occlusion: 0.94 });

  if (inBlockIdx % 4 === 2) {
    offset = pushSeawallLamp(vertices, offset, shore);
  }
  if (RIVER_PIER_SLOTS.includes(inBlockIdx)) {
    offset = pushRiverPierWithBoat(vertices, offset, shore, waterY);
  }

  const { x: splashX, z: splashZ } = planarPointAcrossRoad(shore, (roadHalfWidth + 10.5 + primarySeed * 3.5) * side);
  offset = pushWaterSplashCrests(vertices, offset, splashX, waterY, splashZ, yaw, primarySeed);

  if (inBlockIdx === WATERFRONT_LANDMARK_SLOT) {
    offset = pushManhattanRiverBridgeTower(vertices, offset, x, waterY, z, yaw, side);
  }
  return offset;
}

function pushSeawallLamp(vertices, offset, shore) {
  const { wallX, wallZ, y, yaw } = shore;
  offset = pushBox(vertices, offset, {
    center: [wallX, y + 2.4, wallZ],
    size: [0.22, 3.6, 0.22],
    yaw,
    color: [0.20, 0.24, 0.26],
    material: MATERIAL.METAL,
    occlusion: 0.9
  });
  return pushBox(vertices, offset, {
    center: [wallX, y + 4.3, wallZ],
    size: [0.46, 0.46, 0.46],
    yaw,
    color: [1.0, 0.90, 0.62],
    material: MATERIAL.GLOW,
    occlusion: 1.0
  });
}

function pushRiverPierWithBoat(vertices, offset, shore, waterY) {
  const { yaw, side, rightX, rightZ } = shore;
  const { x: pierX, z: pierZ } = planarPointAcrossRoad(shore, (shore.roadHalfWidth + 14.5) * side);
  offset = pushBox(vertices, offset, {
    center: [pierX, waterY + 0.45, pierZ],
    size: [18.0, 0.45, 2.4],
    yaw,
    color: [0.52, 0.38, 0.26],
    material: MATERIAL.STONE,
    occlusion: 0.95,
    variant: 0.1
  });
  return pushLakeSailboat(vertices, offset, pierX + rightX * (side * 4.5), waterY, pierZ + rightZ * (side * 4.5) + 2.8, yaw, 1.25);
}

function pushWaterfrontBackdrop(vertices, offset, shore) {
  const { y, side, inBlockIdx, roadHalfWidth, primarySeed, secondarySeed } = shore;
  if (inBlockIdx % 2 === 1) {
    const { x: farTreeX, z: farTreeZ } = planarPointAcrossRoad(shore, (roadHalfWidth + 42.0 + primarySeed * 8.0) * side);
    const choice = chooseTreeFromSpecies(PARK_TREE_SPECIES, { pickSeed: secondarySeed, heightSeed: primarySeed });
    plantStreetTree({ x: farTreeX, y: y + 1.5, z: farTreeZ, ...choice, seed: primarySeed });
  }
  if (inBlockIdx % 5 === 3) {
    const bluffLateral = (roadHalfWidth + 58.0 + secondarySeed * 14.0) * side;
    const bluffHeight = 38.0 + primarySeed * 28.0;
    offset = pushBox(vertices, offset, {
      center: centerAcrossRoad(shore, bluffLateral, y + (bluffHeight - 12.0) * 0.5),
      size: [15.5, bluffHeight + 12.0, 15.5],
      yaw: shore.yaw,
      color: [0.60, 0.58, 0.54],
      material: MATERIAL.STONE,
      occlusion: 0.94,
      variant: 0.5
    });
  }
  return offset;
}

function pushParkFootpath(vertices, offset, park) {
  const { y, yaw, side, inBlockIdx } = park;
  const { x: pathX, z: pathZ } = planarPointAcrossRoad(park, (park.roadHalfWidth + PARK_FOOTPATH_SETBACK_METERS) * side);
  offset = pushBox(vertices, offset, {
    center: [pathX, y + 0.22, pathZ],
    size: [2.6, 0.18, SEG_LENGTH + 0.2],
    yaw,
    color: [0.74, 0.72, 0.67],
    material: MATERIAL.PAVING,
    occlusion: 0.85,
    variant: PAVING_PATTERN_VARIANT.slab
  });
  if (inBlockIdx % PARK_BENCH_SLOT_PERIOD !== PARK_BENCH_SLOT_PHASE) return offset;
  const { x: benchX, z: benchZ } = planarPointAcrossRoad(park, (park.roadHalfWidth + PARK_FOOTPATH_SETBACK_METERS - PARK_BENCH_OFFSET_FROM_PATH_METERS) * side);
  return pushMarbleBench(vertices, offset, { base: [benchX, y + 0.18, benchZ], yaw });
}

function pushParkMonument(vertices, offset, park, parkTheme) {
  const { x: monumentX, z: monumentZ } = planarPointAcrossRoad(park, (park.roadHalfWidth + 17.5) * park.side);
  const monument = { ...park, x: monumentX, z: monumentZ };
  registerObstacle("barrier", monumentX, monumentZ, 8.6, 8.6, park.yaw);
  if (parkTheme === PARK_THEME_REFLECTING_FOUNTAIN) {
    return pushReflectingFountainMonument(vertices, offset, monument);
  }
  if (parkTheme === PARK_THEME_CANOPY_PAVILION) {
    return pushCanopyPavilionMonument(vertices, offset, monument);
  }
  return pushWaterfallWallMonument(vertices, offset, monument);
}

function pushReflectingFountainMonument(vertices, offset, monument) {
  const { x, y, z, yaw } = monument;
  offset = pushBox(vertices, offset, {
    center: [x, y - 1.2, z],
    size: [8.6, 4.2, 8.6],
    yaw,
    color: [0.68, 0.65, 0.58],
    material: MATERIAL.STONE,
    occlusion: 0.95,
    variant: 0.1
  });
  offset = pushBox(vertices, offset, {
    center: [x, y + 0.96, z],
    size: [7.4, 0.16, 7.4],
    yaw,
    color: liveWeatherColor(LIVE_WEATHER_COLOR.water),
    material: MATERIAL.WATER,
    occlusion: 1.5,
    variant: 0.95
  });
  offset = pushRoundedDome(vertices, offset, x, y + 2.1, z, 2.2, 0.55, 2.2, 8, 3, [0.46, 0.38, 0.30], 2.0, 0.3, 1.2);
  offset = pushWaterSplashCrests(vertices, offset, x, y + 1.05, z, yaw, monument.primarySeed);
  return pushWaterSplashCrests(vertices, offset, x, y + 2.45, z, yaw + 1.2, monument.secondarySeed);
}

function pushCanopyPavilionMonument(vertices, offset, monument) {
  const { x, y, z, yaw } = monument;
  const limestone = [0.78, 0.75, 0.68];
  const copper = [0.26, 0.52, 0.44];
  offset = pushBox(vertices, offset, {
    center: [x, y - 1.0, z],
    size: [7.8, 4.2, 7.8],
    yaw,
    color: limestone,
    material: MATERIAL.STONE,
    occlusion: 0.96,
    variant: 0.1
  });
  for (let columnSideX = -1; columnSideX <= 1; columnSideX += 2) {
    for (let columnSideZ = -1; columnSideZ <= 1; columnSideZ += 2) {
      offset = pushBox(vertices, offset, {
        center: [x + columnSideX * 2.4, y + 3.0, z + columnSideZ * 2.4],
        size: [0.58, 3.8, 0.58],
        yaw,
        color: limestone,
        material: MATERIAL.STONE,
        occlusion: 0.98,
        variant: 0.1
      });
    }
  }
  offset = pushFlatConcreteRoof(vertices, offset, { x, y: y + 4.9, z, halfAcross: 3.2, halfAlong: 3.2, yaw, color: copper });
  return pushBox(vertices, offset, {
    center: [x, y + 4.3, z],
    size: [0.65, 0.65, 0.65],
    yaw,
    color: [1.0, 0.90, 0.62],
    material: MATERIAL.GLOW,
    occlusion: 1.0
  });
}

function pushWaterfallWallMonument(vertices, offset, monument) {
  const { x, y, z, yaw, side, rightX, rightZ } = monument;
  offset = pushBox(vertices, offset, {
    center: [x, y - 1.0, z],
    size: [8.2, 4.0, 8.2],
    yaw,
    color: [0.58, 0.56, 0.52],
    material: MATERIAL.STONE,
    occlusion: 0.95,
    variant: 0.1
  });
  offset = pushBox(vertices, offset, {
    center: [x + rightX * (side * 2.4), y + 3.6, z + rightZ * (side * 2.4)],
    size: [1.2, 5.6, 6.4],
    yaw,
    color: [0.36, 0.38, 0.42],
    material: MATERIAL.STONE,
    occlusion: 0.96,
    variant: 0.1
  });
  offset = pushBox(vertices, offset, {
    center: [x + rightX * (side * 1.72), y + 3.5, z + rightZ * (side * 1.72)],
    size: [0.25, 5.2, 5.6],
    yaw,
    color: [0.38, 0.82, 0.98],
    material: MATERIAL.WATER,
    occlusion: 2.0,
    variant: 1.15
  });
  offset = pushBox(vertices, offset, {
    center: [x - rightX * (side * 1.6), y + 4.8, z - rightZ * (side * 1.6)],
    size: [1.35, 7.8, 1.35],
    yaw,
    color: [0.74, 0.70, 0.62],
    material: MATERIAL.STONE,
    occlusion: 1.0,
    variant: 0.1
  });
  return pushWaterSplashCrests(vertices, offset, x, y + 1.05, z, yaw, monument.primarySeed);
}

function plantParkTreeAndGrove(park) {
  const { y, side, segIndex, inBlockIdx, roadHalfWidth, primarySeed, secondarySeed } = park;
  const treeLateral = (roadHalfWidth + 10.5 + secondarySeed * 28.0) * side;
  const { x: treeX, z: treeZ } = planarPointAcrossRoad(park, treeLateral);
  const curbGapMeters = treeLateral * side - roadHalfWidth;
  const choice = chooseTreeFromSpecies(PARK_TREE_SPECIES, { pickSeed: seededRandom(segIndex * 3.7 + side * 0.9), heightSeed: primarySeed });
  plantStreetTree({
    x: treeX, y, z: treeZ,
    ...choice,
    maxCrownRadiusMeters: clamp(curbGapMeters - 2.0, 2.5, 7.0),
    seed: primarySeed
  });
  const isMonumentNeighbor = inBlockIdx >= PARK_MONUMENT_SLOT - 1 && inBlockIdx <= PARK_MONUMENT_SLOT + 1;
  if (inBlockIdx % 2 === 0 && !isMonumentNeighbor) {
    plantParkGroveTree(park, curbGapMeters);
  }
}

function plantParkGroveTree(park, firstTreeCurbGapMeters) {
  const { y, side, segIndex, roadHalfWidth, secondarySeed } = park;
  const groveSeed = seededRandom(segIndex * 13.3 + side * 41.0);
  const groveCurbGapMeters = firstTreeCurbGapMeters > 24.0 ? 11.0 + groveSeed * 5.0 : 30.0 + groveSeed * 9.0;
  const { x: groveX, z: groveZ } = planarPointAcrossRoad(park, (roadHalfWidth + groveCurbGapMeters) * side);
  const groveChoice = chooseTreeFromSpecies(PARK_TREE_SPECIES, { pickSeed: groveSeed, heightSeed: 1.0 - secondarySeed });
  plantStreetTree({
    x: groveX, y, z: groveZ,
    ...groveChoice,
    maxCrownRadiusMeters: clamp(groveCurbGapMeters - 2.0, 2.5, 7.0),
    seed: groveSeed
  });
}
