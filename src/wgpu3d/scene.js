// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

import { createMatrix, composeMatrix, multiplyMatrices, transformPoint, forwardFromYaw, toLinearColor } from "./math.js";
import { resolveEnvironment } from "./environment.js";

const COLLIDER_KINDS = Object.freeze({ BOX: "box", SPHERE: "sphere" });

export class SceneObject {
  constructor({ name = "", mesh = null, position = [0, 0, 0], yaw = 0, pitch = 0, roll = 0, scale = 1, tint = [1, 1, 1], glow = 0, visible = true, castsShadow = true, collider = null, isSolid = Boolean(collider), tags = [] } = {}) {
    this.name = name;
    this.mesh = mesh;
    this.position = [...position];
    this.yaw = yaw;
    this.pitch = pitch;
    this.roll = roll;
    this.scale = typeof scale === "number" ? [scale, scale, scale] : [...scale];
    this.tint = toLinearColor(tint);
    this.glow = glow;
    this.visible = visible;
    this.castsShadow = castsShadow;
    this.collider = collider;
    this.isSolid = isSolid;
    this.tags = new Set(tags);
    this.children = [];
    this.parent = null;
    this.behaviors = [];
    this.parts = {};
    this.speed = 0;
    this.worldMatrix = createMatrix();
    this.normalMatrix = createMatrix();
  }

  add(...children) {
    for (const child of children) {
      child.parent?.remove(child);
      child.parent = this;
      this.children.push(child);
    }
    return this;
  }

  remove(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) this.children.splice(index, 1);
    child.parent = null;
    return this;
  }

  removeFromParent() {
    this.parent?.remove(this);
    return this;
  }

  addBehavior(behavior) {
    this.behaviors.push(behavior);
    return () => {
      this.behaviors = this.behaviors.filter((candidate) => candidate !== behavior);
    };
  }

  traverse(visit) {
    visit(this);
    for (const child of [...this.children]) child.traverse(visit);
  }

  forward() {
    return forwardFromYaw(this.yaw);
  }

  worldPosition() {
    return [this.worldMatrix[12], this.worldMatrix[13], this.worldMatrix[14]];
  }

  updateWorldMatrices(parentWorld = null, parentNormal = null) {
    composeMatrix(this.worldMatrix, this);
    composeMatrix(this.normalMatrix, { yaw: this.yaw, pitch: this.pitch, roll: this.roll, scale: this.scale.map((value) => 1 / value) });
    if (parentWorld) {
      multiplyMatrices(this.worldMatrix, parentWorld, this.worldMatrix);
      multiplyMatrices(this.normalMatrix, parentNormal, this.normalMatrix);
    }
    for (const child of this.children) child.updateWorldMatrices(this.worldMatrix, this.normalMatrix);
  }
}

export class Scene extends SceneObject {
  constructor({ environment = "noon" } = {}) {
    super({ name: "scene" });
    this.environment = resolveEnvironment(environment);
  }

  setEnvironment(environment) {
    this.environment = resolveEnvironment(environment);
    return this;
  }

  update(context) {
    this.runBehaviors(context);
    this.updateWorldMatrices();
  }

  runBehaviors(context) {
    this.traverse((object) => {
      for (const behavior of object.behaviors) {
        if (typeof behavior === "function") behavior(object, context);
        else behavior.update(object, context);
      }
    });
  }

  touching(object, { tag, radius, height = 2 } = {}) {
    const position = object.worldPosition();
    const reach = radius ?? object.collider?.radius ?? 0.5;
    const touched = [];
    this.traverse((candidate) => {
      if (candidate === object || !candidate.collider || (tag && !candidate.tags.has(tag))) return;
      const collider = worldCollider(candidate);
      const overlapsVertically = collider.top >= position[1] && collider.bottom <= position[1] + height;
      if (overlapsVertically && circleOverlapsCollider(position[0], position[2], reach, collider)) touched.push(candidate);
    });
    return touched;
  }

  find(name) {
    let found = null;
    this.traverse((object) => {
      if (!found && object.name === name) found = object;
    });
    return found;
  }

  withTag(tag) {
    const tagged = [];
    this.traverse((object) => {
      if (object.tags.has(tag)) tagged.push(object);
    });
    return tagged;
  }

  solidColliders(except = null) {
    const colliders = [];
    this.traverse((object) => {
      if (object.isSolid && object.collider && object !== except) colliders.push(worldCollider(object));
    });
    return colliders;
  }

  drawList() {
    const objects = [];
    const visit = (object) => {
      if (!object.visible) return;
      if (object.mesh && object.mesh.vertexCount > 0) objects.push(object);
      object.children.forEach(visit);
    };
    visit(this);
    return objects;
  }
}

export function boxCollider(size) {
  return { kind: COLLIDER_KINDS.BOX, size: [...size] };
}

export function sphereCollider(radius) {
  return { kind: COLLIDER_KINDS.SPHERE, radius };
}

export function worldCollider(object) {
  const center = transformPoint(object.worldMatrix, object.collider.offset ?? [0, 0, 0]);
  const yaw = worldYaw(object);
  const scale = object.scale;
  if (object.collider.kind === COLLIDER_KINDS.SPHERE) {
    const radius = object.collider.radius * Math.max(...scale);
    return { object, kind: COLLIDER_KINDS.SPHERE, x: center[0], z: center[2], radius, bottom: center[1] - radius, top: center[1] + radius };
  }
  const [width, height, depth] = object.collider.size;
  return {
    object,
    kind: COLLIDER_KINDS.BOX,
    x: center[0],
    z: center[2],
    yaw,
    halfWidth: width * scale[0] / 2,
    halfDepth: depth * scale[2] / 2,
    bottom: center[1] - height * scale[1] / 2,
    top: center[1] + height * scale[1] / 2
  };
}

export function circleOverlapsCollider(x, z, radius, collider) {
  return separationFromCollider(x, z, radius, collider) !== null;
}

export function separationFromCollider(x, z, radius, collider) {
  if (collider.kind === COLLIDER_KINDS.SPHERE) {
    const offsetX = x - collider.x, offsetZ = z - collider.z;
    const distance = Math.hypot(offsetX, offsetZ);
    const overlap = radius + collider.radius - distance;
    if (overlap <= 0) return null;
    const normalX = distance > 1e-6 ? offsetX / distance : 1;
    const normalZ = distance > 1e-6 ? offsetZ / distance : 0;
    return { pushX: normalX * overlap, pushZ: normalZ * overlap, normalX, normalZ };
  }
  const rightX = Math.cos(collider.yaw), rightZ = -Math.sin(collider.yaw);
  const forwardX = -Math.sin(collider.yaw), forwardZ = -Math.cos(collider.yaw);
  const offsetX = x - collider.x, offsetZ = z - collider.z;
  const localRight = offsetX * rightX + offsetZ * rightZ;
  const localForward = offsetX * forwardX + offsetZ * forwardZ;
  const closestRight = Math.max(-collider.halfWidth, Math.min(collider.halfWidth, localRight));
  const closestForward = Math.max(-collider.halfDepth, Math.min(collider.halfDepth, localForward));
  const gapRight = localRight - closestRight, gapForward = localForward - closestForward;
  const gapLength = Math.hypot(gapRight, gapForward);
  if (gapLength >= radius) return null;
  let normalRight, normalForward, overlap;
  if (gapLength > 1e-6) {
    normalRight = gapRight / gapLength;
    normalForward = gapForward / gapLength;
    overlap = radius - gapLength;
  } else {
    const exitRight = collider.halfWidth - Math.abs(localRight);
    const exitForward = collider.halfDepth - Math.abs(localForward);
    const exitsSideways = exitRight < exitForward;
    normalRight = exitsSideways ? Math.sign(localRight) || 1 : 0;
    normalForward = exitsSideways ? 0 : Math.sign(localForward) || 1;
    overlap = (exitsSideways ? exitRight : exitForward) + radius;
  }
  const normalX = normalRight * rightX + normalForward * forwardX;
  const normalZ = normalRight * rightZ + normalForward * forwardZ;
  return { pushX: normalX * overlap, pushZ: normalZ * overlap, normalX, normalZ };
}

export function resolveCircleAgainstColliders(position, radius, colliders, { bottom = -Infinity, top = Infinity } = {}) {
  let hitNormal = null;
  for (const collider of colliders) {
    if (collider.top <= bottom || collider.bottom >= top) continue;
    const separation = separationFromCollider(position[0], position[2], radius, collider);
    if (!separation) continue;
    position[0] += separation.pushX;
    position[2] += separation.pushZ;
    hitNormal = { x: separation.normalX, z: separation.normalZ, collider };
  }
  return hitNormal;
}

function worldYaw(object) {
  let yaw = 0;
  for (let current = object; current; current = current.parent) yaw += current.yaw;
  return yaw;
}
