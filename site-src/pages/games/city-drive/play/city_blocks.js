// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const MANHATTAN_STREETS = [
  "5TH AVENUE",
  "BROADWAY",
  "PARK AVENUE",
  "MADISON AVE",
  "WEST 42ND ST",
  "CENTRAL PARK WEST",
  "LEXINGTON AVE",
  "RIVERSIDE DRIVE",
  "EAST 34TH ST",
  "WALL STREET",
  "HUDSON ESPLANADE",
  "AMSTERDAM AVE"
];

const MANHATTAN_BLOCK_PERIOD = 18;
const CROSSWALK_SEGMENT_INDEX = 0;
const MID_BLOCK_CROSSING_SEGMENT_INDEX = 9;
const MID_BLOCK_CROSSING_BLOCK_INTERVAL = 3;
const INTERSECTION_LAST_SEGMENT_INDEX = 2;
const STREET_ROAD_HALF_WIDTH_METERS = 5.6;
const BOULEVARD_ROAD_HALF_WIDTH_METERS = 8.4;
const BOULEVARD_TAPER_SEGMENTS = 3.0;
const BOULEVARD_TAPER_IN_FIRST_SEGMENT_INDEX = 15;
const NO_OVER_BRIDGE = -1;
const OVER_BRIDGE_BLOCK_CHANCE = 0.6;
const OVER_BRIDGE_FIRST_SEGMENT_IN_BLOCK = 7;
const OVER_BRIDGE_LAST_SEGMENT_IN_BLOCK = 11;
const OPEN_FIELD_SIDE_CHANCE = 0.2;
const OPEN_FIELD_STYLE_COUNT = 4;

function getManhattanBlockInfo(segmentIndex, edge = null) {
  const indexInBlock = ((segmentIndex % MANHATTAN_BLOCK_PERIOD) + MANHATTAN_BLOCK_PERIOD) % MANHATTAN_BLOCK_PERIOD;
  const blockNumber = Math.floor(segmentIndex / MANHATTAN_BLOCK_PERIOD);
  const isIntersection = (indexInBlock <= INTERSECTION_LAST_SEGMENT_INDEX);
  const isCrosswalk = indexInBlock === CROSSWALK_SEGMENT_INDEX;

  const blockKinds = classifyBlocksOnEdge(edge);
  const isEndBlock = blockKinds.isEndBlock(blockNumber);
  const district = districtAt(edge ? edge.districtIndex : DEFAULT_DISTRICT_INDEX);
  const pavementStyle = pickFromList(district.pavementStyles, seededRandom(blockNumber * 3.17 + 0.5));

  const isWideBoulevardBlock = blockKinds.isWideBoulevardBlock(blockNumber);
  const boulevardBlend = boulevardBlendAt(blockKinds, blockNumber, indexInBlock);
  const roadHalfWidth = lerp(STREET_ROAD_HALF_WIDTH_METERS, BOULEVARD_ROAD_HALF_WIDTH_METERS, boulevardBlend);

  const isOrdinaryBlock = !isEndBlock;
  const overBridgeStyle = isOrdinaryBlock && !isIntersection ? overBridgeStyleAt(blockNumber, indexInBlock) : NO_OVER_BRIDGE;

  const isWaterBlock = isOrdinaryBlock && (blockNumber % 9 === 4);
  const waterSide = (Math.floor(blockNumber / 6) % 2 === 0) ? 1 : -1;
  const waterStyle = Math.floor(blockNumber / 6) % 3;
  const leftIsValley = isWaterBlock && (waterSide < 0);
  const rightIsValley = isWaterBlock && (waterSide > 0);

  const leftIsPark = isOrdinaryBlock && !leftIsValley && (blockNumber % 5 === 1);
  const rightIsPark = isOrdinaryBlock && !rightIsValley && (blockNumber % 7 === 3);
  const parkTheme = blockNumber % 3;
  const leftIsField = isOrdinaryBlock && !leftIsValley && !leftIsPark && seededRandom(blockNumber * 5.71 + 1.3) < OPEN_FIELD_SIDE_CHANCE;
  const rightIsField = isOrdinaryBlock && !rightIsValley && !rightIsPark && seededRandom(blockNumber * 8.37 + 4.9) < OPEN_FIELD_SIDE_CHANCE;
  const fieldStyle = Math.floor(seededRandom(blockNumber * 2.93 + 0.7) * OPEN_FIELD_STYLE_COUNT) % OPEN_FIELD_STYLE_COUNT;
  const isMidBlockCrossing = !isIntersection && indexInBlock === MID_BLOCK_CROSSING_SEGMENT_INDEX && blockNumber % MID_BLOCK_CROSSING_BLOCK_INTERVAL === 1;

  return {
    active: true,
    inBlockIdx: indexInBlock,
    blockNumber,
    isIntersection,
    isCrosswalk,
    isMidBlockCrossing,
    district,
    pavementStyle,
    isWideBoulevardBlock,
    roadHalfWidth,
    overBridgeStyle,
    leftIsPark,
    rightIsPark,
    parkTheme,
    leftIsField,
    rightIsField,
    fieldStyle,
    leftIsValley,
    rightIsValley,
    waterStyle,
    waterSide
  };
}

function classifyBlocksOnEdge(edge) {
  const isOutsideEdge = (blockNumber) => !!edge && (blockNumber < edge.firstBlock || blockNumber > edge.lastBlock);
  const isEndBlock = (blockNumber) => !!edge && (blockNumber === edge.firstBlock || blockNumber === edge.lastBlock);
  const isWideBoulevardBlock = (blockNumber) => !isEndBlock(blockNumber) && !isOutsideEdge(blockNumber) && (blockNumber % 3 !== 2);
  return { isEndBlock, isWideBoulevardBlock };
}

function boulevardBlendAt(blockKinds, blockNumber, indexInBlock) {
  if (blockKinds.isWideBoulevardBlock(blockNumber)) return 1.0;
  if (blockKinds.isWideBoulevardBlock(blockNumber - 1) && indexInBlock <= INTERSECTION_LAST_SEGMENT_INDEX) {
    return 1.0 - (indexInBlock / BOULEVARD_TAPER_SEGMENTS);
  }
  if (blockKinds.isWideBoulevardBlock(blockNumber + 1) && indexInBlock >= BOULEVARD_TAPER_IN_FIRST_SEGMENT_INDEX) {
    return (indexInBlock - BOULEVARD_TAPER_IN_FIRST_SEGMENT_INDEX) / BOULEVARD_TAPER_SEGMENTS;
  }
  return 0.0;
}

function overBridgeStyleAt(blockNumber, indexInBlock) {
  if (!blockHasOverBridge(blockNumber)) return NO_OVER_BRIDGE;
  if (indexInBlock !== overBridgeSegmentInBlock(blockNumber)) return NO_OVER_BRIDGE;
  const style = rawOverBridgeStyle(blockNumber);
  const repeatsPreviousBlock = blockHasOverBridge(blockNumber - 1) && rawOverBridgeStyle(blockNumber - 1) === style;
  return repeatsPreviousBlock ? pickOverBridgeStyle((seededRandom(blockNumber * 5.55 + 1.7) + 0.5) % 1) : style;
}

function blockHasOverBridge(blockNumber) {
  return seededRandom(blockNumber * 7.77 + 2.1) < OVER_BRIDGE_BLOCK_CHANCE;
}

function overBridgeSegmentInBlock(blockNumber) {
  const slotCount = OVER_BRIDGE_LAST_SEGMENT_IN_BLOCK - OVER_BRIDGE_FIRST_SEGMENT_IN_BLOCK + 1;
  return OVER_BRIDGE_FIRST_SEGMENT_IN_BLOCK + Math.floor(seededRandom(blockNumber * 3.33 + 0.4) * slotCount) % slotCount;
}

function rawOverBridgeStyle(blockNumber) {
  return pickOverBridgeStyle(seededRandom(blockNumber * 5.55 + 1.7));
}

function getViaductProfile(segmentIndex) {
  const wave = Math.sin(segmentIndex * 0.017 + WORLD_SEED * 1.3);
  if (wave > 0.76) {
    const intensity = clamp((wave - 0.76) / 0.24, 0.0, 1.0);
    const smooth = intensity * intensity * (3.0 - 2.0 * intensity);
    return {
      isViaduct: true,
      dropDepth: 12.0 + smooth * 26.0
    };
  }
  return { isViaduct: false, dropDepth: 0.0 };
}
