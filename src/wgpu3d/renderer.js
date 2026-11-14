// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

import { SCENE_SHADER } from "./shaders.js";
import { BYTES_PER_VERTEX } from "./mesh.js";
import { createMatrix, perspectiveMatrix, lookAtMatrix, orthographicMatrix, multiplyMatrices, transformPoint, normalize, subtract, cross, degreesToRadians } from "./math.js";

const FRAME_UNIFORM_FLOATS = 72;
const OBJECT_FLOATS = 36;
const OBJECT_BYTES = OBJECT_FLOATS * 4;
const INITIAL_OBJECT_CAPACITY = 64;
const DEPTH_FORMAT = "depth24plus";
const SHADOW_FORMAT = "depth32float";
const SHADOW_MIN_SUN_HEIGHT = 0.04;
const SHADOW_STRENGTH = 0.9;
const SHADOW_NORMAL_OFFSET_TEXELS = 1.5;
const SHADOW_DEPTH_BIAS_UNITS = 2;
const SHADOW_SLOPE_BIAS = 2.5;
const MINIMUM_SHADOW_DEPTH_RANGE = 200;
const SKY_VERTEX_COUNT = 3;
const MAXIMUM_PIXEL_RATIO = 2;
const FRAME_SLOT = Object.freeze({
  viewProjection: 0,
  lightViewProjection: 16,
  cameraPosition: 32,
  cameraForward: 36,
  cameraRight: 40,
  cameraUp: 44,
  sunDirection: 48,
  sunColor: 52,
  skyTop: 56,
  skyHorizon: 60,
  groundColor: 64,
  fogAndShadow: 68
});
const VERTEX_BUFFER_LAYOUT = Object.freeze({
  arrayStride: BYTES_PER_VERTEX,
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "float32x3" },
    { shaderLocation: 3, offset: 36, format: "float32x3" }
  ]
});

export class Renderer {
  static async create(canvas, options = {}) {
    if (!navigator.gpu) throw new Error("wgpu3d: WebGPU is not available in this browser.");
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: options.powerPreference ?? "high-performance" });
    if (!adapter) throw new Error("wgpu3d: no WebGPU adapter was found.");
    const device = await adapter.requestDevice();
    return new Renderer(canvas, device, options);
  }

  constructor(canvas, device, { pixelRatio = Math.min(globalThis.devicePixelRatio ?? 1, MAXIMUM_PIXEL_RATIO), sampleCount = 4, shadowMapSize = 2048, shadowExtent = 40, shadows = true, onDeviceLost } = {}) {
    this.canvas = canvas;
    this.device = device;
    this.pixelRatio = pixelRatio;
    this.sampleCount = sampleCount;
    this.shadowMapSize = shadowMapSize;
    this.shadowExtent = shadowExtent;
    this.shadows = shadows;
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context = canvas.getContext("webgpu");
    this.context.configure({ device, format: this.format, alphaMode: "opaque" });
    this.frameData = new Float32Array(FRAME_UNIFORM_FLOATS);
    this.objectData = new Float32Array(INITIAL_OBJECT_CAPACITY * OBJECT_FLOATS);
    this.meshBuffers = new WeakMap();
    this.renderTargets = null;
    this.matrices = { view: createMatrix(), projection: createMatrix(), lightView: createMatrix(), lightProjection: createMatrix() };
    this.stats = { drawCalls: 0, triangles: 0 };
    device.lost.then((info) => onDeviceLost?.(info));
    this.createResources();
  }

  createResources() {
    const device = this.device;
    this.frameBuffer = device.createBuffer({ size: FRAME_UNIFORM_FLOATS * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.objectBuffer = this.createObjectBuffer(INITIAL_OBJECT_CAPACITY);
    const shadowTexture = device.createTexture({ size: [this.shadowMapSize, this.shadowMapSize], format: SHADOW_FORMAT, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    this.shadowView = shadowTexture.createView();
    this.shadowSampler = device.createSampler({ compare: "less-equal", magFilter: "linear", minFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });
    this.sceneLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "depth" } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "comparison" } }
      ]
    });
    this.shadowLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } }
      ]
    });
    this.createBindGroups();
    this.createPipelines();
  }

  createObjectBuffer(capacity) {
    return this.device.createBuffer({ size: capacity * OBJECT_BYTES, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  }

  createBindGroups() {
    this.sceneBindGroup = this.device.createBindGroup({
      layout: this.sceneLayout,
      entries: [
        { binding: 0, resource: { buffer: this.frameBuffer } },
        { binding: 1, resource: { buffer: this.objectBuffer } },
        { binding: 2, resource: this.shadowView },
        { binding: 3, resource: this.shadowSampler }
      ]
    });
    this.shadowBindGroup = this.device.createBindGroup({
      layout: this.shadowLayout,
      entries: [
        { binding: 0, resource: { buffer: this.frameBuffer } },
        { binding: 1, resource: { buffer: this.objectBuffer } }
      ]
    });
  }

  createPipelines() {
    const device = this.device;
    const module = device.createShaderModule({ code: SCENE_SHADER });
    const sceneLayout = device.createPipelineLayout({ bindGroupLayouts: [this.sceneLayout] });
    const multisample = { count: this.sampleCount };
    this.skyPipeline = device.createRenderPipeline({
      layout: sceneLayout,
      vertex: { module, entryPoint: "skyVertex" },
      fragment: { module, entryPoint: "skyFragment", targets: [{ format: this.format }] },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: "always" },
      multisample
    });
    this.meshPipeline = device.createRenderPipeline({
      layout: sceneLayout,
      vertex: { module, entryPoint: "meshVertex", buffers: [VERTEX_BUFFER_LAYOUT] },
      fragment: { module, entryPoint: "meshFragment", targets: [{ format: this.format }] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: "less" },
      multisample
    });
    this.shadowPipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.shadowLayout] }),
      vertex: { module, entryPoint: "shadowVertex", buffers: [VERTEX_BUFFER_LAYOUT] },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: { format: SHADOW_FORMAT, depthWriteEnabled: true, depthCompare: "less", depthBias: SHADOW_DEPTH_BIAS_UNITS, depthBiasSlopeScale: SHADOW_SLOPE_BIAS }
    });
  }

  render(scene, camera, timeSeconds = 0) {
    const size = this.resizeToDisplay();
    if (!size) return;
    const objects = scene.drawList();
    this.writeObjects(objects);
    const castsShadows = this.writeFrame(scene.environment, camera, size, timeSeconds);
    const encoder = this.device.createCommandEncoder();
    if (castsShadows) this.encodeShadowPass(encoder, objects);
    this.encodeScenePass(encoder, objects);
    this.device.queue.submit([encoder.finish()]);
  }

  resizeToDisplay() {
    const width = Math.max(1, Math.round(this.canvas.clientWidth * this.pixelRatio));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * this.pixelRatio));
    if (this.canvas.clientWidth === 0 || this.canvas.clientHeight === 0) return null;
    if (this.renderTargets?.width === width && this.renderTargets?.height === height) return this.renderTargets;
    this.canvas.width = width;
    this.canvas.height = height;
    this.renderTargets?.color?.destroy();
    this.renderTargets?.depth.destroy();
    const usage = GPUTextureUsage.RENDER_ATTACHMENT;
    const isMultisampled = this.sampleCount > 1;
    const color = isMultisampled ? this.device.createTexture({ size: [width, height], format: this.format, sampleCount: this.sampleCount, usage }) : null;
    const depth = this.device.createTexture({ size: [width, height], format: DEPTH_FORMAT, sampleCount: this.sampleCount, usage });
    this.renderTargets = { width, height, color, colorView: color?.createView(), depth, depthView: depth.createView() };
    return this.renderTargets;
  }

  writeObjects(objects) {
    this.ensureObjectCapacity(objects.length);
    const data = this.objectData;
    objects.forEach((object, index) => {
      const base = index * OBJECT_FLOATS;
      data.set(object.worldMatrix, base);
      data.set(object.normalMatrix, base + 16);
      data[base + 32] = object.tint[0];
      data[base + 33] = object.tint[1];
      data[base + 34] = object.tint[2];
      data[base + 35] = object.glow;
    });
    if (objects.length > 0) this.device.queue.writeBuffer(this.objectBuffer, 0, data, 0, objects.length * OBJECT_FLOATS);
  }

  ensureObjectCapacity(count) {
    const capacity = this.objectData.length / OBJECT_FLOATS;
    if (count <= capacity) return;
    let grownCapacity = capacity;
    while (grownCapacity < count) grownCapacity *= 2;
    this.objectData = new Float32Array(grownCapacity * OBJECT_FLOATS);
    this.objectBuffer.destroy();
    this.objectBuffer = this.createObjectBuffer(grownCapacity);
    this.createBindGroups();
  }

  writeFrame(environment, camera, size, timeSeconds) {
    const data = this.frameData;
    const aspect = size.width / size.height;
    const fieldOfView = degreesToRadians(camera.fieldOfView);
    const forward = normalize(subtract(camera.target, camera.position));
    const right = normalize(cross(forward, camera.up));
    const up = cross(right, forward);
    perspectiveMatrix(this.matrices.projection, fieldOfView, aspect, camera.near, camera.far);
    lookAtMatrix(this.matrices.view, camera.position, camera.target, camera.up);
    data.set(multiplyMatrices(createMatrix(), this.matrices.projection, this.matrices.view), FRAME_SLOT.viewProjection);
    const castsShadows = this.shadows && environment.sunDirection[1] > SHADOW_MIN_SUN_HEIGHT;
    const texelMeters = (this.shadowExtent * 2) / this.shadowMapSize;
    if (castsShadows) data.set(this.lightViewProjection(environment.sunDirection, camera.target, texelMeters), FRAME_SLOT.lightViewProjection);
    setVector(data, FRAME_SLOT.cameraPosition, camera.position, timeSeconds);
    setVector(data, FRAME_SLOT.cameraForward, forward, aspect);
    setVector(data, FRAME_SLOT.cameraRight, right, Math.tan(fieldOfView / 2));
    setVector(data, FRAME_SLOT.cameraUp, up, texelMeters * SHADOW_NORMAL_OFFSET_TEXELS);
    setVector(data, FRAME_SLOT.sunDirection, environment.sunDirection, environment.sunIntensity);
    setVector(data, FRAME_SLOT.sunColor, environment.sunColor, SHADOW_STRENGTH);
    setVector(data, FRAME_SLOT.skyTop, environment.skyTop, environment.exposure);
    setVector(data, FRAME_SLOT.skyHorizon, environment.skyHorizon, 0);
    setVector(data, FRAME_SLOT.groundColor, environment.groundColor, environment.ambientIntensity);
    setVector(data, FRAME_SLOT.fogAndShadow, [environment.fogStart, environment.fogEnd, 1 / this.shadowMapSize], castsShadows ? 1 : 0);
    this.device.queue.writeBuffer(this.frameBuffer, 0, data);
    return castsShadows;
  }

  lightViewProjection(towardSun, focus, texelMeters) {
    const extent = this.shadowExtent;
    const viewUp = Math.abs(towardSun[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0];
    lookAtMatrix(this.matrices.lightView, [0, 0, 0], [-towardSun[0], -towardSun[1], -towardSun[2]], viewUp);
    const center = transformPoint(this.matrices.lightView, focus);
    const snappedX = Math.round(center[0] / texelMeters) * texelMeters;
    const snappedY = Math.round(center[1] / texelMeters) * texelMeters;
    const depthRange = Math.max(MINIMUM_SHADOW_DEPTH_RANGE, extent * 6);
    const centerDistance = -center[2];
    orthographicMatrix(this.matrices.lightProjection, snappedX - extent, snappedX + extent, snappedY - extent, snappedY + extent, centerDistance - depthRange / 2, centerDistance + depthRange / 2);
    return multiplyMatrices(createMatrix(), this.matrices.lightProjection, this.matrices.lightView);
  }

  encodeShadowPass(encoder, objects) {
    const pass = encoder.beginRenderPass({
      colorAttachments: [],
      depthStencilAttachment: { view: this.shadowView, depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "store" }
    });
    pass.setPipeline(this.shadowPipeline);
    pass.setBindGroup(0, this.shadowBindGroup);
    objects.forEach((object, index) => {
      if (object.castsShadow) this.drawObject(pass, object, index);
    });
    pass.end();
  }

  encodeScenePass(encoder, objects) {
    const targets = this.renderTargets;
    const canvasView = this.context.getCurrentTexture().createView();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: targets.colorView ?? canvasView,
        resolveTarget: targets.colorView ? canvasView : undefined,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: "clear",
        storeOp: targets.colorView ? "discard" : "store"
      }],
      depthStencilAttachment: { view: targets.depthView, depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "discard" }
    });
    pass.setBindGroup(0, this.sceneBindGroup);
    pass.setPipeline(this.skyPipeline);
    pass.draw(SKY_VERTEX_COUNT);
    pass.setPipeline(this.meshPipeline);
    this.stats.drawCalls = 0;
    this.stats.triangles = 0;
    objects.forEach((object, index) => {
      this.drawObject(pass, object, index);
      this.stats.drawCalls += 1;
      this.stats.triangles += object.mesh.vertexCount / 3;
    });
    pass.end();
  }

  drawObject(pass, object, objectIndex) {
    pass.setVertexBuffer(0, this.vertexBufferFor(object.mesh));
    pass.draw(object.mesh.vertexCount, 1, 0, objectIndex);
  }

  vertexBufferFor(mesh) {
    const cached = this.meshBuffers.get(mesh);
    if (cached && cached.version === mesh.version) return cached.buffer;
    const byteLength = Math.max(mesh.vertices.byteLength, 4);
    const canReuse = cached && cached.buffer.size >= byteLength;
    const buffer = canReuse ? cached.buffer : this.device.createBuffer({ size: byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    if (cached && !canReuse) cached.buffer.destroy();
    if (mesh.vertices.byteLength > 0) this.device.queue.writeBuffer(buffer, 0, mesh.vertices);
    this.meshBuffers.set(mesh, { buffer, version: mesh.version });
    return buffer;
  }

  dispose() {
    this.context.unconfigure();
    this.device.destroy();
  }
}

function setVector(data, slot, vector, w) {
  data[slot] = vector[0];
  data[slot + 1] = vector[1];
  data[slot + 2] = vector[2];
  data[slot + 3] = w;
}
