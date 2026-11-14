// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

import { MeshBuilder, material } from "./mesh.js";
import { SceneObject, boxCollider, sphereCollider } from "./scene.js";
import { createRandom, toLinearColor } from "./math.js";

const CAR_RIDE_HEIGHT = 0.42;
const CAR_WHEEL_RADIUS = 0.33;
const CAR_WHEEL_WIDTH = 0.27;
const CAR_WHEEL_TRACK = 0.88;
const CAR_FRONT_AXLE = -1.35;
const CAR_REAR_AXLE = 1.32;
const CAR_WHEEL_SIDES = 14;
const CAR_WHEEL_SPOKES = 5;
const CAR_FINISH = Object.freeze({
  roof: [0.035, 0.035, 0.04],
  glass: [0.05, 0.07, 0.09],
  trim: [0.025, 0.025, 0.03],
  chrome: [0.80, 0.82, 0.86],
  rim: [0.10, 0.10, 0.11],
  tire: [0.055, 0.055, 0.06],
  headlight: [0.88, 0.96, 1.0],
  taillight: [1.0, 0.06, 0.08]
});
const CAR_BODY_SECTIONS = Object.freeze([
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
const CAR_CABIN_SECTIONS = Object.freeze([
  { z: -0.80, base: 0.42, top: 0.44, baseWidth: 0.78, topWidth: 0.74 },
  { z: -0.15, base: 0.46, top: 0.86, baseWidth: 0.82, topWidth: 0.62 },
  { z: 0.75, base: 0.48, top: 0.88, baseWidth: 0.84, topWidth: 0.64 },
  { z: 1.65, base: 0.50, top: 0.52, baseWidth: 0.82, topWidth: 0.76 }
]);
const CAR_ROOF_SPAN_INDEX = 1;
const CHARACTER_LEG_LENGTH = 0.8;
const CHARACTER_ARM_LENGTH = 0.62;
const CHARACTER_SHOULDER_HEIGHT = 1.4;

let sharedCarWheelMesh = null;

export function createCar({ paint = "#c8120c", name = "car" } = {}) {
  const car = new SceneObject({ name, collider: { ...boxCollider([2.1, 1.4, 4.6]), offset: [0, 0.7, 0] } });
  const body = new SceneObject({ name: `${name}-body`, mesh: buildCarBodyMesh(paint), position: [0, CAR_RIDE_HEIGHT, 0] });
  const brakeLight = new SceneObject({ name: `${name}-brake-lights`, mesh: buildCarTaillightMesh() });
  body.add(brakeLight);
  sharedCarWheelMesh ??= buildCarWheelMesh();
  const wheels = [[-1, CAR_FRONT_AXLE], [1, CAR_FRONT_AXLE], [-1, CAR_REAR_AXLE], [1, CAR_REAR_AXLE]].map(([side, axle]) => new SceneObject({
    name: `${name}-wheel`,
    mesh: sharedCarWheelMesh,
    position: [side * CAR_WHEEL_TRACK, CAR_WHEEL_RADIUS, axle],
    tags: axle === CAR_FRONT_AXLE ? ["front-wheel"] : []
  }));
  car.add(body, ...wheels);
  car.parts = { body, wheels, brakeLights: [brakeLight], bodyHeight: CAR_RIDE_HEIGHT };
  return car;
}

function buildCarBodyMesh(paint) {
  const builder = new MeshBuilder();
  const paintFinish = material(paint, { gloss: 0.85 });
  const ring = (section) => [
    ...section.heights.map((height, level) => [-section.widths[level], height, section.z]),
    ...section.heights.map((height, level) => [section.widths[level], height, section.z]).reverse()
  ];
  builder.loft(CAR_BODY_SECTIONS.map(ring), { material: paintFinish });
  addCarCabin(builder);
  addCarTrim(builder);
  return builder.toMesh();
}

function addCarCabin(builder) {
  const glass = material(CAR_FINISH.glass, { gloss: 1 });
  const roof = material(CAR_FINISH.roof, { gloss: 0.8 });
  const rings = CAR_CABIN_SECTIONS.map((section) => [
    [-section.baseWidth, section.base, section.z],
    [-section.topWidth, section.top, section.z],
    [section.topWidth, section.top, section.z],
    [section.baseWidth, section.base, section.z]
  ]);
  for (let index = 0; index < rings.length - 1; index++) {
    const near = rings[index], far = rings[index + 1];
    builder.quad(near[0], near[1], far[1], far[0], glass);
    builder.quad(near[2], near[3], far[3], far[2], glass);
    builder.quad(near[1], near[2], far[2], far[1], index === CAR_ROOF_SPAN_INDEX ? roof : glass);
  }
  for (const side of [-1, 1]) {
    builder.box({ center: [side * 0.98, 0.52, -0.55], size: [0.2, 0.11, 0.17], material: roof });
    builder.box({ center: [side * 0.835, 0.465, 0.42], size: [0.03, 0.025, 2.3], material: material(CAR_FINISH.chrome, { gloss: 1 }) });
  }
}

function addCarTrim(builder) {
  const trim = material(CAR_FINISH.trim, { gloss: 0.3 });
  const headlight = material(CAR_FINISH.headlight, { glow: 0.9 });
  builder.box({ center: [0, -0.24, -2.12], size: [1.72, 0.04, 0.34], material: trim });
  builder.box({ center: [0, -0.07, -2.27], size: [1.02, 0.17, 0.04], material: trim, occlusion: 0.7 });
  builder.box({ center: [0, -0.2, 2.2], size: [1.5, 0.1, 0.22], material: trim, occlusion: 0.7 });
  builder.box({ center: [0, 0.79, 2.06], size: [1.72, 0.045, 0.34], pitch: -0.08, material: material(CAR_FINISH.roof, { gloss: 0.6 }) });
  for (const side of [-1, 1]) {
    builder.box({ center: [side * 0.965, -0.17, 0], size: [0.07, 0.09, 1.85], material: trim });
    builder.box({ center: [side * 0.62, 0.66, 2.02], size: [0.05, 0.22, 0.1], material: trim });
    builder.box({ center: [side * 0.64, 0.15, -2.08], size: [0.42, 0.07, 0.06], material: headlight });
    builder.box({ center: [side * 0.42, -0.13, 2.29], size: [0.13, 0.13, 0.08], material: material(CAR_FINISH.chrome, { gloss: 1 }) });
  }
}

function buildCarTaillightMesh() {
  const builder = new MeshBuilder();
  const taillight = material(CAR_FINISH.taillight, { glow: 0.35 });
  builder.box({ center: [0, 0.33, 2.28], size: [1.52, 0.06, 0.04], material: taillight });
  for (const side of [-1, 1]) builder.box({ center: [side * 0.66, 0.24, 2.27], size: [0.3, 0.13, 0.05], material: taillight });
  return builder.toMesh();
}

function buildCarWheelMesh() {
  const builder = new MeshBuilder();
  const tire = material(CAR_FINISH.tire, { gloss: 0.1 });
  const rim = material(CAR_FINISH.rim, { gloss: 0.9 });
  builder.cylinder({ radius: CAR_WHEEL_RADIUS, height: CAR_WHEEL_WIDTH, sides: CAR_WHEEL_SIDES, axis: "x", material: tire, capMaterial: material(CAR_FINISH.trim) });
  for (const side of [-1, 1]) {
    for (let spoke = 0; spoke < CAR_WHEEL_SPOKES; spoke++) {
      const angle = (spoke / CAR_WHEEL_SPOKES) * Math.PI * 2;
      const reach = CAR_WHEEL_RADIUS * 0.38;
      builder.box({ center: [side * CAR_WHEEL_WIDTH * 0.53, Math.cos(angle) * reach, Math.sin(angle) * reach], size: [0.03, CAR_WHEEL_RADIUS * 0.66, 0.075], pitch: angle, material: rim });
    }
    builder.box({ center: [side * CAR_WHEEL_WIDTH * 0.56, 0, 0], size: [0.04, 0.09, 0.09], material: material(CAR_FINISH.chrome, { gloss: 1 }) });
  }
  return builder.toMesh();
}

export function createCharacter({ shirt = "#2f7de1", pants = "#28313f", skin = "#e0b08c", name = "character" } = {}) {
  const character = new SceneObject({ name, collider: { ...sphereCollider(0.35), offset: [0, 0.9, 0] } });
  const torso = new MeshBuilder()
    .box({ center: [0, 1.12, 0], size: [0.5, 0.62, 0.28], material: material(shirt, { gloss: 0.2 }) })
    .box({ center: [0, 0.82, 0], size: [0.48, 0.1, 0.27], material: material(pants) })
    .sphere({ center: [0, 1.62, 0], radius: 0.19, material: material(skin, { gloss: 0.2 }) })
    .box({ center: [0, 1.66, -0.15], size: [0.22, 0.05, 0.08], material: material("#1b1b1f") });
  character.add(new SceneObject({ name: `${name}-torso`, mesh: torso.toMesh() }));
  const limb = (length, width, color, position) => new SceneObject({
    mesh: new MeshBuilder().box({ center: [0, -length / 2, 0], size: [width, length, width], material: material(color) }).toMesh(),
    position
  });
  const leftLeg = limb(CHARACTER_LEG_LENGTH, 0.2, pants, [-0.13, CHARACTER_LEG_LENGTH, 0]);
  const rightLeg = limb(CHARACTER_LEG_LENGTH, 0.2, pants, [0.13, CHARACTER_LEG_LENGTH, 0]);
  const leftArm = limb(CHARACTER_ARM_LENGTH, 0.14, shirt, [-0.33, CHARACTER_SHOULDER_HEIGHT, 0]);
  const rightArm = limb(CHARACTER_ARM_LENGTH, 0.14, shirt, [0.33, CHARACTER_SHOULDER_HEIGHT, 0]);
  character.add(leftLeg, rightLeg, leftArm, rightArm);
  character.parts = { leftLeg, rightLeg, leftArm, rightArm };
  return character;
}

export function createTree({ seed = 1, height = 5, kind = "round", foliage = "#3f7d3a", trunk = "#6b4a2f", position = [0, 0, 0] } = {}) {
  const random = createRandom(seed);
  const builder = new MeshBuilder();
  const leafColor = toLinearColor(foliage);
  const shade = () => material(leafColor.map((channel) => channel * random.range(0.8, 1.15)), { gloss: 0.05 });
  const trunkHeight = height * (kind === "pine" ? 0.35 : 0.45);
  builder.cylinder({ center: [0, trunkHeight / 2, 0], radius: height * 0.035, radiusTop: height * 0.025, height: trunkHeight, sides: 7, material: material(trunk) });
  if (kind === "pine") {
    for (let layer = 0; layer < 3; layer++) {
      const layerBase = trunkHeight * 0.7 + layer * height * 0.2;
      builder.cone({ center: [0, layerBase + height * 0.17, 0], radius: height * (0.26 - layer * 0.06), height: height * 0.36, sides: 9, material: shade(), isCapped: true });
    }
  } else {
    const blobCount = random.integer(3, 5);
    for (let blob = 0; blob < blobCount; blob++) {
      const angle = random() * Math.PI * 2;
      const spread = blob === 0 ? 0 : height * 0.16;
      const radius = height * random.range(0.17, 0.25);
      builder.sphere({ center: [Math.cos(angle) * spread, trunkHeight + height * random.range(0.12, 0.3), Math.sin(angle) * spread], radii: [radius, radius * 0.85, radius], sides: 9, rings: 6, isSmooth: false, material: shade() });
    }
  }
  return new SceneObject({ name: "tree", mesh: builder.toMesh(), position, yaw: random() * Math.PI * 2, collider: { ...boxCollider([height * 0.1, trunkHeight, height * 0.1]), offset: [0, trunkHeight / 2, 0] } });
}

export function createBuilding({ seed = 1, width = 8, depth = 8, height = 14, color = "#b9b2a6", windowColor = "#9fb8c8", litWindowColor = "#ffd38a", litShare = 0, floorHeight = 3.2, position = [0, 0, 0], yaw = 0 } = {}) {
  const random = createRandom(seed);
  const builder = new MeshBuilder();
  const wall = material(color, { gloss: 0.05 });
  builder.box({ center: [0, height / 2, 0], size: [width, height, depth], material: wall });
  builder.box({ center: [0, height + 0.3, 0], size: [width + 0.3, 0.6, depth + 0.3], material: material(color, { gloss: 0.1 }), occlusion: 0.9 });
  builder.box({ center: [0, 0.4, 0], size: [width + 0.2, 0.8, depth + 0.2], material: material("#6f6a63"), occlusion: 0.85 });
  const darkGlass = material(windowColor, { gloss: 1 });
  const litGlass = material(litWindowColor, { glow: 0.8 });
  const floors = Math.max(1, Math.floor((height - 1.5) / floorHeight));
  const faces = [
    { normal: [0, 0, 1], along: [1, 0, 0], length: width, offset: depth / 2 },
    { normal: [0, 0, -1], along: [-1, 0, 0], length: width, offset: depth / 2 },
    { normal: [1, 0, 0], along: [0, 0, -1], length: depth, offset: width / 2 },
    { normal: [-1, 0, 0], along: [0, 0, 1], length: depth, offset: width / 2 }
  ];
  for (const face of faces) {
    const columns = Math.max(1, Math.floor(face.length / 2.2));
    for (let floor = 0; floor < floors; floor++) {
      for (let column = 0; column < columns; column++) {
        const along = (column + 0.5) / columns * face.length - face.length / 2;
        const bottom = 1.4 + floor * floorHeight;
        const glass = random() < litShare ? litGlass : darkGlass;
        const point = (alongOffset, up) => face.normal.map((component, axis) => component * (face.offset + 0.03) + face.along[axis] * (along + alongOffset) + (axis === 1 ? up : 0));
        builder.quad(point(-0.6, bottom), point(0.6, bottom), point(0.6, bottom + floorHeight * 0.55), point(-0.6, bottom + floorHeight * 0.55), glass);
      }
    }
  }
  return new SceneObject({ name: "building", mesh: builder.toMesh(), position, yaw, collider: { ...boxCollider([width + 0.3, height, depth + 0.3]), offset: [0, height / 2, 0] } });
}

export function createGround({ size = 200, tiles = 40, color = "#5f8a4a", alternateColor = "#577f44" } = {}) {
  const mesh = new MeshBuilder().plane({ size: [size, size], tiles, material: material(color), alternateMaterial: material(alternateColor) }).toMesh();
  return new SceneObject({ name: "ground", mesh, castsShadow: false });
}

export function createRoad({ length = 100, width = 8, position = [0, 0, 0], yaw = 0, height = 0.02, color = "#3a3d44", lineColor = "#f2d35a" } = {}) {
  const markingHeight = height + 0.01;
  const builder = new MeshBuilder();
  const asphalt = material(color, { gloss: 0.1 });
  builder.quad([-width / 2, height, -length / 2], [-width / 2, height, length / 2], [width / 2, height, length / 2], [width / 2, height, -length / 2], asphalt);
  const dash = material(lineColor, { glow: 0.05 });
  for (let start = -length / 2 + 1; start < length / 2 - 3; start += 6) {
    builder.quad([-0.08, markingHeight, start], [-0.08, markingHeight, start + 3], [0.08, markingHeight, start + 3], [0.08, markingHeight, start], dash);
  }
  for (const side of [-1, 1]) {
    const edge = side * (width / 2 - 0.25);
    builder.quad([edge - 0.07, markingHeight, -length / 2], [edge - 0.07, markingHeight, length / 2], [edge + 0.07, markingHeight, length / 2], [edge + 0.07, markingHeight, -length / 2], material("#e8e6df"));
  }
  return new SceneObject({ name: "road", mesh: builder.toMesh(), position, yaw, castsShadow: false });
}

export function createCoin({ color = "#ffc83d", position = [0, 1, 0] } = {}) {
  const gold = material(color, { gloss: 0.9, glow: 0.12 });
  const mesh = new MeshBuilder()
    .cylinder({ radius: 0.4, height: 0.08, sides: 20, axis: "z", material: gold })
    .cylinder({ radius: 0.26, height: 0.1, sides: 20, axis: "z", material: material(color, { gloss: 1, glow: 0.2 }) })
    .toMesh();
  return new SceneObject({ name: "coin", mesh, position, collider: sphereCollider(0.45), isSolid: false, tags: ["coin"] });
}

export function createCrate({ size = 1, color = "#b07a3c", position = [0, 0, 0], yaw = 0 } = {}) {
  const builder = new MeshBuilder();
  builder.box({ center: [0, size / 2, 0], size: [size, size, size], material: material(color, { gloss: 0.1 }) });
  const frame = material("#6d4a22");
  const thickness = size * 0.1, half = size / 2;
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) builder.box({ center: [x * (half - thickness / 2), half, z * (half - thickness / 2)], size: [thickness * 1.05, size * 1.02, thickness * 1.05], material: frame });
  }
  for (const y of [0, size]) {
    builder.box({ center: [0, y + (y === 0 ? thickness / 2 : -thickness / 2), half - thickness / 2], size: [size * 1.02, thickness, thickness * 1.05], material: frame });
    builder.box({ center: [0, y + (y === 0 ? thickness / 2 : -thickness / 2), -half + thickness / 2], size: [size * 1.02, thickness, thickness * 1.05], material: frame });
  }
  return new SceneObject({ name: "crate", mesh: builder.toMesh(), position, yaw, collider: { ...boxCollider([size, size, size]), offset: [0, size / 2, 0] } });
}

export function createLampPost({ height = 4.5, lightColor = "#ffe2a8", glow = 1, position = [0, 0, 0] } = {}) {
  const metal = material("#2c2f36", { gloss: 0.6 });
  const mesh = new MeshBuilder()
    .cylinder({ center: [0, height / 2, 0], radius: 0.07, radiusTop: 0.05, height, sides: 8, material: metal })
    .box({ center: [0, height, 0], size: [0.5, 0.12, 0.5], material: metal })
    .box({ center: [0, height - 0.14, 0], size: [0.38, 0.16, 0.38], material: material(lightColor, { glow }) })
    .toMesh();
  return new SceneObject({ name: "lamp-post", mesh, position, collider: { ...boxCollider([0.25, height, 0.25]), offset: [0, height / 2, 0] } });
}
