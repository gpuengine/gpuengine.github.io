import{css as e}from"lit";export const checkerboardStyles=e`
  :host {
    --checkerboard: repeating-conic-gradient(#cfc8c2 0 25%, #fbf9f7 0 50%) 0 0 / 12px 12px;
  }
`,baseStyles=e`
  *, *::before, *::after {
    box-sizing: border-box;
  }

  :host {
    font: 0.85rem/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
    color: var(--text);
  }

  button, input, select, textarea {
    font: inherit;
    color: inherit;
  }

  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    min-height: 1.9rem;
    padding: 0 0.65rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
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

  .button[aria-pressed="true"], .button--primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }

  .button--icon {
    width: 1.9rem;
    padding: 0;
  }

  .button--small {
    min-height: 1.6rem;
    padding: 0 0.5rem;
    font-size: 0.75rem;
  }

  :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  select, .text-input {
    min-height: 1.9rem;
    padding: 0 0.5rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg);
  }

  .text-input {
    font-family: var(--mono);
    font-size: 0.8rem;
  }

  .text-input[aria-invalid="true"] {
    border-color: #ef4444;
  }
`,panelStyles=e`
  .section {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin: 0;
    color: var(--muted);
    font: 600 0.7rem var(--mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .row-label {
    width: 5.5rem;
    flex: none;
    color: var(--muted);
  }

  .preset-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .preset-button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.25rem 0.6rem;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--bg);
    font-size: 0.75rem;
    cursor: pointer;
  }

  .preset-button:hover {
    border-color: var(--accent);
  }

  .item-list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.35rem 0.3rem 0.5rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--bg);
  }

  .item[aria-current="true"] {
    border-color: var(--accent);
  }

  .item-select {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0;
    border: 0;
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .item-summary {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: 0.75rem var(--mono);
  }

  .item-swatch {
    width: 1rem;
    height: 1rem;
    flex: none;
    border-radius: 4px;
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.2);
    background: linear-gradient(var(--swatch), var(--swatch)), var(--checkerboard);
  }

  .hint {
    margin: 0;
    color: var(--muted);
    font-size: 0.78rem;
  }
`,editorLayoutStyles=e`
  :host {
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--controls-width, 23rem);
    min-height: 0;
    height: 100%;
  }

  .preview {
    position: relative;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .preview > preview-stage {
    flex: 1;
    min-height: 0;
  }

  .controls {
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
    padding: 1rem;
    border-left: 1px solid var(--line);
    background: var(--surface);
  }

  @media (max-width: 800px) {
    :host {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto auto;
      height: auto;
    }

    .preview {
      height: min(26rem, 62vh);
    }

    .controls {
      overflow: visible;
      border-left: 0;
      border-top: 1px solid var(--line);
    }
  }
`,editorStyles=[baseStyles,checkerboardStyles,panelStyles,editorLayoutStyles];
