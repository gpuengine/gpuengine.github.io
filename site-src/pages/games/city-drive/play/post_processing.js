// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const COMPACT_HDR_FORMAT = "rg11b10ufloat";
const WIDE_HDR_FORMAT = "rgba16float";
const COMPACT_HDR_FEATURE = "rg11b10ufloat-renderable";
const MSAA_SAMPLE_COUNT = 4;
const CONTACT_SHADING_FORMAT = "rgba8unorm";
const BLOOM_MIN_MIP_PIXELS = 8;
const POST_UNIFORM_BYTES = 64;
const FULLSCREEN_TRIANGLE_VERTICES = 3;

const POST_EFFECT_SETTINGS = Object.freeze({
  bloomStrength: 0.42,
  bloomThreshold: 1.0,
  contactShadingStrength: 0.7,
  edgeHighlightStrength: 0.22
});

const POST_COMMON_WGSL = `
struct PostUniforms {
  camera : vec4<f32>,
  frame : vec4<f32>,
  effects : vec4<f32>,
  quality : vec4<f32>,
};

@group(0) @binding(0) var<uniform> post : PostUniforms;

struct FullscreenOut {
  @builtin(position) position : vec4<f32>,
  @location(0) uv : vec2<f32>,
};

@vertex
fn vs_fullscreen(@builtin(vertex_index) vertexIndex : u32) -> FullscreenOut {
  var corners = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
  let corner = corners[vertexIndex];
  var out : FullscreenOut;
  out.position = vec4<f32>(corner, 0.0, 1.0);
  out.uv = vec2<f32>(corner.x * 0.5 + 0.5, 0.5 - corner.y * 0.5);
  return out;
}
`;

const CONTACT_SHADING_WGSL = POST_COMMON_WGSL + `
@group(0) @binding(1) var sceneDepth : texture_depth_multisampled_2d;

const OCCLUSION_RADIUS_METERS = 0.9;
const OCCLUSION_BIAS = 0.12;
const OCCLUSION_INTENSITY = 1.6;
const OCCLUSION_MIN_RADIUS_PIXELS = 3.0;
const OCCLUSION_MAX_RADIUS_PIXELS = 48.0;
const EDGE_PROBE_PIXELS = 2;
const EDGE_MIN_CURVATURE = 0.0012;
const EDGE_FULL_CURVATURE = 0.006;
const EDGE_SILHOUETTE_CURVATURE = 0.03;
const SKY_DEPTH = 0.99999;
const GOLDEN_ANGLE = 2.3999632;

fn clampedPixel(pixel : vec2<i32>) -> vec2<i32> {
  return clamp(pixel, vec2<i32>(0), vec2<i32>(textureDimensions(sceneDepth)) - 1);
}

fn linearDepthAt(pixel : vec2<i32>) -> f32 {
  let near = post.camera.x;
  let far = post.camera.y;
  let depth = textureLoad(sceneDepth, clampedPixel(pixel), 0);
  return near * far / (far - depth * (far - near));
}

fn viewPositionAt(pixel : vec2<i32>) -> vec3<f32> {
  let size = vec2<f32>(textureDimensions(sceneDepth));
  let ndc = (vec2<f32>(pixel) + 0.5) / size * vec2<f32>(2.0, -2.0) + vec2<f32>(-1.0, 1.0);
  let depth = linearDepthAt(pixel);
  return vec3<f32>(ndc.x * post.camera.w * post.camera.z * depth, ndc.y * post.camera.z * depth, -depth);
}

fn interleavedGradientNoise(position : vec2<f32>) -> f32 {
  return fract(52.9829189 * fract(dot(position, vec2<f32>(0.06711056, 0.00583715))));
}

fn shorterDifference(forward : vec3<f32>, backward : vec3<f32>) -> vec3<f32> {
  return select(backward, forward, abs(forward.z) < abs(backward.z));
}

fn surfaceNormalAt(pixel : vec2<i32>, center : vec3<f32>) -> vec3<f32> {
  let alongX = shorterDifference(viewPositionAt(pixel + vec2<i32>(1, 0)) - center, center - viewPositionAt(pixel - vec2<i32>(1, 0)));
  let alongY = shorterDifference(viewPositionAt(pixel + vec2<i32>(0, 1)) - center, center - viewPositionAt(pixel - vec2<i32>(0, 1)));
  let normal = normalize(cross(alongY, alongX));
  return select(normal, -normal, dot(normal, -center) < 0.0);
}

fn ambientOcclusionAt(pixel : vec2<i32>, center : vec3<f32>, normal : vec3<f32>, noise : f32) -> f32 {
  let pixelsPerMeter = post.frame.y * 0.5 / (post.camera.z * -center.z);
  let radiusPixels = clamp(OCCLUSION_RADIUS_METERS * pixelsPerMeter, OCCLUSION_MIN_RADIUS_PIXELS, OCCLUSION_MAX_RADIUS_PIXELS);
  let radiusSquared = OCCLUSION_RADIUS_METERS * OCCLUSION_RADIUS_METERS;
  let sampleCount = i32(post.quality.x);
  var occlusion = 0.0;
  for (var sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
    let order = f32(sampleIndex);
    let angle = order * GOLDEN_ANGLE + noise * 6.2831853;
    let reach = sqrt((order + 0.5) / f32(sampleCount)) * radiusPixels;
    let samplePixel = pixel + vec2<i32>(vec2<f32>(cos(angle), sin(angle)) * reach);
    let toSample = viewPositionAt(samplePixel) - center;
    let distanceSquared = dot(toSample, toSample);
    let facing = dot(normal, toSample) * inverseSqrt(max(distanceSquared, 1e-4));
    let falloff = 1.0 - smoothstep(radiusSquared * 0.5, radiusSquared * 2.0, distanceSquared);
    occlusion += max(facing - OCCLUSION_BIAS, 0.0) * falloff;
  }
  return clamp(1.0 - occlusion / f32(sampleCount) * OCCLUSION_INTENSITY, 0.0, 1.0);
}

fn inverseDepthAt(pixel : vec2<i32>) -> f32 {
  return 1.0 / linearDepthAt(pixel);
}

fn edgeCurvatureAt(pixel : vec2<i32>) -> f32 {
  let centerInverse = inverseDepthAt(pixel);
  let neighbourAverage = (
    inverseDepthAt(pixel + vec2<i32>(EDGE_PROBE_PIXELS, 0)) +
    inverseDepthAt(pixel - vec2<i32>(EDGE_PROBE_PIXELS, 0)) +
    inverseDepthAt(pixel + vec2<i32>(0, EDGE_PROBE_PIXELS)) +
    inverseDepthAt(pixel - vec2<i32>(0, EDGE_PROBE_PIXELS))
  ) * 0.25;
  return (centerInverse - neighbourAverage) / centerInverse;
}

@fragment
fn fs_contact_shading(in : FullscreenOut) -> @location(0) vec4<f32> {
  let pixel = vec2<i32>(in.position.xy * post.quality.y);
  if (textureLoad(sceneDepth, clampedPixel(pixel), 0) >= SKY_DEPTH) {
    return vec4<f32>(1.0, 0.0, 0.0, 1.0);
  }
  let center = viewPositionAt(pixel);
  let normal = surfaceNormalAt(pixel, center);
  let occlusion = ambientOcclusionAt(pixel, center, normal, interleavedGradientNoise(in.position.xy));
  let curvature = edgeCurvatureAt(pixel);
  let isNotSilhouette = 1.0 - smoothstep(EDGE_SILHOUETTE_CURVATURE, EDGE_SILHOUETTE_CURVATURE * 2.0, abs(curvature));
  let convexEdge = smoothstep(EDGE_MIN_CURVATURE, EDGE_FULL_CURVATURE, curvature) * isNotSilhouette;
  let concaveCrease = smoothstep(EDGE_MIN_CURVATURE, EDGE_FULL_CURVATURE, -curvature) * isNotSilhouette;
  return vec4<f32>(occlusion, convexEdge, concaveCrease, 1.0);
}
`;

const BLOOM_WGSL = POST_COMMON_WGSL + `
@group(0) @binding(1) var bloomSource : texture_2d<f32>;
@group(0) @binding(2) var bloomSampler : sampler;

fn sourceTexel() -> vec2<f32> {
  return 1.0 / vec2<f32>(textureDimensions(bloomSource));
}

fn brightPassWeight(color : vec3<f32>) -> f32 {
  let threshold = post.effects.w;
  let knee = threshold * 0.5;
  let brightness = max(color.r, max(color.g, color.b));
  let softened = clamp(brightness - threshold + knee, 0.0, 2.0 * knee);
  let softContribution = softened * softened / (4.0 * knee + 1e-4);
  return max(softContribution, brightness - threshold) / max(brightness, 1e-4);
}

@fragment
fn fs_bloom_prefilter(in : FullscreenOut) -> @location(0) vec4<f32> {
  let texel = sourceTexel();
  var color = vec3<f32>(0.0);
  color += textureSampleLevel(bloomSource, bloomSampler, in.uv + vec2<f32>(-0.5, -0.5) * texel, 0.0).rgb;
  color += textureSampleLevel(bloomSource, bloomSampler, in.uv + vec2<f32>(0.5, -0.5) * texel, 0.0).rgb;
  color += textureSampleLevel(bloomSource, bloomSampler, in.uv + vec2<f32>(-0.5, 0.5) * texel, 0.0).rgb;
  color += textureSampleLevel(bloomSource, bloomSampler, in.uv + vec2<f32>(0.5, 0.5) * texel, 0.0).rgb;
  color *= 0.25;
  return vec4<f32>(color * brightPassWeight(color), 1.0);
}

fn bloomTap(uv : vec2<f32>, texelOffset : vec2<f32>) -> vec3<f32> {
  return textureSampleLevel(bloomSource, bloomSampler, uv + texelOffset * sourceTexel(), 0.0).rgb;
}

@fragment
fn fs_bloom_downsample(in : FullscreenOut) -> @location(0) vec4<f32> {
  let uv = in.uv;
  let center = bloomTap(uv, vec2<f32>(0.0, 0.0));
  let innerCorners = bloomTap(uv, vec2<f32>(-1.0, -1.0)) + bloomTap(uv, vec2<f32>(1.0, -1.0)) + bloomTap(uv, vec2<f32>(-1.0, 1.0)) + bloomTap(uv, vec2<f32>(1.0, 1.0));
  let outerCorners = bloomTap(uv, vec2<f32>(-2.0, -2.0)) + bloomTap(uv, vec2<f32>(2.0, -2.0)) + bloomTap(uv, vec2<f32>(-2.0, 2.0)) + bloomTap(uv, vec2<f32>(2.0, 2.0));
  let outerEdges = bloomTap(uv, vec2<f32>(-2.0, 0.0)) + bloomTap(uv, vec2<f32>(2.0, 0.0)) + bloomTap(uv, vec2<f32>(0.0, -2.0)) + bloomTap(uv, vec2<f32>(0.0, 2.0));
  let color = center * 0.125 + innerCorners * 0.125 + outerCorners * 0.03125 + outerEdges * 0.0625;
  return vec4<f32>(color, 1.0);
}

@fragment
fn fs_bloom_upsample(in : FullscreenOut) -> @location(0) vec4<f32> {
  let uv = in.uv;
  let corners = bloomTap(uv, vec2<f32>(-1.0, -1.0)) + bloomTap(uv, vec2<f32>(1.0, -1.0)) + bloomTap(uv, vec2<f32>(-1.0, 1.0)) + bloomTap(uv, vec2<f32>(1.0, 1.0));
  let edges = bloomTap(uv, vec2<f32>(-1.0, 0.0)) + bloomTap(uv, vec2<f32>(1.0, 0.0)) + bloomTap(uv, vec2<f32>(0.0, -1.0)) + bloomTap(uv, vec2<f32>(0.0, 1.0));
  let color = bloomTap(uv, vec2<f32>(0.0, 0.0)) * 0.25 + edges * 0.125 + corners * 0.0625;
  return vec4<f32>(color, 1.0);
}
`;

const COMPOSITE_WGSL = POST_COMMON_WGSL + `
@group(0) @binding(1) var sceneColor : texture_2d<f32>;
@group(0) @binding(2) var linearSampler : sampler;
@group(0) @binding(3) var bloomTexture : texture_2d<f32>;
@group(0) @binding(4) var contactShading : texture_2d<f32>;

const TONE_SHOULDER_START = 0.8;
const CREASE_DARKENING = 0.18;

fn softShoulder(color : vec3<f32>) -> vec3<f32> {
  let headroom = 1.0 - TONE_SHOULDER_START;
  let compressed = TONE_SHOULDER_START + headroom * (1.0 - exp(-(color - TONE_SHOULDER_START) / headroom));
  return select(color, compressed, color > vec3<f32>(TONE_SHOULDER_START));
}

fn blurredContactShading(uv : vec2<f32>) -> vec4<f32> {
  let texel = 1.0 / vec2<f32>(textureDimensions(contactShading));
  return (
    textureSampleLevel(contactShading, linearSampler, uv + vec2<f32>(-0.75, -0.75) * texel, 0.0) +
    textureSampleLevel(contactShading, linearSampler, uv + vec2<f32>(0.75, -0.75) * texel, 0.0) +
    textureSampleLevel(contactShading, linearSampler, uv + vec2<f32>(-0.75, 0.75) * texel, 0.0) +
    textureSampleLevel(contactShading, linearSampler, uv + vec2<f32>(0.75, 0.75) * texel, 0.0)
  ) * 0.25;
}

@fragment
fn fs_composite(in : FullscreenOut) -> @location(0) vec4<f32> {
  var color = textureLoad(sceneColor, vec2<i32>(in.position.xy), 0).rgb;
  let shading = blurredContactShading(in.uv);
  color *= mix(1.0, shading.r, post.effects.y);
  color *= (1.0 + shading.g * post.effects.z) * (1.0 - shading.b * CREASE_DARKENING);
  color += textureSampleLevel(bloomTexture, linearSampler, in.uv, 0.0).rgb * post.effects.x;
  color = clamp(softShoulder(max(color, vec3<f32>(0.0))), vec3<f32>(0.0), vec3<f32>(1.0));
  return vec4<f32>(color, 1.0);
}
`;

class PostProcessChain {
  constructor(device, { outputFormat, hdrFormat, quality }) {
    this.device = device;
    this.outputFormat = outputFormat;
    this.hdrFormat = hdrFormat;
    this.quality = quality;
    this.uniformData = new Float32Array(POST_UNIFORM_BYTES / 4);
    this.uniformBuffer = device.createBuffer({ size: POST_UNIFORM_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.linearSampler = device.createSampler({ magFilter: "linear", minFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });
    this.pipelines = this.createPipelines();
    this.targets = null;
  }

  createPipelines() {
    const fullscreen = (code, entryPoint, format, blend) => {
      const module = this.device.createShaderModule({ code });
      const target = blend ? { format, blend } : { format };
      return this.device.createRenderPipeline({
        layout: "auto",
        vertex: { module, entryPoint: "vs_fullscreen" },
        fragment: { module, entryPoint, targets: [target] },
        primitive: { topology: "triangle-list" }
      });
    };
    const additive = { color: { srcFactor: "one", dstFactor: "one", operation: "add" }, alpha: { srcFactor: "one", dstFactor: "one", operation: "add" } };
    return {
      contactShading: fullscreen(CONTACT_SHADING_WGSL, "fs_contact_shading", CONTACT_SHADING_FORMAT),
      bloomPrefilter: fullscreen(BLOOM_WGSL, "fs_bloom_prefilter", this.hdrFormat),
      bloomDownsample: fullscreen(BLOOM_WGSL, "fs_bloom_downsample", this.hdrFormat),
      bloomUpsample: fullscreen(BLOOM_WGSL, "fs_bloom_upsample", this.hdrFormat, additive),
      composite: fullscreen(COMPOSITE_WGSL, "fs_composite", this.outputFormat)
    };
  }

  setQuality(quality) {
    this.quality = quality;
    if (this.targets) this.resize(this.targets.width, this.targets.height);
  }

  resize(width, height) {
    if (this.targets) this.destroyTargets();
    const device = this.device;
    const halfWidth = Math.max(1, Math.floor(width / 2));
    const halfHeight = Math.max(1, Math.floor(height / 2));
    const shadingDivisor = this.quality.contactShadingDivisor;
    const shadingSize = [Math.max(1, Math.floor(width / shadingDivisor)), Math.max(1, Math.floor(height / shadingDivisor))];
    const bloomMipCount = Math.max(1, Math.min(this.quality.bloomMipCount, Math.floor(Math.log2(Math.min(halfWidth, halfHeight) / BLOOM_MIN_MIP_PIXELS)) + 1));
    const sceneColor = device.createTexture({ size: [width, height], format: this.hdrFormat, sampleCount: MSAA_SAMPLE_COUNT, usage: GPUTextureUsage.RENDER_ATTACHMENT });
    const resolvedColor = device.createTexture({ size: [width, height], format: this.hdrFormat, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    const sceneDepth = device.createTexture({ size: [width, height], format: DEPTH_FORMAT, sampleCount: MSAA_SAMPLE_COUNT, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    const contactShading = device.createTexture({ size: shadingSize, format: CONTACT_SHADING_FORMAT, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    const bloom = device.createTexture({ size: [halfWidth, halfHeight], format: this.hdrFormat, mipLevelCount: bloomMipCount, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    const bloomMipViews = Array.from({ length: bloomMipCount }, (_, mipLevel) => bloom.createView({ baseMipLevel: mipLevel, mipLevelCount: 1 }));
    this.targets = {
      width, height,
      textures: [sceneColor, resolvedColor, sceneDepth, contactShading, bloom],
      sceneColorView: sceneColor.createView(),
      resolvedColorView: resolvedColor.createView(),
      sceneDepthView: sceneDepth.createView(),
      contactShadingView: contactShading.createView(),
      bloomMipViews
    };
    this.bindGroups = this.createBindGroups();
  }

  destroyTargets() {
    for (const texture of this.targets.textures) texture.destroy();
    this.targets = null;
  }

  createBindGroups() {
    const { pipelines, targets, linearSampler } = this;
    const uniformEntry = { binding: 0, resource: { buffer: this.uniformBuffer } };
    const bloomPass = (pipeline, sourceView, usesUniforms) => this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [...(usesUniforms ? [uniformEntry] : []), { binding: 1, resource: sourceView }, { binding: 2, resource: linearSampler }]
    });
    const mips = targets.bloomMipViews;
    return {
      contactShading: this.device.createBindGroup({ layout: pipelines.contactShading.getBindGroupLayout(0), entries: [uniformEntry, { binding: 1, resource: targets.sceneDepthView }] }),
      bloomPrefilter: bloomPass(pipelines.bloomPrefilter, targets.resolvedColorView, true),
      bloomDownsample: mips.slice(0, -1).map(view => bloomPass(pipelines.bloomDownsample, view, false)),
      bloomUpsample: mips.slice(1).map(view => bloomPass(pipelines.bloomUpsample, view, false)),
      composite: this.device.createBindGroup({
        layout: pipelines.composite.getBindGroupLayout(0),
        entries: [
          uniformEntry,
          { binding: 1, resource: targets.resolvedColorView },
          { binding: 2, resource: linearSampler },
          { binding: 3, resource: mips[0] },
          { binding: 4, resource: targets.contactShadingView }
        ]
      })
    };
  }

  writeUniforms({ nearPlane, farPlane, tanHalfFieldOfView, aspect }) {
    const data = this.uniformData;
    data.set([nearPlane, farPlane, tanHalfFieldOfView, aspect], 0);
    data.set([this.targets.width, this.targets.height, 0, 0], 4);
    data.set([POST_EFFECT_SETTINGS.bloomStrength, POST_EFFECT_SETTINGS.contactShadingStrength, POST_EFFECT_SETTINGS.edgeHighlightStrength, POST_EFFECT_SETTINGS.bloomThreshold], 8);
    data.set([this.quality.contactShadingSamples, this.quality.contactShadingDivisor, 0, 0], 12);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, data);
  }

  sceneColorAttachment() {
    return { view: this.targets.sceneColorView, resolveTarget: this.targets.resolvedColorView, clearValue: SCENE_CLEAR_COLOR, loadOp: "clear", storeOp: "discard" };
  }

  depthPrepassAttachment() {
    return { view: this.targets.sceneDepthView, depthClearValue: 1.0, depthLoadOp: "clear", depthStoreOp: "store" };
  }

  sceneDepthAttachment() {
    return { view: this.targets.sceneDepthView, depthLoadOp: "load", depthStoreOp: "store" };
  }

  encode(encoder, outputView) {
    this.drawFullscreen(encoder, this.pipelines.contactShading, this.bindGroups.contactShading, this.targets.contactShadingView);
    this.encodeBloom(encoder);
    this.drawFullscreen(encoder, this.pipelines.composite, this.bindGroups.composite, outputView);
  }

  encodeBloom(encoder) {
    const mips = this.targets.bloomMipViews;
    this.drawFullscreen(encoder, this.pipelines.bloomPrefilter, this.bindGroups.bloomPrefilter, mips[0]);
    for (let mipLevel = 1; mipLevel < mips.length; mipLevel++) {
      this.drawFullscreen(encoder, this.pipelines.bloomDownsample, this.bindGroups.bloomDownsample[mipLevel - 1], mips[mipLevel]);
    }
    for (let mipLevel = mips.length - 2; mipLevel >= 0; mipLevel--) {
      this.drawFullscreen(encoder, this.pipelines.bloomUpsample, this.bindGroups.bloomUpsample[mipLevel], mips[mipLevel], "load");
    }
  }

  drawFullscreen(encoder, pipeline, bindGroup, targetView, loadOp = "clear") {
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: targetView, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp, storeOp: "store" }]
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(FULLSCREEN_TRIANGLE_VERTICES, 1, 0, 0);
    pass.end();
  }
}
