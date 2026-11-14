// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const CURB_CAP_WIDTH = 0.32;
const CURB_CAP_COLOR = [0.70, 0.69, 0.66];
const PAVEMENT_SURFACES = Object.freeze([
  null,
  { color: [0.66, 0.60, 0.50], material: MATERIAL.PAVING, variant: 0.8 },
  { color: [0.76, 0.72, 0.65], material: MATERIAL.ASHLAR, variant: 0.2 },
  { color: [0.44, 0.48, 0.53], material: MATERIAL.PAVING, variant: 0.8 },
  { color: [0.50, 0.49, 0.48], material: MATERIAL.PAVING, variant: PAVING_PATTERN_VARIANT.setts },
  { color: [0.72, 0.67, 0.58], material: MATERIAL.PAVING, variant: PAVING_PATTERN_VARIANT.slab },
  { color: [0.66, 0.66, 0.64], material: MATERIAL.ASHLAR, variant: 0.2 }
]);
const SIDEWALK_CURB_TINT = 0.985;
const ROAD_SHOULDER_WIDTH_METERS = 2.8;
const ROADSIDE_BAND_REACH_METERS = 42.6;
const ZEBRA_STRIPE_COLOR = [0.92, 0.94, 0.96];
const ZEBRA_STRIPE_INSET_METERS = 1.0;
const ZEBRA_STRIPE_SPACING_METERS = 1.35;
const ZEBRA_STRIPE_HALF_WIDTH_METERS = 0.32;
const ZEBRA_STRIPE_HEIGHT_METERS = 0.035;
const ROAD_SURFACE_STRIP_COUNT = 4;
const SHOULDER_SLAB_COLOR = [0.36, 0.35, 0.34];
const ROAD_EDGE_LINE_COLOR = [0.85, 0.88, 0.92];
const SIDEWALK_CURB_HEIGHT_METERS = 0.18;
const CURB_CAP_LIFT_METERS = 0.006;
const HUSK_VERGE_BLOCK_CHANCE = 0.35;
const HUSK_VERGE_GAP_FROM_CURB_METERS = 0.12;
const HUSK_VERGE_WIDTH_METERS = 0.8;
const HUSK_VERGE_LIFT_METERS = 0.012;
const FLUSH_CURB_HEIGHT_METERS = 0.01;
const ROADSIDE_BAND_COUNT = 4;
const VIADUCT_PILLAR_SPACING_SEGMENTS = 5;
const MARKING_LINE_HEIGHT_METERS = 0.022;
const STOP_LINE_HEIGHT_METERS = 0.028;
const MARKING_LINE_WIDTH_METERS = 0.15;
const EDGE_LINE_CURB_OFFSET_METERS = 0.35;
const CENTER_LINE_HALF_GAP_METERS = 0.08;
const CURBSIDE_LANE_WIDTH_METERS = 2.1;
const LANE_DASH_LENGTH_METERS = 3.0;
const LANE_DASH_PERIOD_METERS = 9.0;
const STOP_LINE_DEPTH_METERS = 0.45;
const STOP_LINE_SETBACK_METERS = 0.8;
const STOP_LINE_CENTER_CLEARANCE_METERS = 0.3;
const CROSSWALK_ALONG_INSET_METERS = 0.4;
const MID_BLOCK_ZEBRA_START_FRACTION = 0.15;
const MID_BLOCK_ZEBRA_END_FRACTION = 0.85;
const LINE_OCCLUSION = 1.15;
const STOP_LINE_OCCLUSION = 1.2;
const WHOLE_SEGMENT = Object.freeze([[0, 1]]);
const APPROACH = Object.freeze({ forward: 1, backward: -1 });

function choosePavementSurface(info, sidewalkColor, isBridge) {
  const surface = PAVEMENT_SURFACES[info.pavementStyle];
  if (!surface || isBridge || info.isIntersection) return { color: sidewalkColor, material: MATERIAL.PAVING, variant: 0.8 };
  return surface;
}

function* zebraStripeLaterals(roadHalfWidth) {
  const usableWidth = 2 * (roadHalfWidth - ZEBRA_STRIPE_INSET_METERS);
  const gapCount = Math.floor(usableWidth / ZEBRA_STRIPE_SPACING_METERS);
  const firstLateral = -gapCount * ZEBRA_STRIPE_SPACING_METERS * 0.5;
  for (let stripe = 0; stripe <= gapCount; stripe++) {
    yield firstLateral + stripe * ZEBRA_STRIPE_SPACING_METERS;
  }
}

function hasMidBlockZebra(info) {
  return info.isMidBlockCrossing && info.overBridgeStyle < 0;
}

function buildRoadSegmentGeometry(startNode, endNode, slotBuffer) {
  startNode.obstacles = [];
  refreshCrossRoadClearance(startNode, endNode);
  return collectObstacles(startNode.obstacles, () => pushRoadSegment(startNode, endNode, slotBuffer), startNode.y);
}

function pushRoadSegment(startNode, endNode, slotBuffer) {
  const segment = describeRoadSegment(startNode, endNode);
  return withStreetFrame(createStreetFrame(segment), () => pushRoadSegmentGeometry(segment, slotBuffer));
}

function pushRoadSegmentGeometry(segment, slotBuffer) {
  let offset = 0;
  const { startNode, startInfo } = segment;

  offset = pushRoadSurface(slotBuffer, offset, segment);
  offset = pushShoulderSlabs(slotBuffer, offset, segment);
  if (startInfo.isIntersection) offset = pushIntersectionApproach(slotBuffer, offset, segment);
  if (hasMidBlockZebra(startInfo)) offset = pushMidBlockCrossing(slotBuffer, offset, segment);
  offset = pushCurbsAndSidewalks(slotBuffer, offset, segment);
  if (segment.isViaduct && (startNode.index % VIADUCT_PILLAR_SPACING_SEGMENTS === 0)) offset = pushViaductPillar(slotBuffer, offset, segment);
  if (!startInfo.isIntersection) offset = pushLaneMarkings(slotBuffer, offset, segment);
  if (startInfo.overBridgeStyle >= 0) offset = pushOverBridgeCrossing(slotBuffer, offset, segment);
  offset = pushRoadsideBands(slotBuffer, offset, segment);
  if (!startInfo.isIntersection && (startInfo.leftIsValley || startInfo.rightIsValley)) offset = pushValleyWater(slotBuffer, offset, segment);
  if (!startInfo.isIntersection) offset = pushRoadsideBlocks(slotBuffer, offset, segment);
  if (!startInfo.isIntersection) offset = pushPlannedSkyWalkways(slotBuffer, offset, segment);
  offset = pushFarCityContent(slotBuffer, offset, startNode, segment.pointAlong, segment.roadColor);

  return offset / FLOATS_PER_VERT;
}

function describeRoadSegment(startNode, endNode) {
  const startInfo = startNode.info;
  const endInfo = endNode.info;
  const startViaduct = getViaductProfile(startNode.index);
  const endViaduct = getViaductProfile(endNode.index);
  const isAlternateSegment = (startNode.index & 1) === 0;
  return {
    startNode,
    endNode,
    startInfo,
    endInfo,
    startRoadHalfWidth: startInfo.roadHalfWidth,
    endRoadHalfWidth: endInfo.roadHalfWidth,
    startViaduct,
    isViaduct: startViaduct.isViaduct || endViaduct.isViaduct,
    isAlternateSegment,
    roadColor: shadeRoadColor(isAlternateSegment),
    isSideHidden: (side) => side < 0 ? startNode.hidesLeftSide : startNode.hidesRightSide,
    ...makeSegmentPointFunctions(startNode, endNode)
  };
}

const STREET_FRAME_SOLVER_ITERATIONS = 3;
const STREET_FRAME_MIN_JACOBIAN = 1e-6;

function createStreetFrame(segment) {
  const { startNode, endNode, startRoadHalfWidth, endRoadHalfWidth } = segment;
  const flagCode = streetLightingFlags(segment) * STREET_FRAME_FLAG_STRIDE;
  const startX = startNode.x, startZ = startNode.z;
  const chordX = endNode.x - startX, chordZ = endNode.z - startZ;
  const startRightX = startNode.rightX, startRightZ = startNode.rightZ;
  const rightChangeX = endNode.rightX - startRightX, rightChangeZ = endNode.rightZ - startRightZ;
  const chordLengthSquared = chordX * chordX + chordZ * chordZ || 1.0;

  function locate(pointX, pointZ) {
    const offsetX = pointX - startX, offsetZ = pointZ - startZ;
    let fraction = (offsetX * chordX + offsetZ * chordZ) / chordLengthSquared;
    let lateral = (offsetX - chordX * fraction) * startRightX + (offsetZ - chordZ * fraction) * startRightZ;
    for (let iteration = 0; iteration < STREET_FRAME_SOLVER_ITERATIONS; iteration++) {
      const residualX = chordX * fraction + (startRightX + rightChangeX * fraction) * lateral - offsetX;
      const residualZ = chordZ * fraction + (startRightZ + rightChangeZ * fraction) * lateral - offsetZ;
      const alongX = chordX + rightChangeX * lateral, alongZ = chordZ + rightChangeZ * lateral;
      const acrossX = startRightX + rightChangeX * fraction, acrossZ = startRightZ + rightChangeZ * fraction;
      const jacobian = alongX * acrossZ - acrossX * alongZ;
      if (Math.abs(jacobian) < STREET_FRAME_MIN_JACOBIAN) break;
      fraction -= (residualX * acrossZ - residualZ * acrossX) / jacobian;
      lateral -= (alongX * residualZ - alongZ * residualX) / jacobian;
    }
    return { fraction, lateral };
  }

  return {
    writeCoordinates(point, vertices, index) {
      const { fraction, lateral } = locate(point[0], point[2]);
      vertices[index] = (startNode.index + fraction) * SEG_LENGTH;
      vertices[index + 1] = lateral;
      vertices[index + 2] = flagCode + lerp(startRoadHalfWidth, endRoadHalfWidth, fraction);
    }
  };
}

function streetLightingFlags(segment) {
  const { startInfo } = segment;
  const hasSidewalkLamps = (side) => !segment.isSideHidden(side) && !sideIsParkOf(startInfo, side) && !sideIsValleyOf(startInfo, side) && !sideIsFieldOf(startInfo, side);
  let flags = 0;
  if (hasSidewalkLamps(-1)) flags |= STREET_FRAME_FLAG.leftSidewalkLamps;
  if (hasSidewalkLamps(1)) flags |= STREET_FRAME_FLAG.rightSidewalkLamps;
  return flags;
}

function makeSegmentPointFunctions(startNode, endNode) {
  const startX = startNode.x, startY = startNode.y, startZ = startNode.z;
  const endX = endNode.x, endY = endNode.y, endZ = endNode.z;
  const startRightX = startNode.rightX, startRightY = startNode.rightY, startRightZ = startNode.rightZ;
  const endRightX = endNode.rightX, endRightY = endNode.rightY, endRightZ = endNode.rightZ;

  function pointAtStart(lateral, heightOffset = 0) {
    return [startX + startRightX * lateral, startY + startRightY * lateral + heightOffset, startZ + startRightZ * lateral];
  }
  function pointAtEnd(lateral, heightOffset = 0) {
    return [endX + endRightX * lateral, endY + endRightY * lateral + heightOffset, endZ + endRightZ * lateral];
  }
  function pointAlong(t, lateral, heightOffset = 0) {
    return [
      lerp(startX, endX, t) + lerp(startRightX, endRightX, t) * lateral,
      lerp(startY, endY, t) + lerp(startRightY, endRightY, t) * lateral + heightOffset,
      lerp(startZ, endZ, t) + lerp(startRightZ, endRightZ, t) * lateral
    ];
  }
  return { pointAtStart, pointAtEnd, pointAlong };
}

function shadeRoadColor(isAlternateSegment) {
  return liveWeatherColor(LIVE_WEATHER_COLOR.road, isAlternateSegment ? 1.0 : 0.94);
}

function pushSegmentStrip(vertices, offset, segment, { startLaterals, endLaterals, heights, color, material, variant, occlusion }) {
  const { pointAtStart, pointAtEnd } = segment;
  return pushQuad(
    vertices, offset,
    pointAtStart(startLaterals[0], heights[0]), pointAtEnd(endLaterals[0], heights[1]),
    pointAtEnd(endLaterals[1], heights[2]), pointAtStart(startLaterals[1], heights[3]),
    color, material, variant, occlusion
  );
}

function pushRoadSurface(vertices, offset, segment) {
  const { startRoadHalfWidth, endRoadHalfWidth } = segment;
  const lateralAt = (halfWidth, strip) => -halfWidth + (2 * halfWidth * strip) / ROAD_SURFACE_STRIP_COUNT;
  for (let strip = 0; strip < ROAD_SURFACE_STRIP_COUNT; strip++) {
    offset = pushSegmentStrip(vertices, offset, segment, {
      startLaterals: [lateralAt(startRoadHalfWidth, strip), lateralAt(startRoadHalfWidth, strip + 1)],
      endLaterals: [lateralAt(endRoadHalfWidth, strip), lateralAt(endRoadHalfWidth, strip + 1)],
      heights: [0, 0, 0, 0],
      color: segment.roadColor,
      material: MATERIAL.PAVING,
      variant: 0.35,
      occlusion: 1.0
    });
  }
  return offset;
}

function pushShoulderSlabs(vertices, offset, segment) {
  const { startNode, startRoadHalfWidth, endRoadHalfWidth } = segment;
  const subSlabDepth = segment.isViaduct ? -0.95 : -4.5;
  const startOuterEdge = startRoadHalfWidth + ROAD_SHOULDER_WIDTH_METERS;
  const endOuterEdge = endRoadHalfWidth + ROAD_SHOULDER_WIDTH_METERS;
  const slab = { color: SHOULDER_SLAB_COLOR, material: MATERIAL.STONE, variant: 0.1, occlusion: 0.78 };
  if (!startNode.hidesLeftSide) offset = pushSegmentStrip(vertices, offset, segment, {
    ...slab,
    startLaterals: [-startOuterEdge, -startOuterEdge],
    endLaterals: [-endOuterEdge, -endOuterEdge],
    heights: [0, 0, subSlabDepth, subSlabDepth]
  });
  if (!startNode.hidesRightSide) offset = pushSegmentStrip(vertices, offset, segment, {
    ...slab,
    startLaterals: [startOuterEdge, startOuterEdge],
    endLaterals: [endOuterEdge, endOuterEdge],
    heights: [subSlabDepth, subSlabDepth, 0, 0]
  });
  return offset;
}

function pushIntersectionApproach(vertices, offset, segment) {
  const { startNode, startInfo, startRoadHalfWidth, endRoadHalfWidth } = segment;
  const crossStreetHeight = 0.02;
  const crossReachLeft = startNode.hidesLeftFarCity ? startRoadHalfWidth + ROADSIDE_BAND_REACH_METERS : PARALLEL_STREET_LAT + PARALLEL_STREET_HALF_W;
  const crossReachRight = startNode.hidesRightFarCity ? startRoadHalfWidth + ROADSIDE_BAND_REACH_METERS : PARALLEL_STREET_LAT + PARALLEL_STREET_HALF_W;
  const crossStreet = {
    heights: [crossStreetHeight, crossStreetHeight, crossStreetHeight, crossStreetHeight],
    color: segment.roadColor,
    material: MATERIAL.PAVING,
    variant: 0.35,
    occlusion: 1.0
  };
  offset = pushSegmentStrip(vertices, offset, segment, {
    ...crossStreet,
    startLaterals: [-crossReachLeft, -startRoadHalfWidth],
    endLaterals: [-crossReachLeft, -endRoadHalfWidth]
  });
  offset = pushSegmentStrip(vertices, offset, segment, {
    ...crossStreet,
    startLaterals: [startRoadHalfWidth, crossReachRight],
    endLaterals: [endRoadHalfWidth, crossReachRight]
  });

  if (startInfo.isCrosswalk) offset = pushIntersectionCrosswalk(vertices, offset, segment);
  if (startInfo.inBlockIdx === 0) {
    offset = pushManhattanTrafficSignal(vertices, offset, startNode.x, startNode.y, startNode.z, startNode.heading, -1, startRoadHalfWidth);
    offset = pushManhattanTrafficSignal(vertices, offset, startNode.x, startNode.y, startNode.z, startNode.heading, 1, startRoadHalfWidth);
  }
  return offset;
}

function pushIntersectionCrosswalk(vertices, offset, segment) {
  const insetFraction = CROSSWALK_ALONG_INSET_METERS / SEG_LENGTH;
  for (const stripeLateral of zebraStripeLaterals(segment.startRoadHalfWidth)) {
    offset = pushZebraStripe(vertices, offset, segment, { stripeLateral, fromT: insetFraction, toT: 1 - insetFraction });
  }
  return offset;
}

function pushZebraStripe(vertices, offset, segment, { stripeLateral, fromT, toT }) {
  const { pointAlong } = segment;
  const stripeLeft = stripeLateral - ZEBRA_STRIPE_HALF_WIDTH_METERS;
  const stripeRight = stripeLateral + ZEBRA_STRIPE_HALF_WIDTH_METERS;
  return withRoadMarkingGeometry(() => pushQuad(
    vertices, offset,
    pointAlong(fromT, stripeLeft, ZEBRA_STRIPE_HEIGHT_METERS), pointAlong(toT, stripeLeft, ZEBRA_STRIPE_HEIGHT_METERS),
    pointAlong(toT, stripeRight, ZEBRA_STRIPE_HEIGHT_METERS), pointAlong(fromT, stripeRight, ZEBRA_STRIPE_HEIGHT_METERS),
    ZEBRA_STRIPE_COLOR, MATERIAL.PAVING, 0.2, 1.05
  ));
}

function pushMidBlockCrossing(vertices, offset, segment) {
  for (const stripeLateral of zebraStripeLaterals(segment.startRoadHalfWidth)) {
    offset = pushZebraStripe(vertices, offset, segment, { stripeLateral, fromT: MID_BLOCK_ZEBRA_START_FRACTION, toT: MID_BLOCK_ZEBRA_END_FRACTION });
  }
  for (const side of [-1, 1]) {
    offset = pushCrossingBeacon(vertices, offset, segment, side);
  }
  return offset;
}

function pushCrossingBeacon(vertices, offset, segment, side) {
  const heading = segment.startNode.heading;
  const post = segment.pointAlong(0.5, side * (segment.startRoadHalfWidth + 0.9), 0.18);
  offset = pushBox(vertices, offset, {
    center: [post[0], post[1] + 1.5, post[2]],
    size: [0.12, 3.0, 0.12],
    yaw: heading,
    color: [0.20, 0.22, 0.24],
    material: MATERIAL.METAL,
    occlusion: 0.9
  });
  return pushBox(vertices, offset, {
    center: [post[0], post[1] + 3.05, post[2]],
    size: [0.42, 0.42, 0.42],
    yaw: heading,
    color: [1.0, 0.78, 0.22],
    material: MATERIAL.GLOW,
    occlusion: 1.0
  });
}

function pushCurbsAndSidewalks(vertices, offset, segment) {
  const { startInfo, startRoadHalfWidth, endRoadHalfWidth } = segment;
  const sidewalkColor = chooseSidewalkColor(segment);
  const pavement = choosePavementSurface(startInfo, sidewalkColor, segment.isViaduct);
  const curbHeight = startInfo.isIntersection ? FLUSH_CURB_HEIGHT_METERS : SIDEWALK_CURB_HEIGHT_METERS;
  const sidewalkOcclusion = 0.96;
  const curbFace = { color: sidewalkColor, material: MATERIAL.PAVING, variant: 0.8, occlusion: sidewalkOcclusion };
  const sidewalkTop = { color: pavement.color, material: pavement.material, variant: pavement.variant, occlusion: sidewalkOcclusion };
  const startSidewalkOuter = startRoadHalfWidth + ROAD_SHOULDER_WIDTH_METERS;
  const endSidewalkOuter = endRoadHalfWidth + ROAD_SHOULDER_WIDTH_METERS;
  const cornerT = blockCornerFraction(segment);

  for (const side of [-1, 1]) {
    const isHidden = segment.isSideHidden(side);
    if (cornerT !== null && !isHidden) {
      offset = pushRoundedCurbCorner(vertices, offset, segment, { side, cornerT, curbHeight, sidewalkTop });
      continue;
    }
    offset = pushSegmentStrip(vertices, offset, segment, {
      ...curbFace,
      startLaterals: [side * startRoadHalfWidth, side * startRoadHalfWidth],
      endLaterals: [side * endRoadHalfWidth, side * endRoadHalfWidth],
      heights: side < 0 ? [curbHeight, curbHeight, 0, 0] : [0, 0, curbHeight, curbHeight]
    });
    if (isHidden) continue;
    const [startLaterals, endLaterals] = side < 0
      ? [[-startSidewalkOuter, -startRoadHalfWidth], [-endSidewalkOuter, -endRoadHalfWidth]]
      : [[startRoadHalfWidth, startSidewalkOuter], [endRoadHalfWidth, endSidewalkOuter]];
    offset = pushSegmentStrip(vertices, offset, segment, { ...sidewalkTop, startLaterals, endLaterals, heights: [curbHeight, curbHeight, curbHeight, curbHeight] });
    if (startInfo.isIntersection) continue;
    offset = pushCurbCap(vertices, offset, segment, side, curbHeight);
    if (hasHuskGrassVerge(segment, side)) offset = pushHuskGrassVerge(vertices, offset, segment, side, curbHeight);
  }
  return offset;
}

function chooseSidewalkColor(segment) {
  if (segment.isViaduct) return [0.68 * SIDEWALK_CURB_TINT, 0.72 * SIDEWALK_CURB_TINT, 0.78 * SIDEWALK_CURB_TINT];
  return liveWeatherColor(LIVE_WEATHER_COLOR.shoulder, SIDEWALK_CURB_TINT);
}

function pushCurbCap(vertices, offset, segment, side, curbHeight) {
  const { pointAtStart, pointAtEnd, startRoadHalfWidth, endRoadHalfWidth } = segment;
  const capHeight = curbHeight + CURB_CAP_LIFT_METERS;
  return pushGroundQuad(
    vertices, offset,
    pointAtStart(side * startRoadHalfWidth, capHeight), pointAtEnd(side * endRoadHalfWidth, capHeight),
    pointAtEnd(side * (endRoadHalfWidth + CURB_CAP_WIDTH), capHeight), pointAtStart(side * (startRoadHalfWidth + CURB_CAP_WIDTH), capHeight),
    CURB_CAP_COLOR, MATERIAL.PAVING, 0.85, 1.0
  );
}

function hasHuskGrassVerge(segment, side) {
  const { startInfo } = segment;
  if (segment.isViaduct || startInfo.isMidBlockCrossing || startInfo.overBridgeStyle >= 0) return false;
  if (sideIsParkOf(startInfo, side) || sideIsValleyOf(startInfo, side)) return false;
  return seededRandom(startInfo.blockNumber * 6.13 + side * 1.7) < HUSK_VERGE_BLOCK_CHANCE;
}

function pushHuskGrassVerge(vertices, offset, segment, side, curbHeight) {
  const { pointAtStart, pointAtEnd, startRoadHalfWidth, endRoadHalfWidth } = segment;
  const vergeHeight = curbHeight + HUSK_VERGE_LIFT_METERS;
  const innerFromCurb = CURB_CAP_WIDTH + HUSK_VERGE_GAP_FROM_CURB_METERS;
  const outerFromCurb = innerFromCurb + HUSK_VERGE_WIDTH_METERS;
  return pushGroundQuad(
    vertices, offset,
    pointAtStart(side * (startRoadHalfWidth + innerFromCurb), vergeHeight), pointAtEnd(side * (endRoadHalfWidth + innerFromCurb), vergeHeight),
    pointAtEnd(side * (endRoadHalfWidth + outerFromCurb), vergeHeight), pointAtStart(side * (startRoadHalfWidth + outerFromCurb), vergeHeight),
    HUSK_GRASS_COLOR, MATERIAL.TERRAIN, DRY_GRASS_TERRAIN_VARIANT, 0.97
  );
}

function pushViaductPillar(vertices, offset, segment) {
  const { startNode } = segment;
  const minimumPillarHeight = 18.0;
  return pushSkyscraperPillar(
    vertices,
    offset,
    startNode.x,
    startNode.y,
    startNode.z,
    startNode.heading,
    Math.max(segment.startViaduct.dropDepth, minimumPillarHeight)
  );
}

function pushLaneMarkings(vertices, offset, segment) {
  const { startInfo } = segment;
  const yellow = liveWeatherColor(LIVE_WEATHER_COLOR.stripe);
  const openRanges = rangesOutsideZebra(startInfo);
  for (const side of [-1, 1]) {
    offset = pushCenterLine(vertices, offset, segment, { side, color: yellow, ranges: openRanges });
  }
  return withRoadMarkingGeometry(() => pushNearRoadMarkings(vertices, offset, segment, openRanges));
}

function pushNearRoadMarkings(vertices, offset, segment, openRanges) {
  for (const side of [-1, 1]) {
    offset = pushEdgeLine(vertices, offset, segment, side);
    if (segment.startInfo.isWideBoulevardBlock) offset = pushCurbsideLaneDashes(vertices, offset, segment, { side, ranges: openRanges });
  }
  return pushStopLines(vertices, offset, segment);
}

function rangesOutsideZebra(info) {
  if (!hasMidBlockZebra(info)) return WHOLE_SEGMENT;
  return [[0, MID_BLOCK_ZEBRA_START_FRACTION], [MID_BLOCK_ZEBRA_END_FRACTION, 1]];
}

function roadHalfWidthAt(segment, t) {
  return lerp(segment.startRoadHalfWidth, segment.endRoadHalfWidth, t);
}

function pushEdgeLine(vertices, offset, segment, side) {
  const innerFromCurb = EDGE_LINE_CURB_OFFSET_METERS + MARKING_LINE_WIDTH_METERS;
  return pushLongitudinalLine(vertices, offset, segment, {
    edgesAt: (t) => [side * (roadHalfWidthAt(segment, t) - innerFromCurb), side * (roadHalfWidthAt(segment, t) - EDGE_LINE_CURB_OFFSET_METERS)],
    ranges: WHOLE_SEGMENT,
    color: ROAD_EDGE_LINE_COLOR
  });
}

function pushCenterLine(vertices, offset, segment, { side, color, ranges }) {
  const nearLateral = side * CENTER_LINE_HALF_GAP_METERS;
  const farLateral = side * (CENTER_LINE_HALF_GAP_METERS + MARKING_LINE_WIDTH_METERS);
  return pushLongitudinalLine(vertices, offset, segment, { edgesAt: () => [nearLateral, farLateral], ranges, color });
}

function pushCurbsideLaneDashes(vertices, offset, segment, { side, ranges }) {
  const fromCurb = EDGE_LINE_CURB_OFFSET_METERS + CURBSIDE_LANE_WIDTH_METERS;
  const dashRanges = intersectRanges(laneDashRanges(segment.startNode.index), ranges);
  return pushLongitudinalLine(vertices, offset, segment, {
    edgesAt: (t) => [side * (roadHalfWidthAt(segment, t) - fromCurb - MARKING_LINE_WIDTH_METERS), side * (roadHalfWidthAt(segment, t) - fromCurb)],
    ranges: dashRanges,
    color: ROAD_EDGE_LINE_COLOR
  });
}

function laneDashRanges(segmentIndex) {
  const segmentStartMeters = segmentIndex * SEG_LENGTH;
  const segmentEndMeters = segmentStartMeters + SEG_LENGTH;
  const ranges = [];
  for (let dashStart = Math.floor(segmentStartMeters / LANE_DASH_PERIOD_METERS) * LANE_DASH_PERIOD_METERS; dashStart < segmentEndMeters; dashStart += LANE_DASH_PERIOD_METERS) {
    const visibleStart = Math.max(dashStart, segmentStartMeters);
    const visibleEnd = Math.min(dashStart + LANE_DASH_LENGTH_METERS, segmentEndMeters);
    if (visibleEnd > visibleStart) ranges.push([(visibleStart - segmentStartMeters) / SEG_LENGTH, (visibleEnd - segmentStartMeters) / SEG_LENGTH]);
  }
  return ranges;
}

function intersectRanges(firstRanges, secondRanges) {
  const overlaps = [];
  for (const [firstStart, firstEnd] of firstRanges) {
    for (const [secondStart, secondEnd] of secondRanges) {
      const start = Math.max(firstStart, secondStart);
      const end = Math.min(firstEnd, secondEnd);
      if (end > start) overlaps.push([start, end]);
    }
  }
  return overlaps;
}

function pushLongitudinalLine(vertices, offset, segment, { edgesAt, ranges, color }) {
  const { pointAlong } = segment;
  for (const [fromT, toT] of ranges) {
    const [fromLeft, fromRight] = edgesAt(fromT);
    const [toLeft, toRight] = edgesAt(toT);
    const leftLateral = Math.min(fromLeft, fromRight), rightLateral = Math.max(fromLeft, fromRight);
    const toLeftLateral = Math.min(toLeft, toRight), toRightLateral = Math.max(toLeft, toRight);
    offset = pushQuad(
      vertices, offset,
      pointAlong(fromT, leftLateral, MARKING_LINE_HEIGHT_METERS), pointAlong(toT, toLeftLateral, MARKING_LINE_HEIGHT_METERS),
      pointAlong(toT, toRightLateral, MARKING_LINE_HEIGHT_METERS), pointAlong(fromT, rightLateral, MARKING_LINE_HEIGHT_METERS),
      color, MATERIAL.PAVING, 0.2, LINE_OCCLUSION
    );
  }
  return offset;
}

function pushStopLines(vertices, offset, segment) {
  const { startNode, startInfo } = segment;
  const lastSegmentInBlock = MANHATTAN_BLOCK_PERIOD - 1;
  const firstSegmentAfterIntersection = INTERSECTION_LAST_SEGMENT_INDEX + 1;
  const neighborInfo = (step) => getManhattanBlockInfo(startNode.index + step, startNode.edge);
  if (startInfo.inBlockIdx === lastSegmentInBlock || hasMidBlockZebra(neighborInfo(1))) {
    offset = pushStopLine(vertices, offset, segment, APPROACH.forward);
  }
  if (startInfo.inBlockIdx === firstSegmentAfterIntersection || hasMidBlockZebra(neighborInfo(-1))) {
    offset = pushStopLine(vertices, offset, segment, APPROACH.backward);
  }
  return offset;
}

function pushStopLine(vertices, offset, segment, approach) {
  const { pointAlong } = segment;
  const nearFraction = STOP_LINE_SETBACK_METERS / SEG_LENGTH;
  const farFraction = (STOP_LINE_SETBACK_METERS + STOP_LINE_DEPTH_METERS) / SEG_LENGTH;
  const [fromT, toT] = approach === APPROACH.forward ? [1 - farFraction, 1 - nearFraction] : [nearFraction, farFraction];
  const outerLateralAt = (t) => roadHalfWidthAt(segment, t) - EDGE_LINE_CURB_OFFSET_METERS;
  const side = approach;
  const corners = [
    pointAlong(fromT, side * STOP_LINE_CENTER_CLEARANCE_METERS, STOP_LINE_HEIGHT_METERS),
    pointAlong(toT, side * STOP_LINE_CENTER_CLEARANCE_METERS, STOP_LINE_HEIGHT_METERS),
    pointAlong(toT, side * outerLateralAt(toT), STOP_LINE_HEIGHT_METERS),
    pointAlong(fromT, side * outerLateralAt(fromT), STOP_LINE_HEIGHT_METERS)
  ];
  if (side < 0) corners.reverse();
  return pushQuad(vertices, offset, ...corners, ZEBRA_STRIPE_COLOR, MATERIAL.PAVING, 0.2, STOP_LINE_OCCLUSION);
}

function pushOverBridgeCrossing(vertices, offset, segment) {
  const { startNode, startInfo, startRoadHalfWidth } = segment;
  const bridgeSeed = seededRandom(startNode.index * 61.3);
  return pushOverBridge(vertices, offset, startNode.x, startNode.y, startNode.z, startNode.heading, startRoadHalfWidth, startInfo.overBridgeStyle, bridgeSeed);
}

function roadsideBandEdges(roadHalfWidth) {
  return [
    roadHalfWidth + ROAD_SHOULDER_WIDTH_METERS,
    roadHalfWidth + 7.2,
    roadHalfWidth + 15.6,
    roadHalfWidth + 27.6,
    roadHalfWidth + ROADSIDE_BAND_REACH_METERS,
    68.0,
    92.0,
    124.0,
    165.0
  ];
}

function pushRoadsideBands(vertices, offset, segment) {
  const { startInfo } = segment;
  const startBandEdges = roadsideBandEdges(segment.startRoadHalfWidth);
  const endBandEdges = roadsideBandEdges(segment.endRoadHalfWidth);
  for (let side = -1; side <= 1; side += 2) {
    const sideIsPark = (side < 0 && startInfo.leftIsPark) || (side > 0 && startInfo.rightIsPark);
    const sideIsValley = (side < 0 && startInfo.leftIsValley) || (side > 0 && startInfo.rightIsValley);
    if (segment.isSideHidden(side)) continue;
    for (let band = 0; band < ROADSIDE_BAND_COUNT; band++) {
      const corners = raiseBandCorners(segment, { side, band, startBandEdges, endBandEdges });
      const surface = chooseRoadsideBandSurface({ band, sideIsValley, sideIsPark, sideIsField: sideIsFieldOf(startInfo, side), fieldStyle: startInfo.fieldStyle, isIntersection: startInfo.isIntersection, hasLawnGround: startInfo.district.groundCover === GROUND_COVER.lawn });
      offset = pushRoadsideBandQuad(vertices, offset, side, corners, surface);
    }
  }
  return offset;
}

function raiseBandCorners(segment, { side, band, startBandEdges, endBandEdges }) {
  const { startInfo, pointAtStart, pointAtEnd } = segment;
  const endInfo = endInfoMatchingSegmentLevel(segment);
  const startInnerLateral = startBandEdges[band] * side;
  const endInnerLateral = endBandEdges[band] * side;
  const startOuterLateral = startBandEdges[band + 1] * side;
  const endOuterLateral = endBandEdges[band + 1] * side;

  const startInner = pointAtStart(startInnerLateral, 0);
  const endInner = pointAtEnd(endInnerLateral, 0);
  const startOuter = pointAtStart(startOuterLateral, 0);
  const endOuter = pointAtEnd(endOuterLateral, 0);

  const startInnerHeight = bandHeightAt(startInner[0], startInner[2], startInnerLateral, band, startInfo);
  const endInnerHeight = bandHeightAt(endInner[0], endInner[2], endInnerLateral, band, endInfo);
  const startOuterHeight = bandHeightAt(startOuter[0], startOuter[2], startOuterLateral, band + 1, startInfo);
  const endOuterHeight = bandHeightAt(endOuter[0], endOuter[2], endOuterLateral, band + 1, endInfo);

  startInner[1] += startInnerHeight; endInner[1] += endInnerHeight;
  startOuter[1] += startOuterHeight; endOuter[1] += endOuterHeight;
  return { startInner, endInner, startOuter, endOuter };
}

function endInfoMatchingSegmentLevel({ startInfo, endInfo }) {
  if (endInfo.isIntersection === startInfo.isIntersection) return endInfo;
  return { ...endInfo, isIntersection: startInfo.isIntersection };
}

function chooseRoadsideBandSurface({ band, sideIsValley, sideIsPark, sideIsField, fieldStyle, isIntersection, hasLawnGround }) {
  if (sideIsField && !isIntersection) return fieldGroundSurface(fieldStyle);
  if (sideIsValley && !isIntersection) {
    if (band >= 1 && band <= 4) return { color: [0.46, 0.47, 0.49], material: MATERIAL.TERRAIN, variant: 0.85 };
    return { color: [0.20, 0.45, 0.25], material: MATERIAL.TERRAIN, variant: 0.25 };
  }
  if ((sideIsPark || hasLawnGround) && band <= 5 && !isIntersection) return { color: [0.20, 0.48, 0.26], material: MATERIAL.TERRAIN, variant: 0.25 };
  return { color: [0.52, 0.51, 0.49], material: MATERIAL.PAVING, variant: 0.85 };
}

const ROADSIDE_BAND_INNER_OCCLUSION = 1.0;
const ROADSIDE_BAND_OUTER_OCCLUSION = 0.94;

function pushRoadsideBandQuad(vertices, offset, side, { startInner, endInner, startOuter, endOuter }, { color, material, variant }) {
  const inner = ROADSIDE_BAND_INNER_OCCLUSION, outer = ROADSIDE_BAND_OUTER_OCCLUSION;
  if (side < 0) {
    offset = pushTriangle(vertices, offset, startOuter, endOuter, endInner, color, material, variant, outer, outer, inner);
    return pushTriangle(vertices, offset, startOuter, endInner, startInner, color, material, variant, outer, inner, inner);
  }
  offset = pushTriangle(vertices, offset, startInner, endInner, endOuter, color, material, variant, inner, inner, outer);
  return pushTriangle(vertices, offset, startInner, endOuter, startOuter, color, material, variant, inner, outer, outer);
}

function pushValleyWater(vertices, offset, segment) {
  const { startInfo, startRoadHalfWidth, pointAtStart, pointAtEnd } = segment;
  const valleySide = startInfo.leftIsValley ? -1 : 1;
  const waterInnerLateral = (startRoadHalfWidth + 7.2) * valleySide;
  const waterMidLateral   = (startRoadHalfWidth + 22.5) * valleySide;
  const waterOuterLateral = (startRoadHalfWidth + 41.0) * valleySide;
  const waterNearLateral = Math.min(waterInnerLateral, waterOuterLateral);
  const waterFarLateral = Math.max(waterInnerLateral, waterOuterLateral);
  const waterElevation = startInfo.waterStyle === 0 ? -0.55 : (startInfo.waterStyle === 1 ? -1.35 : -2.35);
  const waterSurfaceColor = startInfo.waterStyle === 1 ? [0.14, 0.56, 0.72] : liveWeatherColor(LIVE_WEATHER_COLOR.water);
  const flow = startInfo.waterStyle === 0 ? 0.35 : (startInfo.waterStyle === 1 ? 1.65 : 1.35);

  const waterNearStart = pointAtStart(waterNearLateral, waterElevation);
  const waterNearEnd = pointAtEnd(waterNearLateral, waterElevation);
  const waterMidStart  = pointAtStart(waterMidLateral, waterElevation);
  const waterMidEnd  = pointAtEnd(waterMidLateral, waterElevation);
  const waterFarStart = pointAtStart(waterFarLateral, waterElevation);
  const waterFarEnd = pointAtEnd(waterFarLateral, waterElevation);

  offset = pushTriangle(vertices, offset, waterNearStart, waterNearEnd, waterMidEnd, waterSurfaceColor, MATERIAL.WATER, flow, 0.46, 0.46, 0.96);
  offset = pushTriangle(vertices, offset, waterNearStart, waterMidEnd, waterMidStart,  waterSurfaceColor, MATERIAL.WATER, flow, 0.46, 0.96, 0.96);
  offset = pushTriangle(vertices, offset, waterMidStart,  waterMidEnd, waterFarEnd, waterSurfaceColor, MATERIAL.WATER, flow, 0.96, 0.96, 0.46);
  return pushTriangle(vertices, offset, waterMidStart,  waterFarEnd, waterFarStart, waterSurfaceColor, MATERIAL.WATER, flow, 0.96, 0.46, 0.46);
}

function pushRoadsideBlocks(vertices, offset, segment) {
  const { startNode, startInfo, startRoadHalfWidth } = segment;
  const { x, y, z, heading, index } = startNode;
  for (let side = -1; side <= 1; side += 2) {
    const isValleySide = (side < 0 && startInfo.leftIsValley) || (side > 0 && startInfo.rightIsValley);
    const isParkSide = (side < 0 && startInfo.leftIsPark) || (side > 0 && startInfo.rightIsPark);
    if (segment.isSideHidden(side)) continue;
    if (isValleySide) {
      offset = pushManhattanWaterFeatureSide(vertices, offset, x, y, z, heading, side, index, startInfo.inBlockIdx, startRoadHalfWidth, startInfo.waterStyle);
    } else if (sideIsFieldOf(startInfo, side)) {
      offset = pushOpenFieldSide(vertices, offset, { pointAlong: segment.pointAlong, info: startInfo, side, heading, segmentIndex: index });
    } else if (isParkSide) {
      offset = pushManhattanParkBlock(vertices, offset, x, y, z, heading, side, index, startInfo.inBlockIdx, startRoadHalfWidth, startInfo.parkTheme);
    } else {
      offset = pushManhattanBuildingBlock(vertices, offset, {
        x, y, z, yaw: heading, side,
        segIndex: index,
        inBlockIdx: startInfo.inBlockIdx,
        roadHalfWidth: startRoadHalfWidth,
        district: startInfo.district
      });
    }
  }
  return offset;
}
