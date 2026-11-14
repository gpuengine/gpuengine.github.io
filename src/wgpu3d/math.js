// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const MATRIX_SIZE = 16;
const scratchMatrix = new Float32Array(MATRIX_SIZE);
const FULL_TURN_RADIANS = Math.PI * 2;
const SRGB_GAMMA = 2.2;
const HEX_COLOR_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

export function damp(current, target, ratePerSecond, deltaSeconds) {
  return lerp(current, target, 1 - Math.exp(-ratePerSecond * deltaSeconds));
}

export function wrapAngle(radians) {
  return radians - Math.round(radians / FULL_TURN_RADIANS) * FULL_TURN_RADIANS;
}

export function dampAngle(current, target, ratePerSecond, deltaSeconds) {
  return current + wrapAngle(target - current) * (1 - Math.exp(-ratePerSecond * deltaSeconds));
}

export function degreesToRadians(degrees) {
  return degrees * Math.PI / 180;
}

export function createRandom(seed = 1) {
  let state = (Math.floor(seed) * 2654435761) >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (minimum, maximum) => lerp(minimum, maximum, next());
  next.integer = (minimum, maximum) => Math.floor(lerp(minimum, maximum + 1, next()));
  next.pick = (items) => items[Math.floor(next() * items.length)];
  return next;
}

export function toLinearColor(color) {
  if (typeof color !== "string") return [color[0], color[1], color[2]];
  const match = HEX_COLOR_PATTERN.exec(color.trim());
  if (!match) throw new Error(`wgpu3d: "${color}" is not a hex color like #ff8a3d.`);
  const digits = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join("") : match[1];
  return [0, 2, 4].map((start) => (parseInt(digits.slice(start, start + 2), 16) / 255) ** SRGB_GAMMA);
}

export function vectorLength(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

export function normalize(vector) {
  const length = vectorLength(vector) || 1;
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

export function subtract(first, second) {
  return [first[0] - second[0], first[1] - second[1], first[2] - second[2]];
}

export function cross(first, second) {
  return [
    first[1] * second[2] - first[2] * second[1],
    first[2] * second[0] - first[0] * second[2],
    first[0] * second[1] - first[1] * second[0]
  ];
}

export function forwardFromYaw(yaw) {
  return [-Math.sin(yaw), 0, -Math.cos(yaw)];
}

export function createMatrix() {
  return identityMatrix(new Float32Array(MATRIX_SIZE));
}

export function identityMatrix(out) {
  out.fill(0);
  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
}

export function perspectiveMatrix(out, fieldOfViewRadians, aspect, near, far) {
  const focalLength = 1 / Math.tan(fieldOfViewRadians * 0.5);
  out.fill(0);
  out[0] = focalLength / aspect;
  out[5] = focalLength;
  out[10] = far / (near - far);
  out[11] = -1;
  out[14] = (far * near) / (near - far);
  return out;
}

export function orthographicMatrix(out, left, right, bottom, top, near, far) {
  out.fill(0);
  out[0] = 2 / (right - left);
  out[5] = 2 / (top - bottom);
  out[10] = 1 / (near - far);
  out[12] = -(right + left) / (right - left);
  out[13] = -(top + bottom) / (top - bottom);
  out[14] = near / (near - far);
  out[15] = 1;
  return out;
}

export function lookAtMatrix(out, eye, target, up) {
  const back = normalize(subtract(eye, target));
  const right = normalize(cross(up, back));
  const trueUp = cross(back, right);
  out[0] = right[0]; out[1] = trueUp[0]; out[2] = back[0]; out[3] = 0;
  out[4] = right[1]; out[5] = trueUp[1]; out[6] = back[1]; out[7] = 0;
  out[8] = right[2]; out[9] = trueUp[2]; out[10] = back[2]; out[11] = 0;
  out[12] = -(right[0] * eye[0] + right[1] * eye[1] + right[2] * eye[2]);
  out[13] = -(trueUp[0] * eye[0] + trueUp[1] * eye[1] + trueUp[2] * eye[2]);
  out[14] = -(back[0] * eye[0] + back[1] * eye[1] + back[2] * eye[2]);
  out[15] = 1;
  return out;
}

export function multiplyMatrices(out, first, second) {
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let index = 0; index < 4; index++) sum += first[index * 4 + row] * second[column * 4 + index];
      scratchMatrix[column * 4 + row] = sum;
    }
  }
  out.set(scratchMatrix);
  return out;
}

export function composeMatrix(out, { position = [0, 0, 0], yaw = 0, pitch = 0, roll = 0, scale = [1, 1, 1] }) {
  const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch), sinPitch = Math.sin(pitch);
  const cosRoll = Math.cos(roll), sinRoll = Math.sin(roll);
  const [scaleX, scaleY, scaleZ] = scale;
  out[0] = (cosYaw * cosRoll + sinYaw * sinPitch * sinRoll) * scaleX;
  out[1] = (cosPitch * sinRoll) * scaleX;
  out[2] = (-sinYaw * cosRoll + cosYaw * sinPitch * sinRoll) * scaleX;
  out[3] = 0;
  out[4] = (-cosYaw * sinRoll + sinYaw * sinPitch * cosRoll) * scaleY;
  out[5] = (cosPitch * cosRoll) * scaleY;
  out[6] = (sinYaw * sinRoll + cosYaw * sinPitch * cosRoll) * scaleY;
  out[7] = 0;
  out[8] = (sinYaw * cosPitch) * scaleZ;
  out[9] = -sinPitch * scaleZ;
  out[10] = (cosYaw * cosPitch) * scaleZ;
  out[11] = 0;
  out[12] = position[0];
  out[13] = position[1];
  out[14] = position[2];
  out[15] = 1;
  return out;
}

export function transformPoint(matrix, point) {
  const [x, y, z] = point;
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]
  ];
}

export function transformDirection(matrix, direction) {
  const [x, y, z] = direction;
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z,
    matrix[1] * x + matrix[5] * y + matrix[9] * z,
    matrix[2] * x + matrix[6] * y + matrix[10] * z
  ];
}
