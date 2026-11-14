// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const JUNCTION_PAD_SIDES = 32;
const JUNCTION_PAD_INNER_RING_FRACTION = 0.5;
const JUNCTION_PAD_SURFACE_DROP_METERS = 0.015;
const JUNCTION_PAD_COVERAGE_MARGIN_METERS = 0.6;
const JUNCTION_PAD_OVERLAP_METERS = 0.4;
const JUNCTION_CURB_FACE_DEPTH_METERS = 0.55;
const JUNCTION_CORNER_CURB_HEIGHT_METERS = 0.18;
const JUNCTION_WIDE_SECTOR_RADIANS = Math.PI * 1.05;
const JUNCTION_POCKET_PARK_BENCH_SLOT = 2;
const POCKET_PARK_CORNER_SHARE = 0.22;
const JUNCTION_LOT_CANDIDATES_NARROW = [[0.5, 21], [0.5, 37], [0.5, 53], [0.3, 30], [0.7, 30]];
const JUNCTION_LOT_CANDIDATES_WIDE = [[0.25, 23], [0.5, 23], [0.75, 23], [0.38, 40], [0.62, 40], [0.5, 56]];

function buildJunctionGeometry(junction, slotBuffer) {
  junction.obstacles = [];
  junction.cornerLandTriangles = [];
  return collectObstacles(junction.obstacles, () => pushJunction(junction, slotBuffer), junction.y);
}

function pushJunction(junction, slotBuffer) {
  let offset = 0;
  const plaza = {
    junction,
    rng: makeRng(roadGraph.seedBase + junction.id * 977),
    roadColor: liveWeatherColor(LIVE_WEATHER_COLOR.road),
    sidewalkColor: liveWeatherColor(LIVE_WEATHER_COLOR.shoulder),
    padRadius: junction.radius,
    pointAtHeading: (heading, dist, h) => [junction.x - Math.sin(heading) * dist, junction.y + h, junction.z - Math.cos(heading) * dist]
  };

  const arms = junction.arms.filter(a => a.edge);
  offset = pushJunctionPad(slotBuffer, offset, plaza, junctionPadCoverageRadius(junction, arms));

  const armCount = arms.length;
  for (const arm of arms) offset = pushJunctionArmApproach(slotBuffer, offset, arm);

  const maxLotsPerCorner = armCount >= 4 ? 3 : 4;
  const cornerCount = armCount === 1 ? 1 : armCount;
  const corners = Array.from({ length: cornerCount }, (_, cornerIndex) => describeJunctionCorner(plaza, arms, cornerIndex));
  for (const corner of corners) offset = pushCornerGround(slotBuffer, offset, plaza, corner);
  for (const corner of corners) offset = pushCornerLots(slotBuffer, offset, plaza, corner, maxLotsPerCorner);

  return offset / FLOATS_PER_VERT;
}

function junctionPadCoverageRadius(junction, arms) {
  const widestRoadCornerDistance = arms.reduce(
    (farthest, arm) => Math.max(farthest, Math.hypot(junction.radius, armEndNode(arm, 0).info.roadHalfWidth)), junction.radius);
  return widestRoadCornerDistance + JUNCTION_PAD_COVERAGE_MARGIN_METERS;
}

function pushJunctionPad(vertices, offset, { junction, roadColor, pointAtHeading }, coverageRadius) {
  const surfaceHeight = -JUNCTION_PAD_SURFACE_DROP_METERS;
  const center = [junction.x, junction.y + surfaceHeight, junction.z];
  const innerRadius = coverageRadius * JUNCTION_PAD_INNER_RING_FRACTION;
  const pushPadTriangle = (pointA, pointB, pointC) => pushGroundTriangle(vertices, offset, pointA, pointB, pointC, roadColor, MATERIAL.PAVING, 0.35, 1.0);
  for (let slice = 0; slice < JUNCTION_PAD_SIDES; slice++) {
    const sliceStart = (slice / JUNCTION_PAD_SIDES) * Math.PI * 2;
    const sliceEnd = ((slice + 1) / JUNCTION_PAD_SIDES) * Math.PI * 2;
    const innerStart = pointAtHeading(sliceStart, innerRadius, surfaceHeight);
    const innerEnd = pointAtHeading(sliceEnd, innerRadius, surfaceHeight);
    const outerStart = pointAtHeading(sliceStart, coverageRadius, surfaceHeight);
    const outerEnd = pointAtHeading(sliceEnd, coverageRadius, surfaceHeight);
    offset = pushPadTriangle(center, innerStart, innerEnd);
    offset = pushPadTriangle(innerStart, outerStart, outerEnd);
    offset = pushPadTriangle(innerStart, outerEnd, innerEnd);
  }
  return offset;
}

function pushJunctionArmApproach(vertices, offset, arm) {
  const node = armEndNode(arm, 0);
  const outwardSign = armOutwardSign(arm);
  const halfWidth = node.info.roadHalfWidth;
  const forwardX = node.forwardX * outwardSign, forwardZ = node.forwardZ * outwardSign;
  const rightX = node.rightX * outwardSign, rightZ = node.rightZ * outwardSign;
  const pointOnArm = (along, lateral, h) => [node.x + forwardX * along + rightX * lateral, node.y + h, node.z + forwardZ * along + rightZ * lateral];

  offset = withRoadMarkingGeometry(() => {
    for (const stripeLateral of zebraStripeLaterals(halfWidth)) {
      const stripeLeft = stripeLateral - ZEBRA_STRIPE_HALF_WIDTH_METERS;
      const stripeRight = stripeLateral + ZEBRA_STRIPE_HALF_WIDTH_METERS;
      offset = pushGroundQuad(vertices, offset, pointOnArm(0.4, stripeLeft, ZEBRA_STRIPE_HEIGHT_METERS), pointOnArm(3.0, stripeLeft, ZEBRA_STRIPE_HEIGHT_METERS), pointOnArm(3.0, stripeRight, ZEBRA_STRIPE_HEIGHT_METERS), pointOnArm(0.4, stripeRight, ZEBRA_STRIPE_HEIGHT_METERS), ZEBRA_STRIPE_COLOR, MATERIAL.PAVING, 0.2, 1.05);
    }
    const stopLineOuter = -(halfWidth - 0.4);
    offset = pushGroundQuad(vertices, offset, pointOnArm(3.4, stopLineOuter, ZEBRA_STRIPE_HEIGHT_METERS), pointOnArm(3.8, stopLineOuter, ZEBRA_STRIPE_HEIGHT_METERS), pointOnArm(3.8, -0.2, ZEBRA_STRIPE_HEIGHT_METERS), pointOnArm(3.4, -0.2, ZEBRA_STRIPE_HEIGHT_METERS), ZEBRA_STRIPE_COLOR, MATERIAL.PAVING, 0.2, 1.1);
    return offset;
  });

  const inboundHeading = arm.heading + Math.PI;
  offset = pushManhattanTrafficSignal(vertices, offset, node.x, node.y, node.z, inboundHeading, 1, halfWidth);
  return offset;
}

function describeJunctionCorner({ junction }, arms, cornerIndex) {
  const armCount = arms.length;
  const firstArm = arms[cornerIndex];
  const nextArm = arms[(cornerIndex + 1) % armCount];
  const sectorAngle = armCount === 1 ? Math.PI * 2 : (normalizeAngle(nextArm.angle - firstArm.angle) || Math.PI * 2);
  return {
    firstArm,
    nextArm,
    sectorAngle,
    isWideSector: sectorAngle > JUNCTION_WIDE_SECTOR_RADIANS,
    firstArmClearSegments: armCornerClearSegments(firstArm, -1),
    nextArmClearSegments: armCornerClearSegments(nextArm, 1),
    bisectorHeading: firstArm.heading + sectorAngle * 0.5,
    isPocketPark: (junction.parkCorner + cornerIndex * 0.37) % 1 < POCKET_PARK_CORNER_SHARE
  };
}

function pushCornerGround(vertices, offset, plaza, corner) {
  const { padRadius, pointAtHeading, sidewalkColor } = plaza;
  const { firstArmClearSegments, nextArmClearSegments, bisectorHeading, isPocketPark } = corner;
  const { boundary, curbLine, firstBandCorner, nextBandCorner } = traceCornerBoundary(plaza, corner);

  const isGreenCorner = isPocketPark || [corner.firstArm, corner.nextArm].some(arm => armEndNode(arm, 0).info.district.groundCover === GROUND_COVER.lawn);
  const cornerSurface = isGreenCorner
    ? { color: LAWN_GREEN, material: MATERIAL.TERRAIN, variant: LAWN_TERRAIN_VARIANT }
    : { color: sidewalkColor, material: MATERIAL.PAVING, variant: PAVING_PATTERN_VARIANT.slab };
  const fanCenter = pointAtHeading(bisectorHeading, padRadius + Math.min(26, (Math.min(firstArmClearSegments, nextArmClearSegments) * SEG_LENGTH) * 0.6 + 6), JUNCTION_CORNER_CURB_HEIGHT_METERS);
  for (let step = 0; step < boundary.length; step++) {
    const nextBoundaryPoint = boundary[(step + 1) % boundary.length];
    offset = pushGroundTriangle(vertices, offset, fanCenter, boundary[step], nextBoundaryPoint, cornerSurface.color, cornerSurface.material, cornerSurface.variant, 0.96);
    plaza.junction.cornerLandTriangles.push([fanCenter, boundary[step], nextBoundaryPoint].map(point => [point[0], point[2]]));
  }
  offset = pushCurbFace(vertices, offset, curbLine);
  offset = pushJunctionCurbCap(vertices, offset, curbLine, fanCenter);
  const skirtDepth = 2.78;
  return pushQuad(vertices, offset, firstBandCorner, nextBandCorner, [nextBandCorner[0], nextBandCorner[1] - skirtDepth, nextBandCorner[2]], [firstBandCorner[0], firstBandCorner[1] - skirtDepth, firstBandCorner[2]], [0.40, 0.40, 0.41], MATERIAL.STONE, 0.1, 0.8);
}

function pushCurbFace(vertices, offset, curbTopPoints) {
  const below = (point) => [point[0], point[1] - JUNCTION_CURB_FACE_DEPTH_METERS, point[2]];
  for (let step = 0; step < curbTopPoints.length - 1; step++) {
    const curbFrom = curbTopPoints[step], curbTo = curbTopPoints[step + 1];
    offset = pushQuad(vertices, offset, curbFrom, curbTo, below(curbTo), below(curbFrom), CORNER_CURB_CONCRETE, MATERIAL.PLASTER, 0.1, 0.9);
  }
  return offset;
}

function pushJunctionCurbCap(vertices, offset, curbTopPoints, landCenter) {
  const lift = (point) => [point[0], point[1] + CURB_CAP_LIFT_METERS, point[2]];
  for (let step = 0; step < curbTopPoints.length - 1; step++) {
    const curbFrom = curbTopPoints[step], curbTo = curbTopPoints[step + 1];
    const inland = inlandCurbOffset(curbFrom, curbTo, landCenter);
    const shift = (point) => [point[0] + inland[0], point[1] + CURB_CAP_LIFT_METERS, point[2] + inland[1]];
    offset = pushGroundQuad(vertices, offset, lift(curbFrom), lift(curbTo), shift(curbTo), shift(curbFrom), CORNER_CURB_CONCRETE, MATERIAL.PLASTER, 0.1, 1.0);
  }
  return offset;
}

function inlandCurbOffset(curbFrom, curbTo, landCenter) {
  const directionX = curbTo[0] - curbFrom[0], directionZ = curbTo[2] - curbFrom[2];
  const length = Math.hypot(directionX, directionZ) || 1;
  let normalX = -directionZ / length, normalZ = directionX / length;
  const towardLand = (landCenter[0] - curbFrom[0]) * normalX + (landCenter[2] - curbFrom[2]) * normalZ;
  if (towardLand < 0) { normalX = -normalX; normalZ = -normalZ; }
  return [normalX * CURB_CAP_WIDTH, normalZ * CURB_CAP_WIDTH];
}

function traceCornerBoundary({ padRadius, pointAtHeading }, corner) {
  const { firstArm, nextArm, sectorAngle, firstArmClearSegments, nextArmClearSegments } = corner;
  const firstArmSign = armOutwardSign(firstArm);
  const nextArmSign = armOutwardSign(nextArm);
  const curbHeight = JUNCTION_CORNER_CURB_HEIGHT_METERS;
  const boundary = [];
  const firstArmCurb = [];
  const nextArmCurb = [];

  for (let step = 0; step <= firstArmClearSegments; step++) {
    const node = armEndNode(firstArm, step);
    const halfWidth = node.info.roadHalfWidth;
    const curbPoint = [node.x - node.rightX * firstArmSign * halfWidth, node.y + curbHeight, node.z - node.rightZ * firstArmSign * halfWidth];
    boundary.push(curbPoint);
    firstArmCurb.push(curbPoint);
  }
  const firstOuterNode = armEndNode(firstArm, firstArmClearSegments);
  const firstBandReach = firstOuterNode.info.roadHalfWidth + ROADSIDE_BAND_REACH_METERS;
  const firstBandCorner = [firstOuterNode.x - firstOuterNode.rightX * firstArmSign * firstBandReach, firstOuterNode.y + curbHeight, firstOuterNode.z - firstOuterNode.rightZ * firstArmSign * firstBandReach];
  boundary.push(firstBandCorner);

  const nextOuterNode = armEndNode(nextArm, nextArmClearSegments);
  const nextBandReach = nextOuterNode.info.roadHalfWidth + ROADSIDE_BAND_REACH_METERS;
  if (corner.isWideSector) {
    const midHeading = firstArm.heading + sectorAngle * 0.5;
    boundary.push(pointAtHeading(midHeading, padRadius + Math.max(firstArmClearSegments, nextArmClearSegments) * SEG_LENGTH + 30, curbHeight));
  }
  const nextBandCorner = [nextOuterNode.x + nextOuterNode.rightX * nextArmSign * nextBandReach, nextOuterNode.y + curbHeight, nextOuterNode.z + nextOuterNode.rightZ * nextArmSign * nextBandReach];
  boundary.push(nextBandCorner);

  for (let step = nextArmClearSegments; step >= 0; step--) {
    const node = armEndNode(nextArm, step);
    const halfWidth = node.info.roadHalfWidth;
    const curbPoint = [node.x + node.rightX * nextArmSign * halfWidth, node.y + curbHeight, node.z + node.rightZ * nextArmSign * halfWidth];
    boundary.push(curbPoint);
    nextArmCurb.push(curbPoint);
  }

  const innerArcPoints = traceCornerCurbArc(padRadius, pointAtHeading, corner).slice(1, -1);
  for (const arcPoint of innerArcPoints) boundary.push(arcPoint);
  const curbLine = [...nextArmCurb, ...innerArcPoints, ...firstArmCurb];
  return { boundary, curbLine, firstBandCorner, nextBandCorner };
}

function traceCornerCurbArc(padRadius, pointAtHeading, { firstArm, nextArm, sectorAngle }) {
  const maxArcSine = 0.95;
  const arcStepRadians = 0.25;
  const arcStart = firstArm.heading + Math.asin(Math.min(maxArcSine, armEndNode(firstArm, 0).info.roadHalfWidth / padRadius));
  const arcEnd = firstArm.heading + sectorAngle - Math.asin(Math.min(maxArcSine, armEndNode(nextArm, 0).info.roadHalfWidth / padRadius));
  const arcSteps = Math.max(2, Math.ceil((arcEnd - arcStart) / arcStepRadians));
  const arcPoints = [];
  for (let step = arcSteps; step >= 0; step--) {
    arcPoints.push(pointAtHeading(arcStart + (arcEnd - arcStart) * (step / arcSteps), padRadius + JUNCTION_PAD_OVERLAP_METERS, JUNCTION_CORNER_CURB_HEIGHT_METERS));
  }
  return arcPoints;
}

function pushCornerLots(vertices, offset, plaza, corner, maxLotsPerCorner) {
  const { junction, rng, padRadius, pointAtHeading } = plaza;
  const { firstArm, nextArm, sectorAngle, firstArmClearSegments, nextArmClearSegments, bisectorHeading } = corner;
  const placed = [];
  const candidates = sectorAngle < 1.9 ? JUNCTION_LOT_CANDIDATES_NARROW : JUNCTION_LOT_CANDIDATES_WIDE;
  for (const [sectorFraction, distanceFromPad] of candidates) {
    if (placed.length >= maxLotsPerCorner) break;
    const size = 11 + rng() * 4;
    const heading = firstArm.heading + sectorAngle * sectorFraction;
    const candidate = pointAtHeading(heading, padRadius + distanceFromPad, 0);
    const firstArmClearance = distanceToArmCenterline(firstArm, candidate[0], candidate[2], firstArmClearSegments + 6);
    const nextArmClearance = distanceToArmCenterline(nextArm, candidate[0], candidate[2], nextArmClearSegments + 6);
    const requiredClearance = 8.6 + size * 0.72 + 1.5;
    if (firstArmClearance < requiredClearance || nextArmClearance < requiredClearance) continue;
    if (isLotOnAnotherRoad(candidate, size, junction)) continue;
    const alongFirstArm = (candidate[0] - junction.x) * -Math.sin(firstArm.heading) + (candidate[2] - junction.z) * -Math.cos(firstArm.heading);
    const alongNextArm = (candidate[0] - junction.x) * -Math.sin(nextArm.heading) + (candidate[2] - junction.z) * -Math.cos(nextArm.heading);
    if (alongFirstArm > padRadius + firstArmClearSegments * SEG_LENGTH - size * 0.5 || alongNextArm > padRadius + nextArmClearSegments * SEG_LENGTH - size * 0.5) continue;
    if (placed.some(placedPoint => Math.hypot(placedPoint[0] - candidate[0], placedPoint[1] - candidate[2]) < size + 3)) continue;
    placed.push([candidate[0], candidate[2]]);
    if (!corner.isPocketPark) {
      offset = pushCornerBuilding(vertices, offset, candidate[0], candidate[1] + 0.18, candidate[2], bisectorHeading, size, rng);
      continue;
    }
    if (placed.length !== JUNCTION_POCKET_PARK_BENCH_SLOT) {
      plantPocketParkTree(candidate, rng);
      continue;
    }
    offset = pushPocketParkBench(vertices, offset, candidate, bisectorHeading);
  }
  return offset;
}

function isLotOnAnotherRoad(candidate, size, junction) {
  const lotHalfDiagonal = size * Math.SQRT1_2;
  const excluded = { edges: junction.arms.map(arm => arm.edge).filter(Boolean), junctions: [junction] };
  return isAreaOnOtherRoad(candidate[0], candidate[2], lotHalfDiagonal, excluded);
}

function plantPocketParkTree(spot, rng) {
  const heightSeed = rng();
  const pickSeed = rng();
  const choice = chooseTreeFromSpecies(PARK_TREE_SPECIES, { pickSeed, heightSeed });
  plantStreetTree({ x: spot[0], y: spot[1] + 0.18, z: spot[2], ...choice, maxCrownRadiusMeters: 6.5, seed: pickSeed });
}

function pushPocketParkBench(vertices, offset, spot, bisectorHeading) {
  return pushMarbleBench(vertices, offset, { base: [spot[0], spot[1] + JUNCTION_CORNER_CURB_HEIGHT_METERS, spot[2]], yaw: bisectorHeading + Math.PI * 0.5 });
}

function distanceToArmCenterline(arm, x, z, lastStep) {
  let closestDistance = Infinity;
  for (let step = 0; step <= lastStep; step += 2) {
    const node = armEndNode(arm, step);
    closestDistance = Math.min(closestDistance, Math.hypot(node.x - x, node.z - z));
  }
  return closestDistance;
}
