// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const STREET_CORNER_SEGMENT_IN_BLOCK = 3;
const CURB_SETBACK = 1.55;
const STREET_CLOCK_CHANCE = 0.5;
const STREET_CLOCK_ALONG_METERS = 2.1;

const STREET_CORNER_TONES = Object.freeze({
  plinthMarble: [0.88, 0.87, 0.84],
  clockFace: [1.0, 0.95, 0.80]
});

function pushStreetCorner(offset, lot) {
  if (lot.inBlockIdx !== STREET_CORNER_SEGMENT_IN_BLOCK) return offset;
  const blockNumber = Math.floor(lot.segIndex / MANHATTAN_BLOCK_PERIOD);
  const cornerRoll = seededRandom(blockNumber * 13.1 + lot.side * 4.7);
  if (cornerRoll > STREET_CLOCK_CHANCE) return offset;
  return pushStreetClockCorner(offset, lot, lot.roadHalfWidth + CURB_SETBACK);
}

function pushSidewalkBox(offset, lot, { lateral, along = 0, bottom, height, across, length, color, material, variant = 0.1, occlusion = 0.95 }) {
  return pushLotBox(offset, lot, { lateral, along, bottom: LOT_GROUND + bottom, height, across, length, color, material, variant, occlusion });
}

function pushStreetClockCorner(offset, lot, curbLateral) {
  return withDetailGeometry(() => {
    const along = STREET_CLOCK_ALONG_METERS;
    const clockPoint = lotPoint(lot, curbLateral, along);
    offset = pushSidewalkBox(offset, lot, { lateral: curbLateral, along, bottom: 0, height: 0.7, across: 0.6, length: 0.6, color: STREET_CORNER_TONES.plinthMarble, material: MATERIAL.MARBLE });
    offset = pushOctagonalPrism(lot.vertices, offset, { x: clockPoint[0], y: clockPoint[1], z: clockPoint[2], bottom: LOT_GROUND + 0.7, top: LOT_GROUND + 3.6, radius: 0.12, sideCount: 6, color: STONE_TONES.ironBlack, material: MATERIAL.METAL });
    offset = pushSidewalkBox(offset, lot, { lateral: curbLateral, along, bottom: 3.6, height: 0.95, across: 0.42, length: 0.95, color: STONE_TONES.ironBlack, material: MATERIAL.METAL });
    return pushSidewalkBox(offset, lot, { lateral: curbLateral, along, bottom: 3.7, height: 0.75, across: 0.46, length: 0.75, color: STREET_CORNER_TONES.clockFace, material: MATERIAL.GLOW, occlusion: 1.0 });
  });
}
