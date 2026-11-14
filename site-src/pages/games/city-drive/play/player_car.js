// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const PLAYER_CAR_RIDE_HEIGHT = 0.42;
const PLAYER_WHEEL_RADIUS = 0.33;
const PLAYER_WHEEL_WIDTH = 0.27;
const PLAYER_WHEEL_SIDES = 12;
const PLAYER_WHEEL_SPOKES = 5;
const PLAYER_WHEEL_TRACK = 0.88;
const PLAYER_FRONT_AXLE = -1.35;
const PLAYER_REAR_AXLE = 1.32;

const PLAYER_CAR_FINISH = Object.freeze({
  paint: [0.78, 0.07, 0.05],
  blackPaint: [0.035, 0.035, 0.04],
  glass: [0.05, 0.07, 0.09],
  trim: [0.025, 0.025, 0.03],
  chrome: [0.80, 0.82, 0.86],
  rim: [0.10, 0.10, 0.11],
  tire: [0.055, 0.055, 0.06],
  caliper: [0.85, 0.08, 0.05],
  headlight: [0.88, 0.96, 1.0],
  shadow: [0.02, 0.02, 0.03]
});

const PLAYER_BODY_SECTIONS = Object.freeze([
  { z: -2.28, heights: [-0.16, -0.06, 0.04, 0.10], widths: [0.74, 0.84, 0.80, 0.66] },
  { z: -2.05, heights: [-0.22, 0.00, 0.16, 0.22], widths: [0.90, 0.96, 0.93, 0.78] },
  { z: -1.72, heights: [-0.10, 0.06, 0.24, 0.30], widths: [0.94, 1.00, 0.97, 0.80] },
  { z: -1.35, heights: [0.22, 0.27, 0.32, 0.35], widths: [0.98, 1.02, 0.99, 0.80] },
  { z: -0.98, heights: [-0.10, 0.08, 0.30, 0.40], widths: [0.95, 0.99, 0.96, 0.80] },
  { z: -0.40, heights: [-0.22, 0.02, 0.32, 0.45], widths: [0.94, 0.97, 0.95, 0.82] },
  { z: 0.45, heights: [-0.22, 0.02, 0.33, 0.47], widths: [0.95, 0.98, 0.96, 0.84] },
  { z: 0.94, heights: [-0.10, 0.08, 0.36, 0.49], widths: [0.98, 1.02, 1.00, 0.86] },
  { z: 1.32, heights: [0.22, 0.28, 0.38, 0.50], widths: [1.00, 1.04, 1.02, 0.86] },
  { z: 1.70, heights: [-0.10, 0.08, 0.36, 0.49], widths: [0.97, 1.00, 0.98, 0.84] },
  { z: 2.05, heights: [-0.20, 0.02, 0.34, 0.46], widths: [0.92, 0.95, 0.93, 0.80] },
  { z: 2.27, heights: [-0.16, 0.04, 0.30, 0.40], widths: [0.84, 0.88, 0.86, 0.74] }
]);

const PLAYER_CABIN_SECTIONS = Object.freeze([
  { z: -0.80, base: 0.42, top: 0.44, baseWidth: 0.78, topWidth: 0.74 },
  { z: -0.15, base: 0.46, top: 0.86, baseWidth: 0.82, topWidth: 0.62 },
  { z: 0.75, base: 0.48, top: 0.88, baseWidth: 0.84, topWidth: 0.64 },
  { z: 1.65, base: 0.50, top: 0.52, baseWidth: 0.82, topWidth: 0.76 }
]);

function pushPlayerCar(vertices, offset, car, cameraMode) {
  const isHoodCam = isHoodCamera(cameraMode);
  const body = playerCarFrame(car, isHoodCam);
  offset = pushPlayerCarShadow(vertices, offset, body);
  offset = pushPlayerCarBody(vertices, offset, body);
  if (!isHoodCam) offset = pushPlayerCarCabin(vertices, offset, body);
  offset = pushPlayerCarAeroParts(vertices, offset, body);
  offset = pushPlayerCarLights(vertices, offset, body, car.braking);
  for (const [side, axle, isFront] of [[-1, PLAYER_FRONT_AXLE, true], [1, PLAYER_FRONT_AXLE, true], [-1, PLAYER_REAR_AXLE, false], [1, PLAYER_REAR_AXLE, false]]) {
    offset = pushPlayerWheel(vertices, offset, body, { side, axle, steer: isFront ? car.steerAngle * 0.65 : 0, spin: car.wheelSpin });
  }
  return offset;
}

function playerCarFrame(car, isHoodCam) {
  const centerY = car.y + PLAYER_CAR_RIDE_HEIGHT + (isHoodCam ? 0 : car.suspBob);
  const pitch = isHoodCam ? car.pitch : car.pitch + car.accelPitch;
  const roll = isHoodCam ? car.roll : car.roll + car.steerRoll;
  const toWorld = (localX, localY, localZ) => transformPoint(localX, localY, localZ, car.x, centerY, car.z, car.heading, pitch, roll);
  return { car, toWorld, center: [car.x, centerY, car.z], yaw: car.heading, pitch, roll, isHoodCam };
}

function pushPlayerCarShadow(vertices, offset, body) {
  const shadowY = -PLAYER_CAR_RIDE_HEIGHT + 0.03 - (body.isHoodCam ? 0 : body.car.suspBob);
  const { toWorld } = body;
  offset = pushQuad(vertices, offset, toWorld(-1.15, shadowY, -2.45), toWorld(1.15, shadowY, -2.45), toWorld(1.15, shadowY, 2.45), toWorld(-1.15, shadowY, 2.45), PLAYER_CAR_FINISH.shadow, MATERIAL.PLASTER, 0.5, 0.45);
  return pushQuad(vertices, offset, toWorld(-0.95, shadowY + 0.005, -2.15), toWorld(0.95, shadowY + 0.005, -2.15), toWorld(0.95, shadowY + 0.005, 2.15), toWorld(-0.95, shadowY + 0.005, 2.15), PLAYER_CAR_FINISH.shadow, MATERIAL.PLASTER, 0.5, 0.25);
}

function bodyRing(body, section) {
  const ring = [];
  const levels = section.heights.length;
  for (let level = 0; level < levels; level++) ring.push(body.toWorld(-section.widths[level], section.heights[level], section.z));
  for (let level = levels - 1; level >= 0; level--) ring.push(body.toWorld(section.widths[level], section.heights[level], section.z));
  return ring;
}

function pushPlayerCarBody(vertices, offset, body) {
  const paint = { color: PLAYER_CAR_FINISH.paint, material: MATERIAL.CAR_PAINT, variant: 0.5, occlusion: 1.0 };
  const rings = PLAYER_BODY_SECTIONS.map(section => bodyRing(body, section));
  const ringSize = rings[0].length;
  const solidCenter = body.toWorld(0, 0.12, 0);
  for (let sectionIndex = 0; sectionIndex < rings.length - 1; sectionIndex++) {
    const nearRing = rings[sectionIndex];
    const farRing = rings[sectionIndex + 1];
    for (let corner = 0; corner < ringSize; corner++) {
      const nextCorner = (corner + 1) % ringSize;
      const face = [nearRing[corner], nearRing[nextCorner], farRing[nextCorner], farRing[corner]];
      const isUnderside = corner === ringSize - 1;
      const surface = isUnderside ? { color: PLAYER_CAR_FINISH.trim, material: MATERIAL.METAL, variant: 0.2, occlusion: 0.5 } : paint;
      offset = pushConvexFaces(vertices, offset, [face], solidCenter, surface);
    }
  }
  for (const [ring, direction] of [[rings[0], -1], [rings[rings.length - 1], 1]]) {
    const capCenter = averagePoints(ring);
    const outside = body.toWorld(0, 0.1, direction * 5.0);
    for (let corner = 0; corner < ringSize; corner++) {
      const viewer = subtractPoints(outside, capCenter);
      offset = pushFacingTriangle(vertices, offset, capCenter, ring[corner], ring[(corner + 1) % ringSize], viewer, paint);
    }
  }
  return offset;
}

function cabinRing(body, section) {
  return [
    body.toWorld(-section.baseWidth, section.base, section.z),
    body.toWorld(-section.topWidth, section.top, section.z),
    body.toWorld(section.topWidth, section.top, section.z),
    body.toWorld(section.baseWidth, section.base, section.z)
  ];
}

function pushPlayerCarCabin(vertices, offset, body) {
  const glass = { color: PLAYER_CAR_FINISH.glass, material: MATERIAL.CAR_GLASS, variant: 0.5, occlusion: 1.0 };
  const roof = { color: PLAYER_CAR_FINISH.blackPaint, material: MATERIAL.CAR_PAINT, variant: 0.5, occlusion: 1.0 };
  const rings = PLAYER_CABIN_SECTIONS.map(section => cabinRing(body, section));
  const solidCenter = body.toWorld(0, 0.45, 0.4);
  for (let sectionIndex = 0; sectionIndex < rings.length - 1; sectionIndex++) {
    const nearRing = rings[sectionIndex];
    const farRing = rings[sectionIndex + 1];
    const isRoofSpan = sectionIndex === 1;
    offset = pushConvexFaces(vertices, offset, [[nearRing[0], nearRing[1], farRing[1], farRing[0]]], solidCenter, glass);
    offset = pushConvexFaces(vertices, offset, [[nearRing[2], nearRing[3], farRing[3], farRing[2]]], solidCenter, glass);
    offset = pushConvexFaces(vertices, offset, [[nearRing[1], nearRing[2], farRing[2], farRing[1]]], solidCenter, isRoofSpan ? roof : glass);
  }
  for (const pillarZ of [-0.15, 0.75]) {
    for (const side of [-1, 1]) {
      const section = PLAYER_CABIN_SECTIONS.find(candidate => candidate.z === pillarZ);
      const pillarCenter = body.toWorld(side * (section.baseWidth + section.topWidth) * 0.5, (section.base + section.top) * 0.5, pillarZ);
      offset = pushBox(vertices, offset, { center: pillarCenter, size: [0.07, section.top - section.base, 0.12], yaw: body.yaw, pitch: body.pitch, roll: body.roll + side * 0.25, color: PLAYER_CAR_FINISH.blackPaint, material: MATERIAL.CAR_PAINT, occlusion: 1.0, variant: 0.5 });
    }
  }
  for (const side of [-1, 1]) {
    const beltCenter = body.toWorld(side * 0.835, 0.465, 0.42);
    offset = pushBox(vertices, offset, { center: beltCenter, size: [0.03, 0.025, 2.3], yaw: body.yaw, pitch: body.pitch, roll: body.roll, color: PLAYER_CAR_FINISH.chrome, material: MATERIAL.CHROME, occlusion: 1.0, variant: 0.5 });
    const mirrorCenter = body.toWorld(side * 0.98, 0.52, -0.55);
    offset = pushBox(vertices, offset, { center: mirrorCenter, size: [0.2, 0.11, 0.17], yaw: body.yaw, pitch: body.pitch, roll: body.roll, color: PLAYER_CAR_FINISH.blackPaint, material: MATERIAL.CAR_PAINT, occlusion: 1.0, variant: 0.5 });
  }
  return offset;
}

function pushPlayerCarPart(vertices, offset, body, { local, size, color, material, occlusion = 0.95, pitchOffset = 0 }) {
  return pushBox(vertices, offset, { center: body.toWorld(local[0], local[1], local[2]), size, yaw: body.yaw, pitch: body.pitch + pitchOffset, roll: body.roll, color, material, occlusion, variant: 0.5 });
}

function pushPlayerCarAeroParts(vertices, offset, body) {
  const trim = PLAYER_CAR_FINISH.trim;
  const blackPaint = PLAYER_CAR_FINISH.blackPaint;
  offset = pushPlayerCarPart(vertices, offset, body, { local: [0, -0.24, -2.12], size: [1.72, 0.04, 0.34], color: trim, material: MATERIAL.METAL });
  offset = pushPlayerCarPart(vertices, offset, body, { local: [0, -0.07, -2.27], size: [1.02, 0.17, 0.04], color: trim, material: MATERIAL.METAL, occlusion: 0.7 });
  for (const slatHeight of [-0.12, -0.07, -0.02]) {
    offset = pushPlayerCarPart(vertices, offset, body, { local: [0, slatHeight, -2.285], size: [0.96, 0.012, 0.03], color: PLAYER_CAR_FINISH.rim, material: MATERIAL.CHROME });
  }
  for (const side of [-1, 1]) {
    offset = pushPlayerCarPart(vertices, offset, body, { local: [side * 0.965, -0.17, 0.0], size: [0.07, 0.09, 1.85], color: trim, material: MATERIAL.METAL });
    offset = pushPlayerCarPart(vertices, offset, body, { local: [side * 0.62, 0.66, 2.02], size: [0.05, 0.22, 0.1], color: blackPaint, material: MATERIAL.CAR_PAINT });
  }
  offset = pushPlayerCarPart(vertices, offset, body, { local: [0, -0.2, 2.2], size: [1.5, 0.1, 0.22], color: trim, material: MATERIAL.METAL, occlusion: 0.7 });
  for (let fin = -2; fin <= 2; fin++) {
    offset = pushPlayerCarPart(vertices, offset, body, { local: [fin * 0.28, -0.2, 2.24], size: [0.03, 0.12, 0.2], color: trim, material: MATERIAL.METAL, occlusion: 0.7 });
  }
  for (const side of [-1, 1]) {
    offset = pushPlayerCarPart(vertices, offset, body, { local: [side * 0.42, -0.13, 2.29], size: [0.13, 0.13, 0.08], color: PLAYER_CAR_FINISH.chrome, material: MATERIAL.CHROME });
  }
  offset = pushPlayerCarPart(vertices, offset, body, { local: [0, 0.79, 2.06], size: [1.72, 0.045, 0.34], color: blackPaint, material: MATERIAL.CAR_PAINT, pitchOffset: -0.08 });
  return pushPlayerCarPart(vertices, offset, body, { local: [0, 0.36, -1.0], size: [0.04, 0.012, 1.2], color: blackPaint, material: MATERIAL.CAR_PAINT });
}

function pushPlayerCarLights(vertices, offset, body, isBraking) {
  const tailIntensity = isBraking ? 1.9 : 0.95;
  const tailColor = [1.0 * tailIntensity, 0.06 * tailIntensity, 0.08 * tailIntensity];
  offset = pushPlayerCarPart(vertices, offset, body, { local: [0, 0.33, 2.28], size: [1.52, 0.06, 0.04], color: tailColor, material: MATERIAL.GLOW });
  for (const side of [-1, 1]) {
    offset = pushPlayerCarPart(vertices, offset, body, { local: [side * 0.66, 0.24, 2.27], size: [0.3, 0.13, 0.05], color: tailColor, material: MATERIAL.GLOW });
    offset = pushPlayerCarPart(vertices, offset, body, { local: [side * 0.64, 0.15, -2.08], size: [0.42, 0.07, 0.06], color: PLAYER_CAR_FINISH.headlight, material: MATERIAL.GLOW });
    offset = pushPlayerCarPart(vertices, offset, body, { local: [side * 0.52, 0.12, -2.09], size: [0.14, 0.11, 0.05], color: [1.0, 0.97, 0.88], material: MATERIAL.GLOW });
    offset = pushPlayerCarPart(vertices, offset, body, { local: [side * 0.62, 0.09, -2.08], size: [0.3, 0.06, 0.04], color: PLAYER_CAR_FINISH.trim, material: MATERIAL.CHROME });
    offset = pushPlayerCarPart(vertices, offset, body, { local: [side * 0.72, -0.15, -2.15], size: [0.22, 0.03, 0.04], color: PLAYER_CAR_FINISH.headlight, material: MATERIAL.GLOW });
  }
  return offset;
}

function pushPlayerWheel(vertices, offset, body, { side, axle, steer, spin }) {
  const hub = body.toWorld(side * PLAYER_WHEEL_TRACK, PLAYER_WHEEL_RADIUS - PLAYER_CAR_RIDE_HEIGHT, axle);
  const wheelYaw = body.yaw + steer;
  const toWheel = (localX, localY, localZ) => transformPoint(localX, localY, localZ, hub[0], hub[1], hub[2], wheelYaw, body.pitch + spin, body.roll);
  const halfWidth = PLAYER_WHEEL_WIDTH * 0.5;
  const tire = { color: PLAYER_CAR_FINISH.tire, material: MATERIAL.PLASTER, variant: 0.5, occlusion: 0.8 };
  const rim = { color: PLAYER_CAR_FINISH.rim, material: MATERIAL.CHROME, variant: 0.5, occlusion: 0.9 };
  const treadFaces = [];
  const outerRing = [];
  const innerRing = [];
  for (let sideIndex = 0; sideIndex < PLAYER_WHEEL_SIDES; sideIndex++) {
    const angle = (sideIndex / PLAYER_WHEEL_SIDES) * Math.PI * 2;
    const nextAngle = ((sideIndex + 1) / PLAYER_WHEEL_SIDES) * Math.PI * 2;
    const point = (x, theta, radius) => toWheel(x, Math.cos(theta) * radius, Math.sin(theta) * radius);
    treadFaces.push([point(-halfWidth, angle, PLAYER_WHEEL_RADIUS), point(halfWidth, angle, PLAYER_WHEEL_RADIUS), point(halfWidth, nextAngle, PLAYER_WHEEL_RADIUS), point(-halfWidth, nextAngle, PLAYER_WHEEL_RADIUS)]);
    outerRing.push(point(side * halfWidth, angle, PLAYER_WHEEL_RADIUS));
    innerRing.push(point(side * halfWidth * 1.02, angle, PLAYER_WHEEL_RADIUS * 0.72));
  }
  offset = pushConvexFaces(vertices, offset, treadFaces, hub, tire);
  const outward = subtractPoints(toWheel(side, 0, 0), hub);
  const rimCenter = toWheel(side * halfWidth * 1.02, 0, 0);
  for (let sideIndex = 0; sideIndex < PLAYER_WHEEL_SIDES; sideIndex++) {
    const next = (sideIndex + 1) % PLAYER_WHEEL_SIDES;
    offset = pushFacingQuad(vertices, offset, outerRing[sideIndex], outerRing[next], innerRing[next], innerRing[sideIndex], outward, tire);
    offset = pushFacingTriangle(vertices, offset, rimCenter, innerRing[sideIndex], innerRing[next], outward, { ...rim, color: [0.03, 0.03, 0.035], material: MATERIAL.METAL });
  }
  for (let spoke = 0; spoke < PLAYER_WHEEL_SPOKES; spoke++) {
    const angle = (spoke / PLAYER_WHEEL_SPOKES) * Math.PI * 2;
    const spokeCenter = toWheel(side * halfWidth * 1.06, Math.cos(angle) * PLAYER_WHEEL_RADIUS * 0.38, Math.sin(angle) * PLAYER_WHEEL_RADIUS * 0.38);
    offset = pushBox(vertices, offset, { center: spokeCenter, size: [0.035, PLAYER_WHEEL_RADIUS * 0.66, 0.075], yaw: wheelYaw, pitch: body.pitch + spin + angle, roll: body.roll, ...rim });
  }
  offset = pushBox(vertices, offset, { center: toWheel(side * halfWidth * 1.1, 0, 0), size: [0.05, 0.09, 0.09], yaw: wheelYaw, pitch: body.pitch + spin, roll: body.roll, color: PLAYER_CAR_FINISH.chrome, material: MATERIAL.CHROME, occlusion: 1.0, variant: 0.5 });
  const caliperCenter = transformPoint(side * halfWidth * 0.7, 0.12, -0.1, hub[0], hub[1], hub[2], wheelYaw, body.pitch, body.roll);
  return pushBox(vertices, offset, { center: caliperCenter, size: [0.06, 0.16, 0.12], yaw: wheelYaw, pitch: body.pitch, roll: body.roll, color: PLAYER_CAR_FINISH.caliper, material: MATERIAL.CAR_PAINT, occlusion: 0.9, variant: 0.5 });
}
