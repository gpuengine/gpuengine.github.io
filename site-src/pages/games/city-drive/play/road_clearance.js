// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const CROSS_ROAD_CLEARANCE_METERS = 4.0;
const SIDE_BAND_PROBE_OFFSETS_METERS = Object.freeze([4, 12, 20, 28, 36, 44, 52]);
const SIDE_BAND_PROBE_FRACTIONS = Object.freeze([0, 0.5, 1]);

function refreshCrossRoadClearance(startNode, endNode) {
  const edge = startNode.edge;
  const bandReach = startNode.info.roadHalfWidth + SIDE_BAND_PROBE_OFFSETS_METERS[SIDE_BAND_PROBE_OFFSETS_METERS.length - 1];
  const midX = (startNode.x + endNode.x) * 0.5;
  const midZ = (startNode.z + endNode.z) * 0.5;
  const searchRadius = bandReach + SEG_LENGTH + CROSS_ROAD_CLEARANCE_METERS;
  const nearbyRoads = collectNearbyRoads(midX, midZ, searchRadius, { edges: [edge], junctions: [edge.ja, edge.jb] });
  startNode.hidesLeftSide = startNode.cornerClearsLeftSide || sideBandCrossesRoads(startNode, endNode, -1, nearbyRoads);
  startNode.hidesRightSide = startNode.cornerClearsRightSide || sideBandCrossesRoads(startNode, endNode, 1, nearbyRoads);
}

function isAreaOnOtherRoad(x, z, radius, excluded) {
  const nearbyRoads = collectNearbyRoads(x, z, radius + CROSS_ROAD_CLEARANCE_METERS, excluded);
  return distanceToRoads(x, z, nearbyRoads) < radius + CROSS_ROAD_CLEARANCE_METERS;
}

function sideBandCrossesRoads(startNode, endNode, side, nearbyRoads) {
  if (!nearbyRoads.junctions.length && !nearbyRoads.segments.length) return false;
  const halfWidth = startNode.info.roadHalfWidth;
  for (const fraction of SIDE_BAND_PROBE_FRACTIONS) {
    const centerX = lerp(startNode.x, endNode.x, fraction);
    const centerZ = lerp(startNode.z, endNode.z, fraction);
    const rightX = lerp(startNode.rightX, endNode.rightX, fraction);
    const rightZ = lerp(startNode.rightZ, endNode.rightZ, fraction);
    for (const probeOffset of SIDE_BAND_PROBE_OFFSETS_METERS) {
      const lateral = side * (halfWidth + probeOffset);
      const probeX = centerX + rightX * lateral;
      const probeZ = centerZ + rightZ * lateral;
      if (distanceToRoads(probeX, probeZ, nearbyRoads) < CROSS_ROAD_CLEARANCE_METERS) return true;
    }
  }
  return false;
}

function collectNearbyRoads(x, z, radius, excluded) {
  const junctions = [];
  for (const junction of roadGraph.junctions.values()) {
    if (excluded.junctions.includes(junction)) continue;
    if (Math.hypot(junction.x - x, junction.z - z) - junction.radius < radius) junctions.push(junction);
  }
  const segments = [];
  for (const edge of roadGraph.edges.values()) {
    if (excluded.edges.includes(edge) || !edgeMayBeWithin(edge, x, z, radius)) continue;
    for (let segmentIndex = 0; segmentIndex < edge.segmentCount; segmentIndex++) {
      const fromNode = edge.nodes[segmentIndex];
      const toNode = edge.nodes[segmentIndex + 1];
      const segment = describeRoadwaySegment(fromNode, toNode);
      if (distanceBeyondRoadway(segment, x, z) < radius) segments.push(segment);
    }
  }
  return { junctions, segments };
}

function describeRoadwaySegment(fromNode, toNode) {
  return {
    fromX: fromNode.x, fromZ: fromNode.z,
    deltaX: toNode.x - fromNode.x, deltaZ: toNode.z - fromNode.z,
    roadwayHalfWidth: (fromNode.info?.roadHalfWidth ?? BASELINE_ROAD_HALF_WIDTH) + ROAD_SHOULDER_WIDTH_METERS
  };
}

function distanceToRoads(x, z, nearbyRoads) {
  let nearest = Infinity;
  for (const junction of nearbyRoads.junctions) {
    nearest = Math.min(nearest, Math.hypot(junction.x - x, junction.z - z) - junction.radius);
  }
  for (const segment of nearbyRoads.segments) {
    nearest = Math.min(nearest, distanceBeyondRoadway(segment, x, z));
  }
  return nearest;
}

function distanceBeyondRoadway(segment, x, z) {
  const lengthSquared = segment.deltaX * segment.deltaX + segment.deltaZ * segment.deltaZ || 1;
  const fraction = clamp(((x - segment.fromX) * segment.deltaX + (z - segment.fromZ) * segment.deltaZ) / lengthSquared, 0, 1);
  const centerlineDistance = Math.hypot(segment.fromX + segment.deltaX * fraction - x, segment.fromZ + segment.deltaZ * fraction - z);
  return centerlineDistance - segment.roadwayHalfWidth;
}
