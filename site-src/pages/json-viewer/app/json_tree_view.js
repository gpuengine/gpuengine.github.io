import { LitElement, html, css, nothing } from "lit";
import { NODE_TYPE } from "./json_index.js";
import { boxSizingStyles, jsonTokenStyles } from "./shared_styles.js";

const ROW_HEIGHT_PX = 22;
const INDENT_PX = 16;
const ROW_START_PADDING_PX = 6;
const DOM_OVERSCAN_ROWS = 12;
const FETCH_OVERSCAN_ROWS = 150;
const MAX_CACHED_ROWS = 4000;
const MAX_SCROLL_HEIGHT_PX = 4_000_000;
const WHEEL_DELTA_MODE = Object.freeze({ PIXEL: 0, LINE: 1, PAGE: 2 });
const SCROLL_ALIGNMENT = Object.freeze({ CENTER: "center", NEAREST: "nearest" });
const EDIT_ENCODING = Object.freeze({ DECODED_STRING: "decoded-string", RAW_STRING_CONTENT: "raw-string-content", RAW_LITERAL: "raw-literal" });
const LINE_BREAK_PATTERN = /[\n\r]/;

const TYPE_CLASS_NAMES = {
  [NODE_TYPE.NULL]: "is-null",
  [NODE_TYPE.BOOLEAN]: "is-boolean",
  [NODE_TYPE.NUMBER]: "is-number",
  [NODE_TYPE.STRING]: "is-string"
};

export class JsonTreeView extends LitElement {
  static properties = {
    rowCount: { type: Number },
    layoutRevision: { type: Number },
    selectedNodeIndex: { type: Number },
    highlightQuery: { type: String },
    isHighlightCaseSensitive: { type: Boolean },
    isEditable: { type: Boolean },
    placeholderText: { type: String },
    rowProvider: { attribute: false },
    nodeTextProvider: { attribute: false },
    editHandler: { attribute: false },
    editState: { state: true }
  };

  static styles = [boxSizingStyles, jsonTokenStyles, css`
    :host {
      display: block;
      position: relative;
      min-height: 0;
      font: 13px/${ROW_HEIGHT_PX}px var(--mono);
    }

    .scroller {
      position: absolute;
      inset: 0;
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
      outline: none;
    }

    .scroller:focus-visible {
      box-shadow: inset 0 0 0 2px var(--accent);
    }

    .rows {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
    }

    .row {
      position: relative;
      height: ${ROW_HEIGHT_PX}px;
      padding-right: 0.75rem;
      white-space: pre;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: default;
    }

    .row:hover {
      background: var(--json-hover);
    }

    .row.is-selected {
      background: var(--json-selected);
      box-shadow: inset 2px 0 0 var(--accent);
    }

    .row-actions {
      position: absolute;
      top: 1px;
      right: 0.4rem;
      display: none;
      gap: 0.25rem;
    }

    .row:hover .row-actions, .row.is-selected .row-actions {
      display: flex;
    }

    .copy-button {
      height: ${ROW_HEIGHT_PX - 2}px;
      padding: 0 0.45rem;
      border: 1px solid var(--line);
      border-radius: 4px;
      background: var(--surface-raised);
      color: var(--muted);
      font: 500 11px/1 system-ui, -apple-system, "Segoe UI", sans-serif;
      cursor: pointer;
    }

    .copy-button:hover {
      border-color: var(--accent);
      color: var(--text);
    }

    @media (hover: none) {
      .row:hover:not(.is-selected) .row-actions {
        display: none;
      }
    }

    .toggle, .toggle-spacer {
      display: inline-block;
      width: 1rem;
      text-align: center;
      color: var(--muted);
    }

    .toggle {
      cursor: pointer;
    }

    .toggle:hover {
      color: var(--text);
    }

    .key { color: var(--json-key); }
    .array-position { color: var(--json-punctuation); font-size: 11px; }
    .punctuation { color: var(--json-punctuation); }
    .is-string { color: var(--json-string); }
    .is-number { color: var(--json-number); }
    .is-boolean { color: var(--json-boolean); }
    .is-null { color: var(--json-null); font-style: italic; }

    .collapsed-summary {
      padding: 0 0.3rem;
      margin: 0 0.15rem;
      border-radius: 4px;
      background: var(--surface-raised);
      color: var(--muted);
      cursor: pointer;
    }

    .child-count {
      margin-left: 0.6rem;
      color: var(--muted);
      font-size: 11px;
    }

    mark {
      background: var(--json-match);
      color: inherit;
      border-radius: 2px;
    }

    .inline-editor {
      font: inherit;
      height: ${ROW_HEIGHT_PX - 2}px;
      min-width: 12rem;
      width: 50%;
      padding: 0 0.3rem;
      border: 1px solid var(--accent);
      border-radius: 4px;
      background: var(--bg);
      color: var(--text);
      outline: none;
    }

    .inline-editor.has-error {
      border-color: #f87171;
    }

    .edit-error {
      margin-left: 0.5rem;
      color: #f87171;
      font: 12px system-ui, sans-serif;
    }

    .placeholder {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 2rem;
      text-align: center;
      color: var(--muted);
      font: 0.95rem/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
      pointer-events: none;
    }
  `];

  #scroller = null;
  #rowCache = new Map();
  #virtualOffsetPx = 0;
  #viewportHeightPx = 0;
  #lastAssignedScrollTop = -1;
  #renderedRange = { start: 0, end: 0 };
  #isFetchingRows = false;
  #failedRevision = -1;
  #resizeObserver = new ResizeObserver(([entry]) => {
    this.#viewportHeightPx = entry.contentRect.height;
    this.requestUpdate();
  });

  constructor() {
    super();
    this.rowCount = 0;
    this.layoutRevision = 0;
    this.selectedNodeIndex = -1;
    this.highlightQuery = "";
    this.isHighlightCaseSensitive = false;
    this.isEditable = false;
    this.placeholderText = "";
    this.rowProvider = null;
    this.nodeTextProvider = null;
    this.editHandler = null;
    this.editState = null;
  }

  firstUpdated() {
    this.#scroller = this.renderRoot.querySelector(".scroller");
    this.#resizeObserver.observe(this.#scroller);
    this.#scroller.addEventListener("wheel", (event) => this.#handleWheel(event), { passive: false });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#resizeObserver.disconnect();
  }

  willUpdate(changedProperties) {
    if (changedProperties.has("layoutRevision")) {
      this.#rowCache.clear();
      this.editState = null;
      this.#virtualOffsetPx = Math.min(this.#virtualOffsetPx, this.#maxVirtualOffsetPx());
    }
  }

  updated() {
    if (this.editState?.needsFocus) this.#focusInlineEditor();
    this.#loadMissingRows();
  }

  focusTree() {
    this.#scroller?.focus({ preventScroll: true });
  }

  scrollToRow(rowIndex, alignment = SCROLL_ALIGNMENT.NEAREST) {
    if (rowIndex < 0) return;
    const rowTopPx = rowIndex * ROW_HEIGHT_PX;
    const viewportPx = this.#viewportHeightPx;
    if (alignment === SCROLL_ALIGNMENT.CENTER) {
      this.#scrollToVirtualOffset(rowTopPx - (viewportPx - ROW_HEIGHT_PX) / 2);
      return;
    }
    const currentOffset = this.#currentVirtualOffsetPx();
    if (rowTopPx < currentOffset) this.#scrollToVirtualOffset(rowTopPx);
    else if (rowTopPx + ROW_HEIGHT_PX > currentOffset + viewportPx) this.#scrollToVirtualOffset(rowTopPx + ROW_HEIGHT_PX - viewportPx);
  }

  render() {
    const virtualOffsetPx = this.#currentVirtualOffsetPx();
    const firstVisibleRow = Math.floor(virtualOffsetPx / ROW_HEIGHT_PX);
    const visibleRowCount = Math.ceil(this.#viewportHeightPx / ROW_HEIGHT_PX) + 1;
    const start = Math.max(0, firstVisibleRow - DOM_OVERSCAN_ROWS);
    const end = Math.min(this.rowCount, firstVisibleRow + visibleRowCount + DOM_OVERSCAN_ROWS);
    this.#renderedRange = { start, end };
    const scrollTop = this.#scroller ? this.#scroller.scrollTop : 0;
    const rowsTopPx = scrollTop - (virtualOffsetPx - start * ROW_HEIGHT_PX);
    const rowIndices = [];
    for (let rowIndex = start; rowIndex < end; rowIndex++) rowIndices.push(rowIndex);
    return html`
      <div class="scroller" tabindex="0" role="tree" aria-label="JSON tree"
        @scroll=${this.#handleScroll} @keydown=${this.#handleKeyDown} @click=${this.#handleClick} @dblclick=${this.#handleDoubleClick}>
        <div style="height: ${this.#scrollHeightPx()}px"></div>
        <div class="rows" style="transform: translateY(${rowsTopPx}px)">${rowIndices.map((rowIndex) => this.#renderRow(rowIndex))}</div>
      </div>
      ${this.rowCount === 0 && this.placeholderText ? html`<div class="placeholder">${this.placeholderText}</div>` : nothing}
    `;
  }

  #renderRow(rowIndex) {
    const row = this.#rowCache.get(rowIndex);
    if (!row) return html`<div class="row"></div>`;
    const isSelected = !row.isClosing && row.nodeIndex === this.selectedNodeIndex;
    const isContainer = row.type === NODE_TYPE.ARRAY || row.type === NODE_TYPE.OBJECT;
    return html`<div class="row ${isSelected ? "is-selected" : ""}" data-row-index=${rowIndex}
      role="treeitem" aria-level=${row.depth + 1} aria-selected=${isSelected ? "true" : "false"}
      aria-expanded=${isContainer && !row.isClosing && row.childCount > 0 ? String(!row.isCollapsed) : nothing}
      style="padding-left: ${ROW_START_PADDING_PX + row.depth * INDENT_PX}px">${this.#renderRowContent(row, isContainer)}${this.#renderCopyActions(row)}</div>`;
  }

  #renderCopyActions(row) {
    if (row.isClosing || this.editState?.nodeIndex === row.nodeIndex) return nothing;
    return html`<span class="row-actions">
      ${row.keyText !== null ? html`<button class="copy-button" type="button" data-copy="key" title="Copy key">Copy key</button>` : nothing}
      <button class="copy-button" type="button" data-copy="value" title="Copy value">Copy value</button>
    </span>`;
  }

  #renderRowContent(row, isContainer) {
    const comma = row.hasTrailingComma ? html`<span class="punctuation">,</span>` : nothing;
    if (row.isClosing) return html`<span class="toggle-spacer"></span><span class="punctuation">${closingBracket(row.type)}</span>${comma}`;
    const label = this.#renderLabel(row);
    if (!isContainer) return html`<span class="toggle-spacer"></span>${label}${this.#renderPrimitiveValue(row)}${comma}`;
    const opening = html`<span class="punctuation">${openingBracket(row.type)}</span>`;
    if (row.childCount === 0) return html`<span class="toggle-spacer"></span>${label}${opening}<span class="punctuation">${closingBracket(row.type)}</span>${comma}`;
    const toggle = html`<span class="toggle" data-action="toggle">${row.isCollapsed ? "▸" : "▾"}</span>`;
    if (!row.isCollapsed) return html`${toggle}${label}${opening}`;
    return html`${toggle}${label}${opening}<span class="collapsed-summary" data-action="toggle">…</span><span class="punctuation">${closingBracket(row.type)}</span>${comma}<span class="child-count">${describeChildCount(row)}</span>`;
  }

  #renderLabel(row) {
    if (this.#isEditing(row, "key")) return html`${this.#renderInlineEditor()}<span class="punctuation">: </span>`;
    if (row.keyText !== null) {
      return html`<span class="key" data-part="key">"${this.#highlight(row.keyText)}${row.isKeyTruncated ? "…" : ""}"</span><span class="punctuation">: </span>`;
    }
    if (row.arrayPosition !== null) return html`<span class="array-position">${row.arrayPosition}</span><span class="punctuation">: </span>`;
    return nothing;
  }

  #renderPrimitiveValue(row) {
    if (this.#isEditing(row, "value")) return this.#renderInlineEditor();
    return html`<span class="${TYPE_CLASS_NAMES[row.type]}" data-part="value">${this.#highlight(row.valueText)}${row.isValueTruncated ? "…" : ""}</span>`;
  }

  #renderInlineEditor() {
    const { draft, errorMessage } = this.editState;
    return html`<input class="inline-editor ${errorMessage ? "has-error" : ""}" .value=${draft} spellcheck="false" aria-label="Edit JSON value"
      @input=${(event) => { this.editState = { ...this.editState, draft: event.target.value, errorMessage: null }; }}
      @keydown=${this.#handleEditorKeyDown} @blur=${() => this.#commitEdit()}
      @click=${(event) => event.stopPropagation()} @dblclick=${(event) => event.stopPropagation()}
    >${errorMessage ? html`<span class="edit-error">${errorMessage}</span>` : nothing}`;
  }

  #highlight(text) {
    const query = this.highlightQuery;
    if (!query) return text;
    const haystack = this.isHighlightCaseSensitive ? text : text.toLowerCase();
    const needle = this.isHighlightCaseSensitive ? query : query.toLowerCase();
    if (haystack.length !== text.length) return text;
    const parts = [];
    let cursor = 0;
    for (let found = haystack.indexOf(needle); found !== -1; found = haystack.indexOf(needle, cursor)) {
      parts.push(text.slice(cursor, found), html`<mark>${text.slice(found, found + needle.length)}</mark>`);
      cursor = found + needle.length;
    }
    if (parts.length === 0) return text;
    parts.push(text.slice(cursor));
    return parts;
  }

  #isEditing(row, part) {
    return this.editState !== null && this.editState.nodeIndex === row.nodeIndex && this.editState.part === part;
  }

  #handleScroll() {
    const scrollTop = this.#scroller.scrollTop;
    if (scrollTop === this.#lastAssignedScrollTop) {
      this.#lastAssignedScrollTop = -1;
      return;
    }
    this.#virtualOffsetPx = scrollTop * this.#scrollScale();
    this.requestUpdate();
  }

  #handleWheel(event) {
    if (this.#scrollScale() === 1) return;
    event.preventDefault();
    const deltaPx = event.deltaMode === WHEEL_DELTA_MODE.LINE ? event.deltaY * ROW_HEIGHT_PX
      : event.deltaMode === WHEEL_DELTA_MODE.PAGE ? event.deltaY * this.#viewportHeightPx
      : event.deltaY;
    this.#scrollToVirtualOffset(this.#virtualOffsetPx + deltaPx);
  }

  #scrollToVirtualOffset(offsetPx) {
    if (!this.#scroller) return;
    const clampedOffset = Math.max(0, Math.min(offsetPx, this.#maxVirtualOffsetPx()));
    this.#virtualOffsetPx = clampedOffset;
    this.#scroller.scrollTop = clampedOffset / this.#scrollScale();
    this.#lastAssignedScrollTop = this.#scroller.scrollTop;
    this.requestUpdate();
  }

  #currentVirtualOffsetPx() {
    if (this.#scroller && this.#scrollScale() === 1) this.#virtualOffsetPx = this.#scroller.scrollTop;
    return this.#virtualOffsetPx;
  }

  #scrollHeightPx() {
    return Math.min(this.rowCount * ROW_HEIGHT_PX, MAX_SCROLL_HEIGHT_PX);
  }

  #maxVirtualOffsetPx() {
    return Math.max(0, this.rowCount * ROW_HEIGHT_PX - this.#viewportHeightPx);
  }

  #scrollScale() {
    const maxScrollTopPx = this.#scrollHeightPx() - this.#viewportHeightPx;
    const maxVirtualOffsetPx = this.#maxVirtualOffsetPx();
    if (this.rowCount * ROW_HEIGHT_PX <= MAX_SCROLL_HEIGHT_PX || maxScrollTopPx <= 0) return 1;
    return maxVirtualOffsetPx / maxScrollTopPx;
  }

  async #loadMissingRows() {
    const { start, end } = this.#renderedRange;
    if (this.#isFetchingRows || !this.rowProvider || this.rowCount === 0) return;
    if (this.#failedRevision === this.layoutRevision || this.#isRangeCached(start, end)) return;
    const fetchStart = Math.max(0, start - FETCH_OVERSCAN_ROWS);
    const fetchEnd = Math.min(this.rowCount, end + FETCH_OVERSCAN_ROWS);
    this.#isFetchingRows = true;
    try {
      const { layoutRevision, rows } = await this.rowProvider(fetchStart, fetchEnd - fetchStart);
      if (layoutRevision !== this.layoutRevision) return;
      if (this.#rowCache.size + rows.length > MAX_CACHED_ROWS) this.#rowCache.clear();
      for (const row of rows) this.#rowCache.set(row.rowIndex, row);
    } catch {
      this.#failedRevision = this.layoutRevision;
    } finally {
      this.#isFetchingRows = false;
      this.requestUpdate();
    }
  }

  #isRangeCached(start, end) {
    for (let rowIndex = start; rowIndex < end; rowIndex++) {
      if (!this.#rowCache.has(rowIndex)) return false;
    }
    return true;
  }

  #rowFromEvent(event) {
    const rowElement = event.target.closest(".row[data-row-index]");
    return rowElement ? this.#rowCache.get(Number(rowElement.dataset.rowIndex)) : undefined;
  }

  #handleClick(event) {
    const row = this.#rowFromEvent(event);
    if (!row) return;
    const copyButton = event.target.closest("[data-copy]");
    if (copyButton) {
      this.#emit("node-copy", { nodeIndex: row.nodeIndex, part: copyButton.dataset.copy });
      return;
    }
    if (event.target.closest("[data-action=toggle]")) this.#emit("node-toggle", { nodeIndex: row.nodeIndex });
    this.#emit("node-select", { nodeIndex: row.nodeIndex });
  }

  #handleDoubleClick(event) {
    const row = this.#rowFromEvent(event);
    const partElement = event.target.closest("[data-part]");
    if (!row || row.isClosing || !partElement || event.target.closest("[data-copy]")) return;
    this.#beginEdit(row, partElement.dataset.part);
  }

  #handleKeyDown(event) {
    if (event.target !== this.#scroller) return;
    const selectedRow = this.#findSelectedRow();
    const actions = {
      ArrowDown: () => this.#selectRowAt(selectedRow ? selectedRow.rowIndex + 1 : this.#renderedRange.start),
      ArrowUp: () => this.#selectRowAt(selectedRow ? selectedRow.rowIndex - 1 : this.#renderedRange.start),
      ArrowRight: () => this.#setSelectedExpanded(selectedRow, true),
      ArrowLeft: () => this.#setSelectedExpanded(selectedRow, false),
      Enter: () => selectedRow && this.#beginEdit(selectedRow, "value")
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  #selectRowAt(rowIndex) {
    if (rowIndex < 0 || rowIndex >= this.rowCount) return;
    const row = this.#rowCache.get(rowIndex);
    if (!row) return;
    this.#emit("node-select", { nodeIndex: row.nodeIndex });
    this.scrollToRow(rowIndex);
  }

  #setSelectedExpanded(row, isExpanded) {
    if (!row || row.isClosing || row.childCount === undefined || row.childCount === 0) return;
    if (row.isCollapsed === isExpanded) this.#emit("node-toggle", { nodeIndex: row.nodeIndex });
  }

  #findSelectedRow() {
    for (const row of this.#rowCache.values()) {
      if (!row.isClosing && row.nodeIndex === this.selectedNodeIndex) return row;
    }
    return undefined;
  }

  async #beginEdit(row, part) {
    const isContainer = row.type === NODE_TYPE.ARRAY || row.type === NODE_TYPE.OBJECT;
    if (!this.isEditable || !this.nodeTextProvider) return;
    if (part === "key" && row.keyText === null) return;
    if (part === "value" && isContainer) return;
    const rawText = await this.nodeTextProvider(row.nodeIndex, part);
    const isString = part === "key" || row.type === NODE_TYPE.STRING;
    const { draft, encoding } = createDraft(rawText, isString);
    this.editState = { nodeIndex: row.nodeIndex, part, draft, initialDraft: draft, encoding, errorMessage: null, needsFocus: true, isCommitting: false };
  }

  #focusInlineEditor() {
    const editor = this.renderRoot.querySelector(".inline-editor");
    if (!editor) return;
    this.editState.needsFocus = false;
    editor.focus();
    editor.select();
  }

  #handleEditorKeyDown(event) {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      this.#finishEdit();
    } else if (event.key === "Enter") {
      event.preventDefault();
      this.#commitEdit();
    }
  }

  async #commitEdit() {
    const editState = this.editState;
    if (!editState || editState.isCommitting) return;
    if (editState.draft === editState.initialDraft) {
      this.#finishEdit();
      return;
    }
    this.editState = { ...editState, isCommitting: true };
    const result = await this.editHandler({
      nodeIndex: editState.nodeIndex,
      part: editState.part,
      replacementText: encodeDraft(editState.draft, editState.encoding)
    });
    if (this.editState === null) return;
    if (result.isSaved) this.editState = null;
    else this.editState = { ...this.editState, isCommitting: false, errorMessage: result.message };
  }

  #finishEdit() {
    this.editState = null;
    this.focusTree();
  }

  #emit(eventName, detail) {
    this.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true, composed: true }));
  }
}

function createDraft(rawText, isString) {
  if (!isString) return { draft: rawText, encoding: EDIT_ENCODING.RAW_LITERAL };
  const decoded = JSON.parse(rawText);
  if (LINE_BREAK_PATTERN.test(decoded)) return { draft: rawText.slice(1, -1), encoding: EDIT_ENCODING.RAW_STRING_CONTENT };
  return { draft: decoded, encoding: EDIT_ENCODING.DECODED_STRING };
}

function encodeDraft(draft, encoding) {
  if (encoding === EDIT_ENCODING.DECODED_STRING) return JSON.stringify(draft);
  if (encoding === EDIT_ENCODING.RAW_STRING_CONTENT) return `"${draft}"`;
  return draft.trim();
}

function openingBracket(type) {
  return type === NODE_TYPE.OBJECT ? "{" : "[";
}

function closingBracket(type) {
  return type === NODE_TYPE.OBJECT ? "}" : "]";
}

function describeChildCount(row) {
  const noun = row.type === NODE_TYPE.OBJECT ? "key" : "item";
  return `${row.childCount.toLocaleString()} ${noun}${row.childCount === 1 ? "" : "s"}`;
}

customElements.define("json-tree-view", JsonTreeView);
