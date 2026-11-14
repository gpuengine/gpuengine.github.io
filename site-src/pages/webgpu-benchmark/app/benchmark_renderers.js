const CANVAS_SIZE_PIXELS = 512;
const WARMUP_FRAMES = 20;
const FLOATS_PER_OBJECT = 8;
const BYTES_PER_FLOAT = 4;
const UNIFORM_SLOT_BYTES = 256;
const QUAD_HALF_SIZE = 0.006;
const DRIFT_AMPLITUDE = 0.02;
const QUAD_CORNERS = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
const VERTICES_PER_QUAD = 6;

export const MODES = [
  { id: "webgl2-per-object", label: "WebGL2, uniforms + drawArrays per object", api: "webgl2", isInstanced: false },
  { id: "webgpu-per-object", label: "WebGPU, dynamic offset + draw per object", api: "webgpu", isInstanced: false },
  { id: "webgl2-instanced", label: "WebGL2, one instanced draw", api: "webgl2", isInstanced: true },
  { id: "webgpu-instanced", label: "WebGPU, one instanced draw", api: "webgpu", isInstanced: true }
];

const WEBGL_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 corner;
uniform vec4 objectData[2];
out vec4 colour;
void main() {
  gl_Position = vec4(objectData[0].xy + corner * objectData[0].z, 0.0, 1.0);
  colour = objectData[1];
}`;

const WEBGL_INSTANCED_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 corner;
layout(location = 1) in vec4 placement;
layout(location = 2) in vec4 instanceColour;
out vec4 colour;
void main() {
  gl_Position = vec4(placement.xy + corner * placement.z, 0.0, 1.0);
  colour = instanceColour;
}`;

const WEBGL_FRAGMENT_SHADER = `#version 300 es
precision mediump float;
in vec4 colour;
out vec4 fragmentColour;
void main() {
  fragmentColour = colour;
}`;

const WGSL_SHARED = `
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
`;

const WGSL_PER_OBJECT = WGSL_SHARED + `
@group(0) @binding(0) var<uniform> objectData : ObjectData;

@vertex
fn vertexMain(@location(0) corner : vec2f) -> VertexOut {
  return placeCorner(corner, objectData);
}
`;

const WGSL_INSTANCED = WGSL_SHARED + `
@group(0) @binding(0) var<storage, read> objects : array<ObjectData>;

@vertex
fn vertexMain(@location(0) corner : vec2f, @builtin(instance_index) instance : u32) -> VertexOut {
  return placeCorner(corner, objects[instance]);
}
`;

export async function requestWebGPU() {
  if (!navigator.gpu) throw new Error("WebGPU is not available in this browser.");
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) throw new Error("No WebGPU adapter.");
  const device = await adapter.requestDevice();
  return { adapter, device };
}

export async function describeEnvironment(adapter) {
  const info = adapter.info || {};
  const probeCanvas = document.createElement("canvas");
  const gl = probeCanvas.getContext("webgl2");
  const debugInfo = gl && gl.getExtension("WEBGL_debug_renderer_info");
  const environment = {
    userAgent: navigator.userAgent,
    webgpuAdapter: { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description },
    webglRenderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl && gl.getParameter(gl.RENDERER),
    webglVendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl && gl.getParameter(gl.VENDOR),
    canvasPixels: `${CANVAS_SIZE_PIXELS}x${CANVAS_SIZE_PIXELS}`,
    hardwareConcurrency: navigator.hardwareConcurrency
  };
  const loseContext = gl && gl.getExtension("WEBGL_lose_context");
  if (loseContext) loseContext.loseContext();
  return environment;
}

export async function measureMode({ mode, objectCount, measuredFrames, device, createCanvas }) {
  const canvas = createCanvas(CANVAS_SIZE_PIXELS);
  const scene = createScene(objectCount);
  const renderer = mode.api === "webgl2"
    ? createWebGLRenderer(canvas, scene, mode.isInstanced)
    : createWebGPURenderer(canvas, scene, mode.isInstanced, device);
  const timings = await runFrames(renderer, scene, measuredFrames);
  renderer.destroy();
  if (mode.api === "webgpu") await device.queue.onSubmittedWorkDone();
  return summarise({ mode, objectCount, timings });
}

function createScene(objectCount) {
  const objects = new Float32Array(objectCount * FLOATS_PER_OBJECT);
  const homes = new Float32Array(objectCount * 3);
  let seed = 12345;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let index = 0; index < objectCount; index++) {
    homes[index * 3] = random() * 1.9 - 0.95;
    homes[index * 3 + 1] = random() * 1.9 - 0.95;
    homes[index * 3 + 2] = random() * Math.PI * 2;
    objects.set([0, 0, QUAD_HALF_SIZE, 0, 0.4 + random() * 0.6, 0.3 + random() * 0.5, 0.1 + random() * 0.3, 1], index * FLOATS_PER_OBJECT);
  }
  return { objectCount, objects, homes };
}

function animateScene(scene, seconds) {
  const { objectCount, objects, homes } = scene;
  for (let index = 0; index < objectCount; index++) {
    const phase = homes[index * 3 + 2];
    objects[index * FLOATS_PER_OBJECT] = homes[index * 3] + Math.sin(seconds * 2 + phase) * DRIFT_AMPLITUDE;
    objects[index * FLOATS_PER_OBJECT + 1] = homes[index * 3 + 1] + Math.cos(seconds * 2 + phase) * DRIFT_AMPLITUDE;
  }
}

function runFrames(renderer, scene, measuredFrames) {
  const totalFrames = WARMUP_FRAMES + measuredFrames;
  const cpuMilliseconds = [];
  const uploadMilliseconds = [];
  const frameStamps = [];
  let frame = 0;
  return new Promise(resolve => {
    function tick(timestamp) {
      animateScene(scene, timestamp / 1000);
      renderer.stageObjects();
      const started = performance.now();
      const upload = renderer.drawFrame();
      const finished = performance.now();
      if (frame >= WARMUP_FRAMES) {
        cpuMilliseconds.push(finished - started);
        uploadMilliseconds.push(upload);
        frameStamps.push(timestamp);
      }
      frame++;
      if (frame < totalFrames) requestAnimationFrame(tick);
      else resolve({ cpuMilliseconds, uploadMilliseconds, frameStamps });
    }
    requestAnimationFrame(tick);
  });
}

function createWebGLRenderer(canvas, scene, isInstanced) {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!gl) throw new Error("WebGL2 is not available.");
  const program = linkProgram(gl, isInstanced ? WEBGL_INSTANCED_VERTEX_SHADER : WEBGL_VERTEX_SHADER, WEBGL_FRAGMENT_SHADER);
  const vertexArray = gl.createVertexArray();
  gl.bindVertexArray(vertexArray);
  const cornerBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD_CORNERS, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const instanceBuffer = isInstanced ? createWebGLInstanceBuffer(gl, scene) : null;
  const objectDataLocation = gl.getUniformLocation(program, "objectData");
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 1);
  gl.useProgram(program);

  function drawEachObject() {
    const { objects, objectCount } = scene;
    for (let index = 0; index < objectCount; index++) {
      gl.uniform4fv(objectDataLocation, objects, index * FLOATS_PER_OBJECT, FLOATS_PER_OBJECT);
      gl.drawArrays(gl.TRIANGLES, 0, VERTICES_PER_QUAD);
    }
  }

  function drawAllInstances() {
    const uploadStarted = performance.now();
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, scene.objects);
    const uploadMilliseconds = performance.now() - uploadStarted;
    gl.drawArraysInstanced(gl.TRIANGLES, 0, VERTICES_PER_QUAD, scene.objectCount);
    return uploadMilliseconds;
  }

  return {
    drawCallsPerFrame: isInstanced ? 1 : scene.objectCount,
    stageObjects() {},
    drawFrame() {
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (isInstanced) return drawAllInstances();
      drawEachObject();
      return 0;
    },
    destroy() {
      gl.deleteBuffer(cornerBuffer);
      if (instanceBuffer) gl.deleteBuffer(instanceBuffer);
      gl.deleteVertexArray(vertexArray);
      gl.deleteProgram(program);
      const loseContext = gl.getExtension("WEBGL_lose_context");
      if (loseContext) loseContext.loseContext();
    }
  };
}

function createWebGLInstanceBuffer(gl, scene) {
  const strideBytes = FLOATS_PER_OBJECT * BYTES_PER_FLOAT;
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, scene.objects.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, strideBytes, 0);
  gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 4, gl.FLOAT, false, strideBytes, 4 * BYTES_PER_FLOAT);
  gl.vertexAttribDivisor(2, 1);
  return buffer;
}

function linkProgram(gl, vertexSource, fragmentSource) {
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  return program;
}

function createWebGPURenderer(canvas, scene, isInstanced, device) {
  const context = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "opaque" });
  const module = device.createShaderModule({ code: isInstanced ? WGSL_INSTANCED : WGSL_PER_OBJECT });
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: isInstanced ? { type: "read-only-storage" } : { type: "uniform", hasDynamicOffset: true }
    }]
  });
  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: { module, entryPoint: "vertexMain", buffers: [{ arrayStride: 2 * BYTES_PER_FLOAT, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }] }] },
    fragment: { module, entryPoint: "fragmentMain", targets: [{ format }] },
    primitive: { topology: "triangle-list" }
  });
  const cornerBuffer = device.createBuffer({ size: QUAD_CORNERS.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(cornerBuffer, 0, QUAD_CORNERS);
  const objectStrideBytes = isInstanced ? FLOATS_PER_OBJECT * BYTES_PER_FLOAT : UNIFORM_SLOT_BYTES;
  const objectBuffer = device.createBuffer({
    size: scene.objectCount * objectStrideBytes,
    usage: (isInstanced ? GPUBufferUsage.STORAGE : GPUBufferUsage.UNIFORM) | GPUBufferUsage.COPY_DST
  });
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: objectBuffer, size: isInstanced ? undefined : FLOATS_PER_OBJECT * BYTES_PER_FLOAT } }]
  });
  const alignedObjects = isInstanced ? null : new Float32Array(scene.objectCount * UNIFORM_SLOT_BYTES / BYTES_PER_FLOAT);
  const dynamicOffsets = isInstanced ? null : Uint32Array.from({ length: scene.objectCount }, (unused, index) => index * UNIFORM_SLOT_BYTES);

  function spreadObjectsIntoUniformSlots() {
    if (isInstanced) return;
    const floatsPerSlot = UNIFORM_SLOT_BYTES / BYTES_PER_FLOAT;
    for (let index = 0; index < scene.objectCount; index++) {
      alignedObjects.set(scene.objects.subarray(index * FLOATS_PER_OBJECT, (index + 1) * FLOATS_PER_OBJECT), index * floatsPerSlot);
    }
  }

  function uploadObjects() {
    device.queue.writeBuffer(objectBuffer, 0, isInstanced ? scene.objects : alignedObjects);
  }

  function recordDraws(pass) {
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, cornerBuffer);
    if (isInstanced) {
      pass.setBindGroup(0, bindGroup);
      pass.draw(VERTICES_PER_QUAD, scene.objectCount);
      return;
    }
    for (let index = 0; index < scene.objectCount; index++) {
      pass.setBindGroup(0, bindGroup, dynamicOffsets, index, 1);
      pass.draw(VERTICES_PER_QUAD);
    }
  }

  return {
    drawCallsPerFrame: isInstanced ? 1 : scene.objectCount,
    stageObjects: spreadObjectsIntoUniformSlots,
    drawFrame() {
      const uploadStarted = performance.now();
      uploadObjects();
      const uploadMilliseconds = performance.now() - uploadStarted;
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: "clear", storeOp: "store" }]
      });
      recordDraws(pass);
      pass.end();
      device.queue.submit([encoder.finish()]);
      return uploadMilliseconds;
    },
    destroy() {
      context.unconfigure();
      cornerBuffer.destroy();
      objectBuffer.destroy();
    }
  };
}

function summarise({ mode, objectCount, timings }) {
  const sorted = [...timings.cpuMilliseconds].sort((first, second) => first - second);
  const percentile = fraction => sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
  const stamps = timings.frameStamps;
  const elapsedMilliseconds = stamps[stamps.length - 1] - stamps[0];
  return {
    mode: mode.id,
    label: mode.label,
    objectCount,
    drawCallsPerFrame: mode.isInstanced ? 1 : objectCount,
    measuredFrames: sorted.length,
    cpuMillisecondsMedian: round(percentile(0.5)),
    cpuMillisecondsP95: round(percentile(0.95)),
    cpuMillisecondsMean: round(mean(sorted)),
    uploadMillisecondsMean: round(mean(timings.uploadMilliseconds)),
    uploadBytesPerFrame: mode.isInstanced ? objectCount * FLOATS_PER_OBJECT * BYTES_PER_FLOAT : mode.api === "webgpu" ? objectCount * UNIFORM_SLOT_BYTES : 0,
    framesPerSecond: round((stamps.length - 1) / (elapsedMilliseconds / 1000))
  };
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value) {
  return Math.round(value * 100) / 100;
}
