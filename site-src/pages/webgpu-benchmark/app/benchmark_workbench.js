import { LitElement, html, css, nothing } from "lit";
import { MODES, requestWebGPU, describeEnvironment, measureMode } from "./benchmark_renderers.js";

const DEFAULT_OBJECT_COUNTS_TEXT = "1000,10000,50000";
const DEFAULT_MEASURED_FRAMES = 120;
const MINIMUM_MEASURED_FRAMES = 10;
const NOTICE_MILLISECONDS = 1600;
const RUN_STATUS = Object.freeze({ IDLE: "idle", RUNNING: "running", DONE: "done", ERROR: "error" });
const NUMBER_FORMAT = new Intl.NumberFormat("en-GB");
const IDLE_MESSAGE = "Press Run benchmark. Each mode draws on its own canvas, one after another.";
const STAGE_PLACEHOLDERS = Object.freeze({
  [RUN_STATUS.IDLE]: "The test scene appears here while the benchmark runs.",
  [RUN_STATUS.DONE]: "Run complete. See the results table.",
  [RUN_STATUS.ERROR]: "The run stopped. See the message above."
});

export class BenchmarkWorkbench extends LitElement {
  static properties = {
    objectCountsText: { state: true },
    measuredFramesText: { state: true },
    runStatus: { state: true },
    statusMessage: { state: true },
    runs: { state: true },
    environment: { state: true },
    completedRunCount: { state: true },
    plannedRunCount: { state: true },
    hasCanvas: { state: true },
    notice: { state: true }
  };

  static styles = css`
    *, *::before, *::after {
      box-sizing: border-box;
    }

    :host {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      min-height: 0;
      overflow: hidden;
      background: var(--bg);
      color: var(--text);
      font: 0.85rem/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
    }

    button, input {
      font: inherit;
      color: inherit;
    }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: 0.6rem 0.9rem;
      padding: 0.6rem var(--gutter);
      border-bottom: 1px solid var(--line);
      background: var(--surface);
    }

    .field {
      display: grid;
      gap: 0.2rem;
      color: var(--muted);
      font-size: 0.75rem;
    }

    .field input {
      height: 1.9rem;
      padding: 0 0.55rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--bg);
      font: 0.8rem var(--mono);
    }

    .field input:focus {
      outline: none;
      border-color: var(--accent);
    }

    .counts-input {
      width: 13rem;
    }

    .frames-input {
      width: 6rem;
    }

    .button {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      height: 1.9rem;
      padding: 0 0.75rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      font-size: 0.8rem;
      font-weight: 500;
      white-space: nowrap;
      cursor: pointer;
    }

    .button:hover:not(:disabled) {
      border-color: var(--accent);
    }

    .button:disabled {
      opacity: 0.45;
      cursor: default;
    }

    .button:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 1px;
    }

    .button--primary {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--accent-ink);
      font-weight: 600;
    }

    .status {
      flex: 1;
      min-width: 12rem;
      align-self: end;
      margin: 0;
      line-height: 1.9rem;
      color: var(--muted);
    }

    .status[data-status="error"] {
      color: #f87171;
    }

    .status[data-status="done"] {
      color: var(--success);
    }

    .panes {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
      min-height: 0;
    }

    .stage-pane {
      position: relative;
      display: grid;
      place-items: center;
      min-height: 0;
      padding: 1.25rem;
      background: #000;
      container-type: size;
    }

    .stage {
      display: grid;
      width: min(100cqw - 2.5rem, 100cqh - 2.5rem, 512px);
      aspect-ratio: 1;
      border: 1px solid #2f2823;
      border-radius: 8px;
      overflow: hidden;
    }

    .stage canvas {
      width: 100%;
      height: 100%;
    }

    .stage-placeholder {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 2rem;
      color: #a99e95;
      text-align: center;
      pointer-events: none;
    }

    .progress {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 3px;
      background: rgb(255 255 255 / 0.08);
    }

    .progress-fill {
      height: 100%;
      background: var(--accent);
      transition: width 0.25s ease;
    }

    .results-pane {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      min-height: 0;
      overflow: auto;
      overscroll-behavior: contain;
      padding: 1rem var(--gutter) 1.25rem 1.25rem;
      border-left: 1px solid var(--line);
      background: var(--surface);
    }

    .results-heading {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      color: var(--muted);
      font: 600 0.7rem var(--mono);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .results-heading span {
      margin-right: auto;
    }

    .table-scroll {
      overflow-x: auto;
      overscroll-behavior-x: contain;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--bg);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
      font-variant-numeric: tabular-nums;
    }

    th, td {
      padding: 0.45rem 0.6rem;
      border-bottom: 1px solid var(--line);
      text-align: right;
      white-space: nowrap;
    }

    th:first-child, td:first-child {
      min-width: 13rem;
      text-align: left;
      white-space: normal;
    }

    thead th {
      background: var(--surface-raised);
      color: var(--muted);
      font-weight: 600;
    }

    tbody tr:last-child td {
      border-bottom: 0;
    }

    .group-row td {
      padding-top: 0.6rem;
      background: var(--surface);
      color: var(--muted);
      font: 600 0.72rem var(--mono);
      letter-spacing: 0.04em;
    }

    .is-fastest {
      color: var(--accent);
      font-weight: 700;
    }

    .empty {
      color: var(--muted);
      text-align: left;
    }

    .hint {
      margin: 0;
      color: var(--muted);
      font-size: 0.78rem;
    }

    details summary {
      color: var(--accent);
      font-weight: 600;
      cursor: pointer;
    }

    pre {
      margin: 0.5rem 0 0;
      padding: 0.75rem;
      overflow-x: auto;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--bg);
      color: var(--muted);
      font: 0.75rem/1.5 var(--mono);
    }

    @media (max-width: 800px) {
      :host {
        display: block;
        overflow: auto;
        overscroll-behavior: contain;
      }

      .toolbar {
        padding-inline: 1rem;
      }

      .counts-input {
        width: min(13rem, 52vw);
      }

      .status {
        flex-basis: 100%;
        order: 1;
        line-height: 1.4;
      }

      .panes {
        display: block;
      }

      .stage-pane {
        height: min(22rem, 90vw);
      }

      .results-pane {
        overflow: visible;
        padding: 1rem;
        border-left: 0;
        border-top: 1px solid var(--line);
      }
    }
  `;

  constructor() {
    super();
    const query = new URLSearchParams(location.search);
    this.objectCountsText = query.get("counts") || DEFAULT_OBJECT_COUNTS_TEXT;
    this.measuredFramesText = query.get("frames") || String(DEFAULT_MEASURED_FRAMES);
    this.modeFilter = query.get("modes");
    this.shouldAutorun = query.has("autorun");
    this.runStatus = RUN_STATUS.IDLE;
    this.statusMessage = IDLE_MESSAGE;
    this.runs = [];
    this.environment = null;
    this.completedRunCount = 0;
    this.plannedRunCount = 0;
    this.hasCanvas = false;
    this.notice = null;
    window.benchmarkResults = { status: RUN_STATUS.IDLE, environment: null, runs: [] };
  }

  firstUpdated() {
    if (this.shouldAutorun) this.runBenchmark();
  }

  get isRunning() {
    return this.runStatus === RUN_STATUS.RUNNING;
  }

  render() {
    const progressPercent = this.plannedRunCount ? this.completedRunCount / this.plannedRunCount * 100 : 0;
    return html`
      <div class="toolbar">
        <label class="field">Object counts
          <input class="counts-input" .value=${this.objectCountsText} inputmode="numeric" spellcheck="false" ?disabled=${this.isRunning}
            @input=${(event) => { this.objectCountsText = event.target.value; }}>
        </label>
        <label class="field">Frames per run
          <input class="frames-input" .value=${this.measuredFramesText} inputmode="numeric" ?disabled=${this.isRunning}
            @input=${(event) => { this.measuredFramesText = event.target.value; }}>
        </label>
        <button class="button button--primary" type="button" ?disabled=${this.isRunning} @click=${this.runBenchmark}>
          ${this.isRunning ? "Running…" : "Run benchmark"}
        </button>
        <p class="status" role="status" data-status=${this.runStatus}>${this.statusMessage}</p>
      </div>
      <div class="panes">
        <div class="stage-pane">
          <div class="stage" aria-label="Benchmark canvas"></div>
          ${this.hasCanvas ? nothing : html`<p class="stage-placeholder">${STAGE_PLACEHOLDERS[this.runStatus]}</p>`}
          ${this.plannedRunCount ? html`<div class="progress" role="progressbar" aria-label="Benchmark progress" aria-valuemin="0"
            aria-valuemax=${this.plannedRunCount} aria-valuenow=${this.completedRunCount}><div class="progress-fill" style="width: ${progressPercent}%"></div></div>` : nothing}
        </div>
        <div class="results-pane">
          <h2 class="results-heading">
            <span>Results</span>
            ${this.notice ? html`<span class="hint">${this.notice}</span>` : nothing}
            <button class="button" type="button" ?disabled=${this.runs.length === 0} @click=${this.copyResults}>Copy JSON</button>
          </h2>
          ${this.renderResultsTable()}
          <p class="hint">Lower CPU ms is better. The fastest mode at each object count is highlighted.</p>
          <details>
            <summary>Your browser and GPU details</summary>
            <pre>${this.environment ? JSON.stringify(this.environment, null, 2) : "Environment details appear here after a run."}</pre>
          </details>
        </div>
      </div>
    `;
  }

  renderResultsTable() {
    const objectCounts = [...new Set(this.runs.map((run) => run.objectCount))];
    return html`
      <div class="table-scroll">
        <table>
          <thead><tr><th>Mode</th><th>Draw calls</th><th>CPU ms median</th><th>CPU ms p95</th><th>Upload ms</th><th>FPS</th></tr></thead>
          <tbody>
            ${this.runs.length === 0 ? html`<tr><td colspan="6" class="empty">Results appear here.</td></tr>` : nothing}
            ${objectCounts.map((objectCount) => this.renderObjectCountGroup(objectCount))}
          </tbody>
        </table>
      </div>
    `;
  }

  renderObjectCountGroup(objectCount) {
    const groupRuns = this.runs.filter((run) => run.objectCount === objectCount);
    const fastestMedian = Math.min(...groupRuns.map((run) => run.cpuMillisecondsMedian));
    const hasComparison = groupRuns.length > 1;
    return html`
      <tr class="group-row"><td colspan="6">${NUMBER_FORMAT.format(objectCount)} objects</td></tr>
      ${groupRuns.map((run) => html`
        <tr>
          <td>${run.label}</td>
          <td>${NUMBER_FORMAT.format(run.drawCallsPerFrame)}</td>
          <td class=${hasComparison && run.cpuMillisecondsMedian === fastestMedian ? "is-fastest" : ""}>${run.cpuMillisecondsMedian.toFixed(2)}</td>
          <td>${run.cpuMillisecondsP95.toFixed(2)}</td>
          <td>${run.uploadMillisecondsMean.toFixed(2)}</td>
          <td>${run.framesPerSecond.toFixed(1)}</td>
        </tr>
      `)}
    `;
  }

  readSettings() {
    const modeIds = this.modeFilter?.split(",");
    return {
      objectCounts: this.objectCountsText.split(",").map(Number).filter((count) => count > 0),
      measuredFrames: Math.max(MINIMUM_MEASURED_FRAMES, Number(this.measuredFramesText) || DEFAULT_MEASURED_FRAMES),
      modes: modeIds ? MODES.filter((mode) => modeIds.includes(mode.id)) : MODES
    };
  }

  async runBenchmark() {
    const settings = this.readSettings();
    if (settings.objectCounts.length === 0) {
      this.finishWithError("enter at least one object count, for example 1000,10000.");
      return;
    }
    this.startRun(settings);
    try {
      const gpu = await requestWebGPU();
      this.environment = await describeEnvironment(gpu.adapter);
      window.benchmarkResults.environment = this.environment;
      for (const objectCount of settings.objectCounts) {
        for (const mode of settings.modes) {
          this.statusMessage = `Running ${mode.label} with ${NUMBER_FORMAT.format(objectCount)} objects…`;
          const run = await measureMode({ mode, objectCount, measuredFrames: settings.measuredFrames, device: gpu.device, createCanvas: (sizePixels) => this.createStageCanvas(sizePixels) });
          this.recordRun(run);
        }
      }
      this.clearStage();
      this.runStatus = RUN_STATUS.DONE;
      this.statusMessage = "Done. Run it again for steadier numbers; the first run includes warm-up.";
      window.benchmarkResults.status = RUN_STATUS.DONE;
    } catch (error) {
      this.finishWithError(String(error?.message || error));
    }
  }

  startRun(settings) {
    this.runStatus = RUN_STATUS.RUNNING;
    this.runs = [];
    this.completedRunCount = 0;
    this.plannedRunCount = settings.objectCounts.length * settings.modes.length;
    window.benchmarkResults = { status: RUN_STATUS.RUNNING, environment: null, settings: { ...settings, modes: settings.modes.map((mode) => mode.id) }, runs: [] };
  }

  recordRun(run) {
    this.runs = [...this.runs, run];
    this.completedRunCount += 1;
    window.benchmarkResults.runs.push(run);
  }

  finishWithError(reason) {
    this.clearStage();
    this.runStatus = RUN_STATUS.ERROR;
    this.statusMessage = `Error: ${reason}`;
    window.benchmarkResults.status = RUN_STATUS.ERROR;
    window.benchmarkResults.error = reason;
  }

  createStageCanvas(sizePixels) {
    const stage = this.renderRoot.querySelector(".stage");
    const canvas = document.createElement("canvas");
    canvas.width = sizePixels;
    canvas.height = sizePixels;
    stage.replaceChildren(canvas);
    this.hasCanvas = true;
    return canvas;
  }

  clearStage() {
    this.renderRoot.querySelector(".stage")?.replaceChildren();
    this.hasCanvas = false;
  }

  async copyResults() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(window.benchmarkResults, null, 2));
      this.showNotice("Copied");
    } catch {
      this.showNotice("Copy failed");
    }
  }

  showNotice(message) {
    this.notice = message;
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => { this.notice = null; }, NOTICE_MILLISECONDS);
  }
}

customElements.define("benchmark-workbench", BenchmarkWorkbench);
