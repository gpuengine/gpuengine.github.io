// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const BRUTALIST_TOWER = Object.freeze({
  frontLateralMeters: 11.0,
  depthMeters: 13.0,
  shaftLengthMeters: 11.0,
  crownLengthMeters: 14.0,
  crownProjectionMeters: 1.5,
  crownStoreyCount: 3,
  lobbyHeightMeters: 4.6,
  lobbyRecessMeters: 2.0,
  storeyHeightMeters: 3.6,
  lowestStoreyCount: 12,
  storeyCountRange: 13,
  pilotisWidthMeters: 0.9,
  floorFinProjectionMeters: 0.6,
  floorFinThicknessMeters: 0.45,
  mullionFinCount: 3,
  mullionFinWidthMeters: 0.5,
  serviceCoreWidthMeters: 4.0,
  serviceCoreDepthMeters: 2.6,
  serviceCoreRiseMeters: 2.4
});

const BRUTALIST_CONCRETE_TONES = Object.freeze([
  [0.60, 0.59, 0.56],
  [0.52, 0.52, 0.51],
  [0.66, 0.63, 0.58]
]);

const BRUTALIST_LOBBY_GLOW = Object.freeze([0.95, 0.80, 0.56]);

function pushBrutalistTower(offset, lot, place) {
  const tower = describeBrutalistTower(lot, place);
  offset = pushBrutalistLobby(offset, lot, tower);
  offset = pushBrutalistShaft(offset, lot, tower);
  offset = pushBrutalistFloorFins(offset, lot, tower);
  offset = pushBrutalistMullionFins(offset, lot, tower);
  offset = pushBrutalistCrown(offset, lot, tower);
  return pushBrutalistServiceCore(offset, lot, tower);
}

function brutalistTowerHeight(lot) {
  const storeyCount = BRUTALIST_TOWER.lowestStoreyCount + Math.floor(lot.primarySeed * BRUTALIST_TOWER.storeyCountRange);
  return BRUTALIST_TOWER.lobbyHeightMeters + storeyCount * BRUTALIST_TOWER.storeyHeightMeters;
}

function describeBrutalistTower(lot, place) {
  const height = brutalistTowerHeight(lot);
  return {
    front: lotFrontLateral(lot, BRUTALIST_TOWER.frontLateralMeters),
    along: place.along,
    height,
    crownBottom: height - BRUTALIST_TOWER.crownStoreyCount * BRUTALIST_TOWER.storeyHeightMeters,
    concrete: pickFromList(BRUTALIST_CONCRETE_TONES, lot.secondarySeed)
  };
}

function pushBrutalistLobby(offset, lot, { front, along, concrete }) {
  const { depthMeters, shaftLengthMeters, lobbyHeightMeters, lobbyRecessMeters, pilotisWidthMeters } = BRUTALIST_TOWER;
  offset = pushLotMass(offset, lot, { front: front + lobbyRecessMeters, depth: depthMeters - lobbyRecessMeters, along, length: shaftLengthMeters - 1.0, top: lobbyHeightMeters, color: STONE_TONES.darkGlass, material: MATERIAL.METAL, variant: 0.3 });
  offset = pushLotBox(offset, lot, { lateral: front + lobbyRecessMeters - 0.06, along, bottom: 0.4, height: 3.2, across: 0.1, length: shaftLengthMeters - 3.0, color: BRUTALIST_LOBBY_GLOW, material: MATERIAL.GLOW, occlusion: 1.0 });
  for (const pilotisAlong of [-1, 0, 1]) {
    offset = pushLotBox(offset, lot, { lateral: front + pilotisWidthMeters * 0.5, along: along + pilotisAlong * (shaftLengthMeters * 0.5 - pilotisWidthMeters * 0.5), bottom: 0, height: lobbyHeightMeters, across: pilotisWidthMeters, length: pilotisWidthMeters, color: concrete, material: MATERIAL.PLASTER, variant: PLASTER_PANEL_VARIANT });
  }
  return offset;
}

function pushBrutalistShaft(offset, lot, { front, along, crownBottom, concrete }) {
  const { depthMeters, shaftLengthMeters, lobbyHeightMeters } = BRUTALIST_TOWER;
  offset = pushLotMass(offset, lot, { front, depth: depthMeters, along, length: shaftLengthMeters, bottom: lobbyHeightMeters, top: crownBottom, color: concrete, material: MATERIAL.PLASTER, variant: PLASTER_PANEL_VARIANT });
  return pushLotBox(offset, lot, { lateral: front - 0.05, along, bottom: lobbyHeightMeters + 0.6, height: crownBottom - lobbyHeightMeters - 1.2, across: 0.12, length: shaftLengthMeters - 1.4, color: STONE_TONES.darkGlass, material: MATERIAL.METAL, variant: 0.3 });
}

function pushBrutalistFloorFins(offset, lot, { front, along, crownBottom, concrete }) {
  const { shaftLengthMeters, lobbyHeightMeters, storeyHeightMeters, floorFinProjectionMeters, floorFinThicknessMeters } = BRUTALIST_TOWER;
  for (let finBottom = lobbyHeightMeters; finBottom < crownBottom - storeyHeightMeters * 0.5; finBottom += storeyHeightMeters) {
    offset = pushLotBox(offset, lot, { lateral: front - floorFinProjectionMeters * 0.5 + 0.05, along, bottom: finBottom, height: floorFinThicknessMeters, across: floorFinProjectionMeters + 0.1, length: shaftLengthMeters, color: concrete, material: MATERIAL.PLASTER, variant: PLASTER_PANEL_VARIANT, occlusion: 1.0 });
  }
  return offset;
}

function pushBrutalistMullionFins(offset, lot, { front, along, crownBottom, concrete }) {
  const { shaftLengthMeters, lobbyHeightMeters, floorFinProjectionMeters, mullionFinCount, mullionFinWidthMeters } = BRUTALIST_TOWER;
  const finSpacing = (shaftLengthMeters - mullionFinWidthMeters) / (mullionFinCount - 1);
  for (let fin = 0; fin < mullionFinCount; fin++) {
    const finAlong = along - (shaftLengthMeters - mullionFinWidthMeters) * 0.5 + fin * finSpacing;
    offset = pushLotBox(offset, lot, { lateral: front - floorFinProjectionMeters * 0.5 + 0.05, along: finAlong, bottom: lobbyHeightMeters, height: crownBottom - lobbyHeightMeters, across: floorFinProjectionMeters + 0.1, length: mullionFinWidthMeters, color: concrete, material: MATERIAL.PLASTER, variant: PLASTER_PANEL_VARIANT, occlusion: 0.98 });
  }
  return offset;
}

function pushBrutalistCrown(offset, lot, { front, along, height, crownBottom, concrete }) {
  const { depthMeters, crownLengthMeters, crownProjectionMeters } = BRUTALIST_TOWER;
  const crownFront = front - crownProjectionMeters;
  const crownDepth = depthMeters + crownProjectionMeters;
  offset = pushLotMass(offset, lot, { front: crownFront, depth: crownDepth, along, length: crownLengthMeters, bottom: crownBottom, top: height, color: concrete, material: MATERIAL.PLASTER, variant: PLASTER_PANEL_VARIANT });
  offset = pushLotBox(offset, lot, { lateral: crownFront - 0.05, along, bottom: crownBottom + 4.2, height: 1.6, across: 0.12, length: crownLengthMeters - 2.4, color: STONE_TONES.darkGlass, material: MATERIAL.METAL, variant: 0.3 });
  const roofCenter = lotPoint(lot, crownFront + crownDepth * 0.5, along, height);
  return pushFlatConcreteRoof(lot.vertices, offset, { x: roofCenter[0], y: roofCenter[1], z: roofCenter[2], halfAcross: crownDepth * 0.5, halfAlong: crownLengthMeters * 0.5, yaw: lot.yaw, color: concrete });
}

function pushBrutalistServiceCore(offset, lot, { front, along, height, concrete }) {
  const { depthMeters, serviceCoreWidthMeters, serviceCoreDepthMeters, serviceCoreRiseMeters } = BRUTALIST_TOWER;
  const coreColor = [concrete[0] * 0.88, concrete[1] * 0.88, concrete[2] * 0.88];
  return pushLotMass(offset, lot, { front: front + depthMeters, depth: serviceCoreDepthMeters, along, length: serviceCoreWidthMeters, top: height + serviceCoreRiseMeters, color: coreColor, material: MATERIAL.PLASTER, variant: PLASTER_PANEL_VARIANT });
}
