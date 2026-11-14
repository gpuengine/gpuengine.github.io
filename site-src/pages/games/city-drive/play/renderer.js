// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const UNIFORM_BUFFER_BYTES = 400;
const DEPTH_FORMAT = "depth24plus";
const SCENE_CLEAR_COLOR = { r: 0.05, g: 0.08, b: 0.15, a: 1.0 };
const SKY_TRIANGLE_VERTEX_COUNT = 3;
const MIN_GPU_BUFFER_BYTES = 4;
const LEAF_ATLAS_BYTES_PER_PIXEL = 4;
const SURFACE_SAMPLER_MAX_ANISOTROPY = 16;
const EMPTY_DYNAMIC_MESH = Object.freeze({ groundVertexCount: 0, vertexCount: 0 });
const TREE_BATCH_REFRESH_FRAMES = 5;
const TREE_BATCH_REFRESH_MOVEMENT_METERS = 3;
const TREE_BATCH_REFRESH_TURN_COSINE = 0.996;
const SLOT_ORDER_REFRESH_MOVEMENT_METERS = 4;
const MESH_VERTEX_ATTRIBUTES = [
  { shaderLocation: 0, offset: 0,  format: "float32x3" },
  { shaderLocation: 1, offset: 12, format: "float32x3" },
  { shaderLocation: 2, offset: 24, format: "float32x3" },
  { shaderLocation: 3, offset: 36, format: "float32x3" },
  { shaderLocation: 4, offset: STREET_FRAME_FLOAT_OFFSET * 4, format: "float32x3" }
];

const UNIFORM_VEC4_SLOT = {
  camPosAndTime: 4,
  camForwardAndAspect: 5,
  camRightAndFov: 6,
  camUp: 7,
  sunDirAndIntensity: 8,
  skyTopColor: 9,
  skyHorizonColor: 10,
  sunColorAndNight: 11,
  carPosAndHeading: 12,
  carFwdAndSpeed: 13,
  skyMidColor: 14,
  lightViewProj: 15,
  shadowParams: 19,
  weatherRoadColor: 20,
  weatherShoulderColor: 21,
  weatherStripeColor: 22,
  weatherWaterColor: 23,
  qualityParams: 24
};

const RENDER_QUALITY = Object.freeze({
  full: {
    shadowMapSize: 2048,
    shadowMaxFramesBetweenRenders: 6,
    shadowRefreshMovementMeters: 1.5,
    treeShadowMaxLod: 1,
    contactShadingDivisor: 2,
    contactShadingSamples: 8,
    bloomMipCount: 6,
    detailFadeStartMeters: 38,
    detailFadeEndMeters: 62
  },
  cool: {
    shadowMapSize: 1024,
    shadowMaxFramesBetweenRenders: 10,
    shadowRefreshMovementMeters: 2.5,
    treeShadowMaxLod: 0,
    contactShadingDivisor: 4,
    contactShadingSamples: 6,
    bloomMipCount: 4,
    detailFadeStartMeters: 28,
    detailFadeEndMeters: 46
  }
});

const frameProjectionMatrix = new Float32Array(16);
const frameViewMatrix = new Float32Array(16);
const frameViewProjectionMatrix = new Float32Array(16);

class HorizonRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.device = null;
    this.context = null;
    this.uniformData = new Float32Array(UNIFORM_BUFFER_BYTES / 4);
    this.slotCounts = new Uint32Array(MAX_SEGMENTS);
    this.slotCenters = new Float32Array(MAX_SEGMENTS * 3);
    this.slotViewDistances = new Float32Array(MAX_SEGMENTS);
    this.slotDrawOrder = new Uint16Array(MAX_SEGMENTS);
    this.compareSlotViewDistance = (slotA, slotB) => this.slotViewDistances[slotA] - this.slotViewDistances[slotB];
    this.treeField = new TreeInstanceField(MAX_SEGMENTS);
    this.treeMeshes = null;
    this.quality = RENDER_QUALITY.full;
    this.shadowNeedsRender = true;
    this.slotOrderCache = { version: -1, cameraPosition: null, order: null };
    this.slotsVersion = 0;
    this.treeBatchCache = { fieldVersion: -1, framesSinceBuild: Infinity, view: null, batches: [] };
    this.treeFieldVersion = 0;
  }

  async init({ powerPreference = "high-performance", qualityName = "full", leafAtlasMipChainReady }) {
    this.quality = RENDER_QUALITY[qualityName] || RENDER_QUALITY.full;
    this.device = await this.requestDevice(powerPreference);
    this.configureCanvasContext();
    await this.initWebGPUResources(await leafAtlasMipChainReady);
  }

  setRenderQuality(qualityName) {
    const quality = RENDER_QUALITY[qualityName] || RENDER_QUALITY.full;
    if (quality === this.quality) return;
    const previousShadowMapSize = this.quality.shadowMapSize;
    this.quality = quality;
    if (!this.device) return;
    if (quality.shadowMapSize !== previousShadowMapSize) this.replaceSunShadowMap();
    this.postChain.setQuality(quality);
    forceSunShadowRefresh();
  }

  setFrameProjection(frameProjection) {
    this.frameProjection = frameProjection;
  }

  async requestDevice(powerPreference) {
    if (window.isSecureContext === false) {
      throw new Error(`WebGPU needs HTTPS or localhost. This page was loaded from ${location.origin}, which the browser treats as insecure.`);
    }
    if (!navigator.gpu) {
      throw new Error("WebGPU is not supported in this browser.");
    }
    const adapter = await navigator.gpu.requestAdapter({ powerPreference });
    if (!adapter) {
      throw new Error("Unable to acquire WebGPU adapter.");
    }
    const supportsCompactHdr = adapter.features.has(COMPACT_HDR_FEATURE);
    this.hdrFormat = supportsCompactHdr ? COMPACT_HDR_FORMAT : WIDE_HDR_FORMAT;
    return adapter.requestDevice({ requiredFeatures: supportsCompactHdr ? [COMPACT_HDR_FEATURE] : [] });
  }

  configureCanvasContext() {
    this.context = this.canvas.getContext("webgpu");
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "opaque"
    });
  }

  async initWebGPUResources(leafAtlasMipChain) {
    const shaderModule = this.device.createShaderModule({ code: buildWorldShaderCode() + FOLIAGE_WGSL_CODE });
    this.sunShadowMap = createSunShadowMap(this.device, this.quality.shadowMapSize);
    const bindGroupLayout = this.createUniformBindings(leafAtlasMipChain);
    const pipelineLayout = this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
    this.createPipelines(shaderModule, pipelineLayout);
    this.shadowPipelines = createSunShadowPipelines({ device: this.device, shaderModule, bindGroupLayout: this.shadowBindGroupLayout });
    this.postChain = new PostProcessChain(this.device, { outputFormat: this.format, hdrFormat: this.hdrFormat, quality: this.quality });
    this.createGeometryBuffers();
    this.resizeRenderTargets();
  }

  createUniformBindings(leafAtlasMipChain) {
    const device = this.device;
    this.uniformBuffer = device.createBuffer({
      size: UNIFORM_BUFFER_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.sceneBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float", viewDimension: "2d-array" } },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float", viewDimension: "2d-array" } },
        { binding: 5, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
        { binding: 6, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "depth" } },
        { binding: 7, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "comparison" } }
      ]
    });
    const surfaceTextures = createSurfaceDetailTextures(device);
    this.sceneTextures = {
      leafAtlasView: this.createLeafAtlasTexture(leafAtlasMipChain).createView(),
      leafSampler: device.createSampler({ magFilter: "linear", minFilter: "linear", mipmapFilter: "linear", maxAnisotropy: 4 }),
      surfaceAlbedoView: surfaceTextures.albedoView,
      surfaceReliefView: surfaceTextures.reliefView,
      surfaceSampler: device.createSampler({
        addressModeU: "repeat",
        addressModeV: "repeat",
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
        maxAnisotropy: SURFACE_SAMPLER_MAX_ANISOTROPY
      })
    };
    this.bindGroup = this.createSceneBindGroup();
    this.createShadowBindings(this.sceneTextures);
    return this.sceneBindGroupLayout;
  }

  createSceneBindGroup() {
    const textures = this.sceneTextures;
    return this.device.createBindGroup({
      layout: this.sceneBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: textures.leafAtlasView },
        { binding: 2, resource: textures.leafSampler },
        { binding: 3, resource: textures.surfaceAlbedoView },
        { binding: 4, resource: textures.surfaceReliefView },
        { binding: 5, resource: textures.surfaceSampler },
        { binding: 6, resource: this.sunShadowMap.view },
        { binding: 7, resource: this.sunShadowMap.sampler }
      ]
    });
  }

  replaceSunShadowMap() {
    const previousTexture = this.sunShadowMap.texture;
    this.sunShadowMap = createSunShadowMap(this.device, this.quality.shadowMapSize);
    this.bindGroup = this.createSceneBindGroup();
    previousTexture.destroy();
  }

  createShadowBindings({ leafAtlasView, leafSampler }) {
    const device = this.device;
    this.shadowBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } }
      ]
    });
    this.shadowBindGroup = device.createBindGroup({
      layout: this.shadowBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: leafAtlasView },
        { binding: 2, resource: leafSampler }
      ]
    });
  }

  createPipelines(shaderModule, pipelineLayout) {
    const pipelineBase = { device: this.device, layout: pipelineLayout, shaderModule, colorFormat: this.hdrFormat };
    const meshVertexBuffers = [{ arrayStride: BYTES_PER_VERT, attributes: MESH_VERTEX_ATTRIBUTES }];
    const treeVertexBuffers = [TREE_VERTEX_BUFFER_LAYOUT, TREE_INSTANCE_BUFFER_LAYOUT];
    const openPrimitive = { topology: "triangle-list", cullMode: "none" };

    this.skyPipeline = createSceneRenderPipeline({
      ...pipelineBase,
      vertexEntryPoint: "vs_sky",
      fragmentEntryPoint: "fs_sky",
      primitive: { topology: "triangle-list" },
      depthWriteEnabled: false,
      depthCompare: "less-equal"
    });

    this.meshPipeline = createSceneRenderPipeline({
      ...pipelineBase,
      vertexEntryPoint: "vs_mesh",
      vertexBuffers: meshVertexBuffers,
      fragmentEntryPoint: "fs_mesh",
      primitive: openPrimitive,
      depthWriteEnabled: true,
      depthCompare: "less-equal"
    });

    this.treePipeline = createSceneRenderPipeline({
      ...pipelineBase,
      vertexEntryPoint: "vs_tree",
      vertexBuffers: treeVertexBuffers,
      fragmentEntryPoint: "fs_tree",
      primitive: openPrimitive,
      depthWriteEnabled: true,
      depthCompare: "less-equal"
    });

    this.depthPrepassPipelines = {
      mesh: createDepthPrepassPipeline({ device: this.device, layout: pipelineLayout, shaderModule, vertexEntryPoint: "vs_mesh_depth", vertexBuffers: meshVertexBuffers }),
      tree: createDepthPrepassPipeline({ device: this.device, layout: pipelineLayout, shaderModule, vertexEntryPoint: "vs_tree", fragmentEntryPoint: "fs_tree_depth", vertexBuffers: treeVertexBuffers })
    };
  }

  createGeometryBuffers() {
    this.vertexBuffer = this.device.createBuffer({
      size: TOTAL_BUFFER_VERTS * BYTES_PER_VERT,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });

    this.treeInstanceBuffer = this.device.createBuffer({
      size: MAX_TREE_INSTANCES * TREE_INSTANCE_BYTES,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
  }

  createLeafAtlasTexture(mipChain) {
    const texture = this.device.createTexture({
      size: [LEAF_ATLAS_SIZE, LEAF_ATLAS_SIZE, 1],
      mipLevelCount: mipChain.length,
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });
    mipChain.forEach((level, mipLevel) => {
      this.device.queue.writeTexture(
        { texture, mipLevel },
        level.data,
        { bytesPerRow: level.size * LEAF_ATLAS_BYTES_PER_PIXEL, rowsPerImage: level.size },
        { width: level.size, height: level.size, depthOrArrayLayers: 1 }
      );
    });
    return texture;
  }

  resizeRenderTargets() {
    if (!this.postChain) return;
    this.postChain.resize(Math.max(1, this.canvas.width), Math.max(1, this.canvas.height));
  }

  setTreeMeshLibrary(speciesMeshes) {
    const library = packTreeMeshLibrary(speciesMeshes);
    this.treeMeshes = library.placements;
    this.treeVertexBuffer = this.device.createBuffer({ size: Math.max(MIN_GPU_BUFFER_BYTES, library.vertexBytes.byteLength), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    this.treeIndexBuffer = this.device.createBuffer({ size: Math.max(MIN_GPU_BUFFER_BYTES, library.indices.byteLength), usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(this.treeVertexBuffer, 0, library.vertexBytes);
    this.device.queue.writeBuffer(this.treeIndexBuffer, 0, library.indices);
    this.treeField.setSpeciesCount(speciesMeshes.length);
  }

  setSlotTrees(slotIndex, trees) {
    this.treeField.setSlotTrees(slotIndex, trees);
    this.treeFieldVersion++;
  }

  uploadSegmentSlot(slotIndex, floatData, vertCount) {
    const vertexCount = Math.min(Math.max(0, Math.floor(vertCount)), VERTS_PER_SEGMENT);
    this.slotCounts[slotIndex] = vertexCount;
    this.slotsVersion++;
    if (!this.device || vertexCount === 0) return;
    this.recordSlotCenter(slotIndex, floatData, vertexCount);
    const byteOffset = slotIndex * VERTS_PER_SEGMENT * BYTES_PER_VERT;
    this.device.queue.writeBuffer(this.vertexBuffer, byteOffset, floatData.buffer, floatData.byteOffset, vertexCount * BYTES_PER_VERT);
  }

  recordSlotCenter(slotIndex, floatData, vertexCount) {
    const lowest = [Infinity, Infinity, Infinity];
    const highest = [-Infinity, -Infinity, -Infinity];
    for (let vertex = 0; vertex < vertexCount; vertex++) {
      const firstFloat = vertex * FLOATS_PER_VERT;
      for (let axis = 0; axis < 3; axis++) {
        const coordinate = floatData[firstFloat + axis];
        if (coordinate < lowest[axis]) lowest[axis] = coordinate;
        if (coordinate > highest[axis]) highest[axis] = coordinate;
      }
    }
    for (let axis = 0; axis < 3; axis++) this.slotCenters[slotIndex * 3 + axis] = (lowest[axis] + highest[axis]) * 0.5;
  }

  clearSegmentSlot(slotIndex) {
    this.slotCounts[slotIndex] = 0;
    this.slotsVersion++;
    this.treeField.clearSlot(slotIndex);
    this.treeFieldVersion++;
  }

  uploadDynamicMesh(floatData, vertCount) {
    if (!this.device) return;
    const safeVertCount = Math.min(vertCount, DYNAMIC_MESH_MAX_VERTS);
    const byteOffset = DYNAMIC_VERT_OFFSET * BYTES_PER_VERT;
    const byteLength = safeVertCount * BYTES_PER_VERT;
    if (byteLength > 0) this.device.queue.writeBuffer(this.vertexBuffer, byteOffset, floatData.buffer, floatData.byteOffset, byteLength);
  }

  renderFrame({ dynamicMesh = EMPTY_DYNAMIC_MESH }) {
    if (!this.device || !this.frameProjection) return;
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData.buffer, 0, UNIFORM_BUFFER_BYTES);
    const treeBatches = this.prepareTreeBatches();
    const slotOrder = this.sortSlotsNearestFirst();
    const encoder = this.device.createCommandEncoder();
    if (this.shadowNeedsRender) this.encodeShadowPass(encoder, { dynamicMesh, slotOrder, treeBatches });
    this.encodeDepthPrepass(encoder, { dynamicMesh, slotOrder, treeBatches });
    const pass = encoder.beginRenderPass({
      colorAttachments: [this.postChain.sceneColorAttachment()],
      depthStencilAttachment: this.postChain.sceneDepthAttachment()
    });
    this.drawWorldMeshes(pass, { dynamicMesh, slotOrder, pipeline: this.meshPipeline, bindGroup: this.bindGroup });
    this.drawTreeBatches(pass, treeBatches, this.treePipeline, this.bindGroup);
    this.drawSky(pass);
    pass.end();
    this.postChain.writeUniforms(this.frameProjection);
    this.postChain.encode(encoder, this.context.getCurrentTexture().createView());
    this.device.queue.submit([encoder.finish()]);
  }

  encodeShadowPass(encoder, { dynamicMesh, slotOrder, treeBatches }) {
    const pass = encoder.beginRenderPass({
      colorAttachments: [],
      depthStencilAttachment: { view: this.sunShadowMap.view, depthClearValue: 1.0, depthLoadOp: "clear", depthStoreOp: "store" }
    });
    this.drawWorldMeshes(pass, { dynamicMesh, slotOrder, pipeline: this.shadowPipelines.mesh, bindGroup: this.shadowBindGroup });
    const nearbyTreeBatches = treeBatches.filter(batch => batch.lod <= this.quality.treeShadowMaxLod);
    this.drawTreeBatches(pass, nearbyTreeBatches, this.shadowPipelines.tree, this.shadowBindGroup);
    pass.end();
  }

  encodeDepthPrepass(encoder, { dynamicMesh, slotOrder, treeBatches }) {
    const pass = encoder.beginRenderPass({
      colorAttachments: [],
      depthStencilAttachment: this.postChain.depthPrepassAttachment()
    });
    this.drawWorldMeshes(pass, { dynamicMesh, slotOrder, pipeline: this.depthPrepassPipelines.mesh, bindGroup: this.bindGroup });
    this.drawTreeBatches(pass, treeBatches, this.depthPrepassPipelines.tree, this.bindGroup);
    pass.end();
  }

  drawSky(pass) {
    pass.setPipeline(this.skyPipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(SKY_TRIANGLE_VERTEX_COUNT, 1, 0, 0);
  }

  drawWorldMeshes(pass, { dynamicMesh, slotOrder, pipeline, bindGroup }) {
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, this.vertexBuffer);
    const groundVertexCount = Math.min(dynamicMesh.groundVertexCount, DYNAMIC_MESH_MAX_VERTS);
    const vehiclesAndParticlesVertexCount = Math.min(dynamicMesh.vertexCount, DYNAMIC_MESH_MAX_VERTS) - groundVertexCount;
    if (vehiclesAndParticlesVertexCount > 0) pass.draw(vehiclesAndParticlesVertexCount, 1, DYNAMIC_VERT_OFFSET + groundVertexCount, 0);
    for (const slotIndex of slotOrder) {
      if (this.slotCounts[slotIndex] > 0) pass.draw(this.slotCounts[slotIndex], 1, slotIndex * VERTS_PER_SEGMENT, 0);
    }
    if (groundVertexCount > 0) pass.draw(groundVertexCount, 1, DYNAMIC_VERT_OFFSET, 0);
  }

  sortSlotsNearestFirst() {
    const cameraFirstFloat = UNIFORM_VEC4_SLOT.camPosAndTime * 4;
    const camera = [this.uniformData[cameraFirstFloat], this.uniformData[cameraFirstFloat + 1], this.uniformData[cameraFirstFloat + 2]];
    const cache = this.slotOrderCache;
    const cameraMovement = cache.cameraPosition ? Math.hypot(camera[0] - cache.cameraPosition[0], camera[1] - cache.cameraPosition[1], camera[2] - cache.cameraPosition[2]) : Infinity;
    if (cache.version === this.slotsVersion && cameraMovement < SLOT_ORDER_REFRESH_MOVEMENT_METERS) return cache.order;
    let filledSlotCount = 0;
    for (let slotIndex = 0; slotIndex < MAX_SEGMENTS; slotIndex++) {
      if (this.slotCounts[slotIndex] === 0) continue;
      const centerX = this.slotCenters[slotIndex * 3] - camera[0];
      const centerY = this.slotCenters[slotIndex * 3 + 1] - camera[1];
      const centerZ = this.slotCenters[slotIndex * 3 + 2] - camera[2];
      this.slotViewDistances[slotIndex] = centerX * centerX + centerY * centerY + centerZ * centerZ;
      this.slotDrawOrder[filledSlotCount++] = slotIndex;
    }
    cache.order = Uint16Array.from(this.slotDrawOrder.subarray(0, filledSlotCount).sort(this.compareSlotViewDistance));
    cache.version = this.slotsVersion;
    cache.cameraPosition = camera;
    return cache.order;
  }

  prepareTreeBatches() {
    if (!this.treeMeshes) return [];
    const view = readTreeCullingView(this.uniformData);
    const cache = this.treeBatchCache;
    cache.framesSinceBuild++;
    if (!this.isTreeBatchCacheStale(view)) return cache.batches;
    const { batches, instanceCount } = this.treeField.buildBatches(view);
    if (instanceCount > 0) this.device.queue.writeBuffer(this.treeInstanceBuffer, 0, this.treeField.staging.buffer, 0, instanceCount * TREE_INSTANCE_BYTES);
    cache.batches = instanceCount > 0 ? batches : [];
    cache.view = view;
    cache.fieldVersion = this.treeFieldVersion;
    cache.framesSinceBuild = 0;
    return cache.batches;
  }

  isTreeBatchCacheStale(view) {
    const cache = this.treeBatchCache;
    if (!cache.view || cache.fieldVersion !== this.treeFieldVersion) return true;
    if (cache.framesSinceBuild >= TREE_BATCH_REFRESH_FRAMES) return true;
    const movement = Math.hypot(view.x - cache.view.x, view.y - cache.view.y, view.z - cache.view.z);
    const turnCosine = view.forwardX * cache.view.forwardX + view.forwardY * cache.view.forwardY + view.forwardZ * cache.view.forwardZ;
    return movement > TREE_BATCH_REFRESH_MOVEMENT_METERS || turnCosine < TREE_BATCH_REFRESH_TURN_COSINE;
  }

  drawTreeBatches(pass, batches, pipeline, bindGroup) {
    if (batches.length === 0) return;
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, this.treeVertexBuffer);
    pass.setVertexBuffer(1, this.treeInstanceBuffer);
    pass.setIndexBuffer(this.treeIndexBuffer, "uint16");
    for (const batch of batches) {
      const mesh = this.treeMeshes[batch.speciesIndex][batch.lod];
      pass.drawIndexed(mesh.indexCount, batch.instanceCount, mesh.firstIndex, mesh.baseVertex, batch.firstInstance);
    }
  }
}

function setUniformVec4(uniforms, slot, x, y, z, w) {
  const firstIndex = slot * 4;
  uniforms[firstIndex] = x;
  uniforms[firstIndex + 1] = y;
  uniforms[firstIndex + 2] = z;
  uniforms[firstIndex + 3] = w;
}

function writeFrameUniforms(renderer, { camera, biome, fieldOfView, nearPlane, farPlane }) {
  const aspect = renderer.canvas.width / Math.max(1, renderer.canvas.height);
  mat4Perspective(frameProjectionMatrix, fieldOfView, aspect, nearPlane, farPlane);
  mat4LookAt(
    frameViewMatrix,
    [camera.x, camera.y, camera.z],
    [camera.lookX, camera.lookY, camera.lookZ],
    [0, 1, 0]
  );
  mat4Multiply(frameViewProjectionMatrix, frameProjectionMatrix, frameViewMatrix);

  const uniforms = renderer.uniformData;
  uniforms.set(frameViewProjectionMatrix, 0);

  const basis = computeCameraBasis(camera);
  const slot = UNIFORM_VEC4_SLOT;
  setUniformVec4(uniforms, slot.camPosAndTime, camera.x, camera.y, camera.z, environment.time);
  setUniformVec4(uniforms, slot.camForwardAndAspect, basis.forwardX, basis.forwardY, basis.forwardZ, aspect);
  setUniformVec4(uniforms, slot.camRightAndFov, basis.rightX, basis.rightY, basis.rightZ, Math.tan(fieldOfView * 0.5));
  setUniformVec4(uniforms, slot.camUp, basis.upX, basis.upY, basis.upZ, 0);
  setUniformVec4(uniforms, slot.sunDirAndIntensity, biome.sunDir[0], biome.sunDir[1], biome.sunDir[2], biome.sunIntensity);
  setUniformVec4(uniforms, slot.skyTopColor, biome.skyTop[0], biome.skyTop[1], biome.skyTop[2], biome.weatherWetness || 0.0);
  setUniformVec4(uniforms, slot.skyHorizonColor, biome.skyHorizon[0], biome.skyHorizon[1], biome.skyHorizon[2], 0);
  setUniformVec4(uniforms, slot.sunColorAndNight, biome.sunColor[0], biome.sunColor[1], biome.sunColor[2], biome.nightFactor);
  setUniformVec4(uniforms, slot.skyMidColor, biome.skyMid[0], biome.skyMid[1], biome.skyMid[2], 0.0);
  setUniformVec4(uniforms, slot.weatherRoadColor, biome.roadColor[0], biome.roadColor[1], biome.roadColor[2], 1);
  setUniformVec4(uniforms, slot.weatherShoulderColor, biome.shoulderColor[0], biome.shoulderColor[1], biome.shoulderColor[2], 1);
  setUniformVec4(uniforms, slot.weatherStripeColor, biome.stripeColor[0], biome.stripeColor[1], biome.stripeColor[2], 1);
  setUniformVec4(uniforms, slot.weatherWaterColor, biome.waterColor[0], biome.waterColor[1], biome.waterColor[2], 1);
  setUniformVec4(uniforms, slot.qualityParams, renderer.quality.detailFadeStartMeters, renderer.quality.detailFadeEndMeters, MSAA_SAMPLE_COUNT, 0);
  renderer.shadowNeedsRender = updateSunShadow(uniforms, { camera, sunDirection: biome.sunDir, quality: renderer.quality });
  renderer.setFrameProjection({ nearPlane, farPlane, tanHalfFieldOfView: Math.tan(fieldOfView * 0.5), aspect });
}

function createDepthPrepassPipeline({ device, layout, shaderModule, vertexEntryPoint, fragmentEntryPoint, vertexBuffers }) {
  const descriptor = {
    layout,
    vertex: { module: shaderModule, entryPoint: vertexEntryPoint, buffers: vertexBuffers },
    primitive: { topology: "triangle-list", cullMode: "none" },
    multisample: { count: MSAA_SAMPLE_COUNT },
    depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: true, depthCompare: "less" }
  };
  if (fragmentEntryPoint) descriptor.fragment = { module: shaderModule, entryPoint: fragmentEntryPoint, targets: [] };
  return device.createRenderPipeline(descriptor);
}

function createSceneRenderPipeline({ device, layout, shaderModule, colorFormat, vertexEntryPoint, vertexBuffers, fragmentEntryPoint, primitive, depthWriteEnabled, depthCompare }) {
  const vertex = { module: shaderModule, entryPoint: vertexEntryPoint };
  if (vertexBuffers) vertex.buffers = vertexBuffers;
  return device.createRenderPipeline({
    layout,
    vertex,
    fragment: {
      module: shaderModule,
      entryPoint: fragmentEntryPoint,
      targets: [{ format: colorFormat }]
    },
    primitive,
    multisample: { count: MSAA_SAMPLE_COUNT },
    depthStencil: {
      format: DEPTH_FORMAT,
      depthWriteEnabled,
      depthCompare
    }
  });
}

function packTreeMeshLibrary(speciesMeshes) {
  const meshes = speciesMeshes.flat();
  const totalVertexBytes = meshes.reduce((sum, mesh) => sum + mesh.vertexData.byteLength, 0);
  const totalIndices = meshes.reduce((sum, mesh) => sum + mesh.indices.length, 0);
  const vertexBytes = new Uint8Array(totalVertexBytes);
  const indices = new Uint16Array(totalIndices + (totalIndices % 2));
  let vertexByteCursor = 0;
  let indexCursor = 0;
  const placements = speciesMeshes.map(lodMeshes => lodMeshes.map(mesh => {
    const placement = { baseVertex: vertexByteCursor / TREE_VERTEX_BYTES, firstIndex: indexCursor, indexCount: mesh.indices.length };
    vertexBytes.set(new Uint8Array(mesh.vertexData), vertexByteCursor);
    indices.set(mesh.indices, indexCursor);
    vertexByteCursor += mesh.vertexData.byteLength;
    indexCursor += mesh.indices.length;
    return placement;
  }));
  return { placements, vertexBytes, indices };
}

function readTreeCullingView(uniforms) {
  const position = UNIFORM_VEC4_SLOT.camPosAndTime * 4;
  const forward = UNIFORM_VEC4_SLOT.camForwardAndAspect * 4;
  const tanHalfFov = uniforms[UNIFORM_VEC4_SLOT.camRightAndFov * 4 + 3];
  const aspect = uniforms[forward + 3];
  const carSpeed = Math.abs(uniforms[UNIFORM_VEC4_SLOT.carFwdAndSpeed * 4 + 3]);
  return {
    x: uniforms[position], y: uniforms[position + 1], z: uniforms[position + 2],
    forwardX: uniforms[forward], forwardY: uniforms[forward + 1], forwardZ: uniforms[forward + 2],
    tanHalfDiagonal: tanHalfFov * Math.hypot(1, aspect),
    carSpeed
  };
}

function computeCameraBasis(camera) {
  let forwardX = camera.lookX - camera.x;
  let forwardY = camera.lookY - camera.y;
  let forwardZ = camera.lookZ - camera.z;
  const forwardLength = Math.hypot(forwardX, forwardY, forwardZ) || 1;
  forwardX /= forwardLength; forwardY /= forwardLength; forwardZ /= forwardLength;

  let rightX = -forwardZ, rightY = 0, rightZ = forwardX;
  const rightLength = Math.hypot(rightX, rightY, rightZ) || 1;
  rightX /= rightLength; rightY /= rightLength; rightZ /= rightLength;

  return {
    forwardX, forwardY, forwardZ,
    rightX, rightY, rightZ,
    upX: rightY * forwardZ - rightZ * forwardY,
    upY: rightZ * forwardX - rightX * forwardZ,
    upZ: rightX * forwardY - rightY * forwardX
  };
}
