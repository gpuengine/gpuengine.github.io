// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

import { createMatrix, composeMatrix, multiplyMatrices, transformPoint, transformDirection, toLinearColor, subtract, cross, normalize } from "./math.js";

export const FLOATS_PER_VERTEX = 12;
export const BYTES_PER_VERTEX = FLOATS_PER_VERTEX * 4;

const INITIAL_VERTEX_CAPACITY = 1024;
const DEFAULT_COLOR = "#cccccc";
const BOX_FACE_OCCLUSION = Object.freeze({ top: 1.05, side: 0.92, front: 1.0, bottom: 0.65 });
const DEFAULT_ROUND_SIDES = 16;
const DEFAULT_SPHERE_RINGS = 10;
const AXIS_ROTATIONS = Object.freeze({
  y: { yaw: 0, pitch: 0, roll: 0 },
  x: { yaw: 0, pitch: 0, roll: -Math.PI / 2 },
  z: { yaw: 0, pitch: Math.PI / 2, roll: 0 }
});

export class Mesh {
  constructor(vertices = new Float32Array(0)) {
    this.vertices = vertices;
    this.version = 0;
  }

  get vertexCount() {
    return this.vertices.length / FLOATS_PER_VERTEX;
  }

  replaceVertices(vertices) {
    this.vertices = vertices;
    this.version += 1;
    return this;
  }
}

export function material(color = DEFAULT_COLOR, { gloss = 0, glow = 0 } = {}) {
  return { color: toLinearColor(color), gloss, glow };
}

export function resolveMaterial(surface) {
  if (surface === undefined || surface === null) return material();
  if (typeof surface === "string" || Array.isArray(surface)) return material(surface);
  if (Array.isArray(surface.color) && surface.color.length === 3 && typeof surface.gloss === "number") return surface;
  return material(surface.color ?? DEFAULT_COLOR, surface);
}

export class MeshBuilder {
  constructor() {
    this.data = new Float32Array(INITIAL_VERTEX_CAPACITY * FLOATS_PER_VERTEX);
    this.length = 0;
    this.transformStack = [createMatrix()];
  }

  get vertexCount() {
    return this.length / FLOATS_PER_VERTEX;
  }

  withTransform(transform, buildParts) {
    const local = composeMatrix(createMatrix(), normalizeTransform(transform));
    this.transformStack.push(multiplyMatrices(createMatrix(), this.currentTransform, local));
    try {
      buildParts(this);
    } finally {
      this.transformStack.pop();
    }
    return this;
  }

  get currentTransform() {
    return this.transformStack[this.transformStack.length - 1];
  }

  triangle(pointA, pointB, pointC, surface, occlusion = [1, 1, 1], vertexNormals = null) {
    const resolved = resolveMaterial(surface);
    const points = [pointA, pointB, pointC].map((point) => transformPoint(this.currentTransform, point));
    const faceNormal = normalize(cross(subtract(points[1], points[0]), subtract(points[2], points[0])));
    const normals = vertexNormals ? vertexNormals.map((normal) => normalize(transformDirection(this.currentTransform, normal))) : [faceNormal, faceNormal, faceNormal];
    this.reserve(3);
    points.forEach((point, index) => this.writeVertex(point, normals[index], resolved, occlusion[index]));
    return this;
  }

  quad(pointA, pointB, pointC, pointD, surface, occlusion = 1) {
    const corners = [occlusion, occlusion, occlusion];
    this.triangle(pointA, pointB, pointC, surface, corners);
    return this.triangle(pointA, pointC, pointD, surface, corners);
  }

  box({ center = [0, 0, 0], size = [1, 1, 1], yaw = 0, pitch = 0, roll = 0, material: surface, occlusion = 1 } = {}) {
    const [halfX, halfY, halfZ] = size.map((length) => length / 2);
    return this.withTransform({ position: center, yaw, pitch, roll }, (builder) => {
      const corner = (signX, signY, signZ) => [signX * halfX, signY * halfY, signZ * halfZ];
      const [c0, c1, c2, c3] = [corner(-1, -1, -1), corner(1, -1, -1), corner(1, 1, -1), corner(-1, 1, -1)];
      const [c4, c5, c6, c7] = [corner(-1, -1, 1), corner(1, -1, 1), corner(1, 1, 1), corner(-1, 1, 1)];
      builder.quad(c0, c1, c2, c3, surface, occlusion * BOX_FACE_OCCLUSION.front);
      builder.quad(c5, c4, c7, c6, surface, occlusion * BOX_FACE_OCCLUSION.front);
      builder.quad(c3, c2, c6, c7, surface, occlusion * BOX_FACE_OCCLUSION.top);
      builder.quad(c4, c5, c1, c0, surface, occlusion * BOX_FACE_OCCLUSION.bottom);
      builder.quad(c4, c0, c3, c7, surface, occlusion * BOX_FACE_OCCLUSION.side);
      builder.quad(c1, c5, c6, c2, surface, occlusion * BOX_FACE_OCCLUSION.side);
    });
  }

  cylinder({ center = [0, 0, 0], radius = 0.5, radiusTop = radius, height = 1, sides = DEFAULT_ROUND_SIDES, axis = "y", yaw = 0, pitch = 0, roll = 0, material: surface, capMaterial = surface, isCapped = true } = {}) {
    return this.withTransform({ position: center, yaw, pitch, roll }, (oriented) => {
      oriented.withTransform(AXIS_ROTATIONS[axis], (builder) => {
        const halfHeight = height / 2;
        const ringPoint = (index, ringRadius, y) => {
          const angle = (index / sides) * Math.PI * 2;
          return [Math.cos(angle) * ringRadius, y, Math.sin(angle) * ringRadius];
        };
        for (let index = 0; index < sides; index++) {
          const bottomA = ringPoint(index, radius, -halfHeight), bottomB = ringPoint(index + 1, radius, -halfHeight);
          const topA = ringPoint(index, radiusTop, halfHeight), topB = ringPoint(index + 1, radiusTop, halfHeight);
          if (radiusTop > 0) builder.quad(bottomA, bottomB, topB, topA, surface, BOX_FACE_OCCLUSION.side);
          else builder.triangle(bottomA, bottomB, topA, surface, [0.8, 0.8, 1.05]);
          if (!isCapped) continue;
          builder.triangle([0, -halfHeight, 0], bottomB, bottomA, capMaterial, [0.7, 0.7, 0.7]);
          if (radiusTop > 0) builder.triangle([0, halfHeight, 0], topA, topB, capMaterial, [1.05, 1.05, 1.05]);
        }
      });
    });
  }

  cone({ radius = 0.5, ...options } = {}) {
    return this.cylinder({ ...options, radius, radiusTop: 0 });
  }

  sphere({ center = [0, 0, 0], radius = 0.5, radii = [radius, radius, radius], sides = DEFAULT_ROUND_SIDES, rings = DEFAULT_SPHERE_RINGS, isSmooth = true, material: surface } = {}) {
    const normalAt = (ring, side) => {
      const point = pointAt(ring, side);
      return normalize([(point[0] - center[0]) / radii[0] ** 2, (point[1] - center[1]) / radii[1] ** 2, (point[2] - center[2]) / radii[2] ** 2]);
    };
    const normalsFor = (...corners) => (isSmooth ? corners.map(([ring, side]) => normalAt(ring, side)) : null);
    const pointAt = (ring, side) => {
      const latitude = -Math.PI / 2 + (ring / rings) * Math.PI;
      const longitude = (side / sides) * Math.PI * 2;
      return [
        center[0] + Math.cos(latitude) * Math.cos(longitude) * radii[0],
        center[1] + Math.sin(latitude) * radii[1],
        center[2] + Math.cos(latitude) * Math.sin(longitude) * radii[2]
      ];
    };
    const occlusionAt = (ring) => 0.62 + (ring / rings) * 0.45;
    for (let ring = 0; ring < rings; ring++) {
      for (let side = 0; side < sides; side++) {
        const lower = occlusionAt(ring), upper = occlusionAt(ring + 1);
        this.triangle(pointAt(ring, side), pointAt(ring + 1, side + 1), pointAt(ring, side + 1), surface, [lower, upper, lower], normalsFor([ring, side], [ring + 1, side + 1], [ring, side + 1]));
        this.triangle(pointAt(ring, side), pointAt(ring + 1, side), pointAt(ring + 1, side + 1), surface, [lower, upper, upper], normalsFor([ring, side], [ring + 1, side], [ring + 1, side + 1]));
      }
    }
    return this;
  }

  plane({ center = [0, 0, 0], size = [10, 10], tiles = 1, material: surface, alternateMaterial = surface } = {}) {
    const [width, depth] = size;
    const tileWidth = width / tiles, tileDepth = depth / tiles;
    for (let row = 0; row < tiles; row++) {
      for (let column = 0; column < tiles; column++) {
        const left = center[0] - width / 2 + column * tileWidth;
        const back = center[2] - depth / 2 + row * tileDepth;
        const y = center[1];
        const tileMaterial = (row + column) % 2 === 0 ? surface : alternateMaterial;
        this.quad([left, y, back], [left, y, back + tileDepth], [left + tileWidth, y, back + tileDepth], [left + tileWidth, y, back], tileMaterial);
      }
    }
    return this;
  }

  loft(sections, { material: surface, capMaterial = surface, isCapped = true } = {}) {
    const pointsPerSection = sections[0].length;
    for (let sectionIndex = 0; sectionIndex < sections.length - 1; sectionIndex++) {
      const near = sections[sectionIndex], far = sections[sectionIndex + 1];
      for (let corner = 0; corner < pointsPerSection; corner++) {
        const next = (corner + 1) % pointsPerSection;
        this.quad(near[corner], near[next], far[next], far[corner], surface);
      }
    }
    if (!isCapped) return this;
    for (const section of [sections[0], sections[sections.length - 1]]) {
      const middle = section.reduce((sum, point) => sum.map((value, axis) => value + point[axis] / section.length), [0, 0, 0]);
      for (let corner = 0; corner < pointsPerSection; corner++) {
        this.triangle(middle, section[corner], section[(corner + 1) % pointsPerSection], capMaterial);
      }
    }
    return this;
  }

  toMesh() {
    return new Mesh(this.data.slice(0, this.length));
  }

  reserve(vertexCount) {
    const needed = this.length + vertexCount * FLOATS_PER_VERTEX;
    if (needed <= this.data.length) return;
    const grown = new Float32Array(Math.max(needed, this.data.length * 2));
    grown.set(this.data.subarray(0, this.length));
    this.data = grown;
  }

  writeVertex(point, normal, resolved, occlusion) {
    const data = this.data;
    let index = this.length;
    data[index++] = point[0]; data[index++] = point[1]; data[index++] = point[2];
    data[index++] = normal[0]; data[index++] = normal[1]; data[index++] = normal[2];
    data[index++] = resolved.color[0]; data[index++] = resolved.color[1]; data[index++] = resolved.color[2];
    data[index++] = resolved.gloss; data[index++] = resolved.glow; data[index++] = occlusion;
    this.length = index;
  }
}

export function buildMesh(buildParts) {
  const builder = new MeshBuilder();
  buildParts(builder);
  return builder.toMesh();
}

function normalizeTransform({ position = [0, 0, 0], yaw = 0, pitch = 0, roll = 0, scale = 1 }) {
  return { position, yaw, pitch, roll, scale: typeof scale === "number" ? [scale, scale, scale] : scale };
}
