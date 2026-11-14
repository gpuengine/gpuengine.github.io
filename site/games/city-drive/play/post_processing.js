// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar
const COMPACT_HDR_FORMAT="rg11b10ufloat",WIDE_HDR_FORMAT="rgba16float",COMPACT_HDR_FEATURE="rg11b10ufloat-renderable",MSAA_SAMPLE_COUNT=4,CONTACT_SHADING_FORMAT="rgba8unorm",BLOOM_MIN_MIP_PIXELS=8,POST_UNIFORM_BYTES=64,FULLSCREEN_TRIANGLE_VERTICES=3,POST_EFFECT_SETTINGS=Object.freeze({bloomStrength:.42,bloomThreshold:1,contactShadingStrength:.7,edgeHighlightStrength:.22}),POST_COMMON_WGSL=`
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
`,CONTACT_SHADING_WGSL=POST_COMMON_WGSL+`
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
`,BLOOM_WGSL=POST_COMMON_WGSL+`
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
`,COMPOSITE_WGSL=POST_COMMON_WGSL+`
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
`;class PostProcessChain{constructor(e,{outputFormat:t,hdrFormat:o,quality:s}){this.device=e,this.outputFormat=t,this.hdrFormat=o,this.quality=s,this.uniformData=new Float32Array(64/4),this.uniformBuffer=e.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.linearSampler=e.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),this.pipelines=this.createPipelines(),this.targets=null}createPipelines(){const e=(o,s,r,i)=>{const n=this.device.createShaderModule({code:o}),l=i?{format:r,blend:i}:{format:r};return this.device.createRenderPipeline({layout:"auto",vertex:{module:n,entryPoint:"vs_fullscreen"},fragment:{module:n,entryPoint:s,targets:[l]},primitive:{topology:"triangle-list"}})},t={color:{srcFactor:"one",dstFactor:"one",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one",operation:"add"}};return{contactShading:e(CONTACT_SHADING_WGSL,"fs_contact_shading",CONTACT_SHADING_FORMAT),bloomPrefilter:e(BLOOM_WGSL,"fs_bloom_prefilter",this.hdrFormat),bloomDownsample:e(BLOOM_WGSL,"fs_bloom_downsample",this.hdrFormat),bloomUpsample:e(BLOOM_WGSL,"fs_bloom_upsample",this.hdrFormat,t),composite:e(COMPOSITE_WGSL,"fs_composite",this.outputFormat)}}setQuality(e){this.quality=e,this.targets&&this.resize(this.targets.width,this.targets.height)}resize(e,t){this.targets&&this.destroyTargets();const o=this.device,s=Math.max(1,Math.floor(e/2)),r=Math.max(1,Math.floor(t/2)),i=this.quality.contactShadingDivisor,n=[Math.max(1,Math.floor(e/i)),Math.max(1,Math.floor(t/i))],l=Math.max(1,Math.min(this.quality.bloomMipCount,Math.floor(Math.log2(Math.min(s,r)/8))+1)),a=o.createTexture({size:[e,t],format:this.hdrFormat,sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT}),c=o.createTexture({size:[e,t],format:this.hdrFormat,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),u=o.createTexture({size:[e,t],format:DEPTH_FORMAT,sampleCount:4,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),p=o.createTexture({size:n,format:CONTACT_SHADING_FORMAT,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),m=o.createTexture({size:[s,r],format:this.hdrFormat,mipLevelCount:l,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),f=Array.from({length:l},(h,v)=>m.createView({baseMipLevel:v,mipLevelCount:1}));this.targets={width:e,height:t,textures:[a,c,u,p,m],sceneColorView:a.createView(),resolvedColorView:c.createView(),sceneDepthView:u.createView(),contactShadingView:p.createView(),bloomMipViews:f},this.bindGroups=this.createBindGroups()}destroyTargets(){for(const e of this.targets.textures)e.destroy();this.targets=null}createBindGroups(){const{pipelines:e,targets:t,linearSampler:o}=this,s={binding:0,resource:{buffer:this.uniformBuffer}},r=(n,l,a)=>this.device.createBindGroup({layout:n.getBindGroupLayout(0),entries:[...a?[s]:[],{binding:1,resource:l},{binding:2,resource:o}]}),i=t.bloomMipViews;return{contactShading:this.device.createBindGroup({layout:e.contactShading.getBindGroupLayout(0),entries:[s,{binding:1,resource:t.sceneDepthView}]}),bloomPrefilter:r(e.bloomPrefilter,t.resolvedColorView,!0),bloomDownsample:i.slice(0,-1).map(n=>r(e.bloomDownsample,n,!1)),bloomUpsample:i.slice(1).map(n=>r(e.bloomUpsample,n,!1)),composite:this.device.createBindGroup({layout:e.composite.getBindGroupLayout(0),entries:[s,{binding:1,resource:t.resolvedColorView},{binding:2,resource:o},{binding:3,resource:i[0]},{binding:4,resource:t.contactShadingView}]})}}writeUniforms({nearPlane:e,farPlane:t,tanHalfFieldOfView:o,aspect:s}){const r=this.uniformData;r.set([e,t,o,s],0),r.set([this.targets.width,this.targets.height,0,0],4),r.set([POST_EFFECT_SETTINGS.bloomStrength,POST_EFFECT_SETTINGS.contactShadingStrength,POST_EFFECT_SETTINGS.edgeHighlightStrength,POST_EFFECT_SETTINGS.bloomThreshold],8),r.set([this.quality.contactShadingSamples,this.quality.contactShadingDivisor,0,0],12),this.device.queue.writeBuffer(this.uniformBuffer,0,r)}sceneColorAttachment(){return{view:this.targets.sceneColorView,resolveTarget:this.targets.resolvedColorView,clearValue:SCENE_CLEAR_COLOR,loadOp:"clear",storeOp:"discard"}}depthPrepassAttachment(){return{view:this.targets.sceneDepthView,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}}sceneDepthAttachment(){return{view:this.targets.sceneDepthView,depthLoadOp:"load",depthStoreOp:"store"}}encode(e,t){this.drawFullscreen(e,this.pipelines.contactShading,this.bindGroups.contactShading,this.targets.contactShadingView),this.encodeBloom(e),this.drawFullscreen(e,this.pipelines.composite,this.bindGroups.composite,t)}encodeBloom(e){const t=this.targets.bloomMipViews;this.drawFullscreen(e,this.pipelines.bloomPrefilter,this.bindGroups.bloomPrefilter,t[0]);for(let o=1;o<t.length;o++)this.drawFullscreen(e,this.pipelines.bloomDownsample,this.bindGroups.bloomDownsample[o-1],t[o]);for(let o=t.length-2;o>=0;o--)this.drawFullscreen(e,this.pipelines.bloomUpsample,this.bindGroups.bloomUpsample[o],t[o],"load")}drawFullscreen(e,t,o,s,r="clear"){const i=e.beginRenderPass({colorAttachments:[{view:s,clearValue:{r:0,g:0,b:0,a:1},loadOp:r,storeOp:"store"}]});i.setPipeline(t),i.setBindGroup(0,o),i.draw(3,1,0,0),i.end()}}
