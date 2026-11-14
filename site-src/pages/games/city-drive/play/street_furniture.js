// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const SIDEWALK_LAMP_SLOT_PERIOD = 3;
const SIDEWALK_LAMP_SLOT_PHASE = 1;
const SIDEWALK_LAMP_POLE_FROM_CURB_METERS = 1.42;
const SIDEWALK_LAMP_HEAD_REACH_METERS = 1.05;
const SIDEWALK_LAMP_HEAD_HEIGHT_METERS = 4.38;

const MARBLE_BENCH = Object.freeze({ lengthMeters: 2.1, seatDepthMeters: 0.56, seatThicknessMeters: 0.12, seatHeightMeters: 0.46, legInsetMeters: 0.32, legThicknessMeters: 0.18 });
const MARBLE_BENCH_TONES = Object.freeze({ seat: [0.91, 0.90, 0.87], leg: [0.60, 0.59, 0.56] });

function pushSidewalkFurniture(offset, lot) {
  const { inBlockIdx } = lot;
  if (isSidewalkLampSlot(inBlockIdx)) {
    return pushSidewalkStreetLamp(offset, lot);
  }
  return offset;
}

function pushManhattanTrafficSignal(vertices, offset, x, y, z, yaw, side, roadHalfWidth = 5.6) {
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  const poleLateral = (roadHalfWidth + 1.8) * side;
  const poleX = x + rightX * poleLateral;
  const poleZ = z + rightZ * poleLateral;
  const nycYellow = [0.92, 0.70, 0.15];

  offset = pushBox(vertices, offset, {
    center: [poleX, y + 2.2, poleZ],
    size: [0.30, 9.2, 0.30],
    yaw,
    color: nycYellow,
    material: MATERIAL.METAL,
    occlusion: 0.95
  });
  const armCenterX = x + rightX * (side * (roadHalfWidth - 1.2));
  const armCenterZ = z + rightZ * (side * (roadHalfWidth - 1.2));
  offset = pushBox(vertices, offset, {
    center: [armCenterX, y + 6.4, armCenterZ],
    size: [6.6, 0.22, 0.22],
    yaw,
    color: nycYellow,
    material: MATERIAL.METAL,
    occlusion: 0.95
  });
  return pushTrafficSignalHead(vertices, offset, armCenterX, y, armCenterZ, yaw);
}

function pushMarbleBench(vertices, offset, { base, yaw }) {
  const bench = MARBLE_BENCH;
  const [x, y, z] = base;
  const seatCenterY = y + bench.seatHeightMeters - bench.seatThicknessMeters * 0.5;
  const legHeight = bench.seatHeightMeters - bench.seatThicknessMeters;
  for (const end of [-1, 1]) {
    const legAlong = end * (bench.lengthMeters * 0.5 - bench.legInsetMeters);
    const legCenter = transformPoint(0, legHeight * 0.5, legAlong, x, y, z, yaw, 0, 0);
    offset = pushBox(vertices, offset, { center: legCenter, size: [bench.seatDepthMeters - 0.08, legHeight, bench.legThicknessMeters], yaw, color: MARBLE_BENCH_TONES.leg, material: MATERIAL.STONE, occlusion: 0.9, variant: 0.1 });
  }
  registerObstacle("barrier", x, z, bench.seatDepthMeters + 0.2, bench.lengthMeters + 0.2, yaw);
  return pushBox(vertices, offset, { center: [x, seatCenterY, z], size: [bench.seatDepthMeters, bench.seatThicknessMeters, bench.lengthMeters], yaw, color: MARBLE_BENCH_TONES.seat, material: MATERIAL.MARBLE, occlusion: 1.0, variant: 0.1 });
}

function isSidewalkLampSlot(inBlockIdx) {
  return inBlockIdx % SIDEWALK_LAMP_SLOT_PERIOD === SIDEWALK_LAMP_SLOT_PHASE;
}

function pushSidewalkStreetLamp(offset, lot) {
  const { vertices, x, y, z, yaw, side, roadHalfWidth, rightX, rightZ, shiftLateral } = lot;
  const lampLateral = (roadHalfWidth + SIDEWALK_LAMP_POLE_FROM_CURB_METERS) * side;
  const lampX = x + rightX * lampLateral;
  const lampZ = z + rightZ * lampLateral;
  const lampArmDirection = -side;
  offset = pushBox(vertices, offset, {
    center: [lampX, y + 2.1, lampZ],
    size: [0.20, 5.2, 0.20],
    yaw,
    color: [0.18, 0.20, 0.22],
    material: MATERIAL.METAL,
    occlusion: 0.92
  });
  offset = pushBox(vertices, offset, {
    center: [lampX + rightX * (lampArmDirection * 0.55), y + 4.55, lampZ + rightZ * (lampArmDirection * 0.55)],
    size: [1.25, 0.14, 0.16],
    yaw,
    color: [0.18, 0.20, 0.22],
    material: MATERIAL.METAL,
    occlusion: 0.95
  });
  offset = pushBox(vertices, offset, {
    center: [lampX + rightX * (lampArmDirection * SIDEWALK_LAMP_HEAD_REACH_METERS), y + SIDEWALK_LAMP_HEAD_HEIGHT_METERS, lampZ + rightZ * (lampArmDirection * SIDEWALK_LAMP_HEAD_REACH_METERS)],
    size: [0.52, 0.28, 0.42],
    yaw,
    color: [1.0, 0.88, 0.58],
    material: MATERIAL.GLOW,
    occlusion: 1.0
  });
  if (lot.district.groundCover === GROUND_COVER.lawn) return offset;
  const sconceLateral = (10.8 + shiftLateral) * side;
  return pushBox(vertices, offset, {
    center: [x + rightX * sconceLateral, y + 3.2, z + rightZ * sconceLateral],
    size: [0.26, 0.42, 0.85],
    yaw,
    color: [1.0, 0.84, 0.52],
    material: MATERIAL.GLOW,
    occlusion: 1.0
  });
}

function pushTrafficSignalHead(vertices, offset, armCenterX, y, armCenterZ, yaw) {
  offset = pushBox(vertices, offset, {
    center: [armCenterX, y + 5.85, armCenterZ],
    size: [0.42, 0.95, 0.42],
    yaw,
    color: [0.18, 0.20, 0.22],
    material: MATERIAL.METAL,
    occlusion: 0.9
  });
  offset = pushBox(vertices, offset, {
    center: [armCenterX, y + 5.62, armCenterZ],
    size: [0.28, 0.28, 0.48],
    yaw,
    color: [0.22, 0.98, 0.48],
    material: MATERIAL.GLOW,
    occlusion: 1.0
  });
  return pushBox(vertices, offset, {
    center: [armCenterX, y + 6.08, armCenterZ],
    size: [0.28, 0.28, 0.48],
    yaw,
    color: [1.0, 0.24, 0.20],
    material: MATERIAL.GLOW,
    occlusion: 1.0
  });
}
