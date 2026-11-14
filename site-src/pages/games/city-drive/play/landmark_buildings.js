// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const FRONTAGE_LOT_COUNT = 4;
const FRONTAGE_FIRST_LOT_IN_BLOCK = 5;
const FRONTAGE_LOT_SPACING_SEGMENTS = 4;
const SINGLE_LOT_LENGTH = 14.6;
const DOUBLE_LOT_LENGTH = 28.0;
const LOT_GROUND = 0.18;
const FOUNDATION_DEPTH = 4.0;

const SINGLE_LOT_STYLES = [
  { id: "limestoneSetback", build: pushLimestoneSetbackTower },
  { id: "colonnade", build: pushColonnadeTower },
  { id: "brownstone", build: pushBrownstoneRowhouse },
  { id: "fountainPlaza", build: pushFountainPlazaTower },
  { id: "templeBank", build: pushMarbleTempleBank },
  { id: "georgian", build: pushGeorgianTerrace },
  { id: "victorian", build: pushVictorianMansionBlock },
  { id: "castIron", build: pushCastIronLoft },
  { id: "gothicClock", build: pushGothicClockTower },
  { id: "bronzeGlass", build: pushBronzeGlassTower },
  { id: "savingsBank", build: pushNeighborhoodSavingsBank },
  { id: "storageWarehouse", build: pushStorageWarehouse },
  { id: "brutalistTower", build: pushBrutalistTower },
  { id: "suburbanHome", build: pushSuburbanHome, onlyWhereListed: true }
];

const DOUBLE_LOT_STYLES = [
  { id: "artDeco", build: pushArtDecoSupertall },
  { id: "grandStair", build: pushGrandStairPlazaTower },
  { id: "publicSchool", build: pushPublicSchool }
];

function pushPlannedFrontage(offset, lot, blockNumber) {
  const plannedLot = frontageLotAt(blockNumber, lot.side, lot.inBlockIdx, lot.district);
  if (!plannedLot) return offset;
  const place = plannedLot.lotSpan === 2
    ? { along: SEG_LENGTH * FRONTAGE_LOT_SPACING_SEGMENTS * 0.5, length: DOUBLE_LOT_LENGTH }
    : { along: 0, length: SINGLE_LOT_LENGTH };
  return plannedLot.build(offset, lot, place);
}

function frontageLotAt(blockNumber, side, inBlockIdx, district) {
  const lotIndex = frontageLotIndexAt(inBlockIdx);
  if (lotIndex < 0) return null;
  return planBlockFrontage(blockNumber, side, district)[lotIndex];
}

function frontageBuildingCovering(blockNumber, side, inBlockIdx, district) {
  const lotIndex = frontageLotIndexAt(inBlockIdx);
  if (lotIndex < 0) return null;
  const lots = planBlockFrontage(blockNumber, side, district);
  const ownerLotIndex = lots[lotIndex] ? lotIndex : lotIndex - 1;
  const ownerLot = lots[ownerLotIndex];
  if (!ownerLot) return null;
  return { styleId: ownerLot.styleId, lotSpan: ownerLot.lotSpan, ownerInBlockIdx: FRONTAGE_FIRST_LOT_IN_BLOCK + ownerLotIndex * FRONTAGE_LOT_SPACING_SEGMENTS };
}

function frontageLotIndexAt(inBlockIdx) {
  const lotOffset = inBlockIdx - FRONTAGE_FIRST_LOT_IN_BLOCK;
  if (lotOffset < 0 || lotOffset % FRONTAGE_LOT_SPACING_SEGMENTS !== 0) return -1;
  const lotIndex = lotOffset / FRONTAGE_LOT_SPACING_SEGMENTS;
  return lotIndex < FRONTAGE_LOT_COUNT ? lotIndex : -1;
}

function planBlockFrontage(blockNumber, side, district) {
  const lots = [];
  let lotIndex = 0;
  while (lotIndex < FRONTAGE_LOT_COUNT) {
    const spanRoll = seededRandom(blockNumber * 19.7 + side * 5.3 + lotIndex * 3.1);
    const styleRoll = seededRandom(blockNumber * 7.9 + side * 2.3 + lotIndex * 11.7);
    const canSpanTwoLots = lotIndex % 2 === 0;
    if (canSpanTwoLots && spanRoll < district.doubleLotChance) {
      const style = pickWeightedStyle(DOUBLE_LOT_STYLES, district.doubleLotWeights, district.otherStyleWeight, styleRoll);
      lots.push({ build: style.build, styleId: style.id, lotSpan: 2 });
      lots.push(null);
      lotIndex += 2;
      continue;
    }
    const style = pickWeightedStyle(SINGLE_LOT_STYLES, district.singleLotWeights, district.otherStyleWeight, styleRoll);
    lots.push({ build: style.build, styleId: style.id, lotSpan: 1 });
    lotIndex += 1;
  }
  return lots;
}

function pickWeightedStyle(styles, weightById, otherStyleWeight, roll) {
  const weightOf = (style) => weightById[style.id] ?? (style.onlyWhereListed ? 0 : otherStyleWeight);
  const totalWeight = styles.reduce((sum, style) => sum + weightOf(style), 0);
  let remaining = roll * totalWeight;
  for (const style of styles) {
    remaining -= weightOf(style);
    if (remaining <= 0) return style;
  }
  return styles[styles.length - 1];
}

function lotFrontLateral(lot, baseLateral) {
  return baseLateral + lot.shiftLateral;
}

function pushLotMass(offset, lot, { front, depth, along = 0, length, bottom = -FOUNDATION_DEPTH, top, color, material = MATERIAL.STONE, variant = 0.55, occlusion = 0.96 }) {
  return pushLotBox(offset, lot, { lateral: front + depth * 0.5, along, bottom, height: top - bottom, across: depth, length, color, material, variant, occlusion });
}

function pushLotCornice(offset, lot, { front, depth, along = 0, length, height, thickness = 0.9, overhang = 0.45, color }) {
  return pushLotBox(offset, lot, { lateral: front + depth * 0.5, along, bottom: height, height: thickness, across: depth + overhang * 2, length: length + overhang * 2, color, material: MATERIAL.STONE, variant: 0.1, occlusion: 1.0 });
}

function pushMarbleTempleBank(offset, lot, place) {
  const marble = MARBLE_TONES[Math.floor(lot.secondarySeed * MARBLE_TONES.length) % MARBLE_TONES.length];
  const stepCount = 5;
  const treadDepth = 0.42;
  const podiumHeight = 1.3;
  const stepsFront = lotFrontLateral(lot, 10.4);
  const podiumFront = stepsFront + stepCount * treadDepth;
  const bodyFront = podiumFront + 3.6;
  const bodyDepth = 11.0;
  const bodyTop = podiumHeight + 13.0 + lot.primarySeed * 6.0;
  const length = place.length - 0.6;
  const along = place.along;

  offset = pushLotFrontSteps(offset, lot, { frontLateral: podiumFront, along, length: length - 2.0, topHeight: podiumHeight, stepCount, treadDepth, color: marble, material: MATERIAL.MARBLE });
  offset = pushLotMass(offset, lot, { front: podiumFront, depth: bodyFront + bodyDepth - podiumFront, along, length, top: podiumHeight, color: marble, material: MATERIAL.MARBLE, variant: 0.1 });
  offset = pushLotMass(offset, lot, { front: bodyFront, depth: bodyDepth, along, length: length - 0.8, bottom: podiumHeight, top: bodyTop, color: STONE_TONES.paleLimestone, variant: 0.55 });
  offset = pushLotCornice(offset, lot, { front: bodyFront, depth: bodyDepth, along, length: length - 0.8, height: bodyTop, color: marble });
  offset = pushTemplePortico(offset, lot, { podiumFront, podiumHeight, along, length, marble });
  offset = pushLotBox(offset, lot, { lateral: bodyFront - 0.1, along, bottom: podiumHeight, height: 5.2, across: 0.3, length: 2.8, color: STONE_TONES.bronze, material: MATERIAL.METAL, occlusion: 0.9 });
  return pushLotBox(offset, lot, { lateral: bodyFront - 0.25, along, bottom: podiumHeight + 5.4, height: 0.5, across: 0.2, length: 3.2, color: [1.0, 0.86, 0.6], material: MATERIAL.GLOW, occlusion: 1.0 });
}

function pushTemplePortico(offset, lot, { podiumFront, podiumHeight, along, length, marble }) {
  const columnHeight = 9.6;
  const columnCount = 6;
  const columnSpacing = (length - 2.6) / (columnCount - 1);
  for (let column = 0; column < columnCount; column++) {
    offset = pushLotColumn(offset, lot, {
      lateral: podiumFront + 1.3,
      along: along - (length - 2.6) * 0.5 + column * columnSpacing,
      bottom: podiumHeight,
      height: columnHeight,
      radius: 0.5,
      color: marble
    });
  }
  const entablatureBottom = podiumHeight + columnHeight;
  offset = pushLotBox(offset, lot, { lateral: podiumFront + 1.85, along, bottom: entablatureBottom, height: 1.4, across: 3.9, length, color: marble, material: MATERIAL.MARBLE, variant: 0.1, occlusion: 1.0 });
  const pedimentBase = lotPoint(lot, podiumFront + 1.85, along, entablatureBottom + 1.4);
  return pushFlatConcreteRoof(lot.vertices, offset, { x: pedimentBase[0], y: pedimentBase[1], z: pedimentBase[2], halfAcross: 1.95, halfAlong: length * 0.5, yaw: lot.yaw, color: marble });
}

function pushArtDecoSupertall(offset, lot, place) {
  const facade = lot.secondarySeed > 0.5 ? STONE_TONES.limestone : STONE_TONES.sandstone;
  const pierStone = [facade[0] * 0.72, facade[1] * 0.72, facade[2] * 0.74];
  const along = place.along;
  const plazaStepCount = 3;
  const plazaTreadDepth = 0.45;
  const plazaFront = lotFrontLateral(lot, 10.0);
  const front = plazaFront + plazaStepCount * plazaTreadDepth;
  const plazaHeight = 0.55;
  const tiers = planArtDecoTiers(lot, place);

  offset = pushLotFrontSteps(offset, lot, { frontLateral: front, along, length: tiers[0].length, topHeight: plazaHeight, stepCount: plazaStepCount, treadDepth: plazaTreadDepth, color: STONE_TONES.granite });
  offset = pushArtDecoTiers(offset, lot, { front, along, tiers, facade, pierStone });
  offset = pushArtDecoPiers(offset, lot, { front, along, tiers, pierStone });
  offset = pushArtDecoCrown(offset, lot, { front, along, crownTier: tiers[3], facade });
  return pushArtDecoEntrance(offset, lot, { front, along, plazaHeight });
}

function planArtDecoTiers(lot, place) {
  const tiers = [
    { inset: 0.0, depth: 18.0, length: place.length - 2.0, top: 26.0 + lot.primarySeed * 8.0 },
    { inset: 2.6, depth: 14.0, length: place.length - 8.0, top: 72.0 + lot.secondarySeed * 24.0 },
    { inset: 4.6, depth: 10.0, length: place.length - 14.0, top: 120.0 + lot.primarySeed * 50.0 },
    { inset: 6.0, depth: 7.2, length: place.length - 19.0, top: 0 }
  ];
  tiers[3].top = tiers[2].top + 18.0 + lot.secondarySeed * 12.0;
  return tiers;
}

function pushArtDecoTiers(offset, lot, { front, along, tiers, facade, pierStone }) {
  let previousTop = 0;
  for (const tier of tiers) {
    const tierFront = front + tier.inset;
    offset = pushLotMass(offset, lot, { front: tierFront, depth: tier.depth, along, length: tier.length, bottom: previousTop === 0 ? -FOUNDATION_DEPTH : previousTop - 0.5, top: tier.top, color: facade });
    offset = pushLotCornice(offset, lot, { front: tierFront, depth: tier.depth, along, length: tier.length, height: tier.top, thickness: 1.0, overhang: 0.3, color: pierStone });
    previousTop = tier.top;
  }
  return offset;
}

function pushArtDecoPiers(offset, lot, { front, along, tiers, pierStone }) {
  const baseTier = tiers[0];
  const middleTier = tiers[1];
  const pierCount = 5;
  for (let pier = 0; pier < pierCount; pier++) {
    offset = pushLotBox(offset, lot, {
      lateral: front + middleTier.inset - 0.2,
      along: along + (pier - (pierCount - 1) * 0.5) * (middleTier.length / pierCount),
      bottom: baseTier.top,
      height: middleTier.top - baseTier.top,
      across: 0.6,
      length: 0.9,
      color: pierStone,
      material: MATERIAL.STONE,
      variant: 0.1
    });
  }
  return offset;
}

function pushArtDecoCrown(offset, lot, { front, along, crownTier, facade }) {
  const crownFront = front + crownTier.inset + crownTier.depth * 0.5;
  const mastHeight = 26.0;
  let crownBase = crownTier.top + 1.0;
  for (let step = 0; step < 3; step++) {
    const scale = 0.78 - step * 0.2;
    const crownHeight = 5.0 - step;
    offset = pushLotBox(offset, lot, { lateral: crownFront, along, bottom: crownBase, height: crownHeight, across: crownTier.depth * scale, length: crownTier.length * scale, color: step === 2 ? STONE_TONES.copper : facade, material: MATERIAL.STONE, variant: 0.2 });
    crownBase += crownHeight;
  }
  offset = pushLotBox(offset, lot, { lateral: crownFront, along, bottom: crownBase, height: mastHeight, across: 0.7, length: 0.7, color: [0.72, 0.74, 0.78], material: MATERIAL.METAL, occlusion: 1.0 });
  return pushLotBox(offset, lot, { lateral: crownFront, along, bottom: crownBase + mastHeight, height: 0.6, across: 0.6, length: 0.6, color: [1.0, 0.18, 0.15], material: MATERIAL.GLOW, occlusion: 1.0 });
}

function pushArtDecoEntrance(offset, lot, { front, along, plazaHeight }) {
  const marble = MARBLE_TONES[0];
  const columnHeight = 7.4;
  for (let column = 0; column < 4; column++) {
    offset = pushLotColumn(offset, lot, { lateral: front - 0.9, along: along + (column - 1.5) * 3.2, bottom: plazaHeight, height: columnHeight, radius: 0.46, color: marble, capitalColor: STONE_TONES.bronze });
  }
  offset = pushLotBox(offset, lot, { lateral: front - 0.9, along, bottom: plazaHeight + columnHeight, height: 0.6, across: 2.4, length: 12.6, color: STONE_TONES.bronze, material: MATERIAL.METAL, occlusion: 1.0 });
  return pushLotBox(offset, lot, { lateral: front - 0.05, along, bottom: plazaHeight, height: 6.4, across: 0.2, length: 9.0, color: [1.0, 0.88, 0.64], material: MATERIAL.GLOW, occlusion: 1.0 });
}

function pushGrandStairPlazaTower(offset, lot, place) {
  const along = place.along;
  const terraceHeight = 1.6 + lot.primarySeed * 1.6;
  const stepCount = Math.round(terraceHeight / 0.17);
  const treadDepth = 0.4;
  const stairsFront = lotFrontLateral(lot, 9.9);
  const terraceFront = stairsFront + stepCount * treadDepth;
  const terraceDepth = 24.0;
  const stairLength = place.length - 9.0;
  const cheekLength = (place.length - stairLength) * 0.5;
  const stepStone = lot.secondarySeed > 0.5 ? [0.60, 0.58, 0.54] : [0.66, 0.62, 0.55];
  const towerStone = lot.secondarySeed > 0.5 ? STONE_TONES.portland : [0.46, 0.48, 0.52];
  const towerLength = place.length - 6.0;
  const towerTop = terraceHeight + 92.0 + lot.secondarySeed * 96.0;

  offset = pushLotFrontSteps(offset, lot, { frontLateral: terraceFront, along, length: stairLength, topHeight: terraceHeight, stepCount, treadDepth, color: stepStone });
  offset = pushLotMass(offset, lot, { front: terraceFront, depth: terraceDepth, along, length: place.length, top: terraceHeight, color: stepStone, variant: 0.1 });
  for (const end of [-1, 1]) {
    const cheekAlong = along + end * (stairLength + cheekLength) * 0.5;
    offset = pushGrandStairCheek(offset, lot, { stairsFront, terraceFront, terraceHeight, cheekAlong, cheekLength });
  }
  offset = pushGrandStairPortico(offset, lot, { terraceFront, terraceHeight, along, towerLength });
  return pushGrandStairTower(offset, lot, { towerFront: terraceFront + 5.5, towerDepth: 16.0, along, towerLength, terraceHeight, towerTop, towerStone });
}

function pushGrandStairCheek(offset, lot, { stairsFront, terraceFront, terraceHeight, cheekAlong, cheekLength }) {
  offset = pushLotMass(offset, lot, { front: stairsFront, depth: terraceFront - stairsFront, along: cheekAlong, length: cheekLength, top: terraceHeight + 0.7, color: STONE_TONES.granite, variant: 0.1 });
  const lampPoint = lotPoint(lot, stairsFront + 0.6, cheekAlong, terraceHeight + 0.7);
  offset = pushBox(lot.vertices, offset, { center: [lampPoint[0], lampPoint[1] + 1.6, lampPoint[2]], size: [0.18, 3.2, 0.18], yaw: lot.yaw, color: STONE_TONES.ironBlack, material: MATERIAL.METAL, occlusion: 0.9 });
  return pushBox(lot.vertices, offset, { center: [lampPoint[0], lampPoint[1] + 3.35, lampPoint[2]], size: [0.5, 0.5, 0.5], yaw: lot.yaw, color: [1.0, 0.9, 0.66], material: MATERIAL.GLOW, occlusion: 1.0 });
}

function pushGrandStairPortico(offset, lot, { terraceFront, terraceHeight, along, towerLength }) {
  const pillarCount = 6;
  const pillarHeight = 10.5;
  for (let pillar = 0; pillar < pillarCount; pillar++) {
    offset = pushLotBox(offset, lot, {
      lateral: terraceFront + 2.4,
      along: along + (pillar - (pillarCount - 1) * 0.5) * (towerLength / pillarCount),
      bottom: terraceHeight,
      height: pillarHeight,
      across: 1.1,
      length: 1.1,
      color: STONE_TONES.portland,
      material: MATERIAL.STONE,
      variant: 0.1
    });
  }
  return pushLotBox(offset, lot, { lateral: terraceFront + 3.9, along, bottom: terraceHeight + pillarHeight, height: 1.1, across: 4.2, length: towerLength + 1.2, color: STONE_TONES.portland, material: MATERIAL.STONE, variant: 0.1, occlusion: 1.0 });
}

function pushGrandStairTower(offset, lot, { towerFront, towerDepth, along, towerLength, terraceHeight, towerTop, towerStone }) {
  offset = pushLotMass(offset, lot, { front: towerFront, depth: towerDepth, along, length: towerLength, bottom: terraceHeight - 0.5, top: towerTop, color: towerStone });
  offset = pushLotCornice(offset, lot, { front: towerFront, depth: towerDepth, along, length: towerLength, height: towerTop, thickness: 1.4, overhang: 0.35, color: [towerStone[0] * 0.7, towerStone[1] * 0.7, towerStone[2] * 0.72] });
  offset = pushLotBox(offset, lot, { lateral: towerFront + towerDepth * 0.5, along, bottom: towerTop + 1.4, height: 6.0, across: towerDepth * 0.55, length: towerLength * 0.5, color: towerStone, material: MATERIAL.STONE, variant: 0.2 });
  offset = pushLotBox(offset, lot, { lateral: towerFront + towerDepth * 0.5, along, bottom: towerTop + 7.4, height: 14.0, across: 0.5, length: 0.5, color: [0.70, 0.72, 0.76], material: MATERIAL.METAL, occlusion: 1.0 });
  return pushLotBox(offset, lot, { lateral: towerFront - 0.05, along, bottom: terraceHeight, height: 5.0, across: 0.2, length: towerLength * 0.6, color: [1.0, 0.88, 0.64], material: MATERIAL.GLOW, occlusion: 1.0 });
}

function pushGeorgianTerrace(offset, lot, place) {
  const houseCount = 3;
  const terrace = {
    place,
    houseCount,
    houseLength: place.length / houseCount,
    front: lotFrontLateral(lot, 12.0),
    depth: 12.0
  };
  const { front, depth } = terrace;

  offset = pushLotMass(offset, lot, { front: front - 0.12, depth: 0.3, along: place.along, length: place.length, bottom: 0, top: 3.7, color: STONE_TONES.stucco, material: MATERIAL.PLASTER, variant: 0.1 });
  offset = pushLotMass(offset, lot, { front: front + 1.2, depth: depth - 2.4, along: place.along, length: place.length - 0.4, bottom: 14.0, top: 16.8, color: STONE_TONES.slate, variant: 0.1 });
  for (let house = 0; house < houseCount; house++) {
    offset = pushGeorgianHouse(offset, lot, terrace, house);
  }
  return offset;
}

function pushGeorgianHouse(offset, lot, { place, houseCount, houseLength, front, depth }, house) {
  const ashlarChoices = [ASHLAR_TONES.ivoryMarble, ASHLAR_TONES.warmSandstone, ASHLAR_TONES.travertine];
  const doorColors = [[0.06, 0.08, 0.10], [0.42, 0.08, 0.10], [0.08, 0.20, 0.34], [0.10, 0.26, 0.16]];
  const houseSeed = seededRandom(lot.segIndex * 5.3 + house * 1.7 + lot.side);
  const houseAlong = place.along + (house - (houseCount - 1) * 0.5) * houseLength;
  const height = 13.2 + (house % 2) * 0.5 + houseSeed * 0.3;
  const ashlar = ashlarChoices[Math.floor(houseSeed * ashlarChoices.length) % ashlarChoices.length];
  const isMiddleHouse = house === 1;
  offset = pushLotMass(offset, lot, { front, depth, along: houseAlong, length: houseLength - 0.05, top: height, color: ashlar, material: MATERIAL.ASHLAR, variant: 0.2 });
  offset = pushLotCornice(offset, lot, { front, depth, along: houseAlong, length: houseLength - 0.05, height, thickness: 0.7, overhang: 0.2, color: STONE_TONES.stucco });
  if (!isMiddleHouse) {
    offset = pushLotBox(offset, lot, { lateral: front + depth * 0.5, along: houseAlong + houseLength * 0.36, bottom: height + 0.7, height: 3.8, across: 1.0, length: 0.9, color: ashlar, material: MATERIAL.ASHLAR, variant: 0.2 });
  }
  const doorAlong = houseAlong + (house % 2 === 0 ? -1 : 1) * houseLength * 0.25;
  offset = pushLotBox(offset, lot, { lateral: front - 0.2, along: doorAlong, bottom: 0.5, height: 2.5, across: 0.18, length: 1.1, color: doorColors[Math.floor(houseSeed * 7) % doorColors.length], material: MATERIAL.METAL, occlusion: 0.95 });
  offset = pushLotBox(offset, lot, { lateral: front - 0.2, along: doorAlong, bottom: 3.1, height: 0.4, across: 0.16, length: 1.0, color: [1.0, 0.86, 0.56], material: MATERIAL.GLOW, occlusion: 1.0 });
  offset = pushLotFrontSteps(offset, lot, { frontLateral: front - 0.1, along: doorAlong, length: 1.6, topHeight: 0.5, stepCount: 2, treadDepth: 0.4, color: STONE_TONES.portland });
  offset = pushLotFacadeWindowGrid(offset, lot, { faceLateral: front, along: houseAlong, firstFloor: 4.4, floorCount: 3, floorHeight: 2.9, columnCount: 2, bayWidth: houseLength * 0.5, windowWidth: 1.05, windowHeight: 1.9 });
  return offset;
}

function pushVictorianMansionBlock(offset, lot, place) {
  const front = lotFrontLateral(lot, 11.2);
  const depth = 13.0;
  const length = place.length - 0.6;
  const along = place.along;
  const height = 18.0 + lot.primarySeed * 6.0;
  const ashlar = lot.secondarySeed > 0.5 ? ASHLAR_TONES.warmSandstone : ASHLAR_TONES.greyGranite;
  const dressing = STONE_TONES.portland;

  offset = pushLotMass(offset, lot, { front, depth, along, length, top: height, color: ashlar, material: MATERIAL.ASHLAR, variant: 0.2 });
  for (let band = 1; band <= 4; band++) {
    offset = pushLotBox(offset, lot, { lateral: front - 0.06, along, bottom: band * (height / 5.0), height: 0.35, across: 0.24, length: length + 0.1, color: dressing, material: MATERIAL.STONE, variant: 0.1 });
  }
  for (const end of [-1, 1]) {
    offset = pushVictorianEndBay(offset, lot, { end, front, along, length, height, dressing });
  }
  offset = pushLotFacadeWindowGrid(offset, lot, { faceLateral: front, along, firstFloor: 4.2, floorCount: 4, floorHeight: height / 5.0, columnCount: 3, bayWidth: length * 0.42, windowWidth: 0.9, windowHeight: 1.7, frameColor: dressing });
  offset = pushLotCornice(offset, lot, { front, depth, along, length, height, thickness: 0.5, overhang: 0.3, color: dressing });
  const roofBase = lotPoint(lot, front + depth * 0.5, along, height + 0.5);
  offset = pushFlatConcreteRoof(lot.vertices, offset, { x: roofBase[0], y: roofBase[1], z: roofBase[2], halfAcross: length * 0.5, halfAlong: depth * 0.5, yaw: lot.yaw + Math.PI * 0.5 });
  offset = pushLotBox(offset, lot, { lateral: front - 0.15, along, bottom: 0.18, height: 3.6, across: 0.4, length: 2.8, color: dressing, material: MATERIAL.STONE, variant: 0.1 });
  return pushLotBox(offset, lot, { lateral: front - 0.3, along, bottom: 0.18, height: 2.8, across: 0.2, length: 1.6, color: [0.10, 0.07, 0.06], material: MATERIAL.METAL, occlusion: 0.9 });
}

function pushVictorianEndBay(offset, lot, { end, front, along, length, height, dressing }) {
  offset = pushLotBox(offset, lot, { lateral: front - 0.05, along: along + end * (length * 0.5 - 0.35), bottom: 0, height, across: 0.3, length: 0.75, color: dressing, material: MATERIAL.STONE, variant: 0.1 });
  const bayAlong = along + end * length * 0.25;
  offset = pushLotMass(offset, lot, { front: front - 1.2, depth: 1.3, along: bayAlong, length: 3.2, bottom: 0.6, top: height - 2.4, color: STONE_TONES.sandstone, variant: 0.62 });
  const bayRoof = lotPoint(lot, front - 0.55, bayAlong, height - 2.4);
  offset = pushFlatConcreteRoof(lot.vertices, offset, { x: bayRoof[0], y: bayRoof[1], z: bayRoof[2], halfAcross: 0.75, halfAlong: 1.7, yaw: lot.yaw });
  const dormerBase = lotPoint(lot, front + 1.4, bayAlong, height + 0.5);
  return pushFlatConcreteRoof(lot.vertices, offset, { x: dormerBase[0], y: dormerBase[1], z: dormerBase[2], halfAcross: 1.4, halfAlong: 1.8, yaw: lot.yaw });
}

function pushCastIronLoft(offset, lot, place) {
  const paintChoices = [[0.86, 0.82, 0.72], [0.72, 0.74, 0.74], [0.62, 0.68, 0.60], [0.80, 0.72, 0.62]];
  const paint = paintChoices[Math.floor(lot.secondarySeed * paintChoices.length) % paintChoices.length];
  const ironTrim = [paint[0] * 0.82, paint[1] * 0.82, paint[2] * 0.82];
  const front = lotFrontLateral(lot, 10.8);
  const depth = 13.0;
  const length = place.length - 0.4;
  const along = place.along;
  const floorCount = 5 + Math.floor(lot.primarySeed * 2);
  const floorHeight = 4.0;
  const height = floorCount * floorHeight + 0.6;

  offset = pushLotMass(offset, lot, { front, depth, along, length, top: height, color: paint, variant: 0.62 });
  const pilasterCount = 6;
  for (let pilaster = 0; pilaster < pilasterCount; pilaster++) {
    offset = pushLotBox(offset, lot, { lateral: front - 0.15, along: along + (pilaster / (pilasterCount - 1) - 0.5) * (length - 0.6), bottom: 0, height: height - 0.4, across: 0.35, length: 0.45, color: ironTrim, material: MATERIAL.METAL, occlusion: 0.95 });
  }
  for (let floor = 1; floor < floorCount; floor++) {
    offset = pushLotBox(offset, lot, { lateral: front - 0.12, along, bottom: floor * floorHeight, height: 0.32, across: 0.28, length, color: ironTrim, material: MATERIAL.METAL, occlusion: 0.95 });
  }
  offset = pushLotCornice(offset, lot, { front, depth, along, length, height, thickness: 1.3, overhang: 0.6, color: ironTrim });
  offset = pushLotBox(offset, lot, { lateral: front - 0.05, along, bottom: 0.2, height: 3.1, across: 0.15, length: length - 2.0, color: [1.0, 0.84, 0.58], material: MATERIAL.GLOW, occlusion: 1.0 });
  offset = pushLotBox(offset, lot, { lateral: front - 0.75, along, bottom: 3.3, height: 0.18, across: 1.5, length: length - 1.4, color: lot.primarySeed > 0.5 ? [0.16, 0.30, 0.22] : [0.48, 0.12, 0.14], material: MATERIAL.STONE, variant: 0.1 });
  return pushFireEscape(offset, lot, { front, escapeAlong: along + length * 0.18, floorCount, floorHeight });
}

function pushFireEscape(offset, lot, { front, escapeAlong, floorCount, floorHeight }) {
  return withDetailGeometry(() => {
    for (let floor = 1; floor < floorCount; floor++) {
      const platformHeight = floor * floorHeight + 0.4;
      offset = pushLotBox(offset, lot, { lateral: front - 0.6, along: escapeAlong, bottom: platformHeight, height: 0.08, across: 1.1, length: 5.2, color: STONE_TONES.ironBlack, material: MATERIAL.METAL, occlusion: 0.85 });
      offset = pushLotBox(offset, lot, { lateral: front - 1.12, along: escapeAlong, bottom: platformHeight, height: 1.0, across: 0.05, length: 5.2, color: STONE_TONES.ironBlack, material: MATERIAL.METAL, occlusion: 0.85 });
      const ladderCenter = lotPoint(lot, front - 0.45, escapeAlong, platformHeight - floorHeight * 0.5);
      offset = pushBox(lot.vertices, offset, { center: ladderCenter, size: [0.55, 0.08, Math.hypot(4.0, floorHeight)], yaw: lot.yaw, pitch: (floor % 2 === 0 ? 1 : -1) * Math.atan2(floorHeight, 4.0), color: STONE_TONES.ironBlack, material: MATERIAL.METAL, occlusion: 0.85 });
    }
    return offset;
  });
}

function pushGothicClockTower(offset, lot, place) {
  const stone = lot.secondarySeed > 0.5 ? STONE_TONES.sandstone : [0.58, 0.56, 0.52];
  const trim = [stone[0] * 0.78, stone[1] * 0.78, stone[2] * 0.78];
  const front = lotFrontLateral(lot, 11.6);
  const depth = 13.0;
  const length = place.length - 0.6;
  const along = place.along;
  const hallHeight = 12.0 + lot.primarySeed * 3.0;
  const towerSize = 6.0;
  const towerFront = front - 1.0;
  const towerAlong = along + (lot.primarySeed > 0.5 ? 1 : -1) * (length * 0.5 - towerSize * 0.5);
  const towerTop = hallHeight + 22.0 + lot.secondarySeed * 14.0;
  const tower = { towerFront, towerAlong, towerSize, towerTop };

  offset = pushLotMass(offset, lot, { front, depth, along, length, top: hallHeight, color: stone, variant: 0.55 });
  const hallRoof = lotPoint(lot, front + depth * 0.5, along, hallHeight);
  offset = pushFlatConcreteRoof(lot.vertices, offset, { x: hallRoof[0], y: hallRoof[1], z: hallRoof[2], halfAcross: length * 0.5, halfAlong: depth * 0.5 + 0.3, yaw: lot.yaw + Math.PI * 0.5 });
  offset = pushLotMass(offset, lot, { front: towerFront, depth: towerSize, along: towerAlong, length: towerSize, top: towerTop, color: stone, variant: 0.1 });
  offset = pushClockTowerPinnacles(offset, lot, tower, trim);
  offset = pushClockFaces(offset, lot, tower);
  const spireBase = lotPoint(lot, towerFront + towerSize * 0.5, towerAlong, towerTop);
  offset = pushFlatConcreteRoof(lot.vertices, offset, { x: spireBase[0], y: spireBase[1], z: spireBase[2], halfAcross: towerSize * 0.5 + 0.4, halfAlong: towerSize * 0.5 + 0.4, yaw: lot.yaw });
  const porchBase = lotPoint(lot, towerFront - 0.6, towerAlong, 4.2);
  offset = pushFlatConcreteRoof(lot.vertices, offset, { x: porchBase[0], y: porchBase[1], z: porchBase[2], halfAcross: 0.7, halfAlong: 1.6, yaw: lot.yaw });
  return pushLotBox(offset, lot, { lateral: towerFront - 0.12, along: towerAlong, bottom: 0.18, height: 4.0, across: 0.2, length: 2.2, color: [0.18, 0.10, 0.06], material: MATERIAL.WOOD, occlusion: 0.9 });
}

function pushClockTowerPinnacles(offset, lot, { towerFront, towerAlong, towerSize, towerTop }, trim) {
  for (const corner of [[0, -1], [0, 1], [1, -1], [1, 1]]) {
    offset = pushLotBox(offset, lot, { lateral: towerFront + corner[0] * towerSize, along: towerAlong + corner[1] * towerSize * 0.5, bottom: 0, height: towerTop * 0.82, across: 0.9, length: 0.9, color: trim, material: MATERIAL.STONE, variant: 0.1 });
    const pinnacleBase = lotPoint(lot, towerFront + corner[0] * towerSize, towerAlong + corner[1] * towerSize * 0.5, towerTop);
    offset = pushFlatConcreteRoof(lot.vertices, offset, { x: pinnacleBase[0], y: pinnacleBase[1], z: pinnacleBase[2], halfAcross: 0.6, halfAlong: 0.6, yaw: lot.yaw });
  }
  return offset;
}

function pushClockFaces(offset, lot, { towerFront, towerAlong, towerSize, towerTop }) {
  const clockHeight = towerTop - 5.5;
  offset = pushLotBox(offset, lot, { lateral: towerFront - 0.08, along: towerAlong, bottom: clockHeight, height: 3.0, across: 0.2, length: 3.0, color: [1.0, 0.94, 0.78], material: MATERIAL.GLOW, occlusion: 1.0 });
  offset = pushLotBox(offset, lot, { lateral: towerFront - 0.22, along: towerAlong, bottom: clockHeight + 1.45, height: 1.2, across: 0.08, length: 0.12, color: STONE_TONES.ironBlack, material: MATERIAL.METAL, occlusion: 1.0 });
  offset = pushLotBox(offset, lot, { lateral: towerFront + towerSize * 0.5, along: towerAlong, bottom: clockHeight, height: 3.0, across: 3.0, length: towerSize + 0.16, color: [1.0, 0.94, 0.78], material: MATERIAL.GLOW, occlusion: 1.0 });
  return pushLotBox(offset, lot, { lateral: towerFront - 0.06, along: towerAlong, bottom: clockHeight - 6.0, height: 4.2, across: 0.2, length: 1.6, color: [0.08, 0.08, 0.09], material: MATERIAL.METAL, occlusion: 0.9 });
}

function pushBronzeGlassTower(offset, lot, place) {
  const glass = lot.secondarySeed > 0.5 ? [0.20, 0.26, 0.32] : [0.24, 0.30, 0.30];
  const marble = MARBLE_TONES[2];
  const front = lotFrontLateral(lot, 14.0);
  const depth = 12.0;
  const length = place.length - 1.0;
  const along = place.along;
  const top = 70.0 + lot.primarySeed * 70.0;
  const lobbyHeight = 7.0;

  offset = pushLotMass(offset, lot, { front: front + 2.2, depth: depth - 2.2, along, length: length - 3.0, bottom: -FOUNDATION_DEPTH, top: lobbyHeight, color: [0.30, 0.27, 0.22], material: MATERIAL.METAL, variant: 0.3, occlusion: 0.95 });
  offset = pushLotBox(offset, lot, { lateral: front + 2.1, along, bottom: 0.6, height: 4.6, across: 0.12, length: length - 5.0, color: [0.86, 0.74, 0.54], material: MATERIAL.GLOW, occlusion: 1.0 });
  offset = pushLotMass(offset, lot, { front, depth, along, length, bottom: lobbyHeight, top, color: glass, material: MATERIAL.METAL, variant: 0.3 });
  for (let column = 0; column < 5; column++) {
    offset = pushLotBox(offset, lot, { lateral: front + 0.6, along: along + (column - 2) * (length / 5), bottom: 0.18, height: lobbyHeight, across: 0.9, length: 0.9, color: marble, material: MATERIAL.MARBLE, variant: 0.1 });
  }
  offset = pushCurtainWallGrid(offset, lot, { front, along, length, lobbyHeight, top });
  offset = pushLotCornice(offset, lot, { front, depth, along, length, height: top, thickness: 2.4, overhang: 0.1, color: STONE_TONES.bronze });
  return pushReflectingPool(offset, lot, { poolLateral: front - 4.0, along, length });
}

function pushCurtainWallGrid(offset, lot, { front, along, length, lobbyHeight, top }) {
  const bronze = STONE_TONES.bronze;
  const mullionCount = 7;
  for (let mullion = 0; mullion < mullionCount; mullion++) {
    offset = pushLotBox(offset, lot, { lateral: front - 0.2, along: along + (mullion / (mullionCount - 1) - 0.5) * (length - 0.4), bottom: lobbyHeight, height: top - lobbyHeight, across: 0.4, length: 0.22, color: bronze, material: MATERIAL.METAL, occlusion: 0.95 });
  }
  for (let band = 1; band <= 4; band++) {
    offset = pushLotBox(offset, lot, { lateral: front - 0.1, along, bottom: lobbyHeight + band * (top - lobbyHeight) / 5, height: 0.6, across: 0.24, length: length + 0.1, color: bronze, material: MATERIAL.METAL, occlusion: 0.95 });
  }
  return offset;
}

function pushReflectingPool(offset, lot, { poolLateral, along, length }) {
  offset = pushLotBox(offset, lot, { lateral: poolLateral, along, bottom: 0, height: 0.5, across: 3.0, length: length * 0.7, color: STONE_TONES.granite, material: MATERIAL.STONE, variant: 0.1 });
  return pushLotBox(offset, lot, { lateral: poolLateral, along, bottom: 0.5, height: 0.1, across: 2.5, length: length * 0.66, color: [0.16, 0.48, 0.66], material: MATERIAL.WATER, variant: 0.85, occlusion: 1.5 });
}
