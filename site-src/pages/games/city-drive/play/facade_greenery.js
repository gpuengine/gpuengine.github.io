// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const LAWN_GREEN = Object.freeze([0.24, 0.50, 0.24]);

function pushLawn(offset, lot, { lateral, along, across, length }) {
  return pushLotBox(offset, lot, { lateral, along, bottom: -0.1, height: 0.36, across, length, color: LAWN_GREEN, material: MATERIAL.TERRAIN, variant: 0.25, occlusion: 0.97 });
}

function plantLotTree(lot, { lateral, along, speciesNames, heightScale = 1, maxCrownRadiusMeters, salt }) {
  const point = lotPoint(lot, lateral, along, LOT_GROUND);
  const pickSeed = seededRandom(lot.segIndex * 17.3 + lot.side * 3.1 + salt * 7.7);
  const choice = chooseTreeFromSpecies(speciesNames, { pickSeed, heightSeed: seededRandom(lot.segIndex * 5.9 + salt * 2.3) });
  plantStreetTree({ x: point[0], y: point[1], z: point[2], ...choice, heightMeters: choice.heightMeters * heightScale, maxCrownRadiusMeters, seed: pickSeed });
}
