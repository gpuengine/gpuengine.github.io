const WORKGROUP_SIZE = 256;
const MAX_WORKGROUPS_PER_DIMENSION = 65535;
const PARAMETER_COUNT = 8;
const BYTES_PER_WORD = 4;
const ASCII_UPPERCASE_A = 65;
const ASCII_UPPERCASE_Z = 90;
const ASCII_CASE_OFFSET = 32;
const ASCII_LIMIT = 128;
const EIGHT_BIT_UNIT_LIMIT = 256;
const TEXT_ENCODING = Object.freeze({
  ASCII: { unitBits: 8, unitsPerWord: 4 },
  UTF16: { unitBits: 16, unitsPerWord: 2 }
});

const SEARCH_SHADER = `
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
  if (parameters.foldsCase == 1u && unit >= ${ASCII_UPPERCASE_A}u && unit <= ${ASCII_UPPERCASE_Z}u) {
    return unit + ${ASCII_CASE_OFFSET}u;
  }
  return unit;
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn findMatches(@builtin(global_invocation_id) invocation: vec3u) {
  let position = invocation.x + invocation.y * parameters.workgroupsPerRow * ${WORKGROUP_SIZE}u;
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
`;

export async function createGpuTextSearch() {
  if (typeof navigator === "undefined" || !navigator.gpu) return null;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;
    const device = await adapter.requestDevice({
      requiredLimits: {
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
        maxBufferSize: adapter.limits.maxBufferSize
      }
    });
    const pipeline = await device.createComputePipelineAsync({
      layout: "auto",
      compute: { module: device.createShaderModule({ code: SEARCH_SHADER }), entryPoint: "findMatches" }
    });
    return new GpuTextSearch(device, pipeline);
  } catch {
    return null;
  }
}

class GpuTextSearch {
  constructor(device, pipeline) {
    this.device = device;
    this.pipeline = pipeline;
    this.isLost = false;
    this.preparedText = null;
    this.textBuffer = null;
    this.textEncoding = null;
    device.lost.then(() => { this.isLost = true; });
  }

  get isUsable() {
    return !this.isLost;
  }

  prepareText(text) {
    if (this.preparedText === text) return true;
    this.releaseText();
    const packed = packText(text);
    const byteLength = packed.words.byteLength;
    const limits = this.device.limits;
    if (byteLength > limits.maxStorageBufferBindingSize || byteLength > limits.maxBufferSize) return false;
    this.textBuffer = this.device.createBuffer({ size: byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(this.textBuffer, 0, packed.words);
    this.textEncoding = packed.encoding;
    this.preparedText = text;
    return true;
  }

  canSearchFor(query, isCaseSensitive) {
    if (isCaseSensitive) return true;
    for (let position = 0; position < query.length; position++) {
      const code = query.charCodeAt(position);
      if (code >= ASCII_LIMIT && query[position].toLowerCase() !== query[position].toUpperCase()) return false;
    }
    return true;
  }

  async findOffsets(query, { isCaseSensitive, maxMatches }) {
    const textLength = this.preparedText.length;
    const queryUnits = encodeQuery(query, isCaseSensitive);
    const queryFitsEncoding = this.textEncoding === TEXT_ENCODING.UTF16 || queryUnits.every((unit) => unit < EIGHT_BIT_UNIT_LIMIT);
    if (!queryFitsEncoding || query.length > textLength) return { offsets: new Uint32Array(0), totalCount: 0 };
    const { device } = this;
    const buffers = this.createSearchBuffers(queryUnits, maxMatches);
    const totalWorkgroups = Math.ceil(textLength / WORKGROUP_SIZE);
    const workgroupsPerRow = Math.min(totalWorkgroups, MAX_WORKGROUPS_PER_DIMENSION);
    const rowCount = Math.ceil(totalWorkgroups / workgroupsPerRow);
    device.queue.writeBuffer(buffers.parameters, 0, Uint32Array.from([
      textLength, query.length, this.textEncoding.unitBits, this.textEncoding.unitsPerWord,
      isCaseSensitive ? 0 : 1, maxMatches, workgroupsPerRow, 0
    ]));
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.createBindGroup(buffers));
    pass.dispatchWorkgroups(workgroupsPerRow, rowCount);
    pass.end();
    encoder.copyBufferToBuffer(buffers.matchCount, 0, buffers.countReadback, 0, BYTES_PER_WORD);
    encoder.copyBufferToBuffer(buffers.matchOffsets, 0, buffers.offsetsReadback, 0, maxMatches * BYTES_PER_WORD);
    device.queue.submit([encoder.finish()]);
    try {
      return await readMatches(buffers, maxMatches);
    } finally {
      for (const buffer of Object.values(buffers)) buffer.destroy();
    }
  }

  createSearchBuffers(queryUnits, maxMatches) {
    const { device } = this;
    const queryBuffer = device.createBuffer({ size: Math.max(queryUnits.length, 1) * BYTES_PER_WORD, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(queryBuffer, 0, Uint32Array.from(queryUnits));
    return {
      parameters: device.createBuffer({ size: PARAMETER_COUNT * BYTES_PER_WORD, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }),
      query: queryBuffer,
      matchCount: device.createBuffer({ size: BYTES_PER_WORD, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
      matchOffsets: device.createBuffer({ size: maxMatches * BYTES_PER_WORD, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
      countReadback: device.createBuffer({ size: BYTES_PER_WORD, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }),
      offsetsReadback: device.createBuffer({ size: maxMatches * BYTES_PER_WORD, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST })
    };
  }

  createBindGroup(buffers) {
    return this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: buffers.parameters } },
        { binding: 1, resource: { buffer: this.textBuffer } },
        { binding: 2, resource: { buffer: buffers.query } },
        { binding: 3, resource: { buffer: buffers.matchCount } },
        { binding: 4, resource: { buffer: buffers.matchOffsets } }
      ]
    });
  }

  releaseText() {
    if (this.textBuffer) this.textBuffer.destroy();
    this.textBuffer = null;
    this.preparedText = null;
    this.textEncoding = null;
  }
}

async function readMatches(buffers, maxMatches) {
  await Promise.all([buffers.countReadback.mapAsync(GPUMapMode.READ), buffers.offsetsReadback.mapAsync(GPUMapMode.READ)]);
  const totalCount = new Uint32Array(buffers.countReadback.getMappedRange())[0];
  const storedCount = Math.min(totalCount, maxMatches);
  const offsets = new Uint32Array(buffers.offsetsReadback.getMappedRange(), 0, storedCount).slice();
  buffers.countReadback.unmap();
  buffers.offsetsReadback.unmap();
  return { offsets: offsets.sort(), totalCount };
}

function packText(text) {
  const asciiBytes = new Uint8Array(roundUpToMultiple(text.length, BYTES_PER_WORD));
  const { read, written } = new TextEncoder().encodeInto(text, asciiBytes);
  if (read === text.length && written === text.length) {
    return { words: new Uint32Array(asciiBytes.buffer), encoding: TEXT_ENCODING.ASCII };
  }
  const codeUnits = new Uint16Array(roundUpToMultiple(text.length, TEXT_ENCODING.UTF16.unitsPerWord));
  for (let position = 0; position < text.length; position++) codeUnits[position] = text.charCodeAt(position);
  return { words: new Uint32Array(codeUnits.buffer), encoding: TEXT_ENCODING.UTF16 };
}

function encodeQuery(query, isCaseSensitive) {
  const units = [];
  for (let position = 0; position < query.length; position++) {
    const code = query.charCodeAt(position);
    const foldsToLowercase = !isCaseSensitive && code >= ASCII_UPPERCASE_A && code <= ASCII_UPPERCASE_Z;
    units.push(foldsToLowercase ? code + ASCII_CASE_OFFSET : code);
  }
  return units;
}

function roundUpToMultiple(value, multiple) {
  return Math.max(multiple, Math.ceil(value / multiple) * multiple);
}
