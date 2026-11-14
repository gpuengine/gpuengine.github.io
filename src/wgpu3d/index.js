// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

export const VERSION = "0.1.0";

export { createApp, isSupported, App } from "./app.js";
export { Renderer } from "./renderer.js";
export { Scene, SceneObject, boxCollider, sphereCollider, worldCollider, resolveCircleAgainstColliders, circleOverlapsCollider } from "./scene.js";
export { Mesh, MeshBuilder, buildMesh, material, FLOATS_PER_VERTEX } from "./mesh.js";
export { Camera, ChaseCamera, OrbitCamera } from "./camera.js";
export { Input, DEFAULT_BINDINGS } from "./input.js";
export { VehicleController, CharacterController, spin, bob } from "./controllers.js";
export { createCar, createCharacter, createTree, createBuilding, createGround, createRoad, createCoin, createCrate, createLampPost } from "./prefabs.js";
export { ENVIRONMENT_PRESETS } from "./environment.js";
export { clamp, lerp, damp, dampAngle, wrapAngle, degreesToRadians, createRandom, forwardFromYaw } from "./math.js";
