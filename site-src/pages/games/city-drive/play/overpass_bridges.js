// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const OVER_BRIDGE_STYLE = Object.freeze({
  stoneArch: 0,
  glassSkywalk: 1,
  steelTruss: 2,
  graniteBowArch: 3,
  elevatedRailViaduct: 4,
  triumphalGateway: 5,
  gatehouseTowers: 6
});

const OVER_BRIDGE_STYLE_WEIGHTS = Object.freeze([
  { style: OVER_BRIDGE_STYLE.stoneArch, weight: 3 },
  { style: OVER_BRIDGE_STYLE.graniteBowArch, weight: 3 },
  { style: OVER_BRIDGE_STYLE.elevatedRailViaduct, weight: 2 },
  { style: OVER_BRIDGE_STYLE.gatehouseTowers, weight: 2 },
  { style: OVER_BRIDGE_STYLE.triumphalGateway, weight: 1.5 },
  { style: OVER_BRIDGE_STYLE.glassSkywalk, weight: 1 },
  { style: OVER_BRIDGE_STYLE.steelTruss, weight: 1 }
]);

const OVER_BRIDGE_STYLE_NAMES = Object.freeze([
  "STONE ARCH OVERPASS",
  "GLASS SKYWALK",
  "STEEL TRUSS OVERPASS",
  "GRANITE BOW ARCH",
  "ELEVATED RAIL VIADUCT",
  "TRIUMPHAL GATEWAY",
  "GATEHOUSE BRIDGE"
]);

const BRIDGE_MASONRY_PALETTES = Object.freeze([
  { body: STONE_TONES.granite, trim: STONE_TONES.limestone, accent: STONE_TONES.darkGranite },
  { body: STONE_TONES.sandstone, trim: STONE_TONES.paleLimestone, accent: STONE_TONES.brownstone },
  { body: STONE_TONES.brownstone, trim: STONE_TONES.sandstone, accent: STONE_TONES.darkGranite },
  { body: STONE_TONES.limestone, trim: STONE_TONES.portland, accent: STONE_TONES.granite }
]);

const BRIDGE_LANTERN_GLOW = [1.0, 0.88, 0.60];
const BRIDGE_IRON = [0.16, 0.17, 0.19];
const STEPPED_ARCH_COURSE_COUNT = 5;
const GATEHOUSE_MERLONS_PER_SIDE = 4;
const RAIL_VIADUCT_CAR_COLORS = Object.freeze({ body: [0.62, 0.64, 0.66], windowGlow: [1.0, 0.92, 0.72], stripe: [0.70, 0.18, 0.16] });

const STONE_ARCH_BRIDGE_COLORS = Object.freeze({
  limestone: [0.74, 0.70, 0.62],
  darkGranite: [0.46, 0.45, 0.43],
  warmLamp: [1.0, 0.90, 0.64],
  lampPost: [0.20, 0.22, 0.24]
});

const GLASS_SKYWALK_BRIDGE_COLORS = Object.freeze({
  steel: [0.26, 0.30, 0.36],
  glassTint: [0.22, 0.42, 0.58],
  skyGlow: [0.78, 0.94, 1.0],
  undersideLight: [1.0, 0.95, 0.84]
});

const STEEL_TRUSS_BRIDGE_COLORS = Object.freeze({
  trussGreen: [0.20, 0.34, 0.30],
  girderDark: [0.18, 0.22, 0.24],
  beaconAmber: [1.0, 0.78, 0.32]
});

function pushOverBridge(vertices, offset, x, y, z, yaw, roadHalfWidth, bridgeStyle, seed) {
  const bridge = {
    x, y, z, yaw, roadHalfWidth, seed,
    rightX: Math.cos(yaw),
    rightZ: -Math.sin(yaw),
    totalSpan: (roadHalfWidth + 14.5) * 2.0,
    pierLateral: roadHalfWidth + 1.85
  };

  const builders = {
    [OVER_BRIDGE_STYLE.stoneArch]: pushStoneArchOverBridge,
    [OVER_BRIDGE_STYLE.glassSkywalk]: pushGlassSkywalkOverBridge,
    [OVER_BRIDGE_STYLE.steelTruss]: pushSteelTrussOverBridge,
    [OVER_BRIDGE_STYLE.graniteBowArch]: pushGraniteBowArchOverBridge,
    [OVER_BRIDGE_STYLE.elevatedRailViaduct]: pushElevatedRailViaduct,
    [OVER_BRIDGE_STYLE.triumphalGateway]: pushTriumphalGateway,
    [OVER_BRIDGE_STYLE.gatehouseTowers]: pushGatehouseTowerBridge
  };
  const build = builders[bridgeStyle] || pushStoneArchOverBridge;
  return build(vertices, offset, bridge);
}

function pickOverBridgeStyle(roll) {
  const totalWeight = OVER_BRIDGE_STYLE_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);
  let remaining = roll * totalWeight;
  for (const entry of OVER_BRIDGE_STYLE_WEIGHTS) {
    remaining -= entry.weight;
    if (remaining < 0) return entry.style;
  }
  return OVER_BRIDGE_STYLE_WEIGHTS[0].style;
}

function overBridgeStyleName(bridgeStyle) {
  return OVER_BRIDGE_STYLE_NAMES[bridgeStyle] || OVER_BRIDGE_STYLE_NAMES[OVER_BRIDGE_STYLE.stoneArch];
}

function pushSkyscraperPillar(vertices, offset, x, y, z, yaw, dropDepth) {
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  const pillarColor = [0.48, 0.49, 0.52];
  const girderColor = [0.28, 0.31, 0.36];
  const lightColor = [0.38, 0.88, 1.0];

  offset = pushBox(vertices, offset, {
    center: [x, y - 0.85, z],
    size: [13.8, 1.4, 2.8],
    yaw,
    color: girderColor,
    material: MATERIAL.METAL,
    occlusion: 0.88
  });

  for (let side = -1; side <= 1; side += 2) {
    const pillarX = x + rightX * (side * 4.6);
    const pillarZ = z + rightZ * (side * 4.6);
    const pillarHeight = dropDepth + 24.0;
    const pillarCenterY = y - pillarHeight * 0.5 - 1.0;
    offset = pushBox(vertices, offset, {
      center: [pillarX, pillarCenterY, pillarZ],
      size: [2.3, pillarHeight, 2.5],
      yaw,
      color: pillarColor,
      material: MATERIAL.STONE,
      occlusion: 0.94,
      variant: 0.1
    });
    offset = pushBox(vertices, offset, {
      center: [pillarX, pillarCenterY, pillarZ],
      size: [2.42, pillarHeight * 0.75, 0.32],
      yaw,
      color: lightColor,
      material: MATERIAL.GLOW,
      occlusion: 1.0
    });
  }
  return offset;
}

function pushManhattanRiverBridgeTower(vertices, offset, x, y, z, yaw, side) {
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  const towerLateral = side * 28.0;
  const towerX = x + rightX * towerLateral;
  const towerZ = z + rightZ * towerLateral;
  const graniteColor = [0.52, 0.51, 0.49];
  const steelColor = [0.32, 0.38, 0.44];
  const beaconColor = [1.0, 0.22, 0.18];

  for (let legSide = -1; legSide <= 1; legSide += 2) {
    const legX = towerX + rightX * (legSide * 4.2);
    const legZ = towerZ + rightZ * (legSide * 4.2);
    offset = pushBox(vertices, offset, {
      center: [legX, y + 8.0, legZ],
      size: [2.8, 36.0, 3.2],
      yaw,
      color: graniteColor,
      material: MATERIAL.STONE,
      occlusion: 0.95,
      variant: 0.15
    });
  }
  offset = pushBox(vertices, offset, {
    center: [towerX, y + 18.5, towerZ],
    size: [11.6, 2.6, 3.4],
    yaw,
    color: graniteColor,
    material: MATERIAL.STONE,
    occlusion: 0.96,
    variant: 0.1
  });
  offset = pushBox(vertices, offset, {
    center: [towerX, y + 25.0, towerZ],
    size: [12.2, 2.2, 3.6],
    yaw,
    color: graniteColor,
    material: MATERIAL.STONE,
    occlusion: 0.98,
    variant: 0.1
  });
  offset = pushBox(vertices, offset, {
    center: [towerX, y + 5.5, towerZ],
    size: [16.0, 1.4, 4.4],
    yaw,
    color: steelColor,
    material: MATERIAL.METAL,
    occlusion: 0.92
  });
  offset = pushBox(vertices, offset, {
    center: [towerX, y + 26.5, towerZ],
    size: [0.45, 0.45, 0.45],
    yaw,
    color: beaconColor,
    material: MATERIAL.GLOW,
    occlusion: 1.0
  });
  return offset;
}

function centerAcrossRoad(frame, lateral, height) {
  return [frame.x + frame.rightX * lateral, height, frame.z + frame.rightZ * lateral];
}

function planarPointAcrossRoad(frame, lateral) {
  return { x: frame.x + frame.rightX * lateral, z: frame.z + frame.rightZ * lateral };
}

function pushOverBridgeSpanBox(vertices, offset, bridge, spanBox) {
  return pushBox(vertices, offset, { ...spanBox, center: [bridge.x, spanBox.height, bridge.z], yaw: bridge.yaw });
}

function pushOverBridgePiers(vertices, offset, bridge, pierBox) {
  for (let side = -1; side <= 1; side += 2) {
    offset = pushBox(vertices, offset, { ...pierBox, center: centerAcrossRoad(bridge, side * bridge.pierLateral, pierBox.height), yaw: bridge.yaw });
  }
  return offset;
}

function pushStoneArchOverBridge(vertices, offset, bridge) {
  const deckY = bridge.y + 8.6;
  offset = pushStoneArchPiersAndHaunches(vertices, offset, bridge);
  offset = pushStoneArchDeck(vertices, offset, bridge, deckY);
  offset = pushStoneArchUndersideLamps(vertices, offset, bridge, deckY);
  return pushStoneArchDeckTreesAndLampPosts(vertices, offset, bridge, deckY);
}

function pushStoneArchPiersAndHaunches(vertices, offset, bridge) {
  const { y, yaw, pierLateral } = bridge;
  for (let side = -1; side <= 1; side += 2) {
    offset = pushBox(vertices, offset, {
      center: centerAcrossRoad(bridge, side * pierLateral, y + 2.2),
      size: [2.4, 13.2, 4.8],
      yaw,
      color: STONE_ARCH_BRIDGE_COLORS.darkGranite,
      material: MATERIAL.STONE,
      occlusion: 0.96,
      variant: 0.1
    });
    offset = pushBox(vertices, offset, {
      center: centerAcrossRoad(bridge, side * (pierLateral - 2.6), y + 7.2),
      size: [3.6, 1.6, 4.4],
      yaw,
      color: STONE_ARCH_BRIDGE_COLORS.limestone,
      material: MATERIAL.STONE,
      occlusion: 0.96,
      variant: 0.1
    });
  }
  return offset;
}

function pushStoneArchDeck(vertices, offset, bridge, deckY) {
  offset = pushOverBridgeSpanBox(vertices, offset, bridge, {
    height: deckY,
    size: [bridge.totalSpan, 1.35, 4.6],
    color: STONE_ARCH_BRIDGE_COLORS.limestone,
    material: MATERIAL.STONE,
    occlusion: 0.98,
    variant: 0.1
  });
  return pushOverBridgeSpanBox(vertices, offset, bridge, {
    height: deckY + 1.05,
    size: [bridge.totalSpan, 0.85, 4.9],
    color: STONE_ARCH_BRIDGE_COLORS.darkGranite,
    material: MATERIAL.STONE,
    occlusion: 1.0,
    variant: 0.1
  });
}

function pushStoneArchUndersideLamps(vertices, offset, bridge, deckY) {
  for (let lampIndex = -1; lampIndex <= 1; lampIndex++) {
    offset = pushBox(vertices, offset, {
      center: centerAcrossRoad(bridge, lampIndex * 4.2, deckY - 0.72),
      size: [1.6, 0.18, 0.85],
      yaw: bridge.yaw,
      color: STONE_ARCH_BRIDGE_COLORS.warmLamp,
      material: MATERIAL.GLOW,
      occlusion: 1.0
    });
  }
  return offset;
}

function pushStoneArchDeckTreesAndLampPosts(vertices, offset, bridge, deckY) {
  const { yaw, seed } = bridge;
  for (let side = -1; side <= 1; side += 2) {
    const { x: treeX, z: treeZ } = planarPointAcrossRoad(bridge, side * 3.8);
    plantStreetTree({ x: treeX, y: deckY + 0.4, z: treeZ, speciesName: side < 0 ? "yoshinoCherry" : "kwanzanCherry", heightMeters: 4.6, maxCrownRadiusMeters: 1.7, seed });
    const lampPostLateral = side * 7.2;
    offset = pushBox(vertices, offset, {
      center: centerAcrossRoad(bridge, lampPostLateral, deckY + 2.6),
      size: [0.16, 2.4, 0.16],
      yaw,
      color: STONE_ARCH_BRIDGE_COLORS.lampPost,
      material: MATERIAL.METAL,
      occlusion: 0.9
    });
    offset = pushBox(vertices, offset, {
      center: centerAcrossRoad(bridge, lampPostLateral, deckY + 3.9),
      size: [0.36, 0.38, 0.36],
      yaw,
      color: STONE_ARCH_BRIDGE_COLORS.warmLamp,
      material: MATERIAL.GLOW,
      occlusion: 1.0
    });
  }
  return offset;
}

function pushGlassSkywalkOverBridge(vertices, offset, bridge) {
  const deckY = bridge.y + 10.2;
  offset = pushOverBridgePiers(vertices, offset, bridge, {
    height: bridge.y + 3.8,
    size: [1.4, 13.8, 3.2],
    color: GLASS_SKYWALK_BRIDGE_COLORS.steel,
    material: MATERIAL.METAL,
    occlusion: 0.95
  });
  return pushGlassSkywalkTube(vertices, offset, bridge, deckY);
}

function pushGlassSkywalkTube(vertices, offset, bridge, deckY) {
  const { totalSpan } = bridge;
  const colors = GLASS_SKYWALK_BRIDGE_COLORS;
  offset = pushOverBridgeSpanBox(vertices, offset, bridge, {
    height: deckY - 1.4,
    size: [totalSpan, 0.65, 4.2],
    color: colors.steel,
    material: MATERIAL.METAL,
    occlusion: 0.98
  });
  offset = pushOverBridgeSpanBox(vertices, offset, bridge, {
    height: deckY + 1.5,
    size: [totalSpan, 0.55, 4.4],
    color: colors.steel,
    material: MATERIAL.METAL,
    occlusion: 1.0
  });
  offset = pushOverBridgeSpanBox(vertices, offset, bridge, {
    height: deckY,
    size: [totalSpan - 1.0, 2.35, 3.6],
    color: colors.glassTint,
    material: MATERIAL.METAL,
    occlusion: 0.95
  });
  offset = pushOverBridgeSpanBox(vertices, offset, bridge, {
    height: deckY + 0.85,
    size: [totalSpan - 2.0, 0.32, 3.72],
    color: colors.skyGlow,
    material: MATERIAL.GLOW,
    occlusion: 1.0
  });
  return pushOverBridgeSpanBox(vertices, offset, bridge, {
    height: deckY - 1.75,
    size: [bridge.roadHalfWidth * 1.7, 0.16, 1.2],
    color: colors.undersideLight,
    material: MATERIAL.GLOW,
    occlusion: 1.0
  });
}

function pushSteelTrussOverBridge(vertices, offset, bridge) {
  const deckY = bridge.y + 9.2;
  offset = pushOverBridgePiers(vertices, offset, bridge, {
    height: bridge.y + 3.2,
    size: [1.85, 14.2, 4.2],
    color: STEEL_TRUSS_BRIDGE_COLORS.girderDark,
    material: MATERIAL.METAL,
    occlusion: 0.92
  });
  offset = pushSteelTrussChordsAndVerticals(vertices, offset, bridge, deckY);
  return pushOverBridgeSpanBox(vertices, offset, bridge, {
    height: deckY - 1.32,
    size: [bridge.roadHalfWidth * 1.8, 0.20, 0.95],
    color: STEEL_TRUSS_BRIDGE_COLORS.beaconAmber,
    material: MATERIAL.GLOW,
    occlusion: 1.0
  });
}

function pushSteelTrussChordsAndVerticals(vertices, offset, bridge, deckY) {
  const trussGreen = STEEL_TRUSS_BRIDGE_COLORS.trussGreen;
  offset = pushOverBridgeSpanBox(vertices, offset, bridge, {
    height: deckY - 0.8,
    size: [bridge.totalSpan, 0.95, 4.8],
    color: trussGreen,
    material: MATERIAL.METAL,
    occlusion: 0.95
  });
  offset = pushOverBridgeSpanBox(vertices, offset, bridge, {
    height: deckY + 2.2,
    size: [bridge.totalSpan, 0.75, 4.8],
    color: trussGreen,
    material: MATERIAL.METAL,
    occlusion: 1.0
  });
  for (let trussIndex = -3; trussIndex <= 3; trussIndex++) {
    offset = pushBox(vertices, offset, {
      center: centerAcrossRoad(bridge, trussIndex * 4.2, deckY + 0.7),
      size: [0.55, 2.4, 4.85],
      yaw: bridge.yaw,
      color: trussGreen,
      material: MATERIAL.METAL,
      occlusion: 0.95
    });
  }
  return offset;
}

function bridgeMasonryPalette(seed) {
  return BRIDGE_MASONRY_PALETTES[Math.floor(seed * BRIDGE_MASONRY_PALETTES.length) % BRIDGE_MASONRY_PALETTES.length];
}

function pointOnBridge(bridge, { lateral = 0, along = 0, height }) {
  const forwardX = -bridge.rightZ, forwardZ = bridge.rightX;
  return [bridge.x + bridge.rightX * lateral + forwardX * along, height, bridge.z + bridge.rightZ * lateral + forwardZ * along];
}

function pushBridgeBlock(vertices, offset, bridge, { lateral = 0, along = 0, bottom, top, across, depth, color, material = MATERIAL.STONE, variant = 0.1, occlusion = 0.96 }) {
  return pushBox(vertices, offset, {
    center: pointOnBridge(bridge, { lateral, along, height: bridge.y + (bottom + top) * 0.5 }),
    size: [across, top - bottom, depth],
    yaw: bridge.yaw,
    color, material, variant, occlusion
  });
}

function pushBridgeLantern(vertices, offset, bridge, { lateral, along = 0, base, postHeight }) {
  offset = pushBridgeBlock(vertices, offset, bridge, { lateral, along, bottom: base, top: base + postHeight, across: 0.18, depth: 0.18, color: BRIDGE_IRON, material: MATERIAL.METAL, occlusion: 0.9 });
  return pushBridgeBlock(vertices, offset, bridge, { lateral, along, bottom: base + postHeight, top: base + postHeight + 0.5, across: 0.42, depth: 0.42, color: BRIDGE_LANTERN_GLOW, material: MATERIAL.GLOW, occlusion: 1.0 });
}

function pushSteppedArch(vertices, offset, bridge, { halfOpening, springHeight, crownHeight, soffitHeight, depth, color }) {
  const rise = crownHeight - springHeight;
  for (let course = 0; course < STEPPED_ARCH_COURSE_COUNT; course++) {
    const isCrownCourse = course === STEPPED_ARCH_COURSE_COUNT - 1;
    const courseBottom = springHeight + rise * course / STEPPED_ARCH_COURSE_COUNT;
    const courseTop = isCrownCourse ? soffitHeight : springHeight + rise * (course + 1) / STEPPED_ARCH_COURSE_COUNT;
    const heightFraction = (course + 1) / STEPPED_ARCH_COURSE_COUNT;
    const innerReach = isCrownCourse ? 0 : halfOpening * Math.sqrt(1 - heightFraction * heightFraction);
    for (const side of [-1, 1]) {
      offset = pushBridgeBlock(vertices, offset, bridge, {
        lateral: side * (innerReach + halfOpening) * 0.5,
        bottom: courseBottom, top: courseTop,
        across: halfOpening - innerReach, depth,
        color, occlusion: 0.94 + course * 0.01
      });
    }
  }
  return offset;
}

function pushParapetWalls(vertices, offset, bridge, { span, deckTop, height, depth, thickness, color }) {
  for (const face of [-1, 1]) {
    offset = pushBridgeBlock(vertices, offset, bridge, { along: face * (depth - thickness) * 0.5, bottom: deckTop, top: deckTop + height, across: span, depth: thickness, color, occlusion: 1.0 });
  }
  return offset;
}

function pushGraniteBowArchOverBridge(vertices, offset, bridge) {
  const palette = bridgeMasonryPalette(bridge.seed);
  const { roadHalfWidth, pierLateral, totalSpan } = bridge;
  const deckBottom = 8.7;
  const deckTop = 10.1;
  const depth = 4.8;
  for (const side of [-1, 1]) {
    offset = pushBridgeBlock(vertices, offset, bridge, { lateral: side * pierLateral, bottom: -4.4, top: 0.9, across: 3.6, depth: depth + 1.0, color: palette.accent });
    offset = pushBridgeBlock(vertices, offset, bridge, { lateral: side * pierLateral, bottom: 0.9, top: deckBottom, across: 3.0, depth: depth + 0.4, color: palette.body });
  }
  offset = pushSteppedArch(vertices, offset, bridge, { halfOpening: roadHalfWidth + 0.35, springHeight: 5.2, crownHeight: 8.0, soffitHeight: deckBottom, depth: depth - 0.2, color: palette.trim });
  offset = pushBridgeBlock(vertices, offset, bridge, { bottom: deckBottom, top: deckTop, across: totalSpan, depth, color: palette.body, occlusion: 0.98 });
  offset = pushBridgeBlock(vertices, offset, bridge, { bottom: deckBottom - 0.2, top: deckBottom + 1.6, across: 1.3, depth: depth + 0.5, color: palette.trim, occlusion: 1.0 });
  offset = pushBridgeBlock(vertices, offset, bridge, { bottom: deckTop - 0.36, top: deckTop - 0.02, across: totalSpan + 0.4, depth: depth + 0.4, color: palette.accent, occlusion: 1.0 });
  offset = pushParapetWalls(vertices, offset, bridge, { span: totalSpan, deckTop, height: 1.1, depth, thickness: 0.4, color: palette.body });
  for (const side of [-1, 1]) {
    for (const face of [-1, 1]) {
      offset = pushBridgeLantern(vertices, offset, bridge, { lateral: side * pierLateral, along: face * (depth * 0.5 - 0.2), base: deckTop + 1.1, postHeight: 1.0 });
    }
  }
  return offset;
}

function pushElevatedRailViaduct(vertices, offset, bridge) {
  const palette = bridgeMasonryPalette(bridge.seed + 0.37);
  const { roadHalfWidth, pierLateral, totalSpan, seed } = bridge;
  const depth = 8.2;
  const deckBottom = 7.8;
  const deckTop = 9.8;
  const pierCenter = pierLateral + 0.3;
  for (const side of [-1, 1]) {
    offset = pushBridgeBlock(vertices, offset, bridge, { lateral: side * pierCenter, bottom: -4.0, top: 2.2, across: 4.2, depth: depth + 0.8, color: palette.accent });
    offset = pushBridgeBlock(vertices, offset, bridge, { lateral: side * pierCenter, bottom: 2.2, top: deckBottom - 0.6, across: 3.4, depth: depth + 0.2, color: palette.body });
    offset = pushBridgeBlock(vertices, offset, bridge, { lateral: side * pierCenter, bottom: deckBottom - 0.6, top: deckBottom, across: 4.2, depth: depth + 0.8, color: palette.trim });
  }
  offset = pushBridgeBlock(vertices, offset, bridge, { bottom: deckBottom, top: deckTop, across: totalSpan, depth, color: palette.body, occlusion: 0.98 });
  for (const face of [-1, 1]) {
    offset = pushBridgeBlock(vertices, offset, bridge, { along: face * (depth * 0.5 + 0.1), bottom: deckBottom + 0.3, top: deckBottom + 0.9, across: totalSpan, depth: 0.2, color: palette.trim, occlusion: 1.0 });
  }
  for (const lightLateral of [-0.5, 0, 0.5]) {
    offset = pushBridgeBlock(vertices, offset, bridge, { lateral: lightLateral * roadHalfWidth, bottom: deckBottom - 0.16, top: deckBottom, across: 0.9, depth: depth - 2.0, color: BRIDGE_LANTERN_GLOW, material: MATERIAL.GLOW, occlusion: 1.0 });
  }
  offset = pushParapetWalls(vertices, offset, bridge, { span: totalSpan, deckTop, height: 1.0, depth, thickness: 0.35, color: palette.accent });
  for (const railAlong of [-1.5, -0.7, 0.7, 1.5]) {
    offset = pushBridgeBlock(vertices, offset, bridge, { along: railAlong, bottom: deckTop, top: deckTop + 0.16, across: totalSpan, depth: 0.12, color: BRIDGE_IRON, material: MATERIAL.METAL, occlusion: 0.95 });
  }
  return pushViaductTrain(vertices, offset, bridge, { deckTop, seed });
}

function pushViaductTrain(vertices, offset, bridge, { deckTop, seed }) {
  const carLength = 11.0;
  const carGap = 0.6;
  const carCount = seed > 0.5 ? 2 : 1;
  const trainAlong = seed > 0.25 ? 1.1 : -1.1;
  const firstCarLateral = (seed - 0.5) * bridge.roadHalfWidth - (carCount - 1) * (carLength + carGap) * 0.5;
  for (let car = 0; car < carCount; car++) {
    const lateral = firstCarLateral + car * (carLength + carGap);
    offset = pushBridgeBlock(vertices, offset, bridge, { lateral, along: trainAlong, bottom: deckTop + 0.3, top: deckTop + 3.3, across: carLength, depth: 2.8, color: RAIL_VIADUCT_CAR_COLORS.body, material: MATERIAL.METAL, occlusion: 0.95 });
    offset = pushBridgeBlock(vertices, offset, bridge, { lateral, along: trainAlong, bottom: deckTop + 1.6, top: deckTop + 2.5, across: carLength - 1.2, depth: 2.9, color: RAIL_VIADUCT_CAR_COLORS.windowGlow, material: MATERIAL.GLOW, occlusion: 1.0 });
    offset = pushBridgeBlock(vertices, offset, bridge, { lateral, along: trainAlong, bottom: deckTop + 0.9, top: deckTop + 1.2, across: carLength + 0.02, depth: 2.86, color: RAIL_VIADUCT_CAR_COLORS.stripe, material: MATERIAL.METAL, occlusion: 1.0 });
  }
  return offset;
}

function pushTriumphalGateway(vertices, offset, bridge) {
  const palette = bridgeMasonryPalette(bridge.seed + 0.71);
  const { roadHalfWidth } = bridge;
  const depth = 6.0;
  const pierWidth = 4.2;
  const pierCenter = roadHalfWidth + 2.3;
  const outerHalfWidth = pierCenter + pierWidth * 0.5;
  const entablatureBottom = 11.6;
  const entablatureTop = 13.2;
  const atticTop = 16.4;
  for (const side of [-1, 1]) {
    offset = pushTriumphalPier(vertices, offset, bridge, { lateral: side * pierCenter, pierWidth, depth, top: entablatureBottom, palette });
    offset = pushBridgeLantern(vertices, offset, bridge, { lateral: side * pierCenter, along: -(depth * 0.5 + 0.8), base: 0, postHeight: 3.2 });
  }
  offset = pushSteppedArch(vertices, offset, bridge, { halfOpening: pierCenter - pierWidth * 0.5, springHeight: 7.2, crownHeight: 10.8, soffitHeight: entablatureBottom, depth: depth - 0.4, color: palette.trim });
  offset = pushBridgeBlock(vertices, offset, bridge, { bottom: entablatureBottom, top: entablatureTop, across: outerHalfWidth * 2 + 0.6, depth: depth + 0.4, color: palette.trim, occlusion: 0.98 });
  offset = pushBridgeBlock(vertices, offset, bridge, { bottom: entablatureBottom + 0.45, top: entablatureBottom + 1.05, across: roadHalfWidth * 1.6, depth: depth + 0.5, color: BRIDGE_LANTERN_GLOW, material: MATERIAL.GLOW, occlusion: 1.0 });
  offset = pushBridgeBlock(vertices, offset, bridge, { bottom: entablatureTop, top: atticTop, across: outerHalfWidth * 2 - 0.6, depth: depth - 0.4, color: palette.body, occlusion: 1.0 });
  offset = pushBridgeBlock(vertices, offset, bridge, { bottom: atticTop, top: atticTop + 0.6, across: outerHalfWidth * 2 + 1.0, depth: depth + 0.8, color: palette.trim, occlusion: 1.0 });
  return pushBridgeBlock(vertices, offset, bridge, { bottom: atticTop + 0.6, top: atticTop + 2.8, across: 5.0, depth: 2.2, color: STONE_TONES.copper, material: MATERIAL.METAL, occlusion: 0.95 });
}

function pushTriumphalPier(vertices, offset, bridge, { lateral, pierWidth, depth, top, palette }) {
  offset = pushBridgeBlock(vertices, offset, bridge, { lateral, bottom: -3.0, top: 1.4, across: pierWidth + 0.6, depth: depth + 0.6, color: palette.accent });
  offset = pushBridgeBlock(vertices, offset, bridge, { lateral, bottom: 1.4, top, across: pierWidth, depth, color: palette.body });
  for (const face of [-1, 1]) {
    for (const pilasterOffset of [-1.4, 1.4]) {
      offset = pushBridgeBlock(vertices, offset, bridge, { lateral: lateral + pilasterOffset, along: face * (depth * 0.5 + 0.15), bottom: 1.4, top, across: 0.7, depth: 0.3, color: palette.trim, occlusion: 1.0 });
    }
  }
  return offset;
}

function pushGatehouseTowerBridge(vertices, offset, bridge) {
  const palette = bridgeMasonryPalette(bridge.seed + 0.13);
  const { roadHalfWidth } = bridge;
  const towerWidth = 4.4;
  const towerDepth = 5.6;
  const towerTop = 19.0;
  const towerCenter = roadHalfWidth + 2.6;
  const innerFace = towerCenter - towerWidth * 0.5;
  const deckBottom = 8.0;
  const deckTop = 9.4;
  const deckDepth = 4.4;
  const roofColor = bridge.seed > 0.5 ? STONE_TONES.copper : STONE_TONES.slate;
  for (const side of [-1, 1]) {
    offset = pushGatehouseTower(vertices, offset, bridge, { lateral: side * towerCenter, towerWidth, towerDepth, towerTop, palette, roofColor });
  }
  offset = pushSteppedArch(vertices, offset, bridge, { halfOpening: innerFace, springHeight: 5.4, crownHeight: 7.6, soffitHeight: deckBottom, depth: deckDepth - 0.2, color: palette.trim });
  offset = pushBridgeBlock(vertices, offset, bridge, { bottom: deckBottom, top: deckTop, across: innerFace * 2, depth: deckDepth, color: palette.body, occlusion: 0.98 });
  offset = pushParapetWalls(vertices, offset, bridge, { span: innerFace * 2, deckTop, height: 0.8, depth: deckDepth, thickness: 0.4, color: palette.body });
  offset = pushGatehouseMerlons(vertices, offset, bridge, { innerFace, deckTop, deckDepth, color: palette.trim });
  return pushBridgeBlock(vertices, offset, bridge, { bottom: deckBottom - 1.0, top: deckBottom - 0.3, across: 0.5, depth: 0.5, color: BRIDGE_LANTERN_GLOW, material: MATERIAL.GLOW, occlusion: 1.0 });
}

function pushGatehouseMerlons(vertices, offset, bridge, { innerFace, deckTop, deckDepth, color }) {
  for (const face of [-1, 1]) {
    for (let merlon = 0; merlon < GATEHOUSE_MERLONS_PER_SIDE; merlon++) {
      const lateral = ((merlon + 0.5) / GATEHOUSE_MERLONS_PER_SIDE - 0.5) * innerFace * 1.6;
      offset = pushBridgeBlock(vertices, offset, bridge, { lateral, along: face * (deckDepth - 0.4) * 0.5, bottom: deckTop + 0.8, top: deckTop + 1.4, across: 0.9, depth: 0.4, color, occlusion: 1.0 });
    }
  }
  return offset;
}

function pushGatehouseTower(vertices, offset, bridge, { lateral, towerWidth, towerDepth, towerTop, palette, roofColor }) {
  offset = pushBridgeBlock(vertices, offset, bridge, { lateral, bottom: -4.0, top: 1.6, across: towerWidth + 0.5, depth: towerDepth + 0.5, color: palette.accent });
  offset = pushBridgeBlock(vertices, offset, bridge, { lateral, bottom: 1.6, top: towerTop, across: towerWidth, depth: towerDepth, color: palette.body });
  offset = pushBridgeBlock(vertices, offset, bridge, { lateral, bottom: towerTop, top: towerTop + 0.7, across: towerWidth + 0.6, depth: towerDepth + 0.6, color: palette.trim, occlusion: 1.0 });
  for (const face of [-1, 1]) {
    for (const slitBottom of [11.0, 14.6]) {
      offset = pushBridgeBlock(vertices, offset, bridge, { lateral, along: face * (towerDepth * 0.5 + 0.04), bottom: slitBottom, top: slitBottom + 2.4, across: 0.9, depth: 0.1, color: BRIDGE_LANTERN_GLOW, material: MATERIAL.GLOW, occlusion: 1.0 });
    }
  }
  const roofBase = pointOnBridge(bridge, { lateral, height: bridge.y + towerTop + 0.7 });
  return pushFlatConcreteRoof(vertices, offset, { x: roofBase[0], y: roofBase[1], z: roofBase[2], halfAcross: (towerWidth + 0.6) * 0.5, halfAlong: (towerDepth + 0.6) * 0.5, yaw: bridge.yaw, color: roofColor });
}
