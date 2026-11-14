import {
  parseJsonIndex, JsonSyntaxError, locateOffset, formatNodeRange, nodePathSegments, formatPathForDisplay,
  readRawValue, readRawKey, decodeRawStringContent, isContainerType, NODE_TYPE
} from "./json_index.js";
import { createTreeLayout, toggleNode, setExpansionMode, revealNode, describeRows, EXPANSION_MODE } from "./tree_layout.js";
import { mapOffsetsToNodes } from "./text_search.js";
import { createGpuTextSearch } from "./gpu_text_search.js";

const MAX_RAW_MATCHES = 200_000;
const DOCUMENT_STATUS = Object.freeze({ VALID: "valid", INVALID: "invalid", EMPTY: "empty" });
const PRETTY_INDENT = "  ";

const session = {
  document: null,
  layout: null,
  documentVersion: 0,
  layoutRevision: 0,
  gpuSearchPromise: null
};

const COMMANDS = {
  load: ({ text }) => loadText(text),
  rows: ({ startRow, rowCount }) => ({ layoutRevision: session.layoutRevision, rows: describeRows(requireDocument(), session.layout, startRow, rowCount) }),
  toggle: ({ nodeIndex }) => changeLayout(() => toggleNode(requireDocument(), session.layout, nodeIndex)),
  expandAll: () => changeLayout(() => setExpansionMode(requireDocument(), session.layout, EXPANSION_MODE.ALL_EXPANDED)),
  collapseAll: () => changeLayout(() => setExpansionMode(requireDocument(), session.layout, EXPANSION_MODE.ALL_COLLAPSED)),
  reveal: ({ nodeIndex }) => {
    let rowIndex = -1;
    const summary = changeLayout(() => { rowIndex = revealNode(requireDocument(), session.layout, nodeIndex); });
    return { ...summary, rowIndex };
  },
  describeNode: ({ nodeIndex }) => describeNode(nodeIndex),
  nodeText: ({ nodeIndex, part }) => ({ text: part === "key" ? readRawKeyWithQuotes(requireDocument(), nodeIndex) : readRawValue(requireDocument(), nodeIndex) }),
  copyPart: ({ nodeIndex, part }) => ({ text: readCopyText(requireDocument(), nodeIndex, part) }),
  format: ({ indentUnit }) => ({ text: formatNodeRange(requireDocument(), 0, indentUnit) }),
  editNode: ({ nodeIndex, part, replacementText }) => editNode(nodeIndex, part, replacementText),
  probeSearch: () => probeSearch(),
  search: (request) => searchDocument(request)
};

self.addEventListener("message", async ({ data }) => {
  const { requestId, command, payload } = data;
  try {
    const result = await COMMANDS[command](payload || {});
    self.postMessage({ requestId, result });
  } catch (error) {
    self.postMessage({ requestId, errorMessage: error instanceof Error ? error.message : String(error) });
  }
});

function loadText(text) {
  if (text.trim().length === 0) {
    session.document = null;
    session.layout = null;
    session.layoutRevision++;
    return { status: DOCUMENT_STATUS.EMPTY, layoutRevision: session.layoutRevision, rowCount: 0 };
  }
  const startTime = performance.now();
  try {
    const nodes = parseJsonIndex(text);
    const parseMilliseconds = performance.now() - startTime;
    session.documentVersion++;
    session.document = { text, nodes, version: session.documentVersion };
    session.layout = createTreeLayout(session.document, session.layout);
    session.layoutRevision++;
    return {
      status: DOCUMENT_STATUS.VALID,
      documentVersion: session.documentVersion,
      layoutRevision: session.layoutRevision,
      rowCount: session.layout.rowCount,
      nodeCount: nodes.count,
      textLength: text.length,
      parseMilliseconds
    };
  } catch (error) {
    if (!(error instanceof JsonSyntaxError)) throw error;
    return {
      status: DOCUMENT_STATUS.INVALID,
      error: { message: error.message, offset: error.offset, ...locateOffset(text, error.offset) },
      hasPreviousDocument: session.document !== null,
      layoutRevision: session.layoutRevision,
      rowCount: session.layout ? session.layout.rowCount : 0
    };
  }
}

function changeLayout(applyChange) {
  applyChange();
  session.layoutRevision++;
  return { layoutRevision: session.layoutRevision, rowCount: session.layout.rowCount };
}

function describeNode(nodeIndex) {
  const document = requireDocument();
  const type = document.nodes.types[nodeIndex];
  return {
    nodeIndex,
    path: formatPathForDisplay(nodePathSegments(document, nodeIndex)),
    type,
    childCount: isContainerType(type) ? document.nodes.childCounts[nodeIndex] : 0
  };
}

function editNode(nodeIndex, part, replacementText) {
  const document = requireDocument();
  const { nodes, text } = document;
  const isKeyEdit = part === "key";
  const start = isKeyEdit ? nodes.keyStarts[nodeIndex] : nodes.valueStarts[nodeIndex];
  const end = isKeyEdit ? nodes.keyEnds[nodeIndex] : nodes.valueEnds[nodeIndex];
  if (start < 0) throw new Error("This node has no key to rename");
  validateReplacement(replacementText, isKeyEdit);
  const editedText = text.slice(0, start) + replacementText + text.slice(end);
  const summary = loadText(editedText);
  if (summary.status !== DOCUMENT_STATUS.VALID) throw new Error(summary.error.message);
  return { ...summary, text: editedText };
}

function validateReplacement(replacementText, isKeyEdit) {
  let parsedValue;
  try {
    parsedValue = JSON.parse(replacementText);
  } catch {
    throw new Error(isKeyEdit ? "Keys must be valid JSON strings" : "Not a valid JSON value. Strings need double quotes.");
  }
  if (isKeyEdit && typeof parsedValue !== "string") throw new Error("Keys must be strings");
}

async function probeSearch() {
  const gpuSearch = await getGpuSearch();
  if (gpuSearch) return { isAvailable: true };
  return { isAvailable: false, reason: "Search needs WebGPU, which this browser or device does not provide." };
}

async function searchDocument({ query, isCaseSensitive, scope }) {
  const document = requireDocument();
  const startTime = performance.now();
  const gpuSearch = await requireUsableGpuSearch();
  if (!gpuSearch.canSearchFor(query, isCaseSensitive)) {
    throw new Error("Ignoring case works for English letters only. Turn on match case for this query.");
  }
  if (!gpuSearch.prepareText(document.text)) throw new Error("This document is larger than the GPU can hold for searching.");
  const rawResult = await gpuSearch.findOffsets(query, { isCaseSensitive, maxMatches: MAX_RAW_MATCHES });
  const nodeIndices = mapOffsetsToNodes(document, rawResult.offsets, scope);
  return {
    documentVersion: document.version,
    nodeIndices,
    rawMatchCount: rawResult.totalCount,
    isTruncated: rawResult.totalCount > MAX_RAW_MATCHES,
    milliseconds: performance.now() - startTime
  };
}

async function requireUsableGpuSearch() {
  let gpuSearch = await getGpuSearch();
  if (gpuSearch && !gpuSearch.isUsable) {
    session.gpuSearchPromise = null;
    gpuSearch = await getGpuSearch();
  }
  if (!gpuSearch) throw new Error("Search needs WebGPU, which this browser or device does not provide.");
  return gpuSearch;
}

function getGpuSearch() {
  if (!session.gpuSearchPromise) session.gpuSearchPromise = createGpuTextSearch();
  return session.gpuSearchPromise;
}

function readCopyText(document, nodeIndex, part) {
  if (part === "key") return decodeRawStringContent(readRawKey(document, nodeIndex) ?? "");
  const type = document.nodes.types[nodeIndex];
  if (isContainerType(type)) return formatNodeRange(document, nodeIndex, PRETTY_INDENT);
  const rawValue = readRawValue(document, nodeIndex);
  return type === NODE_TYPE.STRING ? decodeRawStringContent(rawValue.slice(1, -1)) : rawValue;
}

function readRawKeyWithQuotes(document, nodeIndex) {
  const { nodes, text } = document;
  return text.slice(nodes.keyStarts[nodeIndex], nodes.keyEnds[nodeIndex]);
}

function requireDocument() {
  if (!session.document) throw new Error("No JSON document is loaded");
  return session.document;
}
