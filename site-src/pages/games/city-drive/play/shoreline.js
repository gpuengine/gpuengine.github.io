// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const LAND_LATERAL_REACH_METERS = FAR_REACH;
const JUNCTION_LAND_MARGIN_METERS = 2.0;
const SHORELINE_SEARCH_RADIUS_METERS = FAR_REACH + 60.0;

function shorelineEscapeForFootprint(footprintPoints) {
  let deepest = null;
  for (const [x, z] of footprintPoints) {
    const land = nearestStreamedLand(x, z);
    if (!land || land.signedDistance <= 0) continue;
    if (!deepest || land.signedDistance > deepest.excess) {
      deepest = { outwardX: land.outwardX, outwardZ: land.outwardZ, excess: land.signedDistance };
    }
  }
  return deepest;
}

function nearestStreamedLand(x, z) {
  const searchRadiusSquared = SHORELINE_SEARCH_RADIUS_METERS * SHORELINE_SEARCH_RADIUS_METERS;
  let nearest = null;
  for (const item of segmentStreaming.slotItems) {
    if (!item) continue;
    const anchor = slotItemAnchor(item);
    if ((anchor.x - x) ** 2 + (anchor.z - z) ** 2 > searchRadiusSquared) continue;
    const land = item.edge
      ? segmentLandDistance(item.edge.nodes[item.segmentIndex], item.edge.nodes[item.segmentIndex + 1], x, z)
      : junctionLandDistance(item.junction, x, z);
    if (!nearest || land.signedDistance < nearest.signedDistance) nearest = land;
  }
  return nearest;
}

function segmentLandDistance(startNode, endNode, x, z) {
  const reach = LAND_LATERAL_REACH_METERS;
  return convexPolygonDistance([
    [startNode.x + startNode.rightX * reach, startNode.z + startNode.rightZ * reach],
    [endNode.x + endNode.rightX * reach, endNode.z + endNode.rightZ * reach],
    [endNode.x - endNode.rightX * reach, endNode.z - endNode.rightZ * reach],
    [startNode.x - startNode.rightX * reach, startNode.z - startNode.rightZ * reach]
  ], x, z);
}

function junctionLandDistance(junction, x, z) {
  let nearest = junctionPadDistance(junction, x, z);
  for (const triangle of junction.cornerLandTriangles || []) {
    const triangleDistance = convexPolygonDistance(triangle, x, z);
    if (triangleDistance.signedDistance < nearest.signedDistance) nearest = triangleDistance;
  }
  return nearest;
}

function junctionPadDistance(junction, x, z) {
  const offsetX = x - junction.x;
  const offsetZ = z - junction.z;
  const distance = Math.hypot(offsetX, offsetZ) || 1;
  return {
    signedDistance: distance - (junction.radius + JUNCTION_LAND_MARGIN_METERS),
    outwardX: offsetX / distance,
    outwardZ: offsetZ / distance
  };
}

function convexPolygonDistance(corners, x, z) {
  const centroidX = corners.reduce((sum, corner) => sum + corner[0], 0) / corners.length;
  const centroidZ = corners.reduce((sum, corner) => sum + corner[1], 0) / corners.length;
  let farthest = { signedDistance: -Infinity, outwardX: 0, outwardZ: 0 };
  for (let index = 0; index < corners.length; index++) {
    const [fromX, fromZ] = corners[index];
    const [toX, toZ] = corners[(index + 1) % corners.length];
    const edgeLength = Math.hypot(toX - fromX, toZ - fromZ);
    if (edgeLength < 1e-6) continue;
    let normalX = (toZ - fromZ) / edgeLength;
    let normalZ = -(toX - fromX) / edgeLength;
    if ((centroidX - fromX) * normalX + (centroidZ - fromZ) * normalZ > 0) {
      normalX = -normalX;
      normalZ = -normalZ;
    }
    const signedDistance = (x - fromX) * normalX + (z - fromZ) * normalZ;
    if (signedDistance > farthest.signedDistance) farthest = { signedDistance, outwardX: normalX, outwardZ: normalZ };
  }
  return farthest;
}
