// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const SEG_LENGTH = 4.2;
const LANE_OFFSET = 2.45;
const BOULEVARD_LANE_OFFSET = 4.65;

const BOULEVARD_HALF_WIDTH_THRESHOLD = 6.5;
const GRAPH_EVICT_DISTANCE = 1400;
const BAND_REACH = 52.0;
const FAR_REACH = 112.0;

const roadGraph = {
  junctions: new Map(),
  edges: new Map(),
  nextId: 1,
  nextBlock: 4,
  seedBase: Math.floor(WORLD_SEED * 1000)
};

function makeRoadNode(x, z, heading, index) {
  return {
    x, y: 0, z,
    forwardX: -Math.sin(heading), forwardY: 0, forwardZ: -Math.cos(heading),
    rightX: Math.cos(heading), rightY: 0, rightZ: -Math.sin(heading),
    heading, pitch: 0, bank: 0,
    index,
    obstacles: [],
    info: null,
    hidesLeftSide: false, hidesRightSide: false,
    cornerClearsLeftSide: false, cornerClearsRightSide: false,
    hidesLeftFarCity: false, hidesRightFarCity: false
  };
}

function sortJunctionArms(junction) {
  for (const arm of junction.arms) arm.angle = normalizeAngle(arm.heading);
  junction.arms.sort((a, b) => a.angle - b.angle);
}

function armAngleGaps(junction, arm) {
  const armCount = junction.arms.length;
  if (armCount < 2) return { left: Math.PI * 2, right: Math.PI * 2 };
  const armIndex = junction.arms.indexOf(arm);
  const nextArm = junction.arms[(armIndex + 1) % armCount];
  const previousArm = junction.arms[(armIndex - 1 + armCount) % armCount];
  return {
    left: normalizeAngle(nextArm.angle - arm.angle) || Math.PI * 2,
    right: normalizeAngle(arm.angle - previousArm.angle) || Math.PI * 2
  };
}

function junctionRadius(junction) {
  let need = 0;
  for (const arm of junction.arms) {
    const sectorAngle = Math.min(armAngleGaps(junction, arm).left, Math.PI);
    need = Math.max(need, 8.6 / Math.sin(sectorAngle * 0.5));
  }
  return clamp(need + 0.6, 11.5, 18.0);
}

function createJunction(x, z, backHeading, rng) {
  const travel = backHeading + Math.PI;
  const roll = rng();
  const sides = roll < 0.55 ? [0, 1, -1] : roll < 0.78 ? [0, 1] : [0, -1];
  const backArm = { heading: backHeading, edge: null, end: null, angle: 0 };
  const arms = [backArm];
  for (const side of sides) {
    const spread = side === 0 ? 0.22 : 0.4;
    arms.push({ heading: travel + side * Math.PI * 0.5 + (rng() - 0.5) * spread, edge: null, end: null, angle: 0, straight: side === 0 });
  }
  const newJunction = {
    id: roadGraph.nextId++,
    x, y: 0, z,
    arms,
    radius: 12,
    obstacles: [],
    armsReady: false,
    seed: rng(),
    parkCorner: rng()
  };
  sortJunctionArms(newJunction);
  newJunction.radius = junctionRadius(newJunction);
  roadGraph.junctions.set(newJunction.id, newJunction);
  return { junction: newJunction, backArm };
}

function cornerClearSegmentCount(sectorAngle, radius, reach, maxSegments) {
  if (sectorAngle >= Math.PI - 0.05) return 3;
  const segmentCount = Math.ceil((reach / Math.tan(sectorAngle * 0.5) - radius) / SEG_LENGTH) + 1;
  return clamp(segmentCount, 3, maxSegments);
}

function streetNameForHeading(heading, rng) {
  const northSouth = Math.abs(Math.cos(heading)) > 0.7;
  if (northSouth) {
    return MANHATTAN_STREETS[Math.floor(rng() * MANHATTAN_STREETS.length) % MANHATTAN_STREETS.length];
  }
  const streetNumber = 14 + Math.floor(rng() * 150);
  const mod100 = streetNumber % 100;
  const suffix = (mod100 >= 11 && mod100 <= 13) ? "TH" : (["TH", "ST", "ND", "RD"][streetNumber % 10] || "TH");
  return `${-Math.sin(heading) < 0 ? "W" : "E"} ${streetNumber}${suffix} ST`;
}

function generateEdgeNodes(startX, startZ, startHeading, indexBase, blockCount, rng) {
  const segCount = blockCount * MANHATTAN_BLOCK_PERIOD - 3;
  const nodes = [];
  let heading = startHeading;
  let curvature = 0;
  let targetCurvature = rng() < 0.5 ? 0 : (rng() < 0.5 ? -1 : 1) * 0.008;
  let x = startX;
  let z = startZ;
  for (let i = 0; i <= segCount; i++) {
    const nodeIndex = indexBase + 3 + i;
    const inBlock = nodeIndex % MANHATTAN_BLOCK_PERIOD;
    if (inBlock === 0) {
      if (rng() < 0.45) {
        targetCurvature = 0.0;
      } else {
        const headingDrift = heading - startHeading;
        const turnSign = rng() > 0.5 ? 1 : -1;
        targetCurvature = (Math.abs(headingDrift) > 0.26 ? -Math.sign(headingDrift) : turnSign) * 0.008;
      }
    } else if (inBlock >= 6 && i > 3) {
      targetCurvature = 0.0;
    }
    curvature = lerp(curvature, targetCurvature - (heading - startHeading) * 0.006, 0.075);
    const node = makeRoadNode(x, z, heading, nodeIndex);
    node.curvature = curvature;
    nodes.push(node);
    heading = clamp(heading + curvature * SEG_LENGTH, startHeading - 0.42, startHeading + 0.42);
    x += -Math.sin(heading) * SEG_LENGTH;
    z += -Math.cos(heading) * SEG_LENGTH;
  }
  return nodes;
}

function edgePathIsClear(nodes, probeX, probeZ, fromJunction, relax = 1.0) {
  for (const junction of roadGraph.junctions.values()) {
    if (junction === fromJunction) continue;
    if (Math.hypot(probeX - junction.x, probeZ - junction.z) < 130 * relax) return false;
    for (let i = 6; i < nodes.length; i += 3) {
      if (Math.hypot(nodes[i].x - junction.x, nodes[i].z - junction.z) < 70 * relax) return false;
    }
  }
  for (const edge of roadGraph.edges.values()) {
    const sharesStart = edge.ja === fromJunction || edge.jb === fromJunction;
    for (let otherNodeIndex = 0; otherNodeIndex < edge.nodes.length; otherNodeIndex += 3) {
      const otherNode = edge.nodes[otherNodeIndex];
      if (sharesStart && Math.hypot(otherNode.x - fromJunction.x, otherNode.z - fromJunction.z) < 90) continue;
      if (Math.hypot(probeX - otherNode.x, probeZ - otherNode.z) < 75 * relax) return false;
      for (let i = 6; i < nodes.length; i += 3) {
        const offsetX = nodes[i].x - otherNode.x;
        const offsetZ = nodes[i].z - otherNode.z;
        if (offsetX * offsetX + offsetZ * offsetZ < 62 * 62 * relax * relax) return false;
      }
    }
  }
  return true;
}

function assignEdgeZones(edge) {
  const startArmGaps = armAngleGaps(edge.ja, edge.armA);
  const endArmGaps = armAngleGaps(edge.jb, edge.armB);
  edge.startCornerClear = {
    left: cornerClearSegmentCount(startArmGaps.left, edge.ja.radius, BAND_REACH, 15),
    right: cornerClearSegmentCount(startArmGaps.right, edge.ja.radius, BAND_REACH, 15)
  };
  edge.endCornerClear = {
    left: cornerClearSegmentCount(endArmGaps.right, edge.jb.radius, BAND_REACH, 15),
    right: cornerClearSegmentCount(endArmGaps.left, edge.jb.radius, BAND_REACH, 15)
  };
  const farCityClearStart = {
    left: cornerClearSegmentCount(startArmGaps.left, edge.ja.radius, FAR_REACH, 24),
    right: cornerClearSegmentCount(startArmGaps.right, edge.ja.radius, FAR_REACH, 24)
  };
  const farCityClearEnd = {
    left: cornerClearSegmentCount(endArmGaps.right, edge.jb.radius, FAR_REACH, 24),
    right: cornerClearSegmentCount(endArmGaps.left, edge.jb.radius, FAR_REACH, 24)
  };
  const segmentCount = edge.segmentCount;
  for (let i = 0; i <= segmentCount; i++) {
    const node = edge.nodes[i];
    node.edge = edge;
    node.segmentIndex = i;
    node.cornerClearsLeftSide = i < edge.startCornerClear.left || i >= segmentCount - edge.endCornerClear.left;
    node.cornerClearsRightSide = i < edge.startCornerClear.right || i >= segmentCount - edge.endCornerClear.right;
    node.hidesLeftSide = node.cornerClearsLeftSide;
    node.hidesRightSide = node.cornerClearsRightSide;
    node.hidesLeftFarCity = i < Math.max(farCityClearStart.left, 6) || i >= segmentCount - Math.max(farCityClearEnd.left, 6);
    node.hidesRightFarCity = i < Math.max(farCityClearStart.right, 6) || i >= segmentCount - Math.max(farCityClearEnd.right, 6);
    node.info = getManhattanBlockInfo(node.index, edge);
  }
}

function createEdgeFromArm(junction, arm, relax = 1.0) {
  const rng = makeRng(roadGraph.seedBase + roadGraph.nextId * 7919 + junction.id * 131);
  for (let attempt = 0; attempt < 4; attempt++) {
    const blockCount = rng() < 0.5 ? 4 : 3;
    const firstBlock = roadGraph.nextBlock;
    const startX = junction.x - Math.sin(arm.heading) * junction.radius;
    const startZ = junction.z - Math.cos(arm.heading) * junction.radius;
    const nodes = generateEdgeNodes(startX, startZ, arm.heading, firstBlock * MANHATTAN_BLOCK_PERIOD, blockCount, rng);
    const last = nodes[nodes.length - 1];
    const probeX = last.x - Math.sin(last.heading) * 15;
    const probeZ = last.z - Math.cos(last.heading) * 15;
    if (!edgePathIsClear(nodes, probeX, probeZ, junction, relax)) continue;

    roadGraph.nextBlock += blockCount + 1;
    const farJunctionInfo = createJunction(0, 0, last.heading + Math.PI, rng);
    const farJunction = farJunctionInfo.junction;
    farJunction.x = last.x - Math.sin(last.heading) * farJunction.radius;
    farJunction.z = last.z - Math.cos(last.heading) * farJunction.radius;

    const freshStreetName = streetNameForHeading(arm.heading, rng);
    const edgeId = roadGraph.nextId++;
    const identity = streetIdentityForArm(junction, arm, edgeId, freshStreetName);
    const edge = {
      id: edgeId,
      ja: junction,
      armA: arm,
      jb: farJunction,
      armB: farJunctionInfo.backArm,
      nodes,
      segmentCount: nodes.length - 1,
      firstBlock,
      lastBlock: firstBlock + blockCount - 1,
      name: identity.name,
      streetId: identity.streetId,
      districtIndex: identity.districtIndex
    };
    farJunction.entryEdge = edge;
    arm.edge = edge;
    arm.end = "a";
    farJunctionInfo.backArm.edge = edge;
    farJunctionInfo.backArm.end = "b";
    roadGraph.edges.set(edge.id, edge);
    assignEdgeZones(edge);
    queueRebuildOfSlotsNear(edge);
    return edge;
  }
  return null;
}

function streetIdentityForArm(junction, arm, edgeId, freshStreetName) {
  const continuedEdge = arm.straight ? junction.entryEdge : null;
  if (continuedEdge) {
    return {
      name: continuedEdge.name,
      streetId: continuedEdge.streetId,
      districtIndex: continuedEdge.districtIndex
    };
  }
  const neighbouringDistricts = new Set(junction.arms.filter(other => other.edge).map(other => other.edge.districtIndex));
  return {
    name: freshStreetName,
    streetId: edgeId,
    districtIndex: chooseDistrictAvoiding(neighbouringDistricts, seededRandom(edgeId * 13.7 + 0.31))
  };
}

function ensureJunctionArms(junction) {
  if (junction.armsReady) return;
  junction.armsReady = true;
  const dropped = [];
  for (const arm of junction.arms.slice()) {
    if (arm.edge) continue;
    if (!createEdgeFromArm(junction, arm)) {
      junction.arms.splice(junction.arms.indexOf(arm), 1);
      dropped.push(arm);
    }
  }
  const straight = dropped.find(a => a.straight);
  if (straight) {
    junction.arms.push(straight);
    sortJunctionArms(junction);
    for (const relax of [0.7, 0.45, 0.0]) {
      if (createEdgeFromArm(junction, straight, relax)) return;
    }
    junction.arms.splice(junction.arms.indexOf(straight), 1);
  }
}

function armEndNode(arm, stepsFromJunction) {
  const edge = arm.edge;
  const nodeIndex = arm.end === "a" ? Math.min(stepsFromJunction, edge.segmentCount) : Math.max(0, edge.segmentCount - stepsFromJunction);
  return edge.nodes[nodeIndex];
}

function armOutwardSign(arm) {
  return arm.end === "a" ? 1 : -1;
}

function armCornerClearSegments(arm, side) {
  const edge = arm.edge;
  if (arm.end === "a") return side < 0 ? edge.startCornerClear.left : edge.startCornerClear.right;
  return side < 0 ? edge.endCornerClear.right : edge.endCornerClear.left;
}

function armLanePoint(arm, stepsFromJunction, lane) {
  return lanePointOnNode(armEndNode(arm, stepsFromJunction), armOutwardSign(arm) * lane);
}

function evictFarGraph(car) {
  const evictDistanceSquared = GRAPH_EVICT_DISTANCE * GRAPH_EVICT_DISTANCE;
  const distanceSquared = (point) => (point.x - car.x) * (point.x - car.x) + (point.z - car.z) * (point.z - car.z);
  for (const edge of Array.from(roadGraph.edges.values())) {
    if (edge === carLocation.edge) continue;
    if (distanceSquared(edge.ja) > evictDistanceSquared && distanceSquared(edge.jb) > evictDistanceSquared && distanceSquared(edge.nodes[edge.segmentCount >> 1]) > evictDistanceSquared) {
      roadGraph.edges.delete(edge.id);
      for (const junction of [edge.ja, edge.jb]) {
        for (const arm of junction.arms) {
          if (arm.edge === edge) {
            arm.edge = null;
            junction.armsReady = false;
          }
        }
      }
    }
  }
  for (const junction of Array.from(roadGraph.junctions.values())) {
    if (junction === carLocation.junction) continue;
    if (distanceSquared(junction) > evictDistanceSquared && junction.arms.every(arm => !arm.edge)) {
      roadGraph.junctions.delete(junction.id);
    }
  }
}

function nearestPointOnEdge(edge, x, z) {
  let best = null;
  for (let i = 0; i < edge.segmentCount; i++) {
    const fromNode = edge.nodes[i];
    const toNode = edge.nodes[i + 1];
    const segmentX = toNode.x - fromNode.x;
    const segmentZ = toNode.z - fromNode.z;
    const lengthSquared = segmentX * segmentX + segmentZ * segmentZ || 1;
    const fraction = clamp(((x - fromNode.x) * segmentX + (z - fromNode.z) * segmentZ) / lengthSquared, 0, 1);
    const distance = Math.hypot(fromNode.x + segmentX * fraction - x, fromNode.z + segmentZ * fraction - z);
    if (!best || distance < best.distance) best = { edge, segmentIndex: i, edgePosition: i + fraction, distance };
  }
  return best;
}

function edgeMayBeWithin(edge, x, z, radius) {
  const midNode = edge.nodes[edge.segmentCount >> 1];
  return Math.hypot(midNode.x - x, midNode.z - z) < radius + edge.segmentCount * SEG_LENGTH * 0.5;
}

function nearestEdgePoint(x, z, radius) {
  let best = null;
  for (const edge of roadGraph.edges.values()) {
    if (!edgeMayBeWithin(edge, x, z, radius)) continue;
    const candidate = nearestPointOnEdge(edge, x, z);
    if (candidate.distance <= radius && (!best || candidate.distance < best.distance)) best = candidate;
  }
  return best;
}

function sampleEdge(edge, edgePosition) {
  const clampedPosition = clamp(edgePosition, 0, edge.segmentCount - 0.0001);
  const segmentIndex = Math.floor(clampedPosition);
  const fraction = clampedPosition - segmentIndex;
  const fromNode = edge.nodes[segmentIndex];
  const toNode = edge.nodes[segmentIndex + 1];
  return {
    x: lerp(fromNode.x, toNode.x, fraction),
    y: lerp(fromNode.y, toNode.y, fraction),
    z: lerp(fromNode.z, toNode.z, fraction),
    rightX: lerp(fromNode.rightX, toNode.rightX, fraction),
    rightY: 0,
    rightZ: lerp(fromNode.rightZ, toNode.rightZ, fraction),
    heading: lerp(fromNode.heading, toNode.heading, fraction),
    pitch: 0,
    bank: 0,
    info: fromNode.info
  };
}

function laneOffsetFor(info, normalLaneOffset = LANE_OFFSET) {
  return info.roadHalfWidth > BOULEVARD_HALF_WIDTH_THRESHOLD ? BOULEVARD_LANE_OFFSET : normalLaneOffset;
}

function lanePointOnNode(node, lateralOffset) {
  return { x: node.x + node.rightX * lateralOffset, z: node.z + node.rightZ * lateralOffset };
}
