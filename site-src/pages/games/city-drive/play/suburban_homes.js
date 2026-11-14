// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const SUBURBAN_LOT_LENGTH_METERS = 16.6;
const SUBURBAN_YARD_FRONT_LATERAL = 8.4;
const SUBURBAN_YARD_BACK_LATERAL = 34.0;
const SUBURBAN_FRONT_WALK_SETBACK_METERS = 0.7;
const SUBURBAN_PODIUM_FRONT_LATERAL = 15.4;
const SUBURBAN_PODIUM_HEIGHT_METERS = 1.15;
const SUBURBAN_TERRACE_DEPTH_METERS = 2.6;
const SUBURBAN_COPING_OVERHANG_METERS = 0.12;
const SUBURBAN_COPING_THICKNESS_METERS = 0.1;
const SUBURBAN_STEP_COUNT = 5;
const SUBURBAN_STEP_TREAD_METERS = 0.34;
const SUBURBAN_STEP_WIDTH_METERS = 2.6;
const SUBURBAN_STOREY_HEIGHT_METERS = 3.1;
const SUBURBAN_CROSS_STREET_CLEARANCE_METERS = 0.8;
const SUBURBAN_SIDE_MARGIN_METERS = 1.2;
const SUBURBAN_GARAGE = Object.freeze({ widthMeters: 4.0, depthMeters: 6.4, heightMeters: 3.0, gapMeters: 0.4, doorWidthMeters: 3.0, doorHeightMeters: 2.3 });

const SUBURBAN_TONES = Object.freeze({
  whitePanel: [0.93, 0.93, 0.91],
  marble: [0.92, 0.91, 0.88],
  podiumStone: [0.55, 0.54, 0.51],
  flatRoof: [0.76, 0.75, 0.72],
  glass: [0.34, 0.42, 0.50],
  garageDoor: [0.80, 0.80, 0.79],
  walkStone: [0.78, 0.76, 0.71],
  frontDoor: [0.30, 0.21, 0.15]
});

const CLADDING_STONE_TONES = Object.freeze([
  [0.72, 0.67, 0.58],
  [0.62, 0.61, 0.58],
  [0.68, 0.62, 0.53]
]);

const STONE_CLADDING_VARIANT = 0.1;

const YARD_TREE_SPECIES = Object.freeze(["sugarMaple", "redMaple", "pinOak", "floweringDogwood", "whiteBirch", "blueSpruce", "crabapple", "sweetgum"]);

const HOME_STYLES = Object.freeze([
  { id: "flatRoofVilla", width: 10.4, depth: 9.0, entranceFraction: 0.22, build: pushFlatRoofVilla },
  { id: "flatPavilion", width: 11.0, depth: 9.0, entranceFraction: 0, build: pushFlatRoofPavilion },
  { id: "twoStoreyFlat", width: 9.6, depth: 8.6, entranceFraction: 0, build: pushTwoStoreyFlatHouse }
]);

const COMPACT_HOME_STYLE = Object.freeze({ id: "compactPavilion", width: 7.6, depth: 8.0, entranceFraction: 0, build: pushFlatRoofPavilion });

function pushSuburbanHome(offset, lot, place) {
  const homeSeed = seededRandom(lot.segIndex * 3.71 + lot.side * 9.1);
  const span = suburbanLotSpan(lot, place);
  const plan = planSuburbanHome(lot, span, homeSeed);

  offset = pushYardLawn(offset, lot, span);
  offset = pushHomePodium(offset, lot, plan);
  offset = plan.style.build(offset, lot, plan);
  offset = pushEntranceSteps(offset, lot, plan);
  if (plan.garage) offset = pushGarage(offset, lot, plan);
  offset = pushFrontWalkAndDriveway(offset, lot, plan);
  plantYardTrees(lot, plan, span);
  return offset;
}

function suburbanLotSpan(lot, place) {
  const halfLength = SUBURBAN_LOT_LENGTH_METERS * 0.5;
  const blockStartAlong = (INTERSECTION_LAST_SEGMENT_INDEX + 1 - lot.inBlockIdx) * SEG_LENGTH + SUBURBAN_CROSS_STREET_CLEARANCE_METERS;
  const blockEndAlong = (MANHATTAN_BLOCK_PERIOD - lot.inBlockIdx) * SEG_LENGTH - SUBURBAN_CROSS_STREET_CLEARANCE_METERS;
  return {
    start: Math.max(place.along - halfLength, blockStartAlong),
    end: Math.min(place.along + halfLength, blockEndAlong)
  };
}

function planSuburbanHome(lot, span, homeSeed) {
  const usableLength = span.end - span.start - SUBURBAN_SIDE_MARGIN_METERS * 2;
  const roomyStyle = HOME_STYLES[Math.floor(homeSeed * HOME_STYLES.length) % HOME_STYLES.length];
  const garageLength = SUBURBAN_GARAGE.widthMeters + SUBURBAN_GARAGE.gapMeters;
  const fitsWithGarage = roomyStyle.width + garageLength <= usableLength;
  const style = fitsWithGarage || roomyStyle.width <= usableLength ? roomyStyle : COMPACT_HOME_STYLE;
  const garageEnd = lot.secondarySeed > 0.5 ? 1 : -1;
  const compositionCenter = (span.start + span.end) * 0.5;
  const houseAlong = fitsWithGarage ? compositionCenter - garageEnd * garageLength * 0.5 : compositionCenter;
  const podiumFront = lotFrontLateral(lot, SUBURBAN_PODIUM_FRONT_LATERAL);
  return {
    style,
    along: houseAlong,
    podiumFront,
    wallFront: podiumFront + SUBURBAN_TERRACE_DEPTH_METERS,
    entranceAlong: houseAlong - garageEnd * style.entranceFraction * style.width,
    garageEnd,
    claddingStone: CLADDING_STONE_TONES[Math.floor(homeSeed * 71) % CLADDING_STONE_TONES.length],
    garage: fitsWithGarage ? { along: houseAlong + garageEnd * (style.width * 0.5 + garageLength * 0.5) } : null
  };
}

function pushYardLawn(offset, lot, span) {
  const yardFront = lotFrontLateral(lot, SUBURBAN_YARD_FRONT_LATERAL);
  const yardBack = lotFrontLateral(lot, SUBURBAN_YARD_BACK_LATERAL);
  return pushLawn(offset, lot, { lateral: (yardFront + yardBack) * 0.5, along: (span.start + span.end) * 0.5, across: yardBack - yardFront, length: span.end - span.start });
}

function pushHomePodium(offset, lot, { style, along, podiumFront, wallFront }) {
  const podiumDepth = wallFront + style.depth - podiumFront + 0.6;
  const podiumLength = style.width + 0.8;
  offset = pushLotMass(offset, lot, { front: podiumFront, depth: podiumDepth, along, length: podiumLength, bottom: -0.6, top: SUBURBAN_PODIUM_HEIGHT_METERS, color: SUBURBAN_TONES.podiumStone, material: MATERIAL.ASHLAR, variant: 0.2 });
  const overhang = SUBURBAN_COPING_OVERHANG_METERS;
  return pushLotMass(offset, lot, { front: podiumFront - overhang, depth: podiumDepth + overhang * 2, along, length: podiumLength + overhang * 2, bottom: SUBURBAN_PODIUM_HEIGHT_METERS, top: SUBURBAN_PODIUM_HEIGHT_METERS + SUBURBAN_COPING_THICKNESS_METERS, color: SUBURBAN_TONES.marble, material: MATERIAL.MARBLE, variant: 0.1, occlusion: 1.0 });
}

function houseFloorLevel() {
  return SUBURBAN_PODIUM_HEIGHT_METERS + SUBURBAN_COPING_THICKNESS_METERS;
}

function pushFlatRoofVilla(offset, lot, plan) {
  const { style, along, wallFront, claddingStone, garageEnd } = plan;
  const floor = houseFloorLevel();
  const groundTop = floor + SUBURBAN_STOREY_HEIGHT_METERS;
  const upperTop = groundTop + SUBURBAN_STOREY_HEIGHT_METERS;
  const cantilever = 1.2;
  const upperShift = -garageEnd * 0.8;
  offset = pushLotMass(offset, lot, { front: wallFront, depth: style.depth, along, length: style.width, bottom: floor, top: groundTop, color: claddingStone, material: MATERIAL.STONE, variant: STONE_CLADDING_VARIANT });
  offset = pushLotMass(offset, lot, { front: wallFront - cantilever, depth: style.depth + cantilever, along: along + upperShift, length: style.width - 1.6, bottom: groundTop, top: upperTop, color: SUBURBAN_TONES.whitePanel, material: MATERIAL.PLASTER, variant: PLASTER_PANEL_VARIANT });
  offset = pushMarbleParapet(offset, lot, { front: wallFront - cantilever, depth: style.depth + cantilever, along: along + upperShift, length: style.width - 1.6, top: upperTop });
  offset = pushGlassPane(offset, lot, { face: wallFront, along: plan.entranceAlong + garageEnd * 2.6, bottom: floor + 0.25, height: 2.5, length: 3.4 });
  offset = pushGlassPane(offset, lot, { face: wallFront - cantilever, along: along + upperShift, bottom: groundTop + 0.7, height: 1.6, length: style.width - 3.2 });
  return pushFrontDoor(offset, lot, { face: wallFront, along: plan.entranceAlong, bottom: floor });
}

function pushFlatRoofPavilion(offset, lot, plan) {
  const { style, along, wallFront, claddingStone, garageEnd } = plan;
  const floor = houseFloorLevel();
  const wallTop = floor + SUBURBAN_STOREY_HEIGHT_METERS + 0.3;
  const featureWallEnd = -garageEnd;
  const featureWallLength = 2.4;
  offset = pushLotMass(offset, lot, { front: wallFront, depth: style.depth, along, length: style.width, bottom: floor, top: wallTop, color: SUBURBAN_TONES.whitePanel, material: MATERIAL.PLASTER, variant: PLASTER_PANEL_VARIANT });
  offset = pushLotMass(offset, lot, { front: wallFront - 0.2, depth: style.depth + 0.4, along: along + featureWallEnd * (style.width - featureWallLength) * 0.5, length: featureWallLength + 0.2, bottom: floor, top: wallTop + 0.1, color: claddingStone, material: MATERIAL.STONE, variant: STONE_CLADDING_VARIANT });
  offset = pushMarbleParapet(offset, lot, { front: wallFront, depth: style.depth, along, length: style.width, top: wallTop });
  offset = pushGlassPane(offset, lot, { face: wallFront, along: along - featureWallEnd * 2.6, bottom: floor + 0.25, height: 2.6, length: Math.min(3.4, style.width - featureWallLength - 3.4) });
  return pushFrontDoor(offset, lot, { face: wallFront, along: plan.entranceAlong, bottom: floor });
}

function pushTwoStoreyFlatHouse(offset, lot, plan) {
  const { style, along, wallFront, claddingStone } = plan;
  const floor = houseFloorLevel();
  const beltHeight = floor + SUBURBAN_STOREY_HEIGHT_METERS;
  const wallTop = beltHeight + SUBURBAN_STOREY_HEIGHT_METERS;
  offset = pushLotMass(offset, lot, { front: wallFront, depth: style.depth, along, length: style.width, bottom: floor, top: wallTop, color: SUBURBAN_TONES.whitePanel, material: MATERIAL.PLASTER, variant: PLASTER_PANEL_VARIANT });
  offset = pushLotMass(offset, lot, { front: wallFront - 0.08, depth: style.depth + 0.16, along, length: style.width + 0.16, bottom: floor, top: floor + 1.0, color: claddingStone, material: MATERIAL.STONE, variant: STONE_CLADDING_VARIANT });
  offset = pushLotMass(offset, lot, { front: wallFront - 0.14, depth: style.depth + 0.28, along, length: style.width + 0.28, bottom: beltHeight - 0.12, top: beltHeight + 0.12, color: SUBURBAN_TONES.marble, material: MATERIAL.MARBLE, variant: 0.1, occlusion: 1.0 });
  offset = pushMarbleParapet(offset, lot, { front: wallFront, depth: style.depth, along, length: style.width, top: wallTop });
  for (const end of [-1, 1]) {
    const windowAlong = along + end * style.width * 0.27;
    offset = pushGlassPane(offset, lot, { face: wallFront, along: windowAlong, bottom: beltHeight + 0.7, height: 1.7, length: 2.2 });
    if (Math.abs(windowAlong - plan.entranceAlong) > 2.0) offset = pushGlassPane(offset, lot, { face: wallFront, along: windowAlong, bottom: floor + 1.0, height: 1.7, length: 2.2 });
  }
  offset = pushEntranceCanopy(offset, lot, { face: wallFront, along: plan.entranceAlong, floor });
  return pushFrontDoor(offset, lot, { face: wallFront, along: plan.entranceAlong, bottom: floor });
}

function pushMarbleParapet(offset, lot, { front, depth, along, length, top }) {
  const overhang = SUBURBAN_COPING_OVERHANG_METERS;
  offset = pushLotMass(offset, lot, { front: front - overhang, depth: depth + overhang * 2, along, length: length + overhang * 2, bottom: top, top: top + 0.3, color: SUBURBAN_TONES.marble, material: MATERIAL.MARBLE, variant: 0.1, occlusion: 1.0 });
  return pushLotMass(offset, lot, { front: front + 0.25, depth: depth - 0.5, along, length: length - 0.5, bottom: top, top: top + 0.32, color: SUBURBAN_TONES.flatRoof, material: MATERIAL.PLASTER, variant: 0.1, occlusion: 1.0 });
}

function pushGlassPane(offset, lot, { face, along, bottom, height, length }) {
  if (length <= 0.4) return offset;
  offset = pushLotBox(offset, lot, { lateral: face - 0.06, along, bottom: bottom - 0.08, height: height + 0.16, across: 0.08, length: length + 0.16, color: SUBURBAN_TONES.marble, material: MATERIAL.MARBLE, variant: 0.1, occlusion: 1.0 });
  return pushLotBox(offset, lot, { lateral: face - 0.1, along, bottom, height, across: 0.06, length, color: SUBURBAN_TONES.glass, material: MATERIAL.METAL, occlusion: 0.95 });
}

function pushFrontDoor(offset, lot, { face, along, bottom }) {
  offset = pushLotBox(offset, lot, { lateral: face - 0.06, along, bottom, height: 2.5, across: 0.08, length: 1.5, color: SUBURBAN_TONES.marble, material: MATERIAL.MARBLE, variant: 0.1, occlusion: 1.0 });
  return pushLotBox(offset, lot, { lateral: face - 0.1, along, bottom, height: 2.35, across: 0.06, length: 1.2, color: SUBURBAN_TONES.frontDoor, material: MATERIAL.WOOD, occlusion: 0.95 });
}

function pushEntranceCanopy(offset, lot, { face, along, floor }) {
  const canopyDepth = 1.8;
  const canopyTop = floor + 2.9;
  for (const end of [-1, 1]) {
    offset = pushLotColumn(offset, lot, { lateral: face - canopyDepth + 0.25, along: along + end * 1.1, bottom: floor, height: canopyTop - floor, radius: 0.13, color: SUBURBAN_TONES.marble });
  }
  return pushLotBox(offset, lot, { lateral: face - canopyDepth * 0.5, along, bottom: canopyTop, height: 0.22, across: canopyDepth, length: 3.0, color: SUBURBAN_TONES.marble, material: MATERIAL.MARBLE, variant: 0.1, occlusion: 1.0 });
}

function pushEntranceSteps(offset, lot, { podiumFront, entranceAlong }) {
  return pushLotFrontSteps(offset, lot, {
    frontLateral: podiumFront - SUBURBAN_COPING_OVERHANG_METERS,
    along: entranceAlong,
    length: SUBURBAN_STEP_WIDTH_METERS,
    topHeight: houseFloorLevel(),
    stepCount: SUBURBAN_STEP_COUNT,
    treadDepth: SUBURBAN_STEP_TREAD_METERS,
    color: SUBURBAN_TONES.marble,
    material: MATERIAL.MARBLE
  });
}

function pushGarage(offset, lot, { garage, podiumFront, claddingStone }) {
  const garageSize = SUBURBAN_GARAGE;
  const garageFront = podiumFront + 0.6;
  offset = pushLotMass(offset, lot, { front: garageFront, depth: garageSize.depthMeters, along: garage.along, length: garageSize.widthMeters, bottom: -0.5, top: garageSize.heightMeters, color: claddingStone, material: MATERIAL.STONE, variant: STONE_CLADDING_VARIANT });
  offset = pushMarbleParapet(offset, lot, { front: garageFront, depth: garageSize.depthMeters, along: garage.along, length: garageSize.widthMeters, top: garageSize.heightMeters });
  return pushLotBox(offset, lot, { lateral: garageFront - 0.05, along: garage.along, bottom: 0.18, height: garageSize.doorHeightMeters, across: 0.1, length: garageSize.doorWidthMeters, color: SUBURBAN_TONES.garageDoor, material: MATERIAL.PLASTER, variant: PLASTER_PANEL_VARIANT, occlusion: 0.95 });
}

function pushFrontWalkAndDriveway(offset, lot, { podiumFront, entranceAlong, garage }) {
  const walkStartLateral = suburbanFrontWalkStartLateral(lot);
  const stepsFoot = podiumFront - SUBURBAN_COPING_OVERHANG_METERS - SUBURBAN_STEP_COUNT * SUBURBAN_STEP_TREAD_METERS;
  offset = pushStoneStrip(offset, lot, { from: walkStartLateral, to: stepsFoot, along: entranceAlong, width: 1.6 });
  if (!garage) return offset;
  const yardFront = lotFrontLateral(lot, SUBURBAN_YARD_FRONT_LATERAL);
  return pushStoneStrip(offset, lot, { from: yardFront, to: podiumFront + 0.6, along: garage.along, width: SUBURBAN_GARAGE.doorWidthMeters + 0.4 });
}

function pushStoneStrip(offset, lot, { from, to, along, width }) {
  return pushLotBox(offset, lot, { lateral: (from + to) * 0.5, along, bottom: 0.0, height: 0.3, across: to - from, length: width, color: SUBURBAN_TONES.walkStone, material: MATERIAL.PAVING, variant: PAVING_PATTERN_VARIANT.slab, occlusion: 0.97 });
}

function suburbanFrontWalkStartLateral(lot) {
  return lotFrontLateral(lot, SUBURBAN_YARD_FRONT_LATERAL) + SUBURBAN_FRONT_WALK_SETBACK_METERS;
}

function plantYardTrees(lot, { style, along, podiumFront, wallFront, garageEnd }, span) {
  const treeEnd = -garageEnd;
  const frontTreeAlong = clamp(along + treeEnd * (style.width * 0.5 + 0.6), span.start + 2.0, span.end - 2.0);
  plantLotTree(lot, { lateral: podiumFront - 3.4, along: frontTreeAlong, speciesNames: YARD_TREE_SPECIES, maxCrownRadiusMeters: 3.6, salt: 21 });
  if (lot.primarySeed > 0.35) {
    plantLotTree(lot, { lateral: wallFront + style.depth + 5.5, along: (span.start + span.end) * 0.5 + treeEnd * 2.0, speciesNames: YARD_TREE_SPECIES, maxCrownRadiusMeters: 5.0, salt: 22 });
  }
}
