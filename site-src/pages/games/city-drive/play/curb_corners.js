// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const CORNER_CURB_RADIUS_METERS = 2.8;
const CORNER_CURB_ARC_STEPS = 6;
const CORNER_CURB_CONCRETE = Object.freeze([0.74, 0.73, 0.70]);
const CROSS_STREET_CURB_TOP_METERS = 0.21;
const CROSS_STREET_CURB_BOTTOM_METERS = 0.01;
const CROSS_STREET_CURB_SETBACK_METERS = 0.02;
const ROAD_FILL_HEIGHT_METERS = 0.0;

function blockCornerFraction({ startInfo, endInfo }) {
  if (startInfo.isIntersection) return null;
  if (endInfo.isIntersection) return 1;
  if (startInfo.inBlockIdx === INTERSECTION_LAST_SEGMENT_INDEX + 1) return 0;
  return null;
}

function pushRoundedCurbCorner(vertices, offset, segment, { side, cornerT, curbHeight, sidewalkTop }) {
  const corner = describeCurbCorner(segment, side, cornerT);
  offset = pushCornerSidewalk(vertices, offset, corner, curbHeight, sidewalkTop);
  offset = pushCornerRoadFill(vertices, offset, corner, segment.roadColor);
  offset = pushCornerCurbFace(vertices, offset, corner, curbHeight);
  offset = pushCornerCurbCap(vertices, offset, corner, curbHeight);
  return pushCrossStreetCurb(vertices, offset, corner, segment);
}

function describeCurbCorner(segment, side, cornerT) {
  const segmentLength = SEG_LENGTH;
  const sidewalkWidth = ROAD_SHOULDER_WIDTH_METERS;
  const radius = Math.min(CORNER_CURB_RADIUS_METERS, sidewalkWidth, segmentLength * 0.8);
  const fractionAt = (alongFromCorner) => cornerT === 0 ? alongFromCorner / segmentLength : 1 - alongFromCorner / segmentLength;
  const pointAt = ([alongFromCorner, fromCurb], height) => {
    const t = fractionAt(alongFromCorner);
    return segment.pointAlong(t, side * (roadHalfWidthAt(segment, t) + fromCurb), height);
  };
  return { side, segmentLength, sidewalkWidth, radius, pointAt, arc: curbArc(radius, radius) };
}

function curbArc(radius, centerOffset) {
  const arc = [];
  for (let step = 0; step <= CORNER_CURB_ARC_STEPS; step++) {
    const angle = Math.PI + (step / CORNER_CURB_ARC_STEPS) * Math.PI * 0.5;
    arc.push([centerOffset + Math.cos(angle) * radius, centerOffset + Math.sin(angle) * radius]);
  }
  return arc;
}

function pushCornerSidewalk(vertices, offset, { segmentLength, sidewalkWidth, radius, pointAt, arc }, curbHeight, surface) {
  const outline = [[radius, 0], [segmentLength, 0], [segmentLength, sidewalkWidth], [0, sidewalkWidth], ...arc.slice(1, -1)];
  const fanCenter = pointAt([segmentLength * 0.55, sidewalkWidth * 0.55], curbHeight);
  for (let index = 0; index < outline.length; index++) {
    const from = pointAt(outline[index], curbHeight);
    const to = pointAt(outline[(index + 1) % outline.length], curbHeight);
    offset = pushGroundTriangle(vertices, offset, fanCenter, from, to, surface.color, surface.material, surface.variant, surface.occlusion);
  }
  return offset;
}

function pushCornerRoadFill(vertices, offset, { pointAt, arc }, roadColor) {
  const cornerPoint = pointAt([0, 0], ROAD_FILL_HEIGHT_METERS);
  for (let index = 0; index < arc.length - 1; index++) {
    offset = pushGroundTriangle(vertices, offset, cornerPoint, pointAt(arc[index], ROAD_FILL_HEIGHT_METERS), pointAt(arc[index + 1], ROAD_FILL_HEIGHT_METERS), roadColor, MATERIAL.PAVING, 0.35, 1.0);
  }
  return offset;
}

function pushCornerCurbFace(vertices, offset, { segmentLength, pointAt, arc }, curbHeight) {
  const curbLine = [...arc, [segmentLength, 0]];
  for (let index = 0; index < curbLine.length - 1; index++) {
    const from = curbLine[index], to = curbLine[index + 1];
    offset = pushQuad(vertices, offset, pointAt(from, 0), pointAt(to, 0), pointAt(to, curbHeight), pointAt(from, curbHeight), CORNER_CURB_CONCRETE, MATERIAL.PLASTER, 0.1, 0.92);
  }
  return offset;
}

function pushCornerCurbCap(vertices, offset, { segmentLength, radius, pointAt, arc }, curbHeight) {
  const capHeight = curbHeight + CURB_CAP_LIFT_METERS;
  const innerArc = curbArc(radius - CURB_CAP_WIDTH, radius);
  const outerLine = [...arc, [segmentLength, 0]];
  const innerLine = [...innerArc, [segmentLength, CURB_CAP_WIDTH]];
  for (let index = 0; index < outerLine.length - 1; index++) {
    offset = pushGroundQuad(
      vertices, offset,
      pointAt(outerLine[index], capHeight), pointAt(outerLine[index + 1], capHeight),
      pointAt(innerLine[index + 1], capHeight), pointAt(innerLine[index], capHeight),
      CORNER_CURB_CONCRETE, MATERIAL.PLASTER, 0.1, 1.0
    );
  }
  return offset;
}

function pushCrossStreetCurb(vertices, offset, { side, sidewalkWidth, pointAt }, segment) {
  const cornerNode = segment.startInfo.inBlockIdx === INTERSECTION_LAST_SEGMENT_INDEX + 1 ? segment.startNode : segment.endNode;
  const hidesFarCity = side < 0 ? cornerNode.hidesLeftFarCity : cornerNode.hidesRightFarCity;
  const halfWidth = cornerNode.info.roadHalfWidth;
  const curbEndLateral = hidesFarCity ? halfWidth + ROADSIDE_BAND_REACH_METERS : PARALLEL_STREET_LAT - PARALLEL_STREET_HALF_W;
  const reachFromCurb = curbEndLateral - halfWidth;
  if (reachFromCurb <= sidewalkWidth) return offset;
  const curbStart = [-CROSS_STREET_CURB_SETBACK_METERS, sidewalkWidth];
  const curbEnd = [-CROSS_STREET_CURB_SETBACK_METERS, reachFromCurb];
  offset = pushQuad(
    vertices, offset,
    pointAt(curbStart, CROSS_STREET_CURB_BOTTOM_METERS), pointAt(curbEnd, CROSS_STREET_CURB_BOTTOM_METERS),
    pointAt(curbEnd, CROSS_STREET_CURB_TOP_METERS), pointAt(curbStart, CROSS_STREET_CURB_TOP_METERS),
    CORNER_CURB_CONCRETE, MATERIAL.PLASTER, 0.1, 0.92
  );
  return pushGroundQuad(
    vertices, offset,
    pointAt(curbStart, CROSS_STREET_CURB_TOP_METERS), pointAt(curbEnd, CROSS_STREET_CURB_TOP_METERS),
    pointAt([CURB_CAP_WIDTH, reachFromCurb], CROSS_STREET_CURB_TOP_METERS), pointAt([CURB_CAP_WIDTH, sidewalkWidth], CROSS_STREET_CURB_TOP_METERS),
    CORNER_CURB_CONCRETE, MATERIAL.PLASTER, 0.1, 1.0
  );
}
