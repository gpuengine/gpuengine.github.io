// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const SKY_WALKWAY_LOT_CENTERS_IN_BLOCK = Object.freeze([5, 9, 13, 17]);
const SKY_WALKWAY_FIRST_SLOT_IN_BLOCK = 4;
const SKY_WALKWAY_LAST_SLOT_IN_BLOCK = 17;
const SKY_WALKWAY_MIN_SPACING_SEGMENTS = 4;
const SKY_WALKWAY_SPACING_JITTER_SEGMENTS = 2;
const SKY_WALKWAY_OVER_BRIDGE_CLEARANCE_SEGMENTS = 2;
const SKY_WALKWAY_FACADE_EMBED_METERS = 1.4;
const SKY_WALKWAY_ROOF_LANDING_DEPTH_METERS = 2.2;
const SKY_WALKWAY_ROOF_LANDING_CHANCE = 0.35;
const SKY_WALKWAY_VERTEX_RESERVE = 3700;
const SKY_WALKWAY_DECK_THICKNESS_METERS = 0.55;
const SKY_WALKWAY_DOORWAY_HEIGHT_METERS = 2.7;
const SKY_WALKWAY_BALUSTRADE_HEIGHT_METERS = 1.1;
const SKY_WALKWAY_BALUSTER_SPACING_METERS = 0.75;
const SKY_WALKWAY_BALUSTER_HALF_WIDTH_METERS = 0.07;
const SKY_WALKWAY_BALUSTRADE_PILLAR_SPACING_METERS = 5.0;
const SKY_WALKWAY_GALLERY_PIER_SPACING_METERS = 3.0;
const SKY_WALKWAY_LOGGIA_COLUMN_SPACING_METERS = 4.6;
const SKY_WALKWAY_ARCH_PIECE_COUNT = 8;
const SKY_WALKWAY_ARCH_RIM_DEPTH_METERS = 0.3;
const SKY_WALKWAY_CONCRETE_ROOF_METERS = 0.7;
const SKY_WALKWAY_CORBEL_TIERS = Object.freeze([
  { projectionMeters: 1.9, heightMeters: 0.45 },
  { projectionMeters: 1.3, heightMeters: 0.45 },
  { projectionMeters: 0.7, heightMeters: 0.5 }
]);

const STOREY_HEIGHT_METERS = 3.6;
const SKY_WALKWAY_LOWEST_STOREY = 2;
const SKY_WALKWAY_HIGHEST_STOREY = 20;
const SKY_WALKWAY_HIGH_STOREY_BIAS = 0.5;
const SKY_WALKWAY_STOREYS_KEPT_ABOVE = 2;

const SIDE_LINK_GAP_SEGMENTS_IN_BLOCK = Object.freeze([7, 11, 15]);
const SIDE_LINK_LONG_SPAN_CHANCE = 0.6;
const SIDE_LINK_MIN_SPAN_METERS = 3.5;
const SIDE_LINK_SETBACK_FROM_FACADE_METERS = 0.3;
const SIDE_LINK_CLEARANCE_OVER_ROOF_METERS = 4.0;
const SIDE_LINK_ADJACENT_LOT_STEP = 4;
const SIDE_LINK_SKIPPING_LOT_STEP = 8;
const SIDE_LINK_YAW_FROM_ROAD = Math.PI * 0.5;

const SKY_WALKWAY_HOST_BUILDINGS = Object.freeze({
  brownstone: { front: () => 10.0, roofTop: (seeds) => 16.5 + seeds.primarySeed * 7.5, roofCorniceMeters: 1.0, halfLengthMeters: 7.4 },
  castIron: { front: () => 10.8, roofTop: (seeds) => (5 + Math.floor(seeds.primarySeed * 2)) * 4.0 + 0.6, roofCorniceMeters: 1.3, halfLengthMeters: 7.3 },
  savingsBank: { front: () => 11.2, roofTop: (seeds) => 15.0 + seeds.primarySeed * 5.0, roofCorniceMeters: 1.1, halfLengthMeters: 7.3 },
  victorian: { front: () => 11.2, roofTop: (seeds) => 18.0 + seeds.primarySeed * 6.0, roofCorniceMeters: 1.1, halfLengthMeters: 7.3 },
  artDeco: { front: () => 13.95, roofTop: (seeds) => 72.0 + seeds.secondarySeed * 24.0, roofCorniceMeters: 1.0, halfLengthMeters: 10.0 },
  storageWarehouse: { front: () => 11.4, roofTop: (seeds) => (6 + Math.floor(seeds.primarySeed * 3)) * WAREHOUSE_FLOOR_HEIGHT_METERS + 1.2, halfLengthMeters: 7.1 },
  georgian: { front: () => 12.0, roofTop: () => 14.0, halfLengthMeters: 7.3 },
  limestoneSetback: { front: (seeds) => 10.5 + seeds.secondarySeed * 2.0, roofTop: (seeds) => 18.0 + seeds.primarySeed * 9.0, roofCorniceMeters: 0.9, halfLengthMeters: 7.3 },
  colonnade: { front: (seeds) => 11.4 + seeds.primarySeed * 2.0, roofTop: (seeds) => 28.0 + seeds.secondarySeed * 20.0, roofCorniceMeters: 1.2, halfLengthMeters: 7.0 },
  bronzeGlass: { front: () => 14.0, roofTop: (seeds) => 70.0 + seeds.primarySeed * 70.0, roofCorniceMeters: 0.6, halfLengthMeters: 5.8 },
  fountainPlaza: { front: () => 14.6, roofTop: (seeds) => 34.0 + seeds.secondarySeed * 22.0, roofCorniceMeters: 1.4, halfLengthMeters: 6.9 },
  brutalistTower: { front: () => BRUTALIST_TOWER.frontLateralMeters, roofTop: (seeds) => brutalistTowerHeight(seeds), roofCorniceMeters: BRUTALIST_ROOF_SLAB_METERS, halfLengthMeters: BRUTALIST_TOWER.shaftLengthMeters * 0.5 }
});

const SKY_WALKWAY_PALETTES = Object.freeze([
  { stone: STONE_TONES.limestone, trim: STONE_TONES.granite, marble: MARBLE_TONES[0] },
  { stone: STONE_TONES.sandstone, trim: STONE_TONES.brownstone, marble: MARBLE_TONES[1] },
  { stone: STONE_TONES.granite, trim: STONE_TONES.darkGranite, marble: MARBLE_TONES[2] },
  { stone: STONE_TONES.portland, trim: STONE_TONES.granite, marble: MARBLE_TONES[0] },
  { stone: ASHLAR_TONES.travertine, trim: STONE_TONES.bronze, marble: MARBLE_TONES[1] }
]);

const ROAD_CENTERLINE_LATERAL_METERS = 0;
const SKY_WALKWAY_LANTERN_GLOW = Object.freeze([1.0, 0.86, 0.58]);

const ARCHED_BALUSTRADE_STYLE = Object.freeze({ name: "ARCHED BALUSTRADE SPAN", widthMeters: 3.4, heightAtFacadeMeters: 2.8, build: pushArchedBalustradeWalkway });
const MARBLE_GALLERY_STYLE = Object.freeze({ name: "MARBLE GALLERY", widthMeters: 3.6, heightAtFacadeMeters: 4.8, build: pushMarbleGalleryWalkway });
const COLONNADE_LOGGIA_STYLE = Object.freeze({ name: "COLONNADE LOGGIA", widthMeters: 4.0, heightAtFacadeMeters: 5.8, build: pushColonnadeLoggiaWalkway });
const PAVILION_SPAN_STYLE = Object.freeze({ name: "PAVILION SPAN", widthMeters: 3.8, heightAtFacadeMeters: 2.8, build: pushPavilionWalkway });

const CROSS_ROAD_WALKWAY_STYLES = Object.freeze([ARCHED_BALUSTRADE_STYLE, MARBLE_GALLERY_STYLE, COLONNADE_LOGGIA_STYLE, PAVILION_SPAN_STYLE]);
const SIDE_LINK_WALKWAY_STYLES = Object.freeze([MARBLE_GALLERY_STYLE, COLONNADE_LOGGIA_STYLE]);

function pushPlannedSkyWalkways(vertices, offset, segment) {
  const plans = planSkyWalkways(segment);
  for (const plan of plans) {
    if (!hasVertexRoom(offset, SKY_WALKWAY_VERTEX_RESERVE)) break;
    offset = plan.style.build(offset, describeSkyWalkway(vertices, plan));
  }
  return offset;
}

function planCrossRoadWalkway(segment) {
  const lotCenter = nearestLotCenter(segment.startInfo.inBlockIdx);
  const leftHost = describeHostBuilding(segment, -1, lotCenter);
  const rightHost = describeHostBuilding(segment, 1, lotCenter);
  if (!leftHost || !rightHost) return null;
  const { startNode } = segment;
  const style = pickFromList(CROSS_ROAD_WALKWAY_STYLES, seededRandom(startNode.index * 9.13 + 2.7));
  const connection = chooseCrossRoadConnection(style, { leftHost, rightHost }, startNode.index);
  if (!connection) return null;
  return {
    style,
    floor: connection.floor,
    frame: { x: startNode.x, y: startNode.y, z: startNode.z, yaw: startNode.heading },
    ends: [
      describeWalkwayEnd(-leftHost.front, -1, connection.roofLandingSide === -1),
      describeWalkwayEnd(rightHost.front, 1, connection.roofLandingSide === 1)
    ],
    seed: startNode.index
  };
}

function planSkyWalkways(segment) {
  const { startNode, startInfo } = segment;
  if (!isWalkwayCandidate(segment)) return [];
  const edgeNodes = startNode.edge.nodes;
  const blockStartLocalIndex = startNode.segmentIndex - startInfo.inBlockIdx;
  let nextAllowedSlot = SKY_WALKWAY_FIRST_SLOT_IN_BLOCK;
  for (let slot = SKY_WALKWAY_FIRST_SLOT_IN_BLOCK; slot < startInfo.inBlockIdx; slot++) {
    if (slot < nextAllowedSlot) continue;
    const candidate = describeSlotSegment(edgeNodes, blockStartLocalIndex + slot);
    if (!candidate || !planWalkwaysOnSegment(candidate).length) continue;
    nextAllowedSlot = slot + walkwaySpacingAfter(startInfo.blockNumber, slot);
  }
  return startInfo.inBlockIdx >= nextAllowedSlot ? planWalkwaysOnSegment(segment) : [];
}

function isWalkwayCandidate(segment) {
  const { startInfo, isViaduct } = segment;
  if (startInfo.inBlockIdx < SKY_WALKWAY_FIRST_SLOT_IN_BLOCK || startInfo.inBlockIdx > SKY_WALKWAY_LAST_SLOT_IN_BLOCK) return false;
  if (startInfo.isIntersection || isViaduct || startInfo.overBridgeStyle >= 0) return false;
  return !isNearOverBridge(startInfo.blockNumber, startInfo.inBlockIdx);
}

function describeSlotSegment(edgeNodes, localIndex) {
  const startNode = edgeNodes[localIndex];
  const endNode = edgeNodes[localIndex + 1];
  if (!startNode || !endNode) return null;
  refreshCrossRoadClearance(startNode, endNode);
  const candidate = describeRoadSegment(startNode, endNode);
  return isWalkwayCandidate(candidate) ? candidate : null;
}

function planWalkwaysOnSegment(segment) {
  if (SIDE_LINK_GAP_SEGMENTS_IN_BLOCK.includes(segment.startInfo.inBlockIdx)) return planSideLinks(segment);
  const crossRoadPlan = planCrossRoadWalkway(segment);
  return crossRoadPlan ? [crossRoadPlan] : [];
}

function walkwaySpacingAfter(blockNumber, slot) {
  return SKY_WALKWAY_MIN_SPACING_SEGMENTS + Math.floor(seededRandom(blockNumber * 3.91 + slot * 1.7) * (SKY_WALKWAY_SPACING_JITTER_SEGMENTS + 1));
}

function nearestLotCenter(inBlockIdx) {
  return SKY_WALKWAY_LOT_CENTERS_IN_BLOCK.reduce((nearest, center) => Math.abs(center - inBlockIdx) < Math.abs(nearest - inBlockIdx) ? center : nearest);
}

function isNearOverBridge(blockNumber, inBlockIdx) {
  if (!blockHasOverBridge(blockNumber)) return false;
  return Math.abs(inBlockIdx - overBridgeSegmentInBlock(blockNumber)) <= SKY_WALKWAY_OVER_BRIDGE_CLEARANCE_SEGMENTS;
}

function describeHostBuilding(segment, side, lotCenter) {
  const { startNode, startInfo, startRoadHalfWidth } = segment;
  if (segment.isSideHidden(side)) return null;
  if (sideIsParkOf(startInfo, side) || sideIsValleyOf(startInfo, side) || sideIsFieldOf(startInfo, side)) return null;
  const blockNumber = Math.floor(startNode.index / MANHATTAN_BLOCK_PERIOD);
  const building = frontageBuildingCovering(blockNumber, side, lotCenter, startInfo.district);
  const host = building && SKY_WALKWAY_HOST_BUILDINGS[building.styleId];
  if (!host || isOwnerLotSideHidden(segment, side, building.ownerInBlockIdx)) return null;
  const ownerSegmentIndex = blockNumber * MANHATTAN_BLOCK_PERIOD + building.ownerInBlockIdx;
  const ownerSeeds = describeBuildingLot({ yaw: startNode.heading, side, segIndex: ownerSegmentIndex, roadHalfWidth: startRoadHalfWidth });
  const lotSpanCenterShift = (building.lotSpan - 1) * FRONTAGE_LOT_SPACING_SEGMENTS * SEG_LENGTH * 0.5;
  return {
    ownerInBlockIdx: building.ownerInBlockIdx,
    front: host.front(ownerSeeds) + ownerSeeds.shiftLateral,
    roofTop: host.roofTop(ownerSeeds),
    hasFlatRoof: host.roofCorniceMeters !== undefined,
    roofCorniceMeters: host.roofCorniceMeters,
    centerAlong: (building.ownerInBlockIdx - startInfo.inBlockIdx) * SEG_LENGTH + lotSpanCenterShift,
    halfLength: host.halfLengthMeters
  };
}

function isOwnerLotSideHidden(segment, side, ownerInBlockIdx) {
  const { startNode, startInfo } = segment;
  const edgeNodes = startNode.edge.nodes;
  const ownerLocalIndex = startNode.segmentIndex + ownerInBlockIdx - startInfo.inBlockIdx;
  const ownerNode = edgeNodes[ownerLocalIndex];
  const followingNode = edgeNodes[ownerLocalIndex + 1];
  if (!ownerNode || !followingNode) return true;
  refreshCrossRoadClearance(ownerNode, followingNode);
  return side < 0 ? ownerNode.hidesLeftSide : ownerNode.hidesRightSide;
}

function chooseCrossRoadConnection(style, { leftHost, rightHost }, index) {
  const roofLanding = describeRoofLanding(style, { leftHost, rightHost });
  const facadeFloor = chooseFacadeFloor(style, { lowestFloor: 0, lowerRoofTop: Math.min(leftHost.roofTop, rightHost.roofTop), roll: seededRandom(index * 4.71 + 8.3) });
  const prefersRoof = seededRandom(index * 3.17 + 0.9) < SKY_WALKWAY_ROOF_LANDING_CHANCE;
  if (roofLanding && (prefersRoof || facadeFloor === null)) return roofLanding;
  if (facadeFloor === null) return null;
  return { floor: facadeFloor, roofLandingSide: 0 };
}

function chooseFacadeFloor(style, { lowestFloor, lowerRoofTop, roll }) {
  const lowest = Math.max(SKY_WALKWAY_LOWEST_STOREY, Math.ceil(lowestFloor / STOREY_HEIGHT_METERS));
  const ceiling = lowerRoofTop - SKY_WALKWAY_STOREYS_KEPT_ABOVE * STOREY_HEIGHT_METERS - style.heightAtFacadeMeters;
  const highest = Math.min(SKY_WALKWAY_HIGHEST_STOREY, Math.floor(ceiling / STOREY_HEIGHT_METERS));
  if (highest < lowest) return null;
  const storey = lowest + Math.floor(Math.pow(roll, SKY_WALKWAY_HIGH_STOREY_BIAS) * (highest - lowest + 1));
  return storey * STOREY_HEIGHT_METERS + 0.15;
}

function describeRoofLanding(style, { leftHost, rightHost }) {
  const lowerSide = leftHost.roofTop <= rightHost.roofTop ? -1 : 1;
  const lowerHost = lowerSide < 0 ? leftHost : rightHost;
  const higherHost = lowerSide < 0 ? rightHost : leftHost;
  if (!lowerHost.hasFlatRoof) return null;
  const floor = lowerHost.roofTop + lowerHost.roofCorniceMeters + SKY_WALKWAY_DECK_THICKNESS_METERS;
  const clearsHigherFacade = floor + style.heightAtFacadeMeters + SKY_WALKWAY_STOREYS_KEPT_ABOVE * STOREY_HEIGHT_METERS <= higherHost.roofTop;
  if (floor < SKY_WALKWAY_LOWEST_STOREY * STOREY_HEIGHT_METERS || !clearsHigherFacade) return null;
  return { floor, roofLandingSide: lowerSide };
}

function planSideLinks(segment) {
  const preferredSide = seededRandom(segment.startNode.index * 5.83 + 0.4) < 0.5 ? -1 : 1;
  const link = planSideLink(segment, preferredSide) || planSideLink(segment, -preferredSide);
  return link ? [link] : [];
}

function planSideLink(segment, side) {
  const index = segment.startNode.index;
  const fromLotCenter = segment.startInfo.inBlockIdx - SIDE_LINK_ADJACENT_LOT_STEP * 0.5;
  const style = pickFromList(SIDE_LINK_WALKWAY_STYLES, seededRandom(index * 7.41 + side * 1.3 + 0.2));
  const prefersLongSpan = seededRandom(index * 2.63 + side * 4.1 + 0.7) < SIDE_LINK_LONG_SPAN_CHANCE;
  const lotSteps = prefersLongSpan ? [SIDE_LINK_SKIPPING_LOT_STEP, SIDE_LINK_ADJACENT_LOT_STEP] : [SIDE_LINK_ADJACENT_LOT_STEP, SIDE_LINK_SKIPPING_LOT_STEP];
  for (const lotStep of lotSteps) {
    const link = planLinkBetweenLots(segment, { side, style, fromLotCenter, toLotCenter: fromLotCenter + lotStep });
    if (link) return link;
  }
  return null;
}

function planLinkBetweenLots(segment, { side, style, fromLotCenter, toLotCenter }) {
  if (!SKY_WALKWAY_LOT_CENTERS_IN_BLOCK.includes(toLotCenter)) return null;
  const fromHost = describeHostBuilding(segment, side, fromLotCenter);
  const toHost = describeHostBuilding(segment, side, toLotCenter);
  if (!fromHost || !toHost || fromHost.ownerInBlockIdx === toHost.ownerInBlockIdx) return null;
  const lowestFloor = lowestFloorOverSkippedLots(segment, { side, fromHost, toHost, fromLotCenter, toLotCenter });
  if (lowestFloor === null) return null;
  const fromFace = fromHost.centerAlong + fromHost.halfLength;
  const toFace = toHost.centerAlong - toHost.halfLength;
  if (toFace - fromFace < SIDE_LINK_MIN_SPAN_METERS) return null;
  const index = segment.startNode.index;
  const floor = chooseFacadeFloor(style, { lowestFloor, lowerRoofTop: Math.min(fromHost.roofTop, toHost.roofTop), roll: seededRandom(index * 6.11 + side * 3.7 + 0.5) });
  if (floor === null) return null;
  return {
    style,
    floor,
    frame: sideLinkFrame(segment, side * (Math.max(fromHost.front, toHost.front) + style.widthMeters * 0.5 + SIDE_LINK_SETBACK_FROM_FACADE_METERS)),
    ends: [describeWalkwayEnd(fromFace, -1, false), describeWalkwayEnd(toFace, 1, false)],
    seed: index * 3 + side
  };
}

function lowestFloorOverSkippedLots(segment, { side, fromHost, toHost, fromLotCenter, toLotCenter }) {
  let lowestFloor = 0;
  for (let lotCenter = fromLotCenter + SIDE_LINK_ADJACENT_LOT_STEP; lotCenter < toLotCenter; lotCenter += SIDE_LINK_ADJACENT_LOT_STEP) {
    const skippedHost = describeHostBuilding(segment, side, lotCenter);
    if (!skippedHost) return null;
    if (skippedHost.ownerInBlockIdx === fromHost.ownerInBlockIdx || skippedHost.ownerInBlockIdx === toHost.ownerInBlockIdx) return null;
    lowestFloor = Math.max(lowestFloor, skippedHost.roofTop + SIDE_LINK_CLEARANCE_OVER_ROOF_METERS);
  }
  return lowestFloor;
}

function sideLinkFrame(segment, lateral) {
  const { x, y, z, heading, rightX, rightZ } = segment.startNode;
  return { x: x + rightX * lateral, y, z: z + rightZ * lateral, yaw: heading + SIDE_LINK_YAW_FROM_ROAD };
}

function describeSkyWalkway(vertices, { style, floor, frame, ends, seed }) {
  const { x, y, z, yaw } = frame;
  return {
    vertices, x, y, z, yaw,
    rightX: Math.cos(yaw),
    rightZ: -Math.sin(yaw),
    forwardX: -Math.sin(yaw),
    forwardZ: -Math.cos(yaw),
    faces: ends,
    leftFace: ends[0].lateral,
    rightFace: ends[1].lateral,
    leftEnd: ends[0].deckEnd,
    rightEnd: ends[1].deckEnd,
    floor,
    width: style.widthMeters,
    palette: pickFromList(SKY_WALKWAY_PALETTES, seededRandom(seed * 6.37 + 1.9)),
    detailSeed: seededRandom(seed * 2.29 + 5.5)
  };
}

function describeWalkwayEnd(lateral, towardBuilding, landsOnRoof) {
  const reach = landsOnRoof ? SKY_WALKWAY_ROOF_LANDING_DEPTH_METERS : SKY_WALKWAY_FACADE_EMBED_METERS;
  return { lateral, towardBuilding, landsOnRoof, deckEnd: lateral + towardBuilding * reach };
}

function pushArchedBalustradeWalkway(offset, walkway) {
  offset = pushWalkwayStructure(offset, walkway);
  offset = pushArchedSoffit(offset, walkway);
  offset = pushWalkwayBalustrades(offset, walkway);
  offset = pushFacadeDoorways(offset, walkway);
  offset = pushBalustradeEndLamps(offset, walkway);
  return pushHangingLanterns(offset, walkway, walkway.floor - SKY_WALKWAY_DECK_THICKNESS_METERS - archDepthAt(walkway, 0.5));
}

function pushPavilionWalkway(offset, walkway) {
  offset = pushWalkwayStructure(offset, walkway);
  offset = pushArchedSoffit(offset, walkway);
  offset = pushWalkwayBalustrades(offset, walkway);
  offset = pushFacadeDoorways(offset, walkway);
  return pushCentralPavilion(offset, walkway);
}

function pushMarbleGalleryWalkway(offset, walkway) {
  const { floor, palette } = walkway;
  const wallTop = floor + 3.3;
  offset = pushWalkwayStructure(offset, walkway);
  offset = pushHangingLanterns(offset, walkway, floor - SKY_WALKWAY_DECK_THICKNESS_METERS);
  for (const edge of [-1, 1]) offset = pushGalleryWall(offset, walkway, { edge, wallTop });
  offset = pushWalkwayRoof(offset, walkway, { roofBottom: wallTop });
  return pushFacadeCollars(offset, walkway, { top: wallTop + 0.6, color: palette.marble });
}

function pushColonnadeLoggiaWalkway(offset, walkway) {
  const { floor, palette } = walkway;
  const columnHeight = 3.4;
  const beamTop = floor + columnHeight + 0.5;
  offset = pushWalkwayStructure(offset, walkway);
  offset = pushHangingLanterns(offset, walkway, floor - SKY_WALKWAY_DECK_THICKNESS_METERS);
  for (const edge of [-1, 1]) offset = pushLoggiaSide(offset, walkway, { edge, columnHeight });
  offset = pushWalkwayRoof(offset, walkway, { roofBottom: beamTop });
  return pushFacadeCollars(offset, walkway, { top: beamTop + 0.5, color: palette.trim });
}

function pushWalkwayStructure(offset, walkway) {
  const { leftFace, rightFace, leftEnd, rightEnd, floor, width, palette } = walkway;
  const deckBottom = floor - SKY_WALKWAY_DECK_THICKNESS_METERS;
  offset = pushWalkwayBox(offset, walkway, { fromLateral: leftEnd, toLateral: rightEnd, bottom: deckBottom, top: floor, length: width, color: palette.stone, variant: 0.55 });
  for (const edge of [-1, 1]) {
    offset = pushWalkwayBox(offset, walkway, { fromLateral: leftFace, toLateral: rightFace, along: edge * (width * 0.5 + 0.08), bottom: deckBottom + 0.12, top: deckBottom + 0.42, length: 0.2, color: palette.marble, material: MATERIAL.MARBLE, occlusion: 1.0 });
  }
  return pushFacadeCorbels(offset, walkway);
}

function pushFacadeCorbels(offset, walkway) {
  const { floor, width, palette } = walkway;
  let tierTop = floor - SKY_WALKWAY_DECK_THICKNESS_METERS;
  for (const tier of SKY_WALKWAY_CORBEL_TIERS) {
    for (const face of walkway.faces) {
      if (face.landsOnRoof) continue;
      const outer = face.lateral - face.towardBuilding * tier.projectionMeters;
      const inner = face.lateral + face.towardBuilding * 0.3;
      offset = pushWalkwayBox(offset, walkway, { fromLateral: Math.min(outer, inner), toLateral: Math.max(outer, inner), bottom: tierTop - tier.heightMeters, top: tierTop, length: width * 0.86, color: palette.trim, variant: 0.2 });
    }
    tierTop -= tier.heightMeters;
  }
  return offset;
}

function pushArchedSoffit(offset, walkway) {
  const { leftFace, rightFace, width, palette } = walkway;
  const soffitTop = walkway.floor - SKY_WALKWAY_DECK_THICKNESS_METERS;
  const spanLength = rightFace - leftFace;
  const spandrelSurface = { color: palette.stone, material: MATERIAL.STONE, variant: 0.5, occlusion: 0.9 };
  const archRimSurface = { color: palette.marble, material: MATERIAL.MARBLE, variant: 0.1, occlusion: 1.0 };
  for (let piece = 0; piece < SKY_WALKWAY_ARCH_PIECE_COUNT; piece++) {
    const startFraction = piece / SKY_WALKWAY_ARCH_PIECE_COUNT;
    const endFraction = (piece + 1) / SKY_WALKWAY_ARCH_PIECE_COUNT;
    const pieceSpan = {
      fromLateral: leftFace + spanLength * startFraction,
      toLateral: leftFace + spanLength * endFraction
    };
    const fromArch = soffitTop - archDepthAt(walkway, startFraction);
    const toArch = soffitTop - archDepthAt(walkway, endFraction);
    offset = pushTaperedSpanPiece(offset, walkway, { ...pieceSpan, fromBottom: fromArch, toBottom: toArch, fromTop: soffitTop, toTop: soffitTop, length: width * 0.92, surface: spandrelSurface });
    offset = pushTaperedSpanPiece(offset, walkway, { ...pieceSpan, fromBottom: fromArch - SKY_WALKWAY_ARCH_RIM_DEPTH_METERS, toBottom: toArch - SKY_WALKWAY_ARCH_RIM_DEPTH_METERS, fromTop: fromArch + 0.02, toTop: toArch + 0.02, length: width * 0.92 + 0.16, surface: archRimSurface });
  }
  const keystoneBottom = soffitTop - archDepthAt(walkway, 0.5) - SKY_WALKWAY_ARCH_RIM_DEPTH_METERS - 0.4;
  return pushWalkwayBox(offset, walkway, { fromLateral: (leftFace + rightFace) * 0.5 - 0.35, toLateral: (leftFace + rightFace) * 0.5 + 0.35, bottom: keystoneBottom, top: soffitTop, length: width + 0.24, color: palette.marble, material: MATERIAL.MARBLE, occlusion: 1.0 });
}

function archDepthAt(walkway, spanFraction) {
  const haunchDepth = 1.3 + walkway.detailSeed * 1.2;
  const fromCrown = (spanFraction - 0.5) * 2.0;
  return 0.12 + haunchDepth * fromCrown * fromCrown;
}

function pushTaperedSpanPiece(offset, walkway, { fromLateral, toLateral, fromBottom, toBottom, fromTop, toTop, length, surface }) {
  const halfLength = length * 0.5;
  const corner = (lateral, along, height) => walkwayPoint(walkway, lateral, along, height);
  const corners = [
    corner(toLateral, -halfLength, toBottom), corner(toLateral, halfLength, toBottom), corner(toLateral, halfLength, toTop), corner(toLateral, -halfLength, toTop),
    corner(fromLateral, -halfLength, fromBottom), corner(fromLateral, halfLength, fromBottom), corner(fromLateral, halfLength, fromTop), corner(fromLateral, -halfLength, fromTop)
  ];
  return pushEightCornerSolid(walkway.vertices, offset, corners, surface);
}

function pushWalkwayBalustrades(offset, walkway) {
  for (const edge of [-1, 1]) {
    offset = pushBalustradeRun(offset, walkway, edge * (walkway.width * 0.5 - 0.18));
  }
  return offset;
}

function pushBalustradeRun(offset, walkway, along) {
  const { leftFace, rightFace, floor, palette } = walkway;
  const railTop = floor + SKY_WALKWAY_BALUSTRADE_HEIGHT_METERS;
  offset = pushWalkwayBox(offset, walkway, { fromLateral: leftFace, toLateral: rightFace, along, bottom: floor, top: floor + 0.28, length: 0.42, color: palette.trim, variant: 0.2 });
  offset = pushWalkwayBox(offset, walkway, { fromLateral: leftFace, toLateral: rightFace, along, bottom: railTop - 0.14, top: railTop, length: 0.32, color: palette.marble, material: MATERIAL.MARBLE, occlusion: 1.0 });
  offset = withDetailGeometry(() => pushBalusters(offset, walkway, { along, bottom: floor + 0.28, top: railTop - 0.14 }));
  return pushBalustradePillars(offset, walkway, { along, top: railTop + 0.22 });
}

function pushBalusters(offset, walkway, { along, bottom, top }) {
  const { leftFace, rightFace, palette } = walkway;
  const count = Math.floor((rightFace - leftFace) / SKY_WALKWAY_BALUSTER_SPACING_METERS);
  const spacing = (rightFace - leftFace) / count;
  const surface = { color: palette.marble, material: MATERIAL.MARBLE, variant: 0.1, occlusion: 0.97 };
  for (let baluster = 1; baluster < count; baluster++) {
    offset = pushBalusterFaces(offset, walkway, { lateral: leftFace + baluster * spacing, along, bottom, top, surface });
  }
  return offset;
}

function pushBalusterFaces(offset, walkway, { lateral, along, bottom, top, surface }) {
  const halfWidth = SKY_WALKWAY_BALUSTER_HALF_WIDTH_METERS;
  const faceAt = (faceAlong) => [
    walkwayPoint(walkway, lateral - halfWidth, faceAlong, bottom),
    walkwayPoint(walkway, lateral + halfWidth, faceAlong, bottom),
    walkwayPoint(walkway, lateral + halfWidth, faceAlong, top),
    walkwayPoint(walkway, lateral - halfWidth, faceAlong, top)
  ];
  const faces = [faceAt(along - halfWidth), faceAt(along + halfWidth)];
  return pushConvexFaces(walkway.vertices, offset, faces, walkwayPoint(walkway, lateral, along, (bottom + top) * 0.5), surface);
}

function pushBalustradePillars(offset, walkway, { along, top }) {
  const { leftFace, rightFace, floor, palette } = walkway;
  const count = Math.max(1, Math.round((rightFace - leftFace) / SKY_WALKWAY_BALUSTRADE_PILLAR_SPACING_METERS));
  for (let pillar = 0; pillar <= count; pillar++) {
    const lateral = lerp(leftFace + 0.3, rightFace - 0.3, pillar / count);
    offset = pushWalkwayBox(offset, walkway, { fromLateral: lateral - 0.24, toLateral: lateral + 0.24, along, bottom: floor, top, length: 0.48, color: palette.marble, material: MATERIAL.MARBLE, occlusion: 1.0 });
  }
  return offset;
}

function pushBalustradeEndLamps(offset, walkway) {
  const { floor, width } = walkway;
  const postTop = floor + SKY_WALKWAY_BALUSTRADE_HEIGHT_METERS + 1.5;
  for (const face of walkway.faces) {
    const lateral = face.lateral - face.towardBuilding * 0.3;
    for (const edge of [-1, 1]) {
      const along = edge * (width * 0.5 - 0.18);
      offset = pushWalkwayBox(offset, walkway, { fromLateral: lateral - 0.08, toLateral: lateral + 0.08, along, bottom: floor + SKY_WALKWAY_BALUSTRADE_HEIGHT_METERS, top: postTop, length: 0.16, color: STONE_TONES.ironBlack, material: MATERIAL.METAL, occlusion: 0.9 });
      offset = pushWalkwayBox(offset, walkway, { fromLateral: lateral - 0.2, toLateral: lateral + 0.2, along, bottom: postTop, top: postTop + 0.45, length: 0.4, color: SKY_WALKWAY_LANTERN_GLOW, material: MATERIAL.GLOW, occlusion: 1.0 });
    }
  }
  return offset;
}

function pushFacadeDoorways(offset, walkway) {
  const { floor, width, palette } = walkway;
  const doorwayTop = floor + SKY_WALKWAY_DOORWAY_HEIGHT_METERS;
  for (const face of walkway.faces) {
    const frontLateral = face.lateral - face.towardBuilding * 0.25;
    const frame = { fromLateral: Math.min(frontLateral, face.lateral + face.towardBuilding * 0.2), toLateral: Math.max(frontLateral, face.lateral + face.towardBuilding * 0.2) };
    for (const edge of [-1, 1]) {
      offset = pushWalkwayBox(offset, walkway, { ...frame, along: edge * (width * 0.32), bottom: floor, top: doorwayTop, length: 0.42, color: palette.marble, material: MATERIAL.MARBLE, occlusion: 1.0 });
    }
    offset = pushWalkwayBox(offset, walkway, { ...frame, bottom: doorwayTop, top: doorwayTop + 0.55, length: width * 0.64 + 0.8, color: palette.marble, material: MATERIAL.MARBLE, occlusion: 1.0 });
    if (face.landsOnRoof) continue;
    offset = pushWalkwayBox(offset, walkway, { fromLateral: face.lateral - 0.06, toLateral: face.lateral + 0.06, bottom: floor, top: doorwayTop, length: width * 0.64 - 0.42, color: [1.0, 0.84, 0.58], material: MATERIAL.GLOW, occlusion: 1.0 });
  }
  return offset;
}

function pushFacadeCollars(offset, walkway, { top, color }) {
  const { floor, width } = walkway;
  for (const face of walkway.faces) {
    const collar = { fromLateral: Math.min(face.lateral, face.lateral - face.towardBuilding * 0.45), toLateral: Math.max(face.lateral, face.lateral - face.towardBuilding * 0.45) };
    for (const edge of [-1, 1]) {
      offset = pushWalkwayBox(offset, walkway, { ...collar, along: edge * (width * 0.5 + 0.2), bottom: floor - SKY_WALKWAY_DECK_THICKNESS_METERS - 0.3, top, length: 0.55, color, material: MATERIAL.MARBLE, occlusion: 1.0 });
    }
    offset = pushWalkwayBox(offset, walkway, { ...collar, bottom: top - 0.5, top, length: width + 0.95, color, material: MATERIAL.MARBLE, occlusion: 1.0 });
  }
  return offset;
}

function pushHangingLanterns(offset, walkway, ceiling) {
  const { leftFace, rightFace } = walkway;
  for (const spanFraction of [0.3, 0.7]) {
    const lateral = lerp(leftFace, rightFace, spanFraction);
    offset = pushWalkwayBox(offset, walkway, { fromLateral: lateral - 0.04, toLateral: lateral + 0.04, bottom: ceiling - 0.7, top: ceiling, length: 0.08, color: STONE_TONES.ironBlack, material: MATERIAL.METAL, occlusion: 0.9 });
    offset = pushWalkwayBox(offset, walkway, { fromLateral: lateral - 0.22, toLateral: lateral + 0.22, bottom: ceiling - 1.15, top: ceiling - 0.7, length: 0.44, color: SKY_WALKWAY_LANTERN_GLOW, material: MATERIAL.GLOW, occlusion: 1.0 });
  }
  return offset;
}

function pushGalleryWall(offset, walkway, { edge, wallTop }) {
  const { leftFace, rightFace, floor, width, palette } = walkway;
  const wallAlong = edge * (width * 0.5 - 0.2);
  const sillTop = floor + 1.0;
  const glassTop = wallTop - 0.45;
  offset = pushWalkwayBox(offset, walkway, { fromLateral: leftFace, toLateral: rightFace, along: wallAlong, bottom: floor, top: sillTop, length: 0.4, color: palette.stone, variant: 0.5 });
  offset = pushWalkwayBox(offset, walkway, { fromLateral: leftFace, toLateral: rightFace, along: wallAlong, bottom: sillTop, top: sillTop + 0.12, length: 0.5, color: palette.marble, material: MATERIAL.MARBLE, occlusion: 1.0 });
  offset = pushWalkwayBox(offset, walkway, { fromLateral: leftFace, toLateral: rightFace, along: wallAlong, bottom: sillTop + 0.12, top: glassTop, length: 0.12, color: STONE_TONES.darkGlass, material: MATERIAL.METAL, variant: 0.3 });
  offset = pushWalkwayBox(offset, walkway, { fromLateral: leftFace, toLateral: rightFace, along: wallAlong + edge * 0.07, bottom: glassTop - 0.18, top: glassTop, length: 0.03, color: [1.0, 0.88, 0.64], material: MATERIAL.GLOW, occlusion: 1.0 });
  offset = pushWalkwayBox(offset, walkway, { fromLateral: leftFace, toLateral: rightFace, along: wallAlong, bottom: glassTop, top: wallTop, length: 0.42, color: palette.stone, variant: 0.5 });
  return pushGalleryPiers(offset, walkway, { wallAlong, wallTop });
}

function pushGalleryPiers(offset, walkway, { wallAlong, wallTop }) {
  const { leftFace, rightFace, floor, palette } = walkway;
  const count = Math.max(1, Math.round((rightFace - leftFace) / SKY_WALKWAY_GALLERY_PIER_SPACING_METERS));
  for (let pier = 0; pier <= count; pier++) {
    const lateral = lerp(leftFace + 0.3, rightFace - 0.3, pier / count);
    offset = pushWalkwayBox(offset, walkway, { fromLateral: lateral - 0.26, toLateral: lateral + 0.26, along: wallAlong, bottom: floor, top: wallTop, length: 0.58, color: palette.marble, material: MATERIAL.MARBLE, occlusion: 1.0 });
  }
  return offset;
}

function pushLoggiaSide(offset, walkway, { edge, columnHeight }) {
  const { leftFace, rightFace, floor, width, palette } = walkway;
  const sideAlong = edge * (width * 0.5 - 0.3);
  const count = Math.max(1, Math.round((rightFace - leftFace) / SKY_WALKWAY_LOGGIA_COLUMN_SPACING_METERS));
  offset = pushWalkwayBox(offset, walkway, { fromLateral: leftFace, toLateral: rightFace, along: sideAlong, bottom: floor, top: floor + 0.95, length: 0.34, color: palette.marble, material: MATERIAL.MARBLE, occlusion: 0.98 });
  for (let column = 0; column <= count; column++) {
    const base = walkwayPoint(walkway, lerp(leftFace + 0.5, rightFace - 0.5, column / count), sideAlong, floor);
    offset = pushRoundColumn(walkway.vertices, offset, { x: base[0], y: base[1], z: base[2], height: columnHeight, radius: 0.24, yaw: walkway.yaw, color: palette.marble, material: MATERIAL.MARBLE, capitalColor: palette.stone });
  }
  return pushWalkwayBox(offset, walkway, { fromLateral: leftFace, toLateral: rightFace, along: sideAlong, bottom: floor + columnHeight, top: floor + columnHeight + 0.5, length: 0.7, color: palette.stone, variant: 0.3 });
}

function pushWalkwayRoof(offset, walkway, { roofBottom }) {
  const { leftFace, rightFace, leftEnd, rightEnd, width, palette } = walkway;
  offset = pushWalkwayBox(offset, walkway, { fromLateral: leftEnd, toLateral: rightEnd, bottom: roofBottom, top: roofBottom + 0.3, length: width + 0.3, color: palette.stone, variant: 0.3 });
  offset = pushWalkwayBox(offset, walkway, { fromLateral: leftFace, toLateral: rightFace, bottom: roofBottom + 0.3, top: roofBottom + 0.55, length: width + 0.7, color: palette.marble, material: MATERIAL.MARBLE, occlusion: 1.0 });
  return pushWalkwayBox(offset, walkway, { fromLateral: leftEnd, toLateral: rightEnd, bottom: roofBottom + 0.55, top: roofBottom + 0.55 + SKY_WALKWAY_CONCRETE_ROOF_METERS, length: width + 0.9, color: BRUTALIST_CONCRETE, material: MATERIAL.PLASTER, variant: PLASTER_PANEL_VARIANT, occlusion: 1.0 });
}

function pushCentralPavilion(offset, walkway) {
  const { floor, width, palette } = walkway;
  const pavilionLateral = ROAD_CENTERLINE_LATERAL_METERS;
  const columnHeight = 3.0;
  const halfSpread = 1.25;
  const columnAlong = width * 0.5 - 0.32;
  for (const lateralSign of [-1, 1]) {
    for (const edge of [-1, 1]) {
      const base = walkwayPoint(walkway, pavilionLateral + lateralSign * halfSpread, edge * columnAlong, floor);
      offset = pushRoundColumn(walkway.vertices, offset, { x: base[0], y: base[1], z: base[2], height: columnHeight, radius: 0.2, yaw: walkway.yaw, color: palette.marble, material: MATERIAL.MARBLE, capitalColor: palette.stone });
    }
  }
  const entablatureTop = floor + columnHeight + 0.5;
  offset = pushWalkwayBox(offset, walkway, { fromLateral: pavilionLateral - halfSpread - 0.45, toLateral: pavilionLateral + halfSpread + 0.45, bottom: floor + columnHeight, top: entablatureTop, length: width + 0.2, color: palette.stone, variant: 0.3 });
  const canopyBottom = entablatureTop;
  offset = pushWalkwayBox(offset, walkway, { fromLateral: pavilionLateral - halfSpread - 1.0, toLateral: pavilionLateral + halfSpread + 1.0, bottom: canopyBottom, top: canopyBottom + SKY_WALKWAY_CONCRETE_ROOF_METERS, length: width + 0.9, color: BRUTALIST_CONCRETE, material: MATERIAL.PLASTER, variant: PLASTER_PANEL_VARIANT, occlusion: 1.0 });
  return pushWalkwayBox(offset, walkway, { fromLateral: pavilionLateral - 0.2, toLateral: pavilionLateral + 0.2, bottom: floor + columnHeight - 0.6, top: floor + columnHeight, length: 0.4, color: SKY_WALKWAY_LANTERN_GLOW, material: MATERIAL.GLOW, occlusion: 1.0 });
}

function walkwayPoint(walkway, lateral, along, height) {
  return [
    walkway.x + walkway.rightX * lateral + walkway.forwardX * along,
    walkway.y + height,
    walkway.z + walkway.rightZ * lateral + walkway.forwardZ * along
  ];
}

function pushWalkwayBox(offset, walkway, { fromLateral, toLateral, along = 0, bottom, top, length, color, material = MATERIAL.STONE, variant = 0.1, occlusion = 0.96 }) {
  return pushBox(walkway.vertices, offset, {
    center: walkwayPoint(walkway, (fromLateral + toLateral) * 0.5, along, (bottom + top) * 0.5),
    size: [toLateral - fromLateral, top - bottom, length],
    yaw: walkway.yaw,
    color, material, variant, occlusion
  });
}
