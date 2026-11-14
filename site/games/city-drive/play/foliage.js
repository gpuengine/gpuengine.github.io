// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar
const TREE_VERTEX_BYTES=40,TREE_INSTANCE_FLOATS=12,TREE_INSTANCE_BYTES=48,MAX_TREE_INSTANCES=4096,TREE_LOD_FAR_LIMITS_METERS=[45,130,1/0],TREE_LOD_COUNT=TREE_LOD_FAR_LIMITS_METERS.length,TREE_CULL_MARGIN_METERS=12,TREE_SMEAR_ANGULAR_SPEED_RADIANS_PER_SECOND=1.5,LEAF_ATLAS_SIZE=512,LEAF_ATLAS_CELL_SIZE=256,LEAF_ATLAS_CELL=Object.freeze({broadleaf:0,fineLeaf:1,blossom:2,needle:3}),LEAF_ATLAS_EMPTY_SHADE=150,TREE_VERTEX_KIND=Object.freeze({bark:1,foliageCore:.5,facingCard:0,uprightCard:-1}),TUBE_LENGTH_UV_SPAN_TRUNK_WIDTHS=4,RING_NORMAL_ANGLE_STEP=.01,ZERO_VECTOR=Object.freeze([0,0,0]),FOLIAGE_WGSL_CODE=`
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
`,TREE_VERTEX_BUFFER_LAYOUT={arrayStride:40,stepMode:"vertex",attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"snorm8x4"},{shaderLocation:3,offset:28,format:"unorm8x4"},{shaderLocation:4,offset:32,format:"unorm8x4"},{shaderLocation:5,offset:36,format:"unorm16x2"}]},TREE_INSTANCE_BUFFER_LAYOUT={arrayStride:48,stepMode:"instance",attributes:[{shaderLocation:6,offset:0,format:"float32x4"},{shaderLocation:7,offset:16,format:"float32x4"},{shaderLocation:8,offset:32,format:"float32x4"}]};class TreeMeshBuilder{constructor(){this.vertices=[],this.indices=[]}addTube(t,{sides:o,color:a,occlusion:n}){const r=cumulativeHorizontalShiftLengths(t),i=t.map((s,l)=>{const h=t[Math.max(0,l-1)],c=t[Math.min(t.length-1,l+1)],f=tubeAxisAt(h,c),[u,d]=perpendicularBasis(f),E=m=>ringPointAt(s,u,d,m),T=this.vertices.length;for(let m=0;m<=o;m++){const A=m/o*Math.PI*2,S=E(A);this.vertices.push({anchor:s.anchor,offset:addVectors(s.shift??ZERO_VECTOR,S),normal:ringSurfaceNormal(E,A,f),kind:TREE_VERTEX_KIND.bark,leafColor:a,bloomColor:a,occlusion:s.anchor[1]>0?n*.75:n,uv:[m/o,r[l]/TUBE_LENGTH_UV_SPAN_TRUNK_WIDTHS]})}return T});for(let s=0;s<i.length-1;s++)for(let l=0;l<o;l++){const h=l+1,c=i[s]+l,f=i[s]+h,u=i[s+1]+l,d=i[s+1]+h;this.indices.push(c,f,d,c,d,u)}}addCard({anchor:t,halfWidth:o,halfHeight:a,kind:n,leafColor:r,bloomColor:i,occlusion:s,atlasCell:l,isMirrored:h}){const c=l%2,f=Math.floor(l/2),u=LEAF_ATLAS_CELL_SIZE/LEAF_ATLAS_SIZE,d=(c+(h?1:0))*u,E=(c+(h?0:1))*u,T=f*u,m=(f+1)*u,A=[{offset:[-o,-a,0],uv:[d,m]},{offset:[o,-a,0],uv:[E,m]},{offset:[o,a,0],uv:[E,T]},{offset:[-o,a,0],uv:[d,T]}],S=this.vertices.length;for(const _ of A)this.vertices.push({anchor:t,offset:_.offset,normal:[0,1,0],kind:n,leafColor:r,bloomColor:i,occlusion:s,uv:_.uv});this.indices.push(S,S+1,S+2,S,S+2,S+3)}addFoliageCore({center:t,radiusX:o,radiusY:a,slices:n,stacks:r,color:i,occlusion:s,isCone:l=!1}){const h=[];for(let c=0;c<=r;c++){const f=c/r,u=-Math.PI*.5+f*Math.PI,d=l?1-f:Math.cos(u),E=l?f*2-1:Math.sin(u);h.push(this.vertices.length);for(let T=0;T<n;T++){const m=T/n*Math.PI*2;this.vertices.push({anchor:[t[0]+Math.cos(m)*d*o,t[1]+E*a,t[2]+Math.sin(m)*d*o],offset:[0,0,0],normal:[0,1,0],kind:TREE_VERTEX_KIND.foliageCore,leafColor:i,bloomColor:i,occlusion:s*(.8+f*.35),uv:[0,0]})}}for(let c=0;c<r;c++)for(let f=0;f<n;f++){const u=(f+1)%n,d=h[c]+f,E=h[c]+u,T=h[c+1]+f,m=h[c+1]+u;this.indices.push(d,m,E,d,T,m)}}build(){const t=new ArrayBuffer(this.vertices.length*40),o=new DataView(t);return this.vertices.forEach((a,n)=>writeTreeVertex(o,n*40,a)),{vertexData:t,indices:new Uint16Array(this.indices)}}}class TreeInstanceField{constructor(t){this.slotTrees=new Array(t).fill(null),this.staging=new Float32Array(4096*12),this.speciesCount=0}setSpeciesCount(t){this.speciesCount=t}setSlotTrees(t,o){this.slotTrees[t]=o.length?o:null}clearSlot(t){this.slotTrees[t]=null}buildBatches(t){const o=this.speciesCount*TREE_LOD_COUNT,a=new Uint32Array(o),n=[];for(const l of this.slotTrees)if(l)for(const h of l){const c=chooseTreeLod(h.values,t);if(c<0||n.length>=4096)continue;const f=c*this.speciesCount+h.speciesIndex;a[f]++,n.push(f,h)}const r=new Uint32Array(o),i=[];let s=0;for(let l=0;l<o;l++)r[l]=s,a[l]!==0&&(i.push({lod:Math.floor(l/this.speciesCount),speciesIndex:l%this.speciesCount,firstInstance:s,instanceCount:a[l]}),s+=a[l]);for(let l=0;l<n.length;l+=2){const h=n[l];this.staging.set(n[l+1].values,r[h]++*12)}return{batches:i,instanceCount:s}}}function chooseTreeLod(e,t){const o=e[0]-t.x,a=e[1]+e[4]-t.y,n=e[2]-t.z,r=e[6]+e[5]+TREE_CULL_MARGIN_METERS,i=o*t.forwardX+a*t.forwardY+n*t.forwardZ;if(i<-r)return-1;const s=Math.hypot(o,a,n),l=Math.sqrt(Math.max(0,s*s-i*i));if(l>Math.max(i,0)*t.tanHalfDiagonal+r)return-1;const h=chooseDistanceLod(s);return t.carSpeed*l/Math.max(s*s,1)>TREE_SMEAR_ANGULAR_SPEED_RADIANS_PER_SECOND?Math.min(h+1,TREE_LOD_COUNT-1):h}function chooseDistanceLod(e){for(let t=0;t<TREE_LOD_COUNT;t++)if(e<TREE_LOD_FAR_LIMITS_METERS[t])return t;return TREE_LOD_COUNT-1}function generateLeafAtlasMipChain(){const e=createEmptyLeafAtlas(LEAF_ATLAS_SIZE),t=makeRng(4242);paintBroadleafCell(e,cellOrigin(LEAF_ATLAS_CELL.broadleaf),t),paintFineLeafCell(e,cellOrigin(LEAF_ATLAS_CELL.fineLeaf),t),paintBlossomCell(e,cellOrigin(LEAF_ATLAS_CELL.blossom),t),paintNeedleCell(e,cellOrigin(LEAF_ATLAS_CELL.needle),t);const o=[e];for(;o[o.length-1].size>1;)o.push(downsampleLeafAtlas(o[o.length-1]));return o}function createEmptyLeafAtlas(e){const t=new Uint8Array(e*e*4);for(let o=0;o<e*e;o++)t[o*4]=LEAF_ATLAS_EMPTY_SHADE;return{size:e,data:t}}function cellOrigin(e){return{x:e%2*LEAF_ATLAS_CELL_SIZE,y:Math.floor(e/2)*LEAF_ATLAS_CELL_SIZE}}function randomPointInCluster(e,t){const o=e()*Math.PI*2,a=Math.pow(e(),.7)*t;return{offsetX:Math.cos(o)*a,offsetY:Math.sin(o)*a,angle:o}}function paintBroadleafCell(e,t,o){const a=LEAF_ATLAS_CELL_SIZE*.5;for(let n=0;n<6;n++){const r=n/6*Math.PI*2+o()*.5;stampStroke(e,t,{fromX:a,fromY:a+20,toX:a+Math.cos(r)*90,toY:a+Math.sin(r)*90,thickness:2.2,shade:.22,bloom:0})}for(let n=0;n<70;n++){const{offsetX:r,offsetY:i,angle:s}=randomPointInCluster(o,100);stampLeaf(e,t,{centerX:a+r,centerY:a+i,halfLength:15+o()*9,halfWidth:7+o()*4,angle:s+(o()-.5)*1.2,shade:.5+o()*.45+(1-(a+i)/LEAF_ATLAS_CELL_SIZE)*.15,bloom:0})}}function paintFineLeafCell(e,t,o){const a=LEAF_ATLAS_CELL_SIZE*.5;for(let n=0;n<9;n++){const r=n/9*Math.PI*2+o()*.4;stampStroke(e,t,{fromX:a,fromY:a,toX:a+Math.cos(r)*105,toY:a+Math.sin(r)*105,thickness:1.4,shade:.3,bloom:0})}for(let n=0;n<260;n++){const{offsetX:r,offsetY:i,angle:s}=randomPointInCluster(o,108);stampLeaf(e,t,{centerX:a+r,centerY:a+i,halfLength:7+o()*4,halfWidth:2.6+o()*1.2,angle:s+Math.PI*.5+(o()-.5)*.8,shade:.5+o()*.5,bloom:0})}}function paintBlossomCell(e,t,o){const a=LEAF_ATLAS_CELL_SIZE*.5;for(let n=0;n<26;n++){const{offsetX:r,offsetY:i,angle:s}=randomPointInCluster(o,100);stampLeaf(e,t,{centerX:a+r,centerY:a+i,halfLength:13+o()*6,halfWidth:6+o()*3,angle:s,shade:.45+o()*.4,bloom:0})}for(let n=0;n<42;n++){const{offsetX:r,offsetY:i}=randomPointInCluster(o,96),s=a+r,l=a+i,h=o()*Math.PI;for(let c=0;c<5;c++){const f=h+c/5*Math.PI*2;stampLeaf(e,t,{centerX:s+Math.cos(f)*5.5,centerY:l+Math.sin(f)*5.5,halfLength:6.5,halfWidth:4.8,angle:f,shade:.75+o()*.25,bloom:1})}stampLeaf(e,t,{centerX:s,centerY:l,halfLength:2.4,halfWidth:2.4,angle:0,shade:.95,bloom:.35})}}function paintNeedleCell(e,t,o){const a=LEAF_ATLAS_CELL_SIZE*.5;for(let n=0;n<10;n++){const r=n/10*Math.PI*2+o()*.3,i=80+o()*30;stampStroke(e,t,{fromX:a,fromY:a,toX:a+Math.cos(r)*i,toY:a+Math.sin(r)*i,thickness:2,shade:.25,bloom:0});for(let s=6;s<i;s+=3){const l=a+Math.cos(r)*s,h=a+Math.sin(r)*s;for(const c of[-1,1]){const f=r+c*(.75+o()*.3),u=9+o()*5;stampStroke(e,t,{fromX:l,fromY:h,toX:l+Math.cos(f)*u,toY:h+Math.sin(f)*u,thickness:1.3,shade:.45+o()*.5,bloom:0})}}}}function stampLeaf(e,t,{centerX:o,centerY:a,halfLength:n,halfWidth:r,angle:i,shade:s,bloom:l}){const h=Math.cos(i),c=Math.sin(i),f=Math.ceil(n);forEachCellPixel(e,t,o,a,f,(u,d)=>{const E=u-o,T=d-a,m=(E*h+T*c)/n,A=(-E*c+T*h)/r,S=1-m*m;if(S<=0)return null;const _=Math.pow(S,1.3);if(A*A>_)return null;const p=Math.abs(A)<.12?.82:1,g=.82+.18*(1-Math.abs(A));return{shade:s*g*p+m*.06,bloom:l}})}function stampStroke(e,t,{fromX:o,fromY:a,toX:n,toY:r,thickness:i,shade:s,bloom:l}){const h=Math.hypot(n-o,r-a)||1,c=Math.ceil(h),f=i*.5;for(let u=0;u<=c;u++){const d=u/c,E=o+(n-o)*d,T=a+(r-a)*d;forEachCellPixel(e,t,E,T,Math.ceil(f),(m,A)=>Math.hypot(m-E,A-T)<=f?{shade:s,bloom:l}:null)}}function forEachCellPixel(e,t,o,a,n,r){const i=Math.max(0,Math.floor(o-n)),s=Math.min(LEAF_ATLAS_CELL_SIZE-1,Math.ceil(o+n)),l=Math.max(0,Math.floor(a-n)),h=Math.min(LEAF_ATLAS_CELL_SIZE-1,Math.ceil(a+n));for(let c=l;c<=h;c++)for(let f=i;f<=s;f++){const u=r(f+.5,c+.5);if(!u)continue;const d=((t.y+c)*e.size+t.x+f)*4;e.data[d]=Math.round(Math.min(1,Math.max(0,u.shade))*255),e.data[d+1]=Math.round(u.bloom*255),e.data[d+3]=255}}function downsampleLeafAtlas(e){const t=e.size>>1,o=new Uint8Array(t*t*4);for(let a=0;a<t;a++)for(let n=0;n<t;n++){let r=0,i=0,s=0;for(let c=0;c<4;c++){const f=((a*2+(c>>1))*e.size+n*2+(c&1))*4,u=e.data[f+3];r+=e.data[f]*(u+1),i+=e.data[f+1]*(u+1),s+=u}const l=s+4,h=(a*t+n)*4;o[h]=Math.round(r/l),o[h+1]=Math.round(i/l),o[h+3]=Math.min(255,Math.round(s/4*1.22))}return{size:t,data:o}}function writeTreeVertex(e,t,o){for(let n=0;n<3;n++)e.setFloat32(t+n*4,o.anchor[n],!0),e.setFloat32(t+12+n*4,o.offset[n],!0);const a=normalizeVector(o.normal);for(let n=0;n<3;n++)e.setInt8(t+24+n,Math.round(a[n]*127));e.setInt8(t+27,Math.round(o.kind*127));for(let n=0;n<3;n++)e.setUint8(t+28+n,toUnorm8(o.leafColor[n])),e.setUint8(t+32+n,toUnorm8(o.bloomColor[n]));e.setUint8(t+31,toUnorm8(o.occlusion)),e.setUint8(t+35,255),e.setUint16(t+36,Math.round(clamp(o.uv[0],0,1)*65535),!0),e.setUint16(t+38,Math.round(clamp(o.uv[1],0,1)*65535),!0)}function toUnorm8(e){return Math.round(clamp(e,0,1)*255)}function perpendicularBasis(e){const t=normalizeVector(e),o=Math.abs(t[1])<.9?[0,1,0]:[1,0,0],a=normalizeVector(crossVectors(t,o)),n=crossVectors(t,a);return[a,n]}function tubeAxisAt(e,t){const o=subtractVectors(t.anchor,e.anchor);return Math.hypot(...o)>0?o:subtractVectors(t.shift??ZERO_VECTOR,e.shift??ZERO_VECTOR)}function ringPointAt(e,t,o,a){const n=addVectors(scaleVector(t,Math.cos(a)),scaleVector(o,Math.sin(a))),r=e.radiusScaleAt?e.radiusScaleAt(Math.atan2(n[2],n[0])):1;return scaleVector(n,e.radius*r)}function ringSurfaceNormal(e,t,o){const a=subtractVectors(e(t+RING_NORMAL_ANGLE_STEP),e(t-RING_NORMAL_ANGLE_STEP)),n=crossVectors(a,normalizeVector(o)),r=e(t);return n[0]*r[0]+n[1]*r[1]+n[2]*r[2]>=0?n:scaleVector(n,-1)}function cumulativeHorizontalShiftLengths(e){let t=0;return e.map((o,a)=>{if(a>0){const n=e[a-1].shift??ZERO_VECTOR,r=o.shift??ZERO_VECTOR;t+=Math.hypot(r[0]-n[0],r[2]-n[2])}return t})}function addVectors(e,t){return[e[0]+t[0],e[1]+t[1],e[2]+t[2]]}function subtractVectors(e,t){return[e[0]-t[0],e[1]-t[1],e[2]-t[2]]}function scaleVector(e,t){return[e[0]*t,e[1]*t,e[2]*t]}function crossVectors(e,t){return[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]]}function normalizeVector(e){const t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]}
