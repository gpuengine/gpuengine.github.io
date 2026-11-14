const N=512,V=20,W=8,Y=4,J=256,q=.006,X=.02,S=new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1]),p=6;export const MODES=[{id:"webgl2-per-object",label:"WebGL2, uniforms + drawArrays per object",api:"webgl2",isInstanced:!1},{id:"webgpu-per-object",label:"WebGPU, dynamic offset + draw per object",api:"webgpu",isInstanced:!1},{id:"webgl2-instanced",label:"WebGL2, one instanced draw",api:"webgl2",isInstanced:!0},{id:"webgpu-instanced",label:"WebGPU, one instanced draw",api:"webgpu",isInstanced:!0}];const L=`#version 300 es
layout(location = 0) in vec2 corner;
uniform vec4 objectData[2];
out vec4 colour;
void main() {
  gl_Position = vec4(objectData[0].xy + corner * objectData[0].z, 0.0, 1.0);
  colour = objectData[1];
}`,w=`#version 300 es
layout(location = 0) in vec2 corner;
layout(location = 1) in vec4 placement;
layout(location = 2) in vec4 instanceColour;
out vec4 colour;
void main() {
  gl_Position = vec4(placement.xy + corner * placement.z, 0.0, 1.0);
  colour = instanceColour;
}`,y=`#version 300 es
precision mediump float;
in vec4 colour;
out vec4 fragmentColour;
void main() {
  fragmentColour = colour;
}`,m=`
struct ObjectData {
  placement : vec4f,
  colour : vec4f,
};

struct VertexOut {
  @builtin(position) position : vec4f,
  @location(0) colour : vec4f,
};

fn placeCorner(corner : vec2f, data : ObjectData) -> VertexOut {
  var out : VertexOut;
  out.position = vec4f(data.placement.xy + corner * data.placement.z, 0.0, 1.0);
  out.colour = data.colour;
  return out;
}

@fragment
fn fragmentMain(in : VertexOut) -> @location(0) vec4f {
  return in.colour;
}
`,C=m+`
@group(0) @binding(0) var<uniform> objectData : ObjectData;

@vertex
fn vertexMain(@location(0) corner : vec2f) -> VertexOut {
  return placeCorner(corner, objectData);
}
`,h=m+`
@group(0) @binding(0) var<storage, read> objects : array<ObjectData>;

@vertex
fn vertexMain(@location(0) corner : vec2f, @builtin(instance_index) instance : u32) -> VertexOut {
  return placeCorner(corner, objects[instance]);
}
`;export async function requestWebGPU(){if(!navigator.gpu)throw new Error("WebGPU is not available in this browser.");const t=await navigator.gpu.requestAdapter({powerPreference:"high-performance"});if(!t)throw new Error("No WebGPU adapter.");const r=await t.requestDevice();return{adapter:t,device:r}}export async function describeEnvironment(t){const r=t.info||{},e=document.createElement("canvas").getContext("webgl2"),a=e&&e.getExtension("WEBGL_debug_renderer_info"),n={userAgent:navigator.userAgent,webgpuAdapter:{vendor:r.vendor,architecture:r.architecture,device:r.device,description:r.description},webglRenderer:a?e.getParameter(a.UNMASKED_RENDERER_WEBGL):e&&e.getParameter(e.RENDERER),webglVendor:a?e.getParameter(a.UNMASKED_VENDOR_WEBGL):e&&e.getParameter(e.VENDOR),canvasPixels:"512x512",hardwareConcurrency:navigator.hardwareConcurrency},c=e&&e.getExtension("WEBGL_lose_context");return c&&c.loseContext(),n}export async function measureMode({mode:t,objectCount:r,measuredFrames:o,device:e,createCanvas:a}){const n=a(512),c=x(r),i=t.api==="webgl2"?M(n,c,t.isInstanced):j(n,c,t.isInstanced,e),l=await D(i,c,o);return i.destroy(),t.api==="webgpu"&&await e.queue.onSubmittedWorkDone(),I({mode:t,objectCount:r,timings:l})}function x(t){const r=new Float32Array(t*8),o=new Float32Array(t*3);let e=12345;const a=()=>(e=e*1664525+1013904223>>>0,e/4294967296);for(let n=0;n<t;n++)o[n*3]=a()*1.9-.95,o[n*3+1]=a()*1.9-.95,o[n*3+2]=a()*Math.PI*2,r.set([0,0,.006,0,.4+a()*.6,.3+a()*.5,.1+a()*.3,1],n*8);return{objectCount:t,objects:r,homes:o}}function v(t,r){const{objectCount:o,objects:e,homes:a}=t;for(let n=0;n<o;n++){const c=a[n*3+2];e[n*8]=a[n*3]+Math.sin(r*2+c)*.02,e[n*8+1]=a[n*3+1]+Math.cos(r*2+c)*.02}}function D(t,r,o){const e=20+o,a=[],n=[],c=[];let i=0;return new Promise(l=>{function d(_){v(r,_/1e3),t.stageObjects();const u=performance.now(),E=t.drawFrame(),b=performance.now();i>=20&&(a.push(b-u),n.push(E),c.push(_)),i++,i<e?requestAnimationFrame(d):l({cpuMilliseconds:a,uploadMilliseconds:n,frameStamps:c})}requestAnimationFrame(d)})}function M(t,r,o){const e=t.getContext("webgl2",{antialias:!1,alpha:!1,powerPreference:"high-performance"});if(!e)throw new Error("WebGL2 is not available.");const a=G(e,o?w:L,y),n=e.createVertexArray();e.bindVertexArray(n);const c=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,c),e.bufferData(e.ARRAY_BUFFER,S,e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0);const i=o?U(e,r):null,l=e.getUniformLocation(a,"objectData");e.viewport(0,0,t.width,t.height),e.clearColor(0,0,0,1),e.useProgram(a);function d(){const{objects:u,objectCount:E}=r;for(let b=0;b<E;b++)e.uniform4fv(l,u,b*8,8),e.drawArrays(e.TRIANGLES,0,p)}function _(){const u=performance.now();e.bindBuffer(e.ARRAY_BUFFER,i),e.bufferSubData(e.ARRAY_BUFFER,0,r.objects);const E=performance.now()-u;return e.drawArraysInstanced(e.TRIANGLES,0,p,r.objectCount),E}return{drawCallsPerFrame:o?1:r.objectCount,stageObjects(){},drawFrame(){return e.clear(e.COLOR_BUFFER_BIT),o?_():(d(),0)},destroy(){e.deleteBuffer(c),i&&e.deleteBuffer(i),e.deleteVertexArray(n),e.deleteProgram(a);const u=e.getExtension("WEBGL_lose_context");u&&u.loseContext()}}}function U(t,r){const e=t.createBuffer();return t.bindBuffer(t.ARRAY_BUFFER,e),t.bufferData(t.ARRAY_BUFFER,r.objects.byteLength,t.DYNAMIC_DRAW),t.enableVertexAttribArray(1),t.vertexAttribPointer(1,4,t.FLOAT,!1,32,0),t.vertexAttribDivisor(1,1),t.enableVertexAttribArray(2),t.vertexAttribPointer(2,4,t.FLOAT,!1,32,16),t.vertexAttribDivisor(2,1),e}function G(t,r,o){const e=t.createProgram();for(const[a,n]of[[t.VERTEX_SHADER,r],[t.FRAGMENT_SHADER,o]]){const c=t.createShader(a);if(t.shaderSource(c,n),t.compileShader(c),!t.getShaderParameter(c,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(c));t.attachShader(e,c)}if(t.linkProgram(e),!t.getProgramParameter(e,t.LINK_STATUS))throw new Error(t.getProgramInfoLog(e));return e}function j(t,r,o,e){const a=t.getContext("webgpu"),n=navigator.gpu.getPreferredCanvasFormat();a.configure({device:e,format:n,alphaMode:"opaque"});const c=e.createShaderModule({code:o?h:C}),i=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:o?{type:"read-only-storage"}:{type:"uniform",hasDynamicOffset:!0}}]}),l=e.createRenderPipeline({layout:e.createPipelineLayout({bindGroupLayouts:[i]}),vertex:{module:c,entryPoint:"vertexMain",buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]}]},fragment:{module:c,entryPoint:"fragmentMain",targets:[{format:n}]},primitive:{topology:"triangle-list"}}),d=e.createBuffer({size:S.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(d,0,S);const _=o?32:256,u=e.createBuffer({size:r.objectCount*_,usage:(o?GPUBufferUsage.STORAGE:GPUBufferUsage.UNIFORM)|GPUBufferUsage.COPY_DST}),E=e.createBindGroup({layout:i,entries:[{binding:0,resource:{buffer:u,size:o?void 0:32}}]}),b=o?null:new Float32Array(r.objectCount*256/4),O=o?null:Uint32Array.from({length:r.objectCount},(f,s)=>s*256);function g(){if(o)return;const f=256/4;for(let s=0;s<r.objectCount;s++)b.set(r.objects.subarray(s*8,(s+1)*8),s*f)}function B(){e.queue.writeBuffer(u,0,o?r.objects:b)}function F(f){if(f.setPipeline(l),f.setVertexBuffer(0,d),o){f.setBindGroup(0,E),f.draw(p,r.objectCount);return}for(let s=0;s<r.objectCount;s++)f.setBindGroup(0,E,O,s,1),f.draw(p)}return{drawCallsPerFrame:o?1:r.objectCount,stageObjects:g,drawFrame(){const f=performance.now();B();const s=performance.now()-f,R=e.createCommandEncoder(),T=R.beginRenderPass({colorAttachments:[{view:a.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:"clear",storeOp:"store"}]});return F(T),T.end(),e.queue.submit([R.finish()]),s},destroy(){a.unconfigure(),d.destroy(),u.destroy()}}}function I({mode:t,objectCount:r,timings:o}){const e=[...o.cpuMilliseconds].sort((i,l)=>i-l),a=i=>e[Math.min(e.length-1,Math.floor(i*e.length))],n=o.frameStamps,c=n[n.length-1]-n[0];return{mode:t.id,label:t.label,objectCount:r,drawCallsPerFrame:t.isInstanced?1:r,measuredFrames:e.length,cpuMillisecondsMedian:A(a(.5)),cpuMillisecondsP95:A(a(.95)),cpuMillisecondsMean:A(P(e)),uploadMillisecondsMean:A(P(o.uploadMilliseconds)),uploadBytesPerFrame:t.isInstanced?r*8*4:t.api==="webgpu"?r*256:0,framesPerSecond:A((n.length-1)/(c/1e3))}}function P(t){return t.reduce((r,o)=>r+o,0)/t.length}function A(t){return Math.round(t*100)/100}
