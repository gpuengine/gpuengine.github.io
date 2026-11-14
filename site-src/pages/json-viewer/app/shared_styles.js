import { css } from "lit";

export const boxSizingStyles = css`
  *, *::before, *::after {
    box-sizing: border-box;
  }
`;

export const toolbarStyles = css`
  .tool-button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    height: 1.9rem;
    padding: 0 0.65rem;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font: 500 0.8rem/1 system-ui, -apple-system, "Segoe UI", sans-serif;
    white-space: nowrap;
    cursor: pointer;
  }

  .tool-button:hover:not(:disabled) {
    border-color: var(--accent);
  }

  .tool-button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .tool-button:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .tool-button[aria-pressed="true"] {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }

  .tool-button--icon {
    width: 1.9rem;
    padding: 0;
    justify-content: center;
  }

  .tool-button--primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }
`;

export const jsonTokenStyles = css`
  :host {
    --json-key: #8ab4f8;
    --json-string: #7cf29c;
    --json-number: #f5b86b;
    --json-boolean: #d7a6ff;
    --json-null: #9aa3ad;
    --json-punctuation: #6f7882;
    --json-match: rgb(250 204 21 / 0.35);
    --json-selected: rgb(255 138 61 / 0.14);
    --json-hover: rgb(255 255 255 / 0.04);
  }

  @media (prefers-color-scheme: light) {
    :host {
      --json-key: #1a5fb4;
      --json-string: #0a7a33;
      --json-number: #b35900;
      --json-boolean: #8a2be2;
      --json-null: #5b636c;
      --json-punctuation: #8a929a;
      --json-match: rgb(250 204 21 / 0.45);
      --json-selected: rgb(194 65 12 / 0.09);
      --json-hover: rgb(0 0 0 / 0.035);
    }
  }
`;
