const U=256,A=65535,T=8,m=4,C=65,I=90,O=32,y=128,w=256,f=Object.freeze({ASCII:{unitBits:8,unitsPerWord:4},UTF16:{unitBits:16,unitsPerWord:2}}),E=`
struct SearchParameters {
  textLength: u32,
  queryLength: u32,
  unitBits: u32,
  unitsPerWord: u32,
  foldsCase: u32,
  maxMatches: u32,
  workgroupsPerRow: u32,
  unused: u32,
}

@group(0) @binding(0) var<uniform> parameters: SearchParameters;
@group(0) @binding(1) var<storage, read> textWords: array<u32>;
@group(0) @binding(2) var<storage, read> queryUnits: array<u32>;
@group(0) @binding(3) var<storage, read_write> matchCount: atomic<u32>;
@group(0) @binding(4) var<storage, read_write> matchOffsets: array<u32>;

fn unitAt(position: u32) -> u32 {
  let word = textWords[position / parameters.unitsPerWord];
  let shift = (position % parameters.unitsPerWord) * parameters.unitBits;
  let mask = (1u << parameters.unitBits) - 1u;
  let unit = (word >> shift) & mask;
  if (parameters.foldsCase == 1u && unit >= 65u && unit <= 90u) {
    return unit + 32u;
  }
  return unit;
}

@compute @workgroup_size(256)
fn findMatches(@builtin(global_invocation_id) invocation: vec3u) {
  let position = invocation.x + invocation.y * parameters.workgroupsPerRow * 256u;
  if (position + parameters.queryLength > parameters.textLength) {
    return;
  }
  for (var offset = 0u; offset < parameters.queryLength; offset++) {
    if (unitAt(position + offset) != queryUnits[offset]) {
      return;
    }
  }
  let slot = atomicAdd(&matchCount, 1u);
  if (slot < parameters.maxMatches) {
    matchOffsets[slot] = position;
  }
}
`;export async function createGpuTextSearch(){if(typeof navigator>"u"||!navigator.gpu)return null;try{const r=await navigator.gpu.requestAdapter();if(!r)return null;const e=await r.requestDevice({requiredLimits:{maxStorageBufferBindingSize:r.limits.maxStorageBufferBindingSize,maxBufferSize:r.limits.maxBufferSize}}),n=await e.createComputePipelineAsync({layout:"auto",compute:{module:e.createShaderModule({code:E}),entryPoint:"findMatches"}});return new P(e,n)}catch{return null}}class P{constructor(e,n){this.device=e,this.pipeline=n,this.isLost=!1,this.preparedText=null,this.textBuffer=null,this.textEncoding=null,e.lost.then(()=>{this.isLost=!0})}get isUsable(){return!this.isLost}prepareText(e){if(this.preparedText===e)return!0;this.releaseText();const n=R(e),t=n.words.byteLength,s=this.device.limits;return t>s.maxStorageBufferBindingSize||t>s.maxBufferSize?!1:(this.textBuffer=this.device.createBuffer({size:t,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.textBuffer,0,n.words),this.textEncoding=n.encoding,this.preparedText=e,!0)}canSearchFor(e,n){if(n)return!0;for(let t=0;t<e.length;t++)if(e.charCodeAt(t)>=128&&e[t].toLowerCase()!==e[t].toUpperCase())return!1;return!0}async findOffsets(e,{isCaseSensitive:n,maxMatches:t}){const s=this.preparedText.length,i=S(e,n);if(!(this.textEncoding===f.UTF16||i.every(g=>g<256))||e.length>s)return{offsets:new Uint32Array(0),totalCount:0};const{device:c}=this,o=this.createSearchBuffers(i,t),p=Math.ceil(s/256),d=Math.min(p,65535),l=Math.ceil(p/d);c.queue.writeBuffer(o.parameters,0,Uint32Array.from([s,e.length,this.textEncoding.unitBits,this.textEncoding.unitsPerWord,n?0:1,t,d,0]));const a=c.createCommandEncoder(),u=a.beginComputePass();u.setPipeline(this.pipeline),u.setBindGroup(0,this.createBindGroup(o)),u.dispatchWorkgroups(d,l),u.end(),a.copyBufferToBuffer(o.matchCount,0,o.countReadback,0,4),a.copyBufferToBuffer(o.matchOffsets,0,o.offsetsReadback,0,t*4),c.queue.submit([a.finish()]);try{return await _(o,t)}finally{for(const g of Object.values(o))g.destroy()}}createSearchBuffers(e,n){const{device:t}=this,s=t.createBuffer({size:Math.max(e.length,1)*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});return t.queue.writeBuffer(s,0,Uint32Array.from(e)),{parameters:t.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),query:s,matchCount:t.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),matchOffsets:t.createBuffer({size:n*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),countReadback:t.createBuffer({size:4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),offsetsReadback:t.createBuffer({size:n*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}}createBindGroup(e){return this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:e.parameters}},{binding:1,resource:{buffer:this.textBuffer}},{binding:2,resource:{buffer:e.query}},{binding:3,resource:{buffer:e.matchCount}},{binding:4,resource:{buffer:e.matchOffsets}}]})}releaseText(){this.textBuffer&&this.textBuffer.destroy(),this.textBuffer=null,this.preparedText=null,this.textEncoding=null}}async function _(r,e){await Promise.all([r.countReadback.mapAsync(GPUMapMode.READ),r.offsetsReadback.mapAsync(GPUMapMode.READ)]);const n=new Uint32Array(r.countReadback.getMappedRange())[0],t=Math.min(n,e),s=new Uint32Array(r.offsetsReadback.getMappedRange(),0,t).slice();return r.countReadback.unmap(),r.offsetsReadback.unmap(),{offsets:s.sort(),totalCount:n}}function R(r){const e=new Uint8Array(h(r.length,4)),{read:n,written:t}=new TextEncoder().encodeInto(r,e);if(n===r.length&&t===r.length)return{words:new Uint32Array(e.buffer),encoding:f.ASCII};const s=new Uint16Array(h(r.length,f.UTF16.unitsPerWord));for(let i=0;i<r.length;i++)s[i]=r.charCodeAt(i);return{words:new Uint32Array(s.buffer),encoding:f.UTF16}}function S(r,e){const n=[];for(let t=0;t<r.length;t++){const s=r.charCodeAt(t),i=!e&&s>=65&&s<=90;n.push(i?s+32:s)}return n}function h(r,e){return Math.max(e,Math.ceil(r/e)*e)}
