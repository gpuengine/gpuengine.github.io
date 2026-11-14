// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const WARM_LANTERN_GLOW = Object.freeze([1.0, 0.86, 0.58]);
const GILDED_SIGN_GLOW = Object.freeze([1.0, 0.80, 0.42]);
const FLAG_RED = Object.freeze([0.70, 0.10, 0.14]);
const FLAG_WHITE = Object.freeze([0.94, 0.93, 0.90]);
const FLAG_BLUE = Object.freeze([0.12, 0.16, 0.38]);
const GALVANIZED_STEEL = Object.freeze([0.56, 0.58, 0.60]);
const CEDAR_WOOD = Object.freeze([0.46, 0.30, 0.18]);

const SCHOOLYARD_TREE_SPECIES = Object.freeze(["londonPlane", "honeyLocust", "zelkova", "pinOak"]);
const WAREHOUSE_SIGN_TONES = Object.freeze([[0.74, 0.46, 0.22], [0.24, 0.36, 0.52], [0.56, 0.20, 0.18], [0.78, 0.70, 0.40]]);
const ROLL_UP_DOOR_TONES = Object.freeze([[0.66, 0.68, 0.68], [0.36, 0.44, 0.46], [0.50, 0.26, 0.22]]);

const SCHOOL_FLOOR_HEIGHT_METERS = 4.2;
const SCHOOL_FLOOR_COUNT = 4;
const FLAG_STRIPE_COUNT = 5;
const WAREHOUSE_FLOOR_HEIGHT_METERS = 3.8;
const LOADING_DOCK_HEIGHT_METERS = 1.1;

function pushNeighborhoodSavingsBank(offset, lot, place) {
  const front = lotFrontLateral(lot, 11.0);
  const depth = 14.0;
  const length = place.length - 0.6;
  const along = place.along;
  const baseTop = 4.6;
  const top = 15.0 + lot.primarySeed * 5.0;
  const limestone = lot.secondarySeed > 0.5 ? STONE_TONES.paleLimestone : STONE_TONES.limestone;
  const granite = STONE_TONES.granite;

  offset = pushLotMass(offset, lot, { front, depth, along, length, top: baseTop, color: granite, variant: 0.62 });
  for (let groove = 1; groove <= 3; groove++) {
    offset = pushLotBox(offset, lot, { lateral: front - 0.04, along, bottom: groove * (baseTop / 4), height: 0.08, across: 0.1, length: length + 0.02, color: STONE_TONES.darkGranite, material: MATERIAL.STONE });
  }
  offset = pushLotMass(offset, lot, { front: front + 0.2, depth: depth - 0.2, along, length: length - 0.4, bottom: baseTop, top, color: limestone, variant: 0.55 });
  offset = pushBankPilasters(offset, lot, { front, along, length, baseTop, top, limestone });
  offset = pushBankArchedWindow(offset, lot, { front, along, baseTop, top, limestone });
  offset = pushLotCornice(offset, lot, { front, depth, along, length, height: top, thickness: 1.1, overhang: 0.5, color: limestone });
  offset = pushBankBalustrade(offset, lot, { front, along, length, top, limestone });
  offset = pushLotBox(offset, lot, { lateral: front - 0.08, along, bottom: baseTop + 0.25, height: 0.7, across: 0.12, length: 6.0, color: GILDED_SIGN_GLOW, material: MATERIAL.GLOW, occlusion: 1.0 });
  offset = pushLotBox(offset, lot, { lateral: front - 0.1, along, bottom: 0.18, height: 3.6, across: 0.2, length: 2.6, color: STONE_TONES.bronze, material: MATERIAL.METAL, occlusion: 0.9 });
  offset = pushSidewalkClock(offset, lot, { front, along: along + length * 0.36, height: 5.6 });
  return pushRoofFlag(offset, lot, { lateral: front + 2.0, along: along - length * 0.32, roofHeight: top + 1.1 });
}

function pushBankPilasters(offset, lot, { front, along, length, baseTop, top, limestone }) {
  const capital = [limestone[0] * 0.92, limestone[1] * 0.92, limestone[2] * 0.9];
  for (const pilasterAlong of [-0.42, -0.2, 0.2, 0.42]) {
    offset = pushLotBox(offset, lot, { lateral: front - 0.15, along: along + pilasterAlong * length, bottom: baseTop, height: top - baseTop - 1.0, across: 0.5, length: 0.9, color: limestone, material: MATERIAL.STONE, variant: 0.1 });
    offset = pushLotBox(offset, lot, { lateral: front - 0.25, along: along + pilasterAlong * length, bottom: top - 1.2, height: 0.6, across: 0.7, length: 1.2, color: capital, material: MATERIAL.STONE, variant: 0.1 });
  }
  return offset;
}

function pushBankArchedWindow(offset, lot, { front, along, baseTop, top, limestone }) {
  const archTop = top - 2.0;
  const steps = [{ width: 4.4, bottom: baseTop + 1.2, height: archTop - baseTop - 2.6 }, { width: 3.8, bottom: archTop - 1.4, height: 0.7 }, { width: 2.8, bottom: archTop - 0.7, height: 0.45 }, { width: 1.6, bottom: archTop - 0.25, height: 0.3 }];
  for (const step of steps) {
    offset = pushLotBox(offset, lot, { lateral: front + 0.1, along, bottom: step.bottom, height: step.height, across: 0.24, length: step.width, color: [0.16, 0.20, 0.24], material: MATERIAL.METAL, occlusion: 0.95 });
  }
  offset = pushLotBox(offset, lot, { lateral: front + 0.04, along, bottom: baseTop + 1.2, height: archTop - baseTop - 1.15, across: 0.1, length: 0.14, color: STONE_TONES.bronze, material: MATERIAL.METAL });
  return pushLotBox(offset, lot, { lateral: front - 0.12, along, bottom: archTop - 0.1, height: 1.1, across: 0.5, length: 0.9, color: limestone, material: MATERIAL.STONE, variant: 0.1 });
}

function pushBankBalustrade(offset, lot, { front, along, length, top, limestone }) {
  return withDetailGeometry(() => {
    const railTop = top + 2.1;
    offset = pushLotBox(offset, lot, { lateral: front + 0.1, along, bottom: top + 1.1, height: 0.25, across: 0.5, length: length - 0.6, color: limestone, material: MATERIAL.STONE, variant: 0.1 });
    offset = pushLotBox(offset, lot, { lateral: front + 0.1, along, bottom: railTop - 0.25, height: 0.25, across: 0.55, length: length - 0.6, color: limestone, material: MATERIAL.STONE, variant: 0.1 });
    const balusterCount = 9;
    for (let baluster = 0; baluster < balusterCount; baluster++) {
      const balusterAlong = along + (baluster / (balusterCount - 1) - 0.5) * (length - 1.4);
      offset = pushLotBox(offset, lot, { lateral: front + 0.1, along: balusterAlong, bottom: top + 1.35, height: 0.5, across: 0.3, length: 0.3, color: limestone, material: MATERIAL.STONE, variant: 0.1 });
    }
    return offset;
  });
}

function pushSidewalkClock(offset, lot, { front, along, height }) {
  return withDetailGeometry(() => {
    offset = pushLotBox(offset, lot, { lateral: front - 0.6, along, bottom: height + 0.5, height: 0.14, across: 1.2, length: 0.14, color: STONE_TONES.ironBlack, material: MATERIAL.METAL });
    offset = pushLotBox(offset, lot, { lateral: front - 1.2, along, bottom: height - 0.2, height: 1.2, across: 0.36, length: 1.2, color: STONE_TONES.bronze, material: MATERIAL.METAL });
    return pushLotBox(offset, lot, { lateral: front - 1.2, along, bottom: height - 0.08, height: 0.96, across: 0.42, length: 0.96, color: [1.0, 0.95, 0.80], material: MATERIAL.GLOW, occlusion: 1.0 });
  });
}

function pushRoofFlag(offset, lot, { lateral, along, roofHeight }) {
  return withDetailGeometry(() => {
    const poleHeight = 7.5;
    offset = pushLotBox(offset, lot, { lateral, along, bottom: roofHeight, height: poleHeight, across: 0.12, length: 0.12, color: GALVANIZED_STEEL, material: MATERIAL.METAL });
    return pushStarsAndStripes(offset, lot, { lateral, along, top: roofHeight + poleHeight - 0.2 });
  });
}

function pushStarsAndStripes(offset, lot, { lateral, along, top }) {
  return withDetailGeometry(() => {
    const flagLength = 2.6;
    const stripeHeight = 0.22;
    for (let stripe = 0; stripe < FLAG_STRIPE_COUNT; stripe++) {
      offset = pushLotBox(offset, lot, { lateral, along: along + flagLength * 0.5 + 0.06, bottom: top - (stripe + 1) * stripeHeight, height: stripeHeight, across: 0.04, length: flagLength, color: stripe % 2 === 0 ? FLAG_RED : FLAG_WHITE, material: MATERIAL.PLASTER, occlusion: 1.0 });
    }
    return pushLotBox(offset, lot, { lateral: lateral - 0.01, along: along + 0.6, bottom: top - stripeHeight * 4, height: stripeHeight * 4, across: 0.06, length: 1.08, color: FLAG_BLUE, material: MATERIAL.PLASTER, occlusion: 1.0 });
  });
}

function pushStorageWarehouse(offset, lot, place) {
  const front = lotFrontLateral(lot, 11.4);
  const depth = 15.0;
  const length = place.length - 0.4;
  const along = place.along;
  const floorCount = 6 + Math.floor(lot.primarySeed * 3);
  const height = floorCount * WAREHOUSE_FLOOR_HEIGHT_METERS + 1.2;
  const ashlar = lot.primarySeed > 0.5 ? ASHLAR_TONES.travertine : ASHLAR_TONES.greyGranite;
  const trim = [ashlar[0] * 0.72, ashlar[1] * 0.72, ashlar[2] * 0.72];
  const signTone = WAREHOUSE_SIGN_TONES[Math.floor(lot.secondarySeed * 17) % WAREHOUSE_SIGN_TONES.length];

  offset = pushLotMass(offset, lot, { front, depth, along, length, top: height, color: ashlar, material: MATERIAL.ASHLAR, variant: 0.2 });
  for (const end of [-1, 1]) {
    offset = pushLotBox(offset, lot, { lateral: front - 0.2, along: along + end * (length * 0.5 - 0.5), bottom: 0, height: height + 1.6, across: 0.5, length: 1.0, color: trim, material: MATERIAL.ASHLAR, variant: 0.2 });
  }
  offset = pushLotBox(offset, lot, { lateral: front + depth * 0.5, along, bottom: height, height: 2.2, across: depth, length: length * 0.4, color: ashlar, material: MATERIAL.ASHLAR, variant: 0.2 });
  offset = pushLotBox(offset, lot, { lateral: front - 0.05, along, bottom: height - 3.6, height: 2.4, across: 0.12, length: length - 2.4, color: signTone, material: MATERIAL.PLASTER, occlusion: 1.0 });
  offset = pushLotBox(offset, lot, { lateral: front - 0.08, along, bottom: height - 2.95, height: 0.5, across: 0.08, length: length - 5.0, color: FLAG_WHITE, material: MATERIAL.PLASTER, occlusion: 1.0 });
  offset = pushLotFacadeWindowGrid(offset, lot, { faceLateral: front, along, firstFloor: 5.2, floorCount: floorCount - 2, floorHeight: WAREHOUSE_FLOOR_HEIGHT_METERS, columnCount: 3, bayWidth: length / 3.4, windowWidth: 2.0, windowHeight: 1.8 });
  offset = pushLoadingDock(offset, lot, { front, along, length, seed: lot.primarySeed });
  offset = pushFireEscape(offset, lot, { front, escapeAlong: along - length * 0.3, floorCount: floorCount - 1, floorHeight: WAREHOUSE_FLOOR_HEIGHT_METERS });
  offset = pushRooftopWaterTank(offset, lot, { ...rooftopPoint(lot, front + depth * 0.6, along + length * 0.25, height), standColor: trim });
  return offset;
}

function pushLoadingDock(offset, lot, { front, along, length, seed }) {
  const doorTone = ROLL_UP_DOOR_TONES[Math.floor(seed * 11) % ROLL_UP_DOOR_TONES.length];
  const dockLength = length - 1.6;
  offset = pushLotMass(offset, lot, { front: front - 1.6, depth: 1.6, along, length: dockLength, bottom: -0.5, top: LOADING_DOCK_HEIGHT_METERS, color: [0.52, 0.52, 0.50], variant: 0.62 });
  offset = pushLotBox(offset, lot, { lateral: front - 1.3, along, bottom: 3.9, height: 0.2, across: 2.6, length: dockLength, color: GALVANIZED_STEEL, material: MATERIAL.METAL });
  const doorCount = 3;
  for (let door = 0; door < doorCount; door++) {
    const doorAlong = along + (door - 1) * (dockLength / doorCount);
    offset = pushLotBox(offset, lot, { lateral: front - 0.06, along: doorAlong, bottom: LOADING_DOCK_HEIGHT_METERS, height: 2.7, across: 0.14, length: dockLength / doorCount - 0.9, color: doorTone, material: MATERIAL.METAL, occlusion: 0.92 });
    offset = pushLotBox(offset, lot, { lateral: front - 1.65, along: doorAlong, bottom: 0.3, height: 0.5, across: 0.18, length: 0.4, color: STONE_TONES.ironBlack, material: MATERIAL.METAL });
  }
  return pushLotBox(offset, lot, { lateral: front - 0.2, along, bottom: 3.5, height: 0.22, across: 0.14, length: dockLength * 0.8, color: WARM_LANTERN_GLOW, material: MATERIAL.GLOW, occlusion: 1.0 });
}

function rooftopPoint(lot, lateral, along, roofHeight) {
  const point = lotPoint(lot, lateral, along, 0);
  return { x: point[0], z: point[2], roofY: lot.y + roofHeight };
}

function pushPublicSchool(offset, lot, place) {
  const yardEnd = lot.primarySeed > 0.5 ? 1 : -1;
  const buildingLength = place.length * 0.64;
  const buildingAlong = place.along - yardEnd * (place.length - buildingLength) * 0.5;
  const yardLength = place.length - buildingLength - 0.8;
  const yardAlong = place.along + yardEnd * (place.length - yardLength) * 0.5;
  const front = lotFrontLateral(lot, 12.6);
  const depth = 15.0;
  const ashlar = [ASHLAR_TONES.warmSandstone, ASHLAR_TONES.greyGranite, ASHLAR_TONES.ivoryMarble][Math.floor(lot.secondarySeed * 3) % 3];
  const limestone = STONE_TONES.limestone;
  const school = { front, depth, along: buildingAlong, length: buildingLength, height: SCHOOL_FLOOR_COUNT * SCHOOL_FLOOR_HEIGHT_METERS + 1.4, ashlar, limestone };

  offset = pushSchoolBuilding(offset, lot, school);
  offset = pushSchoolEntrancePavilion(offset, lot, school);
  offset = pushSchoolyard(offset, lot, { front, depth, along: yardAlong, length: yardLength });
  offset = pushLotBox(offset, lot, { lateral: front - 3.2, along: buildingAlong + yardEnd * buildingLength * 0.35, bottom: 0, height: 10.0, across: 0.16, length: 0.16, color: GALVANIZED_STEEL, material: MATERIAL.METAL });
  offset = pushStarsAndStripes(offset, lot, { lateral: front - 3.2, along: buildingAlong + yardEnd * buildingLength * 0.35, top: 9.8 });
  return offset;
}

function pushSchoolBuilding(offset, lot, { front, depth, along, length, height, ashlar, limestone }) {
  offset = pushLotMass(offset, lot, { front, depth, along, length, top: height, color: ashlar, material: MATERIAL.ASHLAR, variant: 0.2 });
  offset = pushLotBox(offset, lot, { lateral: front - 0.08, along, bottom: 0, height: 1.2, across: 0.3, length: length + 0.1, color: STONE_TONES.granite, material: MATERIAL.STONE, variant: 0.1 });
  for (let floor = 1; floor < SCHOOL_FLOOR_COUNT; floor++) {
    offset = pushLotBox(offset, lot, { lateral: front - 0.06, along, bottom: floor * SCHOOL_FLOOR_HEIGHT_METERS + 0.7, height: 0.22, across: 0.22, length: length + 0.06, color: limestone, material: MATERIAL.STONE, variant: 0.1 });
  }
  const wingLength = (length - 7.0) * 0.5;
  for (const wing of [-1, 1]) {
    offset = pushLotFacadeWindowGrid(offset, lot, { faceLateral: front, along: along + wing * (3.5 + wingLength * 0.5), firstFloor: 1.6, floorCount: SCHOOL_FLOOR_COUNT, floorHeight: SCHOOL_FLOOR_HEIGHT_METERS, columnCount: 1, bayWidth: wingLength, windowWidth: wingLength - 1.4, windowHeight: 2.4 });
  }
  offset = pushLotCornice(offset, lot, { front, depth, along, length, height, thickness: 0.7, overhang: 0.25, color: limestone });
  const merlonCount = 5;
  for (let merlon = 0; merlon < merlonCount; merlon++) {
    offset = pushLotBox(offset, lot, { lateral: front + 0.1, along: along + (merlon / (merlonCount - 1) - 0.5) * (length - 1.0), bottom: height + 0.7, height: 0.9, across: 0.5, length: 0.9, color: limestone, material: MATERIAL.STONE, variant: 0.1 });
  }
  return offset;
}

function pushSchoolEntrancePavilion(offset, lot, { front, along, height, ashlar, limestone }) {
  const pavilionFront = front - 1.4;
  const pavilionTop = height + 5.0;
  offset = pushLotMass(offset, lot, { front: pavilionFront, depth: 4.0, along, length: 6.4, top: pavilionTop, color: ashlar, material: MATERIAL.ASHLAR, variant: 0.2 });
  for (const end of [-1, 1]) {
    offset = pushLotBox(offset, lot, { lateral: pavilionFront - 0.1, along: along + end * 2.9, bottom: 0, height: pavilionTop + 1.4, across: 0.6, length: 0.8, color: limestone, material: MATERIAL.STONE, variant: 0.1 });
  }
  offset = pushLotBox(offset, lot, { lateral: pavilionFront - 0.1, along, bottom: 0, height: 5.6, across: 0.3, length: 3.8, color: limestone, material: MATERIAL.STONE, variant: 0.1 });
  offset = pushLotBox(offset, lot, { lateral: pavilionFront - 0.2, along, bottom: 0.18, height: 3.4, across: 0.2, length: 2.4, color: [0.20, 0.12, 0.08], material: MATERIAL.WOOD, occlusion: 0.9 });
  offset = pushLotBox(offset, lot, { lateral: pavilionFront - 0.22, along, bottom: 3.7, height: 1.2, across: 0.16, length: 2.0, color: WARM_LANTERN_GLOW, material: MATERIAL.GLOW, occlusion: 1.0 });
  offset = pushLotBox(offset, lot, { lateral: pavilionFront - 0.12, along, bottom: pavilionTop - 4.0, height: 1.0, across: 0.2, length: 4.2, color: limestone, material: MATERIAL.STONE, variant: 0.1 });
  offset = pushLotFacadeWindowGrid(offset, lot, { faceLateral: pavilionFront, along, firstFloor: 6.6, floorCount: 2, floorHeight: SCHOOL_FLOOR_HEIGHT_METERS, columnCount: 1, bayWidth: 2.0, windowWidth: 2.4, windowHeight: 3.0, frameColor: limestone });
  return pushLotFrontSteps(offset, lot, { frontLateral: pavilionFront, along, length: 4.2, topHeight: 0.6, stepCount: 3, treadDepth: 0.4, color: STONE_TONES.granite });
}

function pushSchoolyard(offset, lot, { front, depth, along, length }) {
  const yardFront = front - 1.0;
  const yardDepth = depth + 1.0;
  const courtColor = [0.24, 0.30, 0.36];
  offset = pushLotBox(offset, lot, { lateral: yardFront + yardDepth * 0.5, along, bottom: 0.0, height: 0.24, across: yardDepth, length, color: courtColor, material: MATERIAL.PAVING, variant: 0.3 });
  offset = pushLotBox(offset, lot, { lateral: yardFront + yardDepth * 0.55, along, bottom: 0.24, height: 0.02, across: 0.12, length: length * 0.8, color: FLAG_WHITE, material: MATERIAL.PAVING, variant: 0.3 });
  offset = pushBasketballHoop(offset, lot, { lateral: yardFront + yardDepth - 1.2, along });
  offset = pushPlayStructure(offset, lot, { lateral: yardFront + yardDepth * 0.42, along: along + length * 0.18 });
  for (let tree = 0; tree < 2; tree++) {
    plantLotTree(lot, { lateral: yardFront + 1.4, along: along + (tree - 0.5) * length * 0.6, speciesNames: SCHOOLYARD_TREE_SPECIES, maxCrownRadiusMeters: 3.6, salt: 10 + tree });
  }
  return offset;
}

function pushBasketballHoop(offset, lot, { lateral, along }) {
  return withDetailGeometry(() => {
    offset = pushLotBox(offset, lot, { lateral, along, bottom: 0, height: 3.4, across: 0.16, length: 0.16, color: [0.26, 0.32, 0.40], material: MATERIAL.METAL });
    offset = pushLotBox(offset, lot, { lateral: lateral - 0.5, along, bottom: 2.9, height: 1.05, across: 0.06, length: 1.8, color: FLAG_WHITE, material: MATERIAL.PLASTER });
    return pushLotBox(offset, lot, { lateral: lateral - 0.85, along, bottom: 3.05, height: 0.04, across: 0.45, length: 0.45, color: [0.92, 0.42, 0.10], material: MATERIAL.METAL });
  });
}

function pushPlayStructure(offset, lot, { lateral, along }) {
  return withDetailGeometry(() => {
    for (const postLateral of [-0.8, 0.8]) {
      for (const postAlong of [-0.8, 0.8]) {
        offset = pushLotBox(offset, lot, { lateral: lateral + postLateral, along: along + postAlong, bottom: 0, height: 2.4, across: 0.14, length: 0.14, color: [0.24, 0.36, 0.50], material: MATERIAL.METAL });
      }
    }
    offset = pushLotBox(offset, lot, { lateral, along, bottom: 1.3, height: 0.14, across: 1.8, length: 1.8, color: [0.82, 0.70, 0.36], material: MATERIAL.PLASTER });
    const roofBase = lotPoint(lot, lateral, along, 2.4);
    offset = pushFlatConcreteRoof(lot.vertices, offset, { x: roofBase[0], y: roofBase[1], z: roofBase[2], halfAcross: 1.0, halfAlong: 1.0, yaw: lot.yaw, color: [0.64, 0.26, 0.22] });
    const slideCenter = lotPoint(lot, lateral, along + 1.9, 0.75);
    return pushBox(lot.vertices, offset, { center: slideCenter, size: [0.7, 0.1, 2.6], yaw: lot.yaw, pitch: -0.52, color: [0.64, 0.26, 0.22], material: MATERIAL.PLASTER, occlusion: 1.0 });
  });
}
