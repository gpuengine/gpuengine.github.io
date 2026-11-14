// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const SHARED_WGSL = `
struct Frame {
  viewProjection : mat4x4f,
  lightViewProjection : mat4x4f,
  cameraPosition : vec4f,
  cameraForward : vec4f,
  cameraRight : vec4f,
  cameraUp : vec4f,
  sunDirection : vec4f,
  sunColor : vec4f,
  skyTop : vec4f,
  skyHorizon : vec4f,
  groundColor : vec4f,
  fogAndShadow : vec4f,
};

struct ObjectData {
  model : mat4x4f,
  normalMatrix : mat4x4f,
  tint : vec4f,
};

@group(0) @binding(0) var<uniform> frame : Frame;
@group(0) @binding(1) var<storage, read> objects : array<ObjectData>;
@group(0) @binding(2) var shadowMap : texture_depth_2d;
@group(0) @binding(3) var shadowSampler : sampler_comparison;

fn toneMap(color : vec3f) -> vec3f {
  let exposed = color * frame.skyTop.w;
  let mapped = (exposed * (2.51 * exposed + 0.03)) / (exposed * (2.43 * exposed + 0.59) + 0.14);
  return pow(clamp(mapped, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2));
}

fn skyColor(direction : vec3f) -> vec3f {
  let elevation = clamp(direction.y, 0.0, 1.0);
  var color = mix(frame.skyHorizon.rgb, frame.skyTop.rgb, pow(elevation, 0.55));
  let belowHorizon = clamp(-direction.y * 6.0, 0.0, 1.0);
  color = mix(color, mix(frame.skyHorizon.rgb, frame.groundColor.rgb, 0.6), belowHorizon);
  let horizonGlow = exp(-abs(direction.y) * 18.0);
  return mix(color, frame.skyHorizon.rgb, horizonGlow * 0.3);
}
`;

export const SCENE_SHADER = SHARED_WGSL + `
const SHADOW_DARKEST_VISIBILITY = 0.18;
const SHADOW_EDGE_FADE_UV = 0.06;

struct VertexInput {
  @location(0) position : vec3f,
  @location(1) normal : vec3f,
  @location(2) color : vec3f,
  @location(3) surface : vec3f,
};

struct MeshVarying {
  @builtin(position) clipPosition : vec4f,
  @location(0) worldPosition : vec3f,
  @location(1) normal : vec3f,
  @location(2) color : vec3f,
  @location(3) surface : vec3f,
};

struct SkyVarying {
  @builtin(position) clipPosition : vec4f,
  @location(0) screen : vec2f,
};

@vertex
fn skyVertex(@builtin(vertex_index) vertexIndex : u32) -> SkyVarying {
  var corners = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var output : SkyVarying;
  output.clipPosition = vec4f(corners[vertexIndex], 1.0, 1.0);
  output.screen = corners[vertexIndex];
  return output;
}

@fragment
fn skyFragment(input : SkyVarying) -> @location(0) vec4f {
  let aspect = frame.cameraForward.w;
  let tanHalfFov = frame.cameraRight.w;
  let direction = normalize(frame.cameraForward.xyz + input.screen.x * aspect * tanHalfFov * frame.cameraRight.xyz + input.screen.y * tanHalfFov * frame.cameraUp.xyz);
  var color = skyColor(direction);
  let sunAlignment = max(dot(direction, frame.sunDirection.xyz), 0.0);
  color += frame.sunColor.rgb * (pow(sunAlignment, 1600.0) * 18.0 + pow(sunAlignment, 12.0) * 0.35);
  return vec4f(toneMap(color), 1.0);
}

@vertex
fn meshVertex(input : VertexInput, @builtin(instance_index) objectIndex : u32) -> MeshVarying {
  let object = objects[objectIndex];
  let world = object.model * vec4f(input.position, 1.0);
  var output : MeshVarying;
  output.clipPosition = frame.viewProjection * world;
  output.worldPosition = world.xyz;
  output.normal = (object.normalMatrix * vec4f(input.normal, 0.0)).xyz;
  output.color = input.color * object.tint.rgb;
  output.surface = vec3f(input.surface.x, input.surface.y + object.tint.a, input.surface.z);
  return output;
}

fn sunShadowVisibility(worldPosition : vec3f, normal : vec3f) -> f32 {
  if (frame.fogAndShadow.w < 0.5) {
    return 1.0;
  }
  let texel = frame.fogAndShadow.z;
  let lightClip = frame.lightViewProjection * vec4f(worldPosition + normal * frame.cameraUp.w, 1.0);
  let shadowUv = vec2f(lightClip.x * 0.5 + 0.5, 0.5 - lightClip.y * 0.5);
  let receiverDepth = lightClip.z - 0.0004;
  var litSamples = 0.0;
  for (var tapY = 0; tapY < 2; tapY++) {
    for (var tapX = 0; tapX < 2; tapX++) {
      let tapOffset = (vec2f(f32(tapX), f32(tapY)) * 2.0 - 1.0) * texel;
      litSamples += textureSampleCompareLevel(shadowMap, shadowSampler, shadowUv + tapOffset, receiverDepth);
    }
  }
  let distanceToEdge = min(min(shadowUv.x, 1.0 - shadowUv.x), min(shadowUv.y, 1.0 - shadowUv.y));
  let insideMap = smoothstep(0.0, SHADOW_EDGE_FADE_UV, distanceToEdge) * step(receiverDepth, 1.0);
  let visibility = mix(SHADOW_DARKEST_VISIBILITY, 1.0, litSamples / 4.0);
  return mix(1.0, visibility, insideMap * frame.sunColor.w);
}

fn ambientLight(normal : vec3f) -> vec3f {
  let skyFacing = normal.y * 0.5 + 0.5;
  let sky = mix(frame.skyHorizon.rgb * 0.5, frame.skyTop.rgb * 0.8, skyFacing);
  let bounce = frame.groundColor.rgb * (1.0 - skyFacing);
  return (sky + bounce) * frame.groundColor.w;
}

@fragment
fn meshFragment(input : MeshVarying) -> @location(0) vec4f {
  let toCamera = frame.cameraPosition.xyz - input.worldPosition;
  let cameraDistance = length(toCamera);
  let viewDirection = toCamera / max(cameraDistance, 0.0001);
  var normal = normalize(input.normal);
  if (dot(normal, viewDirection) < 0.0) {
    normal = -normal;
  }
  let gloss = input.surface.x;
  let glow = input.surface.y;
  let occlusion = input.surface.z;
  let sun = frame.sunDirection.xyz;
  let visibility = sunShadowVisibility(input.worldPosition, normal);
  let sunLight = frame.sunColor.rgb * frame.sunDirection.w;
  let diffuse = sunLight * max(dot(normal, sun), 0.0) * visibility;
  let halfway = normalize(sun + viewDirection);
  let shininess = mix(8.0, 160.0, gloss);
  let specular = sunLight * pow(max(dot(normal, halfway), 0.0), shininess) * gloss * visibility * 1.2;
  let fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 4.0);
  let reflection = skyColor(reflect(-viewDirection, normal)) * fresnel * gloss * 0.6;
  var color = input.color * (ambientLight(normal) * occlusion + diffuse) + specular + reflection + input.color * glow * 3.0;
  let fogAmount = smoothstep(frame.fogAndShadow.x, frame.fogAndShadow.y, cameraDistance) * (1.0 - min(glow, 1.0) * 0.5);
  color = mix(color, skyColor(-viewDirection), fogAmount);
  return vec4f(toneMap(color), 1.0);
}

@vertex
fn shadowVertex(input : VertexInput, @builtin(instance_index) objectIndex : u32) -> @builtin(position) vec4f {
  return frame.lightViewProjection * objects[objectIndex].model * vec4f(input.position, 1.0);
}
`;
