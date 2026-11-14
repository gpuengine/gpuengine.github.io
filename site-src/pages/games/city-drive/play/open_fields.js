// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const FIELD_STYLE = Object.freeze({ wildflowerMeadow: 0, wheat: 1, pasture: 2, huskGrass: 3 });
const FIELD_STYLE_COUNT = 4;
const FIELD_GROUND_HEIGHT_METERS = 0.18;
const FIELD_GROUND_SURFACES = Object.freeze([
  { color: [0.30, 0.52, 0.24], variant: LAWN_TERRAIN_VARIANT },
  { color: [0.44, 0.40, 0.24], variant: LAWN_TERRAIN_VARIANT },
  { color: [0.27, 0.50, 0.22], variant: LAWN_TERRAIN_VARIANT },
  { color: HUSK_GRASS_COLOR, variant: DRY_GRASS_TERRAIN_VARIANT }
]);
const FIELD_FAR_SURFACES = Object.freeze([
  { color: [0.34, 0.54, 0.25], variant: LAWN_TERRAIN_VARIANT },
  { color: [0.70, 0.60, 0.30], variant: LAWN_TERRAIN_VARIANT },
  { color: [0.30, 0.50, 0.23], variant: LAWN_TERRAIN_VARIANT },
  { color: HUSK_GRASS_COLOR, variant: DRY_GRASS_TERRAIN_VARIANT }
]);


const WHEAT_FIRST_ROW_SETBACK_METERS = 6.0;
const WHEAT_LAST_ROW_SETBACK_METERS = 40.0;
const WHEAT_ROW_SPACING_METERS = 2.3;
const WHEAT_ROW_WIDTH_METERS = 1.2;
const WHEAT_ROW_HEIGHT_METERS = 0.9;
const WHEAT_TONES = Object.freeze([[0.86, 0.72, 0.36], [0.80, 0.64, 0.30], [0.90, 0.78, 0.44]]);

const HAY_BALE_COLOR = [0.82, 0.70, 0.40];
const HAY_BALE_SIZE_METERS = Object.freeze([1.5, 1.1, 1.5]);
const HAY_BALE_CHANCE = 0.4;

const LONE_TREE_CHANCE = 0.22;
const FIELD_TREE_SPECIES = ["pinOak", "americanElm", "sugarMaple", "redMaple", "whiteBirch", "easternWhitePine", "londonPlane"];

const BARN_SEGMENT_IN_BLOCK = 9;
const BARN_SETBACK_METERS = 30.0;
const BARN_SIZE_METERS = Object.freeze({ across: 9.0, wallHeight: 5.0, along: 12.0 });
const BARN_ROOF_PITCH_RADIANS = 0.62;
const BARN_ROOF_OVERHANG_METERS = 0.5;
const BARN_COLORS = Object.freeze({ wall: [0.62, 0.18, 0.14], trim: [0.92, 0.90, 0.84], roof: [0.30, 0.30, 0.32] });

const FAR_TREE_LINE_CHANCE = 0.35;
const FAR_TREE_LINE_INSET_METERS = 8.0;

function pushOpenFieldSide(vertices, offset, { pointAlong, info, side, heading, segmentIndex }) {
  const field = {
    vertices, pointAlong, info, side, heading, segmentIndex,
    roadHalfWidth: info.roadHalfWidth,
    primarySeed: seededRandom(segmentIndex * 37.0 + side * 5.0),
    secondarySeed: seededRandom(segmentIndex * 71.0 + side * 13.0)
  };
  if (info.fieldStyle === FIELD_STYLE.wheat) return pushWheatRows(offset, field);
  if (info.fieldStyle === FIELD_STYLE.pasture) return pushPastureContent(offset, field);
  if (info.fieldStyle === FIELD_STYLE.huskGrass) return pushHuskFieldContent(offset, field);
  return pushMeadowContent(offset, field);
}

function fieldGroundSurface(fieldStyle) {
  return { ...FIELD_GROUND_SURFACES[fieldStyle % FIELD_STYLE_COUNT], material: MATERIAL.TERRAIN };
}

function fieldFarSurface(fieldStyle) {
  return { ...FIELD_FAR_SURFACES[fieldStyle % FIELD_STYLE_COUNT], material: MATERIAL.TERRAIN };
}

function plantFarFieldTreeLine({ pointAlong, side, segmentIndex, reach }) {
  const seed = seededRandom(segmentIndex * 19.0 + side * 3.0);
  if (seed > FAR_TREE_LINE_CHANCE) return;
  const [treeX, treeY, treeZ] = pointAlong(seed / FAR_TREE_LINE_CHANCE, side * (reach - FAR_TREE_LINE_INSET_METERS), FIELD_GROUND_HEIGHT_METERS);
  const choice = chooseTreeFromSpecies(FIELD_TREE_SPECIES, { pickSeed: seededRandom(segmentIndex * 5.3), heightSeed: seed });
  plantStreetTree({ x: treeX, y: treeY, z: treeZ, ...choice, maxCrownRadiusMeters: 6.0, seed });
}

function fieldPoint(field, alongFraction, setbackMeters, heightMeters) {
  return field.pointAlong(alongFraction, field.side * (field.roadHalfWidth + setbackMeters), FIELD_GROUND_HEIGHT_METERS + heightMeters);
}

function pushFieldBox(offset, field, { alongFraction = 0.5, setbackMeters, size, color, material, variant, roll = 0 }) {
  return pushBox(field.vertices, offset, {
    center: fieldPoint(field, alongFraction, setbackMeters, size[1] * 0.5),
    size, yaw: field.heading, roll, color, material, variant, occlusion: 0.95
  });
}

function pushWheatRows(offset, field) {
  for (let setback = WHEAT_FIRST_ROW_SETBACK_METERS, row = 0; setback <= WHEAT_LAST_ROW_SETBACK_METERS; setback += WHEAT_ROW_SPACING_METERS, row++) {
    offset = pushFieldBox(offset, field, {
      setbackMeters: setback,
      size: [WHEAT_ROW_WIDTH_METERS, WHEAT_ROW_HEIGHT_METERS, SEG_LENGTH + 0.05],
      color: WHEAT_TONES[row % WHEAT_TONES.length], material: MATERIAL.FOLIAGE, variant: 0.6
    });
  }
  return offset;
}

function pushMeadowContent(offset, field) {
  plantLoneFieldTree(field);
  return offset;
}

function pushPastureContent(offset, field) {
  if (field.info.inBlockIdx === BARN_SEGMENT_IN_BLOCK) offset = pushBarn(offset, field);
  if (field.primarySeed < HAY_BALE_CHANCE) offset = pushHayBale(offset, field);
  plantLoneFieldTree(field);
  return offset;
}

function pushHuskFieldContent(offset, field) {
  if (field.primarySeed < HAY_BALE_CHANCE) offset = pushHayBale(offset, field);
  plantLoneFieldTree(field);
  return offset;
}

function pushHayBale(offset, field) {
  const setback = 9.0 + field.secondarySeed * 26.0;
  return pushFieldBox(offset, field, {
    alongFraction: field.primarySeed / HAY_BALE_CHANCE,
    setbackMeters: setback,
    size: HAY_BALE_SIZE_METERS,
    color: HAY_BALE_COLOR, material: MATERIAL.FOLIAGE, variant: 0.1
  });
}

function plantLoneFieldTree(field) {
  if (field.secondarySeed > LONE_TREE_CHANCE) return;
  const isNearBarn = field.info.fieldStyle === FIELD_STYLE.pasture && Math.abs(field.info.inBlockIdx - BARN_SEGMENT_IN_BLOCK) <= 2;
  if (isNearBarn) return;
  const setback = 12.0 + field.primarySeed * 26.0;
  const [treeX, treeY, treeZ] = fieldPoint(field, 0.5, setback, 0);
  const choice = chooseTreeFromSpecies(FIELD_TREE_SPECIES, { pickSeed: seededRandom(field.segmentIndex * 2.9 + field.side), heightSeed: field.primarySeed });
  plantStreetTree({ x: treeX, y: treeY, z: treeZ, ...choice, maxCrownRadiusMeters: clamp(setback - 3.0, 3.0, 7.0), seed: field.primarySeed });
}

function pushBarn(offset, field) {
  const { across, wallHeight, along } = BARN_SIZE_METERS;
  const barn = { ...field, base: fieldPoint(field, 0.5, BARN_SETBACK_METERS, 0) };
  offset = pushBox(field.vertices, offset, {
    center: barnPoint(barn, 0, wallHeight * 0.5, 0),
    size: [across, wallHeight, along], yaw: field.heading,
    color: BARN_COLORS.wall, material: MATERIAL.WOOD, variant: 0.3, occlusion: 0.95
  });
  offset = pushBarnRoof(offset, barn);
  offset = pushBarnGables(offset, barn);
  return pushBarnDoor(offset, barn);
}

function barnPoint(barn, acrossMeters, heightMeters, alongMeters) {
  return transformPoint(acrossMeters, heightMeters, alongMeters, barn.base[0], barn.base[1], barn.base[2], barn.heading, 0, 0);
}

function barnRidgeRise() {
  return BARN_SIZE_METERS.across * 0.5 * Math.tan(BARN_ROOF_PITCH_RADIANS);
}

function pushBarnRoof(offset, barn) {
  const halfAcross = BARN_SIZE_METERS.across * 0.5;
  const slabWidth = halfAcross / Math.cos(BARN_ROOF_PITCH_RADIANS) + BARN_ROOF_OVERHANG_METERS;
  for (const roofSide of [-1, 1]) {
    offset = pushBox(barn.vertices, offset, {
      center: barnPoint(barn, roofSide * halfAcross * 0.5, BARN_SIZE_METERS.wallHeight + barnRidgeRise() * 0.5 + 0.1, 0),
      size: [slabWidth, 0.2, BARN_SIZE_METERS.along + BARN_ROOF_OVERHANG_METERS * 2],
      yaw: barn.heading, roll: -roofSide * BARN_ROOF_PITCH_RADIANS,
      color: BARN_COLORS.roof, material: MATERIAL.METAL, variant: 0.4, occlusion: 0.95
    });
  }
  return offset;
}

function pushBarnGables(offset, barn) {
  const halfAcross = BARN_SIZE_METERS.across * 0.5;
  const wallTop = BARN_SIZE_METERS.wallHeight;
  for (const end of [-1, 1]) {
    const alongMeters = end * BARN_SIZE_METERS.along * 0.5;
    const left = barnPoint(barn, -halfAcross, wallTop, alongMeters);
    const right = barnPoint(barn, halfAcross, wallTop, alongMeters);
    const ridge = barnPoint(barn, 0, wallTop + barnRidgeRise(), alongMeters);
    offset = pushTriangle(barn.vertices, offset, left, right, ridge, BARN_COLORS.wall, MATERIAL.WOOD, 0.3);
    offset = pushTriangle(barn.vertices, offset, right, left, ridge, BARN_COLORS.wall, MATERIAL.WOOD, 0.3);
  }
  return offset;
}

function pushBarnDoor(offset, barn) {
  const roadFacingAcross = -barn.side * (BARN_SIZE_METERS.across * 0.5 + 0.06);
  return pushBox(barn.vertices, offset, {
    center: barnPoint(barn, roadFacingAcross, 1.8, 0),
    size: [0.1, 3.6, 4.2], yaw: barn.heading,
    color: BARN_COLORS.trim, material: MATERIAL.WOOD, variant: 0.3, occlusion: 0.95
  });
}
