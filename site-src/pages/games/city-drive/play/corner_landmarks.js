// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const BODEGA_STOREY_HEIGHT_METERS = 3.2;
const AWNING_STRIPE_TONES = Object.freeze([
  [[0.20, 0.32, 0.24], [0.86, 0.84, 0.76]],
  [[0.46, 0.16, 0.16], [0.86, 0.84, 0.76]],
  [[0.18, 0.24, 0.36], [0.82, 0.76, 0.56]]
]);
const CAFE_UMBRELLA_TONES = Object.freeze([[0.62, 0.30, 0.24], [0.86, 0.84, 0.76], [0.26, 0.38, 0.34]]);

function cornerPoint(corner, { toward = 0, sideways = 0, height = 0 }) {
  const { x, y, z, yaw } = corner;
  return [
    x + Math.sin(yaw) * toward + Math.cos(yaw) * sideways,
    y + height,
    z + Math.cos(yaw) * toward - Math.sin(yaw) * sideways
  ];
}

function pushCornerBox(offset, corner, { toward = 0, sideways = 0, bottom, height, depth, width, color, material = MATERIAL.STONE, variant = 0.1, occlusion = 0.96 }) {
  const center = cornerPoint(corner, { toward, sideways, height: bottom + height * 0.5 });
  return pushBox(corner.vertices, offset, { center, size: [width, height, depth], yaw: corner.yaw, color, material, variant, occlusion });
}

function pushCornerBank(offset, corner, rng) {
  const { size } = corner;
  const halfSize = size * 0.5;
  const marble = MARBLE_TONES[Math.floor(rng() * MARBLE_TONES.length) % MARBLE_TONES.length];
  const bodyHeight = 13 + rng() * 6;
  const podiumHeight = 1.0;
  offset = pushCornerBox(offset, corner, { bottom: -4, height: bodyHeight + 4, depth: size, width: size, color: STONE_TONES.paleLimestone, variant: 0.55 });
  offset = pushCornerBox(offset, corner, { toward: halfSize + 1.4, bottom: -1, height: podiumHeight + 1, depth: 2.8, width: size * 0.8, color: marble, material: MATERIAL.MARBLE });
  const columnCount = 4;
  for (let column = 0; column < columnCount; column++) {
    const base = cornerPoint(corner, { toward: halfSize + 1.6, sideways: (column / (columnCount - 1) - 0.5) * size * 0.66, height: podiumHeight });
    offset = pushRoundColumn(corner.vertices, offset, { x: base[0], y: base[1], z: base[2], height: bodyHeight * 0.62, radius: 0.42, yaw: corner.yaw, color: marble, material: MATERIAL.MARBLE });
  }
  const entablatureBottom = podiumHeight + bodyHeight * 0.62;
  offset = pushCornerBox(offset, corner, { toward: halfSize + 1.0, bottom: entablatureBottom, height: 1.1, depth: 2.4, width: size * 0.82, color: marble, material: MATERIAL.MARBLE });
  const pediment = cornerPoint(corner, { toward: halfSize + 1.0, height: entablatureBottom + 1.1 });
  offset = pushFlatConcreteRoof(corner.vertices, offset, { x: pediment[0], y: pediment[1], z: pediment[2], halfAcross: 1.2, halfAlong: size * 0.41, yaw: corner.yaw + Math.PI * 0.5, color: marble });
  offset = pushCornerBox(offset, corner, { toward: halfSize + 0.05, bottom: podiumHeight, height: 4.2, depth: 0.2, width: 2.6, color: STONE_TONES.bronze, material: MATERIAL.METAL });
  offset = pushCornerBox(offset, corner, { toward: halfSize + 0.1, bottom: podiumHeight + 4.5, height: 0.6, depth: 0.12, width: 4.0, color: GILDED_SIGN_GLOW, material: MATERIAL.GLOW, occlusion: 1.0 });
  offset = pushCornerBox(offset, corner, { bottom: bodyHeight, height: 0.9, depth: size + 0.8, width: size + 0.8, color: marble, material: MATERIAL.MARBLE });
  const drum = cornerPoint(corner, { height: bodyHeight + 0.9 });
  offset = pushOctagonalPrism(corner.vertices, offset, { x: drum[0], y: drum[1], z: drum[2], bottom: 0, top: 2.6, radius: size * 0.24, color: STONE_TONES.paleLimestone, material: MATERIAL.STONE });
  return pushFlatConcreteRoof(corner.vertices, offset, { x: drum[0], y: drum[1] + 2.6, z: drum[2], halfAcross: size * 0.26, halfAlong: size * 0.26, yaw: corner.yaw });
}

function pushCornerBodega(offset, corner, rng) {
  const { size } = corner;
  const halfSize = size * 0.5;
  const storeys = 4 + Math.floor(rng() * 2);
  const bodyHeight = storeys * BODEGA_STOREY_HEIGHT_METERS + 1.4;
  const ashlar = [ASHLAR_TONES.warmSandstone, ASHLAR_TONES.greyGranite, ASHLAR_TONES.ivoryMarble, ASHLAR_TONES.travertine][Math.floor(rng() * 4) % 4];
  const trim = [0.86, 0.84, 0.78];
  const [awningTone, stripeTone] = AWNING_STRIPE_TONES[Math.floor(rng() * AWNING_STRIPE_TONES.length) % AWNING_STRIPE_TONES.length];
  offset = pushCornerBox(offset, corner, { bottom: -4, height: bodyHeight + 4, depth: size, width: size, color: ashlar, material: MATERIAL.ASHLAR, variant: 0.2 });
  offset = pushCornerBox(offset, corner, { bottom: bodyHeight, height: 0.8, depth: size + 0.9, width: size + 0.9, color: trim, variant: 0.1 });
  const faces = cornerStreetFaces(corner);
  for (const face of faces) {
    offset = pushCornerStorefront(offset, corner, face, { awningTone, stripeTone });
    offset = pushCornerFaceWindows(offset, corner, face, { storeys });
  }
  offset = pushCornerFireEscape(offset, corner, faces[1], storeys);
  const tank = cornerPoint(corner, { toward: -halfSize * 0.4, sideways: halfSize * 0.3 });
  return pushRooftopWaterTank(offset, corner, { x: tank[0], roofY: corner.y + bodyHeight + 0.8, z: tank[2], standColor: [0.30, 0.26, 0.22] });
}

function cornerStreetFaces({ size }) {
  const halfSize = size * 0.5;
  return [
    { normalToward: 1, normalSideways: 0, offsetToward: halfSize, offsetSideways: 0 },
    { normalToward: 0, normalSideways: -1, offsetToward: 0, offsetSideways: -halfSize },
    { normalToward: 0, normalSideways: 1, offsetToward: 0, offsetSideways: halfSize }
  ];
}

function faceBox(offset, corner, face, { out, across, bottom, height, thickness, length, color, material, variant = 0.1, occlusion = 0.96 }) {
  const isTowardFace = face.normalToward !== 0;
  const toward = face.offsetToward + face.normalToward * out + (isTowardFace ? 0 : across);
  const sideways = face.offsetSideways + face.normalSideways * out + (isTowardFace ? across : 0);
  return pushCornerBox(offset, corner, {
    toward, sideways, bottom, height,
    depth: isTowardFace ? thickness : length,
    width: isTowardFace ? length : thickness,
    color, material, variant, occlusion
  });
}

function pushCornerStorefront(offset, corner, face, { awningTone, stripeTone }) {
  const frontLength = corner.size - 1.2;
  const stripeCount = 4;
  offset = faceBox(offset, corner, face, { out: 0.06, across: 0, bottom: 0.3, height: 2.9, thickness: 0.12, length: frontLength, color: [1.0, 0.86, 0.56], material: MATERIAL.GLOW, occlusion: 1.0 });
  offset = faceBox(offset, corner, face, { out: 0.1, across: 0, bottom: 3.3, height: 0.7, thickness: 0.14, length: frontLength, color: stripeTone, material: MATERIAL.PLASTER });
  return withDetailGeometry(() => {
    for (let stripe = 0; stripe < stripeCount; stripe++) {
      const stripeAlong = (stripe / (stripeCount - 1) - 0.5) * (frontLength - frontLength / stripeCount);
      offset = faceBox(offset, corner, face, { out: 0.8, across: stripeAlong, bottom: 3.0, height: 0.32, thickness: 1.5, length: frontLength / stripeCount, color: stripe % 2 === 0 ? awningTone : stripeTone, material: MATERIAL.PLASTER, occlusion: 0.95 });
    }
    return offset;
  });
}

function pushCornerFaceWindows(offset, corner, face, { storeys }) {
  const columnCount = 2;
  const bayWidth = (corner.size - 2.0) / columnCount;
  for (let storey = 1; storey < storeys; storey++) {
    for (let column = 0; column < columnCount; column++) {
      const across = (column - (columnCount - 1) * 0.5) * bayWidth;
      const sill = 1.4 + storey * BODEGA_STOREY_HEIGHT_METERS;
      offset = faceBox(offset, corner, face, { out: 0.04, across, bottom: sill, height: 1.7, thickness: 0.1, length: 1.4, color: STONE_TONES.darkGlass, material: MATERIAL.METAL, occlusion: 0.95 });
    }
  }
  return offset;
}

function pushCornerFireEscape(offset, corner, face, storeys) {
  return withDetailGeometry(() => {
    for (let storey = 1; storey < storeys; storey++) {
      const platform = storey * BODEGA_STOREY_HEIGHT_METERS + 1.3;
      offset = faceBox(offset, corner, face, { out: 0.55, across: -corner.size * 0.18, bottom: platform, height: 0.08, thickness: 1.1, length: 4.0, color: STONE_TONES.ironBlack, material: MATERIAL.METAL, occlusion: 0.85 });
      offset = faceBox(offset, corner, face, { out: 1.08, across: -corner.size * 0.18, bottom: platform, height: 0.95, thickness: 0.05, length: 4.0, color: STONE_TONES.ironBlack, material: MATERIAL.METAL, occlusion: 0.85 });
    }
    return offset;
  });
}

function pushCornerCafePavilion(offset, corner) {
  const { size } = corner;
  const halfSize = size * 0.5;
  const pavilionHeight = 7.2;
  const frame = [0.16, 0.17, 0.18];
  offset = pushCornerBox(offset, corner, { bottom: -2, height: 2.4, depth: size + 0.6, width: size + 0.6, color: STONE_TONES.granite, variant: 0.62 });
  offset = pushCornerBox(offset, corner, { bottom: 0.4, height: pavilionHeight - 0.4, depth: size - 1.6, width: size - 1.6, color: [0.30, 0.38, 0.40], material: MATERIAL.METAL, variant: 0.3 });
  offset = pushCornerBox(offset, corner, { bottom: 0.4, height: 2.8, depth: size - 1.5, width: size - 1.5, color: [1.0, 0.84, 0.56], material: MATERIAL.GLOW, occlusion: 1.0 });
  for (const toward of [-1, 1]) {
    for (const sideways of [-1, 1]) {
      offset = pushCornerBox(offset, corner, { toward: toward * (halfSize - 0.8), sideways: sideways * (halfSize - 0.8), bottom: 0.4, height: pavilionHeight, depth: 0.3, width: 0.3, color: frame, material: MATERIAL.METAL });
    }
  }
  offset = pushCornerBox(offset, corner, { bottom: pavilionHeight, height: 0.5, depth: size, width: size, color: frame, material: MATERIAL.METAL });
  for (const sideways of [-1, 1]) {
    offset = pushCornerBox(offset, corner, { sideways: sideways * (halfSize - 0.5), bottom: pavilionHeight + 0.5, height: 0.8, depth: size - 1.0, width: 0.9, color: CEDAR_WOOD, material: MATERIAL.WOOD });
  }
  offset = withDetailGeometry(() => {
    for (let umbrella = 0; umbrella < 3; umbrella++) {
      const spot = cornerPoint(corner, { toward: halfSize + 2.2, sideways: (umbrella - 1) * size * 0.32 });
      offset = pushCornerBox(offset, corner, { toward: halfSize + 2.2, sideways: (umbrella - 1) * size * 0.32, bottom: 0, height: 2.3, depth: 0.08, width: 0.08, color: frame, material: MATERIAL.METAL });
      offset = pushRoundedDome(corner.vertices, offset, spot[0], spot[1] + 2.2, spot[2], 1.3, 0.55, 1.3, 6, 2, CAFE_UMBRELLA_TONES[umbrella % CAFE_UMBRELLA_TONES.length], MATERIAL.PLASTER, 0.1, 0);
    }
    return offset;
  });

  return offset;
}

function pushCornerChurch(offset, corner, rng) {
  const { size } = corner;
  const halfSize = size * 0.5;
  const stone = rng() > 0.5 ? STONE_TONES.brownstone : STONE_TONES.sandstone;
  const trim = [stone[0] * 0.8, stone[1] * 0.8, stone[2] * 0.8];
  const naveHeight = 11 + rng() * 3;
  offset = pushCornerBox(offset, corner, { toward: -1.0, bottom: -3, height: naveHeight + 3, depth: size - 2.0, width: size * 0.78, color: stone, variant: 0.55 });
  const naveRoof = cornerPoint(corner, { toward: -1.0, height: naveHeight });
  offset = pushFlatConcreteRoof(corner.vertices, offset, { x: naveRoof[0], y: naveRoof[1], z: naveRoof[2], halfAcross: halfSize - 0.8, halfAlong: size * 0.41, yaw: corner.yaw + Math.PI * 0.5 });
  const towerSize = 4.2;
  const towerTop = naveHeight + 12 + rng() * 6;
  offset = pushCornerBox(offset, corner, { toward: halfSize - towerSize * 0.5, bottom: -3, height: towerTop + 3, depth: towerSize, width: towerSize, color: stone, variant: 0.55 });
  offset = pushCornerBox(offset, corner, { toward: halfSize + 0.06, bottom: 0.2, height: 4.4, depth: 0.2, width: 2.2, color: [0.26, 0.12, 0.08], material: MATERIAL.WOOD, occlusion: 0.9 });
  offset = pushCornerBox(offset, corner, { toward: halfSize + 0.06, bottom: naveHeight - 1.5, height: 3.6, depth: 0.16, width: 2.4, color: [0.70, 0.36, 0.62], material: MATERIAL.GLOW, occlusion: 1.0 });
  offset = pushCornerBox(offset, corner, { toward: halfSize - towerSize * 0.5, bottom: towerTop - 3.6, height: 2.4, depth: towerSize + 0.12, width: 1.2, color: STONE_TONES.ironBlack, material: MATERIAL.METAL });
  offset = pushCornerBox(offset, corner, { toward: halfSize - towerSize * 0.5, bottom: towerTop, height: 0.6, depth: towerSize + 0.6, width: towerSize + 0.6, color: trim, variant: 0.1 });
  const spire = cornerPoint(corner, { toward: halfSize - towerSize * 0.5, height: towerTop + 0.6 });
  return pushFlatConcreteRoof(corner.vertices, offset, { x: spire[0], y: spire[1], z: spire[2], halfAcross: towerSize * 0.5, halfAlong: towerSize * 0.5, yaw: corner.yaw });
}

const CORNER_LANDMARK_STYLES = Object.freeze([
  { build: pushCornerBank, vertexReserve: 1000 },
  { build: pushCornerBodega, vertexReserve: 3300 },
  { build: pushCornerCafePavilion, vertexReserve: 820 },
  { build: pushCornerChurch, vertexReserve: 360 }
]);
