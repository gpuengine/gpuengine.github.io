// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const SHADOW_MAP_FORMAT = "depth32float";
const SHADOW_HALF_EXTENT_METERS = 90;
const SHADOW_CENTER_AHEAD_METERS = 50;
const SHADOW_DEPTH_RANGE_METERS = 700;
const SHADOW_MIN_SUN_HEIGHT = 0.05;
const SHADOW_NORMAL_OFFSET_TEXELS = 1.5;
const SHADOW_STRENGTH = 0.92;
const SHADOW_DEPTH_BIAS_UNITS = 2;
const SHADOW_SLOPE_BIAS = 2.5;
const SHADOW_SUN_CHANGE_COSINE = 0.99995;

const sunShadowMatrices = {
  rotation: new Float32Array(16),
  projection: new Float32Array(16),
  viewProjection: new Float32Array(16)
};

const sunShadowSchedule = {
  framesSinceRender: Infinity,
  focusAtRender: null,
  sunAtRender: null,
  mapSizeAtRender: 0
};

function updateSunShadow(uniforms, { camera, sunDirection, quality }) {
  const towardSun = normalizeDirection(sunDirection);
  const focus = shadowFocusPoint(camera);
  sunShadowSchedule.framesSinceRender++;
  if (!isSunShadowStale(focus, towardSun, quality)) return false;

  writeSunShadowMatrix(uniforms, { focus, towardSun, mapSize: quality.shadowMapSize });
  sunShadowSchedule.framesSinceRender = 0;
  sunShadowSchedule.focusAtRender = focus;
  sunShadowSchedule.sunAtRender = towardSun;
  sunShadowSchedule.mapSizeAtRender = quality.shadowMapSize;
  return true;
}

function forceSunShadowRefresh() {
  sunShadowSchedule.framesSinceRender = Infinity;
}

function isSunShadowStale(focus, towardSun, quality) {
  const { focusAtRender, sunAtRender, framesSinceRender, mapSizeAtRender } = sunShadowSchedule;
  if (!focusAtRender || mapSizeAtRender !== quality.shadowMapSize) return true;
  if (framesSinceRender >= quality.shadowMaxFramesBetweenRenders) return true;
  const focusMovement = Math.hypot(focus[0] - focusAtRender[0], focus[1] - focusAtRender[1], focus[2] - focusAtRender[2]);
  if (focusMovement > quality.shadowRefreshMovementMeters) return true;
  const sunAlignment = towardSun[0] * sunAtRender[0] + towardSun[1] * sunAtRender[1] + towardSun[2] * sunAtRender[2];
  return sunAlignment < SHADOW_SUN_CHANGE_COSINE;
}

function writeSunShadowMatrix(uniforms, { focus, towardSun, mapSize }) {
  const isSunUp = towardSun[1] > SHADOW_MIN_SUN_HEIGHT;
  const texelMeters = (SHADOW_HALF_EXTENT_METERS * 2) / mapSize;
  const viewUp = Math.abs(towardSun[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0];
  mat4LookAt(sunShadowMatrices.rotation, [0, 0, 0], [-towardSun[0], -towardSun[1], -towardSun[2]], viewUp);

  const lightSpaceCenter = transformPoint4(sunShadowMatrices.rotation, focus);
  const snappedX = Math.round(lightSpaceCenter[0] / texelMeters) * texelMeters;
  const snappedY = Math.round(lightSpaceCenter[1] / texelMeters) * texelMeters;
  const centerDistance = -lightSpaceCenter[2];
  mat4Orthographic(
    sunShadowMatrices.projection,
    snappedX - SHADOW_HALF_EXTENT_METERS, snappedX + SHADOW_HALF_EXTENT_METERS,
    snappedY - SHADOW_HALF_EXTENT_METERS, snappedY + SHADOW_HALF_EXTENT_METERS,
    centerDistance - SHADOW_DEPTH_RANGE_METERS * 0.5, centerDistance + SHADOW_DEPTH_RANGE_METERS * 0.5
  );
  mat4Multiply(sunShadowMatrices.viewProjection, sunShadowMatrices.projection, sunShadowMatrices.rotation);

  uniforms.set(sunShadowMatrices.viewProjection, UNIFORM_VEC4_SLOT.lightViewProj * 4);
  setUniformVec4(uniforms, UNIFORM_VEC4_SLOT.shadowParams, 1 / mapSize, isSunUp ? 1 : 0, texelMeters * SHADOW_NORMAL_OFFSET_TEXELS, SHADOW_STRENGTH);
}

function shadowFocusPoint(camera) {
  const lookX = camera.lookX - camera.x;
  const lookZ = camera.lookZ - camera.z;
  const lookLength = Math.hypot(lookX, lookZ) || 1;
  return [
    camera.x + (lookX / lookLength) * SHADOW_CENTER_AHEAD_METERS,
    camera.y,
    camera.z + (lookZ / lookLength) * SHADOW_CENTER_AHEAD_METERS
  ];
}

function transformPoint4(matrix, point) {
  const [x, y, z] = point;
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]
  ];
}

function normalizeDirection(direction) {
  const length = Math.hypot(direction[0], direction[1], direction[2]) || 1;
  return [direction[0] / length, direction[1] / length, direction[2] / length];
}

function createSunShadowMap(device, mapSize) {
  const texture = device.createTexture({
    size: [mapSize, mapSize, 1],
    format: SHADOW_MAP_FORMAT,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  });
  return {
    texture,
    mapSize,
    view: texture.createView(),
    sampler: device.createSampler({ compare: "less-equal", magFilter: "linear", minFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" })
  };
}

function createSunShadowPipelines({ device, shaderModule, bindGroupLayout }) {
  const layout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
  const depthStencil = { format: SHADOW_MAP_FORMAT, depthWriteEnabled: true, depthCompare: "less", depthBias: SHADOW_DEPTH_BIAS_UNITS, depthBiasSlopeScale: SHADOW_SLOPE_BIAS };
  return {
    mesh: device.createRenderPipeline({
      layout,
      vertex: { module: shaderModule, entryPoint: "vs_mesh_shadow", buffers: [{ arrayStride: BYTES_PER_VERT, attributes: MESH_VERTEX_ATTRIBUTES }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil
    }),
    tree: device.createRenderPipeline({
      layout,
      vertex: { module: shaderModule, entryPoint: "vs_tree_shadow", buffers: [TREE_VERTEX_BUFFER_LAYOUT, TREE_INSTANCE_BUFFER_LAYOUT] },
      fragment: { module: shaderModule, entryPoint: "fs_tree_shadow", targets: [] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil
    })
  };
}
