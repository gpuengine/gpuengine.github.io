// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const TREE_VERTEX_BYTES = 40;
const TREE_INSTANCE_FLOATS = 12;
const TREE_INSTANCE_BYTES = TREE_INSTANCE_FLOATS * 4;
const MAX_TREE_INSTANCES = 4096;
const TREE_LOD_FAR_LIMITS_METERS = [45, 130, Infinity];
const TREE_LOD_COUNT = TREE_LOD_FAR_LIMITS_METERS.length;
const TREE_CULL_MARGIN_METERS = 12;
const TREE_SMEAR_ANGULAR_SPEED_RADIANS_PER_SECOND = 1.5;

const LEAF_ATLAS_SIZE = 512;
const LEAF_ATLAS_CELL_SIZE = 256;
const LEAF_ATLAS_CELL = Object.freeze({ broadleaf: 0, fineLeaf: 1, blossom: 2, needle: 3 });
const LEAF_ATLAS_EMPTY_SHADE = 150;

const TREE_VERTEX_KIND = Object.freeze({ bark: 1, foliageCore: 0.5, facingCard: 0, uprightCard: -1 });
const TUBE_LENGTH_UV_SPAN_TRUNK_WIDTHS = 4.0;
const RING_NORMAL_ANGLE_STEP = 0.01;
const ZERO_VECTOR = Object.freeze([0, 0, 0]);

const FOLIAGE_WGSL_CODE = `
const BARK_REPEATS_AROUND_TRUNK = 2.0;
const BARK_TILE_HEIGHT_METERS = 1.4;
const BARK_CREVICE_SHADOW = 0.55;
const TUBE_LENGTH_UV_SPAN_TRUNK_WIDTHS = ${TUBE_LENGTH_UV_SPAN_TRUNK_WIDTHS.toFixed(1)};
const BARK_SOIL_CONTACT_METERS = 0.35;
const BARK_MOSS_REACH_METERS = 1.2;
const BARK_MOSS_PATCHES_PER_METER = 2.5;
const BARK_MOTTLING_PER_METER = 1.4;
const BARK_WET_DARKENING = 0.28;
const FOLIAGE_SHADOW_LIGHTWARD_OFFSET_METERS = 0.6;
const FOLIAGE_MIN_SUN_VISIBILITY = 0.22;
@group(0) @binding(1) var leafAtlasTex : texture_2d<f32>;
@group(0) @binding(2) var leafAtlasSampler : sampler;

struct TreeVertexIn {
  @location(0) anchor : vec3<f32>,
  @location(1) offset : vec3<f32>,
  @location(2) normalAndKind : vec4<f32>,
  @location(3) leafColorAndOcclusion : vec4<f32>,
  @location(4) bloomColor : vec4<f32>,
  @location(5) atlasUV : vec2<f32>,
  @location(6) basePositionAndYaw : vec4<f32>,
  @location(7) clearanceCrownTrunk : vec4<f32>,
  @location(8) leanLeafScaleSeed : vec4<f32>,
};

struct TreeVertexOut {
  @builtin(position) @invariant clipPos : vec4<f32>,
  @location(0) worldPos : vec3<f32>,
  @location(1) normal : vec3<f32>,
  @location(2) leafColor : vec3<f32>,
  @location(3) bloomColor : vec3<f32>,
  @location(4) atlasUV : vec2<f32>,
  @location(5) occlusionKindTint : vec3<f32>,
  @location(6) heightAboveGround : f32,
};

fn treeHeightAt(anchorY : f32, clearance : f32, crownHeight : f32) -> f32 {
  if (anchorY < 0.0) {
    return clearance * (1.0 + anchorY);
  }
  return clearance + anchorY * crownHeight;
}

fn rotateAroundY(v : vec3<f32>, yaw : f32) -> vec3<f32> {
  let c = cos(yaw);
  let s = sin(yaw);
  return vec3<f32>(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
}

fn barkMossCoverage(worldPos : vec3<f32>, heightAboveGround : f32, normal : vec3<f32>, toSun : vec3<f32>) -> f32 {
  let nearGround = 1.0 - smoothstep(0.05, BARK_MOSS_REACH_METERS, heightAboveGround);
  let patches = valueNoise(worldPos.xz * BARK_MOSS_PATCHES_PER_METER + vec2<f32>(worldPos.y * 1.7, 5.3));
  let shadedSide = 0.75 - 0.35 * dot(normalize(vec3<f32>(normal.x, 0.0, normal.z) + vec3<f32>(0.0001, 0.0, 0.0)), normalize(vec3<f32>(toSun.x, 0.0, toSun.z) + vec3<f32>(0.0001, 0.0, 0.0)));
  let rootTop = max(normal.y, 0.0) * 0.2;
  return clamp(nearGround * (patches * 0.75 - 0.05) * shadedSide + rootTop * nearGround * patches, 0.0, 1.0);
}

struct PlacedTreeVertex {
  world : vec3<f32>,
  normal : vec3<f32>,
};

struct TreeShadowVertexOut {
  @builtin(position) clipPos : vec4<f32>,
  @location(0) atlasUV : vec2<f32>,
  @location(1) kind : f32,
};

fn placeTreeVertex(in : TreeVertexIn, facingRight : vec3<f32>, facingUp : vec3<f32>) -> PlacedTreeVertex {
  let basePos = in.basePositionAndYaw.xyz;
  let yaw = in.basePositionAndYaw.w;
  let clearance = in.clearanceCrownTrunk.x;
  let crownHeight = in.clearanceCrownTrunk.y;
  let crownRadius = in.clearanceCrownTrunk.z;
  let trunkWidth = in.clearanceCrownTrunk.w;
  let lean = in.leanLeafScaleSeed.xy;
  let leafScale = in.leanLeafScaleSeed.z;
  let seed = in.leanLeafScaleSeed.w;
  let kind = in.normalAndKind.w;

  let height = treeHeightAt(in.anchor.y, clearance, crownHeight);
  var local = vec3<f32>(in.anchor.x * crownRadius, height, in.anchor.z * crownRadius);
  if (kind > 0.75) {
    local += in.offset * trunkWidth;
  }
  local = rotateAroundY(local, yaw);
  let totalHeight = clearance + crownHeight;
  let heightFraction = clamp(height / totalHeight, 0.0, 1.0);
  let leanWeight = smoothstep(0.0, clearance + crownHeight * 0.3, height);
  local.x += lean.x * leanWeight;
  local.z += lean.y * leanWeight;

  let t = u.camPosAndTime.w;
  let phase = seed * 6.2831 + basePos.x * 0.05 + basePos.z * 0.07;
  let gust = sin(t * 0.9 + phase) * 0.6 + sin(t * 2.1 + phase * 1.7) * 0.4;
  let sway = gust * 0.016 * totalHeight * heightFraction * heightFraction;
  local.x += sway * 0.8;
  local.z += sway * 0.6;

  var world = basePos + local;
  if (kind < 0.25) {
    let flutter = sin(t * 3.7 + dot(in.anchor, vec3<f32>(11.0, 7.0, 5.0)) + phase) * 0.035 * leafScale;
    var cardRight = facingRight;
    var cardUp = facingUp;
    if (kind < -0.5) {
      cardRight = normalize(vec3<f32>(cardRight.x, 0.0, cardRight.z) + vec3<f32>(0.0001, 0.0, 0.0));
      cardUp = vec3<f32>(0.0, 1.0, 0.0);
    }
    world += cardRight * (in.offset.x * leafScale + flutter) + cardUp * (in.offset.y * leafScale + flutter * 0.5);
  }

  var normal = rotateAroundY(in.normalAndKind.xyz, yaw);
  if (kind < 0.75) {
    let crownCenter = basePos + vec3<f32>(lean.x, clearance + crownHeight * 0.5, lean.y);
    let fromCenter = world - crownCenter;
    normal = normalize(vec3<f32>(fromCenter.x / crownRadius, fromCenter.y / max(crownHeight * 0.5, 0.5), fromCenter.z / crownRadius) + vec3<f32>(0.0, 0.15, 0.0));
  }
  return PlacedTreeVertex(world, normal);
}

fn sunFacingBasis() -> mat2x3<f32> {
  let towardSun = normalize(u.sunDirAndIntensity.xyz);
  let right = normalize(cross(vec3<f32>(0.0, 1.0, 0.0), towardSun) + vec3<f32>(0.0001, 0.0, 0.0));
  return mat2x3<f32>(right, cross(towardSun, right));
}

@vertex
fn vs_tree_shadow(in : TreeVertexIn) -> TreeShadowVertexOut {
  let sunBasis = sunFacingBasis();
  let placed = placeTreeVertex(in, sunBasis[0], sunBasis[1]);
  var out : TreeShadowVertexOut;
  out.clipPos = u.lightViewProj * vec4<f32>(placed.world, 1.0);
  out.atlasUV = in.atlasUV;
  out.kind = in.normalAndKind.w;
  return out;
}

@fragment
fn fs_tree_shadow(in : TreeShadowVertexOut) {
  let leafCoverage = textureSampleLevel(leafAtlasTex, leafAtlasSampler, in.atlasUV, 0.0).a;
  if (in.kind < 0.25 && leafCoverage < 0.5) {
    discard;
  }
}

@vertex
fn vs_tree(in : TreeVertexIn) -> TreeVertexOut {
  let basePos = in.basePositionAndYaw.xyz;
  let trunkWidth = in.clearanceCrownTrunk.w;
  let seed = in.leanLeafScaleSeed.w;
  let kind = in.normalAndKind.w;
  let placed = placeTreeVertex(in, u.camRightAndFov.xyz, u.camUp.xyz);
  let world = placed.world;

  var out : TreeVertexOut;
  out.clipPos = u.viewProj * vec4<f32>(world, 1.0);
  out.worldPos = world;
  out.normal = placed.normal;
  out.leafColor = in.leafColorAndOcclusion.rgb;
  out.bloomColor = in.bloomColor.rgb;
  let lengthAlongTube = in.atlasUV.y * TUBE_LENGTH_UV_SPAN_TRUNK_WIDTHS * trunkWidth;
  let perTreeBarkShift = vec2<f32>(fract(seed * 7.13), seed * 3.7);
  let barkUV = vec2<f32>(in.atlasUV.x * BARK_REPEATS_AROUND_TRUNK, (world.y - basePos.y + lengthAlongTube) / BARK_TILE_HEIGHT_METERS) + perTreeBarkShift;
  out.atlasUV = select(in.atlasUV, barkUV, kind > 0.75);
  out.occlusionKindTint = vec3<f32>(in.leafColorAndOcclusion.w, kind, 0.94 + seed * 0.12);
  out.heightAboveGround = world.y - basePos.y;
  return out;
}

@fragment
fn fs_tree_depth(in : TreeVertexOut) {
  let texel = textureSample(leafAtlasTex, leafAtlasSampler, in.atlasUV);
  if (in.occlusionKindTint.y < 0.25 && texel.a < 0.5) {
    discard;
  }
}

@fragment
fn fs_tree(in : TreeVertexOut) -> @location(0) vec4<f32> {
  let texel = textureSample(leafAtlasTex, leafAtlasSampler, in.atlasUV);
  let atlasUVDx = dpdx(in.atlasUV);
  let atlasUVDy = dpdy(in.atlasUV);
  let occlusion = in.occlusionKindTint.x;
  let kind = in.occlusionKindTint.y;
  let tint = in.occlusionKindTint.z;
  let isCard = kind < 0.25;
  if (isCard && texel.a < 0.5) {
    discard;
  }

  let N = normalize(in.normal);
  let L = normalize(u.sunDirAndIntensity.xyz);
  let V = normalize(u.camPosAndTime.xyz - in.worldPos);
  let H = normalize(L + V);
  let sunIntensity = u.sunDirAndIntensity.w;
  let sunColor = u.sunColorAndNight.rgb;
  let nightFactor = u.sunColorAndNight.w;
  let weatherWetness = clamp(u.skyTopColor.w, 0.0, 1.0);
  let ambient = ambientLight(N);
  let sunVisibility = sunShadowVisibility(in.worldPos + L * select(0.0, FOLIAGE_SHADOW_LIGHTWARD_OFFSET_METERS, kind < 0.75), N);
  let leafSunVisibility = mix(FOLIAGE_MIN_SUN_VISIBILITY, 1.0, sunVisibility);

  var albedo : vec3<f32>;
  var litColor : vec3<f32>;
  if (kind > 0.75) {
    let aroundTrunk = normalize(cross(vec3<f32>(0.0, 1.0, 0.0), N) + vec3<f32>(0.0001, 0.0, 0.0));
    let barkProjection = SurfaceProjection(in.atlasUV, atlasUVDx, atlasUVDy, aroundTrunk, cross(N, aroundTrunk));
    let barkDetail = sampleSurfaceDetail(SURFACE_LAYER_BARK, barkProjection);
    let barkNormal = perturbSurfaceNormal(N, barkProjection, barkDetail, BARK_RELIEF_STRENGTH);
    let mottling = 0.86 + valueNoise(in.worldPos.xz * BARK_MOTTLING_PER_METER + vec2<f32>(in.worldPos.y * 0.9, 0.0)) * 0.28;
    let barkColor = in.leafColor * barkDetail.albedoRatio * tint * mottling * (1.0 - weatherWetness * BARK_WET_DARKENING);
    let mossProjection = scaleProjection(barkProjection, BARK_TILE_HEIGHT_METERS / MOSS_TILE_METERS);
    let mossed = growMoss(barkColor, barkNormal, barkMossCoverage(in.worldPos, in.heightAboveGround, N, L), mossProjection);
    let soilContact = 1.0 - smoothstep(0.0, BARK_SOIL_CONTACT_METERS, in.heightAboveGround);
    albedo = mix(mossed.color, mossed.color * vec3<f32>(0.70, 0.62, 0.54), soilContact * 0.45);
    let groundOcclusion = 0.72 + 0.28 * smoothstep(-0.05, 0.6, in.heightAboveGround);
    let creviceShadow = 1.0 - barkDetail.crevice * BARK_CREVICE_SHADOW * (1.0 - mossed.amount);
    let ndotl = max(dot(mossed.normal, L), 0.0);
    litColor = albedo * (ambient * occlusion * groundOcclusion * 1.1 * creviceShadow + sunColor * ndotl * sunIntensity * 0.85 * groundOcclusion * sunVisibility);
  } else {
    var shade = 0.55 + valueNoise(in.worldPos.xz * 2.6 + vec2<f32>(in.worldPos.y * 1.3, 0.0)) * 0.22;
    var bloomMix = 0.0;
    if (isCard) {
      shade = 0.58 + texel.r * 0.62;
      bloomMix = texel.g;
    }
    albedo = mix(in.leafColor, in.bloomColor, bloomMix) * shade * tint;
    let wrapped = clamp(dot(N, L) * 0.6 + 0.4, 0.0, 1.0);
    let backlight = pow(clamp(dot(-V, L), 0.0, 1.0), 4.0) * (1.0 - bloomMix * 0.5);
    let translucency = sunColor * vec3<f32>(1.0, 1.04, 0.72) * backlight * 0.55 * (1.3 - occlusion * 0.6);
    let sheen = pow(max(dot(N, H), 0.0), 20.0) * (0.05 + weatherWetness * 0.12);
    litColor = albedo * (ambient * occlusion * 1.1 + (sunColor * wrapped * wrapped * sunIntensity * 0.9 + translucency * sunIntensity) * leafSunVisibility) + sunColor * sheen * sunIntensity * leafSunVisibility;
  }

  let streetLampActive = clamp(nightFactor * 1.15 + weatherWetness * 0.35, 0.0, 1.0);
  let heightAboveStreet = max(in.worldPos.y - u.carPosAndHeading.y, 0.0);
  if (streetLampActive > 0.05 && heightAboveStreet < 12.0) {
    let lampPool = streetLampPoolStrength(in.worldPos.xz);
    litColor += albedo * vec3<f32>(1.0, 0.80, 0.46) * exp(-heightAboveStreet * 0.16) * (0.5 + 0.5 * lampPool) * streetLampActive * 0.85;
  }

  return vec4<f32>(max(litColor, vec3<f32>(0.0)), 1.0);
}
`;

const TREE_VERTEX_BUFFER_LAYOUT = {
  arrayStride: TREE_VERTEX_BYTES,
  stepMode: "vertex",
  attributes: [
    { shaderLocation: 0, offset: 0, format: "float32x3" },
    { shaderLocation: 1, offset: 12, format: "float32x3" },
    { shaderLocation: 2, offset: 24, format: "snorm8x4" },
    { shaderLocation: 3, offset: 28, format: "unorm8x4" },
    { shaderLocation: 4, offset: 32, format: "unorm8x4" },
    { shaderLocation: 5, offset: 36, format: "unorm16x2" }
  ]
};

const TREE_INSTANCE_BUFFER_LAYOUT = {
  arrayStride: TREE_INSTANCE_BYTES,
  stepMode: "instance",
  attributes: [
    { shaderLocation: 6, offset: 0, format: "float32x4" },
    { shaderLocation: 7, offset: 16, format: "float32x4" },
    { shaderLocation: 8, offset: 32, format: "float32x4" }
  ]
};

class TreeMeshBuilder {
  constructor() {
    this.vertices = [];
    this.indices = [];
  }

  addTube(points, { sides, color, occlusion }) {
    const lengthsAlongShift = cumulativeHorizontalShiftLengths(points);
    const ringStarts = points.map((point, pointIndex) => {
      const previous = points[Math.max(0, pointIndex - 1)];
      const next = points[Math.min(points.length - 1, pointIndex + 1)];
      const axis = tubeAxisAt(previous, next);
      const [sideA, sideB] = perpendicularBasis(axis);
      const ringPosition = angle => ringPointAt(point, sideA, sideB, angle);
      const ringStart = this.vertices.length;
      for (let side = 0; side <= sides; side++) {
        const angle = (side / sides) * Math.PI * 2;
        const position = ringPosition(angle);
        this.vertices.push({
          anchor: point.anchor,
          offset: addVectors(point.shift ?? ZERO_VECTOR, position),
          normal: ringSurfaceNormal(ringPosition, angle, axis),
          kind: TREE_VERTEX_KIND.bark,
          leafColor: color,
          bloomColor: color,
          occlusion: point.anchor[1] > 0 ? occlusion * 0.75 : occlusion,
          uv: [side / sides, lengthsAlongShift[pointIndex] / TUBE_LENGTH_UV_SPAN_TRUNK_WIDTHS]
        });
      }
      return ringStart;
    });
    for (let ring = 0; ring < ringStarts.length - 1; ring++) {
      for (let side = 0; side < sides; side++) {
        const nextSide = side + 1;
        const lowerA = ringStarts[ring] + side, lowerB = ringStarts[ring] + nextSide;
        const upperA = ringStarts[ring + 1] + side, upperB = ringStarts[ring + 1] + nextSide;
        this.indices.push(lowerA, lowerB, upperB, lowerA, upperB, upperA);
      }
    }
  }

  addCard({ anchor, halfWidth, halfHeight, kind, leafColor, bloomColor, occlusion, atlasCell, isMirrored }) {
    const cellColumn = atlasCell % 2;
    const cellRow = Math.floor(atlasCell / 2);
    const cellFraction = LEAF_ATLAS_CELL_SIZE / LEAF_ATLAS_SIZE;
    const leftU = (cellColumn + (isMirrored ? 1 : 0)) * cellFraction;
    const rightU = (cellColumn + (isMirrored ? 0 : 1)) * cellFraction;
    const topV = cellRow * cellFraction;
    const bottomV = (cellRow + 1) * cellFraction;
    const corners = [
      { offset: [-halfWidth, -halfHeight, 0], uv: [leftU, bottomV] },
      { offset: [halfWidth, -halfHeight, 0], uv: [rightU, bottomV] },
      { offset: [halfWidth, halfHeight, 0], uv: [rightU, topV] },
      { offset: [-halfWidth, halfHeight, 0], uv: [leftU, topV] }
    ];
    const firstCorner = this.vertices.length;
    for (const corner of corners) {
      this.vertices.push({ anchor, offset: corner.offset, normal: [0, 1, 0], kind, leafColor, bloomColor, occlusion, uv: corner.uv });
    }
    this.indices.push(firstCorner, firstCorner + 1, firstCorner + 2, firstCorner, firstCorner + 2, firstCorner + 3);
  }

  addFoliageCore({ center, radiusX, radiusY, slices, stacks, color, occlusion, isCone = false }) {
    const ringStarts = [];
    for (let stack = 0; stack <= stacks; stack++) {
      const stackFraction = stack / stacks;
      const latitude = -Math.PI * 0.5 + stackFraction * Math.PI;
      const ringScale = isCone ? 1.0 - stackFraction : Math.cos(latitude);
      const ringHeight = isCone ? stackFraction * 2.0 - 1.0 : Math.sin(latitude);
      ringStarts.push(this.vertices.length);
      for (let slice = 0; slice < slices; slice++) {
        const angle = (slice / slices) * Math.PI * 2;
        this.vertices.push({
          anchor: [center[0] + Math.cos(angle) * ringScale * radiusX, center[1] + ringHeight * radiusY, center[2] + Math.sin(angle) * ringScale * radiusX],
          offset: [0, 0, 0],
          normal: [0, 1, 0],
          kind: TREE_VERTEX_KIND.foliageCore,
          leafColor: color,
          bloomColor: color,
          occlusion: occlusion * (0.8 + stackFraction * 0.35),
          uv: [0, 0]
        });
      }
    }
    for (let stack = 0; stack < stacks; stack++) {
      for (let slice = 0; slice < slices; slice++) {
        const nextSlice = (slice + 1) % slices;
        const lowerA = ringStarts[stack] + slice, lowerB = ringStarts[stack] + nextSlice;
        const upperA = ringStarts[stack + 1] + slice, upperB = ringStarts[stack + 1] + nextSlice;
        this.indices.push(lowerA, upperB, lowerB, lowerA, upperA, upperB);
      }
    }
  }

  build() {
    const vertexData = new ArrayBuffer(this.vertices.length * TREE_VERTEX_BYTES);
    const view = new DataView(vertexData);
    this.vertices.forEach((vertex, vertexIndex) => writeTreeVertex(view, vertexIndex * TREE_VERTEX_BYTES, vertex));
    return { vertexData, indices: new Uint16Array(this.indices) };
  }
}

class TreeInstanceField {
  constructor(slotCount) {
    this.slotTrees = new Array(slotCount).fill(null);
    this.staging = new Float32Array(MAX_TREE_INSTANCES * TREE_INSTANCE_FLOATS);
    this.speciesCount = 0;
  }

  setSpeciesCount(speciesCount) {
    this.speciesCount = speciesCount;
  }

  setSlotTrees(slot, trees) {
    this.slotTrees[slot] = trees.length ? trees : null;
  }

  clearSlot(slot) {
    this.slotTrees[slot] = null;
  }

  buildBatches(view) {
    const bucketCount = this.speciesCount * TREE_LOD_COUNT;
    const bucketSizes = new Uint32Array(bucketCount);
    const accepted = [];
    for (const trees of this.slotTrees) {
      if (!trees) continue;
      for (const tree of trees) {
        const lod = chooseTreeLod(tree.values, view);
        if (lod < 0 || accepted.length >= MAX_TREE_INSTANCES) continue;
        const bucket = lod * this.speciesCount + tree.speciesIndex;
        bucketSizes[bucket]++;
        accepted.push(bucket, tree);
      }
    }
    const bucketCursor = new Uint32Array(bucketCount);
    const batches = [];
    let firstInstance = 0;
    for (let bucket = 0; bucket < bucketCount; bucket++) {
      bucketCursor[bucket] = firstInstance;
      if (bucketSizes[bucket] === 0) continue;
      batches.push({ lod: Math.floor(bucket / this.speciesCount), speciesIndex: bucket % this.speciesCount, firstInstance, instanceCount: bucketSizes[bucket] });
      firstInstance += bucketSizes[bucket];
    }
    for (let entry = 0; entry < accepted.length; entry += 2) {
      const bucket = accepted[entry];
      this.staging.set(accepted[entry + 1].values, bucketCursor[bucket]++ * TREE_INSTANCE_FLOATS);
    }
    return { batches, instanceCount: firstInstance };
  }
}

function chooseTreeLod(values, view) {
  const toTreeX = values[0] - view.x;
  const toTreeY = values[1] + values[4] - view.y;
  const toTreeZ = values[2] - view.z;
  const crownReach = values[6] + values[5] + TREE_CULL_MARGIN_METERS;
  const forwardDistance = toTreeX * view.forwardX + toTreeY * view.forwardY + toTreeZ * view.forwardZ;
  if (forwardDistance < -crownReach) return -1;
  const distance = Math.hypot(toTreeX, toTreeY, toTreeZ);
  const lateralDistance = Math.sqrt(Math.max(0, distance * distance - forwardDistance * forwardDistance));
  if (lateralDistance > Math.max(forwardDistance, 0) * view.tanHalfDiagonal + crownReach) return -1;
  const distanceLod = chooseDistanceLod(distance);
  const isSweepingPast = view.carSpeed * lateralDistance / Math.max(distance * distance, 1) > TREE_SMEAR_ANGULAR_SPEED_RADIANS_PER_SECOND;
  return isSweepingPast ? Math.min(distanceLod + 1, TREE_LOD_COUNT - 1) : distanceLod;
}

function chooseDistanceLod(distance) {
  for (let lod = 0; lod < TREE_LOD_COUNT; lod++) {
    if (distance < TREE_LOD_FAR_LIMITS_METERS[lod]) return lod;
  }
  return TREE_LOD_COUNT - 1;
}

function generateLeafAtlasMipChain() {
  const baseLevel = createEmptyLeafAtlas(LEAF_ATLAS_SIZE);
  const rng = makeRng(4242);
  paintBroadleafCell(baseLevel, cellOrigin(LEAF_ATLAS_CELL.broadleaf), rng);
  paintFineLeafCell(baseLevel, cellOrigin(LEAF_ATLAS_CELL.fineLeaf), rng);
  paintBlossomCell(baseLevel, cellOrigin(LEAF_ATLAS_CELL.blossom), rng);
  paintNeedleCell(baseLevel, cellOrigin(LEAF_ATLAS_CELL.needle), rng);
  const levels = [baseLevel];
  while (levels[levels.length - 1].size > 1) levels.push(downsampleLeafAtlas(levels[levels.length - 1]));
  return levels;
}

function createEmptyLeafAtlas(size) {
  const data = new Uint8Array(size * size * 4);
  for (let pixel = 0; pixel < size * size; pixel++) data[pixel * 4] = LEAF_ATLAS_EMPTY_SHADE;
  return { size, data };
}

function cellOrigin(cellIndex) {
  return { x: (cellIndex % 2) * LEAF_ATLAS_CELL_SIZE, y: Math.floor(cellIndex / 2) * LEAF_ATLAS_CELL_SIZE };
}

function randomPointInCluster(rng, clusterRadius) {
  const angle = rng() * Math.PI * 2;
  const distance = Math.pow(rng(), 0.7) * clusterRadius;
  return { offsetX: Math.cos(angle) * distance, offsetY: Math.sin(angle) * distance, angle };
}

function paintBroadleafCell(atlas, origin, rng) {
  const center = LEAF_ATLAS_CELL_SIZE * 0.5;
  for (let twig = 0; twig < 6; twig++) {
    const angle = (twig / 6) * Math.PI * 2 + rng() * 0.5;
    stampStroke(atlas, origin, { fromX: center, fromY: center + 20, toX: center + Math.cos(angle) * 90, toY: center + Math.sin(angle) * 90, thickness: 2.2, shade: 0.22, bloom: 0 });
  }
  for (let leaf = 0; leaf < 70; leaf++) {
    const { offsetX, offsetY, angle } = randomPointInCluster(rng, 100);
    stampLeaf(atlas, origin, {
      centerX: center + offsetX, centerY: center + offsetY,
      halfLength: 15 + rng() * 9, halfWidth: 7 + rng() * 4,
      angle: angle + (rng() - 0.5) * 1.2,
      shade: 0.5 + rng() * 0.45 + (1 - (center + offsetY) / LEAF_ATLAS_CELL_SIZE) * 0.15, bloom: 0
    });
  }
}

function paintFineLeafCell(atlas, origin, rng) {
  const center = LEAF_ATLAS_CELL_SIZE * 0.5;
  for (let stem = 0; stem < 9; stem++) {
    const angle = (stem / 9) * Math.PI * 2 + rng() * 0.4;
    stampStroke(atlas, origin, { fromX: center, fromY: center, toX: center + Math.cos(angle) * 105, toY: center + Math.sin(angle) * 105, thickness: 1.4, shade: 0.3, bloom: 0 });
  }
  for (let leaflet = 0; leaflet < 260; leaflet++) {
    const { offsetX, offsetY, angle } = randomPointInCluster(rng, 108);
    stampLeaf(atlas, origin, {
      centerX: center + offsetX, centerY: center + offsetY,
      halfLength: 7 + rng() * 4, halfWidth: 2.6 + rng() * 1.2,
      angle: angle + Math.PI * 0.5 + (rng() - 0.5) * 0.8,
      shade: 0.5 + rng() * 0.5, bloom: 0
    });
  }
}

function paintBlossomCell(atlas, origin, rng) {
  const center = LEAF_ATLAS_CELL_SIZE * 0.5;
  for (let leaf = 0; leaf < 26; leaf++) {
    const { offsetX, offsetY, angle } = randomPointInCluster(rng, 100);
    stampLeaf(atlas, origin, { centerX: center + offsetX, centerY: center + offsetY, halfLength: 13 + rng() * 6, halfWidth: 6 + rng() * 3, angle, shade: 0.45 + rng() * 0.4, bloom: 0 });
  }
  for (let flower = 0; flower < 42; flower++) {
    const { offsetX, offsetY } = randomPointInCluster(rng, 96);
    const flowerX = center + offsetX;
    const flowerY = center + offsetY;
    const petalTurn = rng() * Math.PI;
    for (let petal = 0; petal < 5; petal++) {
      const petalAngle = petalTurn + (petal / 5) * Math.PI * 2;
      stampLeaf(atlas, origin, {
        centerX: flowerX + Math.cos(petalAngle) * 5.5, centerY: flowerY + Math.sin(petalAngle) * 5.5,
        halfLength: 6.5, halfWidth: 4.8, angle: petalAngle, shade: 0.75 + rng() * 0.25, bloom: 1
      });
    }
    stampLeaf(atlas, origin, { centerX: flowerX, centerY: flowerY, halfLength: 2.4, halfWidth: 2.4, angle: 0, shade: 0.95, bloom: 0.35 });
  }
}

function paintNeedleCell(atlas, origin, rng) {
  const center = LEAF_ATLAS_CELL_SIZE * 0.5;
  for (let branchlet = 0; branchlet < 10; branchlet++) {
    const angle = (branchlet / 10) * Math.PI * 2 + rng() * 0.3;
    const length = 80 + rng() * 30;
    stampStroke(atlas, origin, { fromX: center, fromY: center, toX: center + Math.cos(angle) * length, toY: center + Math.sin(angle) * length, thickness: 2.0, shade: 0.25, bloom: 0 });
    for (let step = 6; step < length; step += 3) {
      const baseX = center + Math.cos(angle) * step;
      const baseY = center + Math.sin(angle) * step;
      for (const needleSide of [-1, 1]) {
        const needleAngle = angle + needleSide * (0.75 + rng() * 0.3);
        const needleLength = 9 + rng() * 5;
        stampStroke(atlas, origin, { fromX: baseX, fromY: baseY, toX: baseX + Math.cos(needleAngle) * needleLength, toY: baseY + Math.sin(needleAngle) * needleLength, thickness: 1.3, shade: 0.45 + rng() * 0.5, bloom: 0 });
      }
    }
  }
}

function stampLeaf(atlas, origin, { centerX, centerY, halfLength, halfWidth, angle, shade, bloom }) {
  const alongX = Math.cos(angle), alongY = Math.sin(angle);
  const reach = Math.ceil(halfLength);
  forEachCellPixel(atlas, origin, centerX, centerY, reach, (pixelX, pixelY) => {
    const deltaX = pixelX - centerX, deltaY = pixelY - centerY;
    const along = (deltaX * alongX + deltaY * alongY) / halfLength;
    const across = (-deltaX * alongY + deltaY * alongX) / halfWidth;
    const lengthFalloff = 1 - along * along;
    if (lengthFalloff <= 0) return null;
    const profile = Math.pow(lengthFalloff, 1.3);
    if (across * across > profile) return null;
    const midribDarkening = Math.abs(across) < 0.12 ? 0.82 : 1.0;
    const edgeLift = 0.82 + 0.18 * (1 - Math.abs(across));
    return { shade: shade * edgeLift * midribDarkening + along * 0.06, bloom };
  });
}

function stampStroke(atlas, origin, { fromX, fromY, toX, toY, thickness, shade, bloom }) {
  const length = Math.hypot(toX - fromX, toY - fromY) || 1;
  const steps = Math.ceil(length);
  const radius = thickness * 0.5;
  for (let step = 0; step <= steps; step++) {
    const fraction = step / steps;
    const pointX = fromX + (toX - fromX) * fraction;
    const pointY = fromY + (toY - fromY) * fraction;
    forEachCellPixel(atlas, origin, pointX, pointY, Math.ceil(radius), (pixelX, pixelY) => {
      return Math.hypot(pixelX - pointX, pixelY - pointY) <= radius ? { shade, bloom } : null;
    });
  }
}

function forEachCellPixel(atlas, origin, centerX, centerY, reach, shadePixel) {
  const minX = Math.max(0, Math.floor(centerX - reach)), maxX = Math.min(LEAF_ATLAS_CELL_SIZE - 1, Math.ceil(centerX + reach));
  const minY = Math.max(0, Math.floor(centerY - reach)), maxY = Math.min(LEAF_ATLAS_CELL_SIZE - 1, Math.ceil(centerY + reach));
  for (let pixelY = minY; pixelY <= maxY; pixelY++) {
    for (let pixelX = minX; pixelX <= maxX; pixelX++) {
      const result = shadePixel(pixelX + 0.5, pixelY + 0.5);
      if (!result) continue;
      const index = ((origin.y + pixelY) * atlas.size + origin.x + pixelX) * 4;
      atlas.data[index] = Math.round(Math.min(1, Math.max(0, result.shade)) * 255);
      atlas.data[index + 1] = Math.round(result.bloom * 255);
      atlas.data[index + 3] = 255;
    }
  }
}

function downsampleLeafAtlas(level) {
  const size = level.size >> 1;
  const data = new Uint8Array(size * size * 4);
  for (let pixelY = 0; pixelY < size; pixelY++) {
    for (let pixelX = 0; pixelX < size; pixelX++) {
      let shadeSum = 0, bloomSum = 0, alphaSum = 0;
      for (let sample = 0; sample < 4; sample++) {
        const sourceIndex = (((pixelY * 2 + (sample >> 1)) * level.size) + pixelX * 2 + (sample & 1)) * 4;
        const alpha = level.data[sourceIndex + 3];
        shadeSum += level.data[sourceIndex] * (alpha + 1);
        bloomSum += level.data[sourceIndex + 1] * (alpha + 1);
        alphaSum += alpha;
      }
      const weight = alphaSum + 4;
      const targetIndex = (pixelY * size + pixelX) * 4;
      data[targetIndex] = Math.round(shadeSum / weight);
      data[targetIndex + 1] = Math.round(bloomSum / weight);
      data[targetIndex + 3] = Math.min(255, Math.round((alphaSum / 4) * 1.22));
    }
  }
  return { size, data };
}

function writeTreeVertex(view, byteOffset, vertex) {
  for (let axis = 0; axis < 3; axis++) {
    view.setFloat32(byteOffset + axis * 4, vertex.anchor[axis], true);
    view.setFloat32(byteOffset + 12 + axis * 4, vertex.offset[axis], true);
  }
  const normal = normalizeVector(vertex.normal);
  for (let axis = 0; axis < 3; axis++) view.setInt8(byteOffset + 24 + axis, Math.round(normal[axis] * 127));
  view.setInt8(byteOffset + 27, Math.round(vertex.kind * 127));
  for (let channel = 0; channel < 3; channel++) {
    view.setUint8(byteOffset + 28 + channel, toUnorm8(vertex.leafColor[channel]));
    view.setUint8(byteOffset + 32 + channel, toUnorm8(vertex.bloomColor[channel]));
  }
  view.setUint8(byteOffset + 31, toUnorm8(vertex.occlusion));
  view.setUint8(byteOffset + 35, 255);
  view.setUint16(byteOffset + 36, Math.round(clamp(vertex.uv[0], 0, 1) * 65535), true);
  view.setUint16(byteOffset + 38, Math.round(clamp(vertex.uv[1], 0, 1) * 65535), true);
}

function toUnorm8(value) {
  return Math.round(clamp(value, 0, 1) * 255);
}

function perpendicularBasis(direction) {
  const axis = normalizeVector(direction);
  const helper = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const sideA = normalizeVector(crossVectors(axis, helper));
  const sideB = crossVectors(axis, sideA);
  return [sideA, sideB];
}

function tubeAxisAt(previous, next) {
  const anchorStep = subtractVectors(next.anchor, previous.anchor);
  if (Math.hypot(...anchorStep) > 0) return anchorStep;
  return subtractVectors(next.shift ?? ZERO_VECTOR, previous.shift ?? ZERO_VECTOR);
}

function ringPointAt(point, sideA, sideB, angle) {
  const direction = addVectors(scaleVector(sideA, Math.cos(angle)), scaleVector(sideB, Math.sin(angle)));
  const radiusScale = point.radiusScaleAt ? point.radiusScaleAt(Math.atan2(direction[2], direction[0])) : 1;
  return scaleVector(direction, point.radius * radiusScale);
}

function ringSurfaceNormal(ringPosition, angle, axis) {
  const alongRing = subtractVectors(ringPosition(angle + RING_NORMAL_ANGLE_STEP), ringPosition(angle - RING_NORMAL_ANGLE_STEP));
  const outward = crossVectors(alongRing, normalizeVector(axis));
  const radial = ringPosition(angle);
  const pointsOutward = outward[0] * radial[0] + outward[1] * radial[1] + outward[2] * radial[2] >= 0;
  return pointsOutward ? outward : scaleVector(outward, -1);
}

function cumulativeHorizontalShiftLengths(points) {
  let total = 0;
  return points.map((point, pointIndex) => {
    if (pointIndex > 0) {
      const previous = points[pointIndex - 1].shift ?? ZERO_VECTOR;
      const current = point.shift ?? ZERO_VECTOR;
      total += Math.hypot(current[0] - previous[0], current[2] - previous[2]);
    }
    return total;
  });
}

function addVectors(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function subtractVectors(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function scaleVector(v, factor) { return [v[0] * factor, v[1] * factor, v[2] * factor]; }
function crossVectors(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function normalizeVector(v) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}
