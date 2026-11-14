import { LitElement, html, css, nothing } from "lit";
import { JsonDocumentClient } from "./json_document_client.js";
import { boxSizingStyles, toolbarStyles } from "./shared_styles.js";
import "./json_source_pane.js";
import "./json_tree_view.js";
import "./json_search_bar.js";

const TEXTAREA_CHARACTER_LIMIT = 16_000_000;
const SMALL_TEXT_CHARACTERS = 200_000;
const MEDIUM_TEXT_CHARACTERS = 5_000_000;
const PARSE_DELAY_MILLISECONDS = Object.freeze({ SMALL: 120, MEDIUM: 350, LARGE: 800 });
const SPLIT_PERCENT = Object.freeze({ DEFAULT: 42, MIN: 20, MAX: 80, KEYBOARD_STEP: 4 });
const SPLIT_STORAGE_KEY = "json-viewer-split-percent";
const NOTICE_MILLISECONDS = 1800;
const PRETTY_INDENT = "  ";
const MINIFIED_INDENT = "";
const DOCUMENT_STATUS = Object.freeze({ VALID: "valid", INVALID: "invalid", EMPTY: "empty" });
const SAMPLE_DOCUMENT = {
  store: "Northwind Books",
  isOpen: true,
  rating: 4.7,
  manager: null,
  address: { street: "12 Harbour Road", city: "Lisbon", postcode: "1100-148", coordinates: [38.7071, -9.1355] },
  tags: ["fiction", "travel", "children", "café"],
  books: [
    { id: 1, title: "The Long Coast", author: "Inês Duarte", price: 18.5, inStock: true, formats: ["hardback", "ebook"] },
    { id: 2, title: "Maps of Small Islands", author: "Tom Reyes", price: 24, inStock: false, formats: ["paperback"] },
    { id: 3, title: "Night Trains", author: "Ada Okafor", price: 12.99, inStock: true, formats: [] }
  ],
  openingHours: { monday: "09:00-19:00", saturday: "10:00-14:00", sunday: null }
};
const NUMBER_FORMAT = new Intl.NumberFormat();

export class JsonWorkbench extends LitElement {
  static properties = {
    documentState: { state: true },
    rowCount: { state: true },
    layoutRevision: { state: true },
    selectedNode: { state: true },
    search: { state: true },
    searchAvailability: { state: true },
    isSourceDetached: { state: true },
    isSourceWrapped: { state: true },
    splitPercent: { state: true },
    notice: { state: true },
    isDraggingFile: { state: true }
  };

  static styles = [boxSizingStyles, toolbarStyles, css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
      background: var(--bg);
      font: 0.9rem/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
    }

    .panes {
      position: relative;
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(0, var(--split-percent)) 6px minmax(0, 1fr);
    }

    .pane {
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      background: var(--surface);
    }

    .pane-header {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      min-height: 2.75rem;
      padding: 0.4rem 0.6rem;
      border-bottom: 1px solid var(--line);
      overflow-x: auto;
      scrollbar-width: none;
    }

    .pane-title {
      margin: 0 0.4rem 0 0.2rem;
      font: 600 0.72rem var(--mono);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .pane-header json-search-bar {
      flex: 1;
      margin-left: 0.4rem;
    }

    .pane-body {
      position: relative;
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    json-source-pane, json-tree-view {
      flex: 1;
      min-height: 0;
    }

    .splitter {
      cursor: col-resize;
      background: var(--line);
      touch-action: none;
    }

    .splitter:hover, .splitter:focus-visible {
      background: var(--accent);
      outline: none;
    }

    .stale-banner {
      padding: 0.35rem 0.75rem;
      border-bottom: 1px solid var(--line);
      background: rgb(250 204 21 / 0.12);
      color: var(--text);
      font-size: 0.8rem;
    }

    .status-bar {
      display: flex;
      align-items: center;
      gap: 1rem;
      min-height: 2rem;
      padding: 0.25rem 0.75rem;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font: 0.75rem var(--mono);
      white-space: nowrap;
      overflow: hidden;
    }

    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    .status-dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background: var(--muted);
    }

    .status-dot.is-valid { background: var(--success); }
    .status-dot.is-invalid { background: #f87171; }

    .selected-path {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--text);
      text-align: right;
    }

    .status-bar .tool-button {
      height: 1.5rem;
      font-size: 0.72rem;
    }

    .notice {
      color: var(--accent);
    }

    .drop-overlay {
      position: absolute;
      inset: 0;
      z-index: 5;
      display: grid;
      place-items: center;
      border: 2px dashed var(--accent);
      background: rgb(17 14 12 / 0.75);
      color: var(--text);
      font-size: 1.1rem;
      pointer-events: none;
    }

    .file-input {
      display: none;
    }

    @media (max-width: 800px) {
      .panes {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr) 1px minmax(0, 1.4fr);
      }

      .splitter {
        pointer-events: none;
      }

      .is-optional {
        display: none;
      }

      .pane-header {
        flex-wrap: wrap;
        overflow-x: visible;
      }

      .pane-header .tree-search {
        flex-basis: 100%;
        margin-left: 0;
      }

      .status-bar {
        gap: 0.5rem;
      }
    }
  `];

  #client = new JsonDocumentClient();
  #sourceText = "";
  #fileName = "data.json";
  #parseTimer = 0;
  #loadSequence = 0;
  #searchSequence = 0;
  #isJumpToFirstMatchPending = false;
  #noticeTimer = 0;
  #handleWindowKeyDown = (event) => this.#focusSearchOnShortcut(event);

  constructor() {
    super();
    this.documentState = { status: DOCUMENT_STATUS.EMPTY };
    this.rowCount = 0;
    this.layoutRevision = 0;
    this.selectedNode = null;
    this.search = createEmptySearch();
    this.searchAvailability = { isAvailable: true, reason: "" };
    this.isSourceDetached = false;
    this.isSourceWrapped = true;
    this.splitPercent = readStoredSplitPercent();
    this.notice = "";
    this.isDraggingFile = false;
    this.rowProvider = (startRow, rowCount) => this.#client.request("rows", { startRow, rowCount });
    this.nodeTextProvider = async (nodeIndex, part) => (await this.#client.request("nodeText", { nodeIndex, part })).text;
    this.editHandler = (request) => this.#editNode(request);
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("keydown", this.#handleWindowKeyDown);
    this.#client.request("probeSearch").then((availability) => { this.searchAvailability = availability; });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this.#handleWindowKeyDown);
  }

  render() {
    const isValid = this.documentState.status === DOCUMENT_STATUS.VALID;
    return html`
      <div class="panes" style="--split-percent: ${this.splitPercent}%"
        @dragover=${this.#handleDragOver} @dragleave=${this.#handleDragLeave} @drop=${this.#handleDrop}>
        <section class="pane" aria-label="JSON input">
          <div class="pane-header">
            <h2 class="pane-title">Input</h2>
            <button class="tool-button" @click=${this.#openFilePicker}>Open file</button>
            <button class="tool-button" ?disabled=${!isValid} @click=${() => this.#reformatSource(PRETTY_INDENT)}>Format</button>
            <button class="tool-button" ?disabled=${!isValid} @click=${() => this.#reformatSource(MINIFIED_INDENT)}>Minify</button>
            <button class="tool-button" aria-pressed=${String(this.isSourceWrapped)} title="Wrap long lines"
              @click=${() => { this.isSourceWrapped = !this.isSourceWrapped; }}>Wrap</button>
            <button class="tool-button is-optional" ?disabled=${!this.#sourceText} @click=${this.#copySource}>Copy</button>
            <button class="tool-button is-optional" ?disabled=${!this.#sourceText} @click=${this.#downloadSource}>Download</button>
            <button class="tool-button is-optional" @click=${this.#loadSample}>Sample</button>
            <button class="tool-button" ?disabled=${!this.#sourceText} @click=${() => this.#replaceSource("", "data.json")}>Clear</button>
            <input class="file-input" type="file" accept=".json,application/json,text/plain" @change=${this.#handleFileChosen}>
          </div>
          <div class="pane-body">
            <json-source-pane .errorInfo=${this.documentState.status === DOCUMENT_STATUS.INVALID ? this.documentState.error : null}
              .isDetached=${this.isSourceDetached} .isWrapped=${this.isSourceWrapped} .detachedSummary=${`${this.#fileName} · ${formatSize(this.#sourceText.length)}`}
              @source-input=${this.#handleSourceInput} @attach-request=${this.#attachSource}></json-source-pane>
          </div>
        </section>
        <div class="splitter" role="separator" aria-orientation="vertical" aria-label="Resize panes" tabindex="0"
          aria-valuemin=${SPLIT_PERCENT.MIN} aria-valuemax=${SPLIT_PERCENT.MAX} aria-valuenow=${Math.round(this.splitPercent)}
          @pointerdown=${this.#startSplitDrag} @keydown=${this.#handleSplitterKey}></div>
        <section class="pane" aria-label="JSON tree">
          <div class="pane-header">
            <h2 class="pane-title">Tree</h2>
            <button class="tool-button" ?disabled=${this.rowCount === 0} @click=${() => this.#changeLayout("expandAll")}>Expand all</button>
            <button class="tool-button" ?disabled=${this.rowCount === 0} @click=${() => this.#changeLayout("collapseAll")}>Collapse all</button>
            <json-search-bar class="tree-search" .resultLabel=${this.#describeSearchResult()} .hasResults=${this.search.nodeIndices.length > 0}
              .isDisabled=${!this.searchAvailability.isAvailable} .disabledReason=${this.searchAvailability.reason || ""}
              @search-change=${this.#handleSearchChange} @search-step=${this.#handleSearchStep}></json-search-bar>
          </div>
          <div class="pane-body">
            ${this.documentState.status === DOCUMENT_STATUS.INVALID && this.documentState.hasPreviousDocument
              ? html`<div class="stale-banner">The input has an error. Showing the last valid JSON.</div>` : nothing}
            <json-tree-view .rowCount=${this.rowCount} .layoutRevision=${this.layoutRevision}
              .selectedNodeIndex=${this.selectedNode ? this.selectedNode.nodeIndex : -1}
              .highlightQuery=${this.search.query} .isHighlightCaseSensitive=${this.search.isCaseSensitive}
              .isEditable=${isValid} .placeholderText=${this.#describeEmptyTree()}
              .rowProvider=${this.rowProvider} .nodeTextProvider=${this.nodeTextProvider} .editHandler=${this.editHandler}
              @node-toggle=${this.#handleNodeToggle} @node-select=${this.#handleNodeSelect}
              @node-copy=${this.#handleNodeCopy}></json-tree-view>
          </div>
        </section>
        ${this.isDraggingFile ? html`<div class="drop-overlay">Drop a JSON file to open it</div>` : nothing}
      </div>
      ${this.#renderStatusBar()}
    `;
  }

  #renderStatusBar() {
    const { status } = this.documentState;
    return html`<footer class="status-bar" aria-live="polite">
      <span class="status-chip"><span class="status-dot is-${status}"></span>${this.#describeDocumentStatus()}</span>
      ${this.search.milliseconds !== null ? html`<span class="is-optional">WebGPU search ${this.search.milliseconds.toFixed(1)} ms</span>` : nothing}
      ${this.notice ? html`<span class="notice">${this.notice}</span>` : nothing}
      <span class="selected-path" title=${this.selectedNode?.path ?? ""}>${this.selectedNode?.path ?? ""}</span>
      ${this.selectedNode ? html`
        <button class="tool-button" @click=${this.#copySelectedPath}>Copy path</button>
        <button class="tool-button is-optional" @click=${this.#copySelectedValue}>Copy value</button>` : nothing}
    </footer>`;
  }

  #describeDocumentStatus() {
    const state = this.documentState;
    if (state.status === DOCUMENT_STATUS.EMPTY) return "No input";
    if (state.status === DOCUMENT_STATUS.INVALID) return `Invalid JSON at line ${state.error.line}`;
    return html`Valid<span class="is-optional"> · ${NUMBER_FORMAT.format(state.nodeCount)} nodes · ${formatSize(state.textLength)} · parsed in ${state.parseMilliseconds.toFixed(0)} ms</span>`;
  }

  #describeEmptyTree() {
    if (this.documentState.status === DOCUMENT_STATUS.INVALID) return "Fix the error in the input to see the tree.";
    return "Paste JSON on the left, open a file, or drop one here.";
  }

  #describeSearchResult() {
    const { query, nodeIndices, activeMatch, isSearching, errorMessage, isTruncated } = this.search;
    if (!query) return "";
    if (isSearching) return "…";
    if (errorMessage) return errorMessage;
    if (nodeIndices.length === 0) return "No matches";
    const total = `${NUMBER_FORMAT.format(nodeIndices.length)}${isTruncated ? "+" : ""}`;
    if (activeMatch >= 0) return `${NUMBER_FORMAT.format(activeMatch + 1)} / ${total}`;
    return `${total} ${nodeIndices.length === 1 && !isTruncated ? "match" : "matches"}`;
  }

  #handleSourceInput() {
    clearTimeout(this.#parseTimer);
    const pane = this.#sourcePane();
    this.#parseTimer = setTimeout(() => {
      this.#sourceText = pane.readText();
      this.#loadSource();
    }, parseDelayFor(this.#sourceText.length));
  }

  async #loadSource() {
    clearTimeout(this.#parseTimer);
    const sequence = ++this.#loadSequence;
    const summary = await this.#client.request("load", { text: this.#sourceText });
    if (sequence !== this.#loadSequence) return;
    this.#applyLoadSummary(summary);
  }

  #applyLoadSummary(summary) {
    const previousNodeCount = this.documentState.nodeCount;
    this.documentState = summary;
    this.rowCount = summary.rowCount;
    this.layoutRevision = summary.layoutRevision;
    if (summary.status === DOCUMENT_STATUS.INVALID) return;
    if (summary.status === DOCUMENT_STATUS.EMPTY || summary.nodeCount !== previousNodeCount) this.selectedNode = null;
    if (this.search.query) this.#runSearch({ shouldJumpToFirst: false });
  }

  #replaceSource(text, fileName) {
    this.#sourceText = text;
    this.#fileName = fileName;
    this.isSourceDetached = text.length > TEXTAREA_CHARACTER_LIMIT;
    this.selectedNode = null;
    this.updateComplete.then(() => {
      if (!this.isSourceDetached) this.#sourcePane().setText(text);
    });
    this.#loadSource();
  }

  async #attachSource() {
    this.isSourceDetached = false;
    await this.updateComplete;
    await this.#sourcePane().updateComplete;
    this.#sourcePane().setText(this.#sourceText);
  }

  async #reformatSource(indentUnit) {
    const { text } = await this.#client.request("format", { indentUnit });
    this.#replaceSource(text, this.#fileName);
  }

  #loadSample() {
    this.#replaceSource(JSON.stringify(SAMPLE_DOCUMENT, null, 2), "sample.json");
  }

  #openFilePicker() {
    this.renderRoot.querySelector(".file-input").click();
  }

  async #handleFileChosen(event) {
    const [file] = event.target.files;
    event.target.value = "";
    if (file) await this.#openFile(file);
  }

  async #openFile(file) {
    this.#showNotice(`Reading ${file.name}…`);
    this.#replaceSource(await file.text(), file.name);
  }

  #handleDragOver(event) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    this.isDraggingFile = true;
  }

  #handleDragLeave(event) {
    if (event.relatedTarget && this.renderRoot.contains(event.relatedTarget)) return;
    this.isDraggingFile = false;
  }

  async #handleDrop(event) {
    event.preventDefault();
    this.isDraggingFile = false;
    const [file] = event.dataTransfer.files;
    if (file) await this.#openFile(file);
  }

  async #copySource() {
    await this.#copyText(this.#sourceText, "Copied input");
  }

  #downloadSource() {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([this.#sourceText], { type: "application/json" }));
    link.download = this.#fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  }

  async #changeLayout(command) {
    this.#applyLayoutSummary(await this.#client.request(command));
  }

  #applyLayoutSummary({ rowCount, layoutRevision }) {
    this.rowCount = rowCount;
    this.layoutRevision = layoutRevision;
  }

  async #handleNodeToggle(event) {
    this.#applyLayoutSummary(await this.#client.request("toggle", { nodeIndex: event.detail.nodeIndex }));
  }

  async #handleNodeSelect(event) {
    const info = await this.#client.request("describeNode", { nodeIndex: event.detail.nodeIndex });
    this.selectedNode = info;
  }

  async #copySelectedPath() {
    await this.#copyText(this.selectedNode.path, "Copied path");
  }

  async #copySelectedValue() {
    await this.#copyNodePart(this.selectedNode.nodeIndex, "value");
  }

  async #handleNodeCopy(event) {
    await this.#copyNodePart(event.detail.nodeIndex, event.detail.part);
  }

  async #copyNodePart(nodeIndex, part) {
    const { text } = await this.#client.request("copyPart", { nodeIndex, part });
    await this.#copyText(text, part === "key" ? "Copied key" : "Copied value");
  }

  async #editNode(request) {
    try {
      const result = await this.#client.request("editNode", request);
      this.#sourceText = result.text;
      if (!this.isSourceDetached) this.#sourcePane().setText(result.text);
      this.#loadSequence++;
      this.#applyLoadSummary(result);
      return { isSaved: true };
    } catch (error) {
      return { isSaved: false, message: error.message };
    }
  }

  #handleSearchChange(event) {
    this.search = { ...createEmptySearch(), ...event.detail };
    this.#runSearch({ shouldJumpToFirst: true });
  }

  async #runSearch({ shouldJumpToFirst }) {
    const sequence = ++this.#searchSequence;
    if (shouldJumpToFirst) this.#isJumpToFirstMatchPending = true;
    const { query, isCaseSensitive, scope } = this.search;
    if (!query || this.rowCount === 0) {
      this.search = { ...this.search, nodeIndices: new Int32Array(0), activeMatch: -1, isSearching: false, milliseconds: null };
      return;
    }
    this.search = { ...this.search, isSearching: true, errorMessage: "" };
    try {
      const result = await this.#client.request("search", { query, isCaseSensitive, scope });
      if (sequence !== this.#searchSequence) return;
      this.search = {
        ...this.search,
        nodeIndices: result.nodeIndices,
        isTruncated: result.isTruncated,
        milliseconds: result.milliseconds,
        activeMatch: -1,
        isSearching: false
      };
      const shouldJump = this.#isJumpToFirstMatchPending;
      this.#isJumpToFirstMatchPending = false;
      if (shouldJump && result.nodeIndices.length > 0) await this.#goToMatch(0);
    } catch (error) {
      if (sequence !== this.#searchSequence) return;
      this.search = { ...this.search, nodeIndices: new Int32Array(0), activeMatch: -1, isSearching: false, errorMessage: error.message };
    }
  }

  async #handleSearchStep(event) {
    const matchCount = this.search.nodeIndices.length;
    if (matchCount === 0) return;
    const nextMatch = (this.search.activeMatch + event.detail.direction + matchCount) % matchCount;
    await this.#goToMatch(this.search.activeMatch < 0 && event.detail.direction > 0 ? 0 : nextMatch);
  }

  async #goToMatch(matchIndex) {
    const nodeIndex = this.search.nodeIndices[matchIndex];
    this.search = { ...this.search, activeMatch: matchIndex };
    const revealed = await this.#client.request("reveal", { nodeIndex });
    this.#applyLayoutSummary(revealed);
    this.selectedNode = await this.#client.request("describeNode", { nodeIndex });
    await this.updateComplete;
    this.#treeView().scrollToRow(revealed.rowIndex, "center");
  }

  #focusSearchOnShortcut(event) {
    const isFindShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f";
    if (!isFindShortcut || !this.searchAvailability.isAvailable) return;
    event.preventDefault();
    this.renderRoot.querySelector("json-search-bar").focusInput();
  }

  #startSplitDrag(event) {
    const splitter = event.currentTarget;
    const panes = this.renderRoot.querySelector(".panes");
    splitter.setPointerCapture(event.pointerId);
    const handleMove = (moveEvent) => {
      const bounds = panes.getBoundingClientRect();
      this.#setSplitPercent(((moveEvent.clientX - bounds.left) / bounds.width) * 100);
    };
    const handleUp = () => {
      splitter.removeEventListener("pointermove", handleMove);
      splitter.removeEventListener("pointerup", handleUp);
      storeSplitPercent(this.splitPercent);
    };
    splitter.addEventListener("pointermove", handleMove);
    splitter.addEventListener("pointerup", handleUp);
  }

  #handleSplitterKey(event) {
    const steps = { ArrowLeft: -SPLIT_PERCENT.KEYBOARD_STEP, ArrowRight: SPLIT_PERCENT.KEYBOARD_STEP };
    if (!(event.key in steps)) return;
    event.preventDefault();
    this.#setSplitPercent(this.splitPercent + steps[event.key]);
    storeSplitPercent(this.splitPercent);
  }

  #setSplitPercent(percent) {
    this.splitPercent = Math.min(SPLIT_PERCENT.MAX, Math.max(SPLIT_PERCENT.MIN, percent));
  }

  async #copyText(text, confirmation) {
    try {
      await navigator.clipboard.writeText(text);
      this.#showNotice(confirmation);
    } catch {
      this.#showNotice("Copy was blocked by the browser");
    }
  }

  #showNotice(message) {
    clearTimeout(this.#noticeTimer);
    this.notice = message;
    this.#noticeTimer = setTimeout(() => { this.notice = ""; }, NOTICE_MILLISECONDS);
  }

  #sourcePane() {
    return this.renderRoot.querySelector("json-source-pane");
  }

  #treeView() {
    return this.renderRoot.querySelector("json-tree-view");
  }
}

function createEmptySearch() {
  return {
    query: "",
    isCaseSensitive: false,
    scope: "all",
    nodeIndices: new Int32Array(0),
    activeMatch: -1,
    isTruncated: false,
    isSearching: false,
    errorMessage: "",
    milliseconds: null
  };
}

function parseDelayFor(textLength) {
  if (textLength < SMALL_TEXT_CHARACTERS) return PARSE_DELAY_MILLISECONDS.SMALL;
  if (textLength < MEDIUM_TEXT_CHARACTERS) return PARSE_DELAY_MILLISECONDS.MEDIUM;
  return PARSE_DELAY_MILLISECONDS.LARGE;
}

function formatSize(characterCount) {
  if (characterCount < 1024) return `${characterCount} B`;
  if (characterCount < 1024 * 1024) return `${(characterCount / 1024).toFixed(1)} KB`;
  return `${(characterCount / (1024 * 1024)).toFixed(1)} MB`;
}

function readStoredSplitPercent() {
  try {
    const stored = Number(localStorage.getItem(SPLIT_STORAGE_KEY));
    return stored >= SPLIT_PERCENT.MIN && stored <= SPLIT_PERCENT.MAX ? stored : SPLIT_PERCENT.DEFAULT;
  } catch {
    return SPLIT_PERCENT.DEFAULT;
  }
}

function storeSplitPercent(percent) {
  try {
    localStorage.setItem(SPLIT_STORAGE_KEY, String(Math.round(percent)));
  } catch {
    return;
  }
}

customElements.define("json-workbench", JsonWorkbench);
