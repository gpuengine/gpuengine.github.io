const EXAMPLE_NAME_PATTERN = /^[a-z0-9-]+$/;
const DEFAULT_EXAMPLE_NAME = "first-triangle";
const TAB_TEXT = "  ";

const editor = document.getElementById("playground-code");
const result = document.getElementById("playground-result");
const titleLabel = document.getElementById("playground-title");
const lessonLink = document.getElementById("playground-lesson");
let originalSource = "";

startEditor();

async function startEditor() {
  const exampleName = readExampleName();
  bindControls();
  try {
    originalSource = await fetchExampleSource(exampleName);
  } catch {
    originalSource = `<!doctype html>\n<p style="color:#e6e8eb;font-family:system-ui">The example "${exampleName}" could not be found.</p>\n`;
  }
  editor.value = originalSource;
  describeExample(originalSource);
  runCode();
}

function readExampleName() {
  const requested = new URLSearchParams(location.search).get("example") || DEFAULT_EXAMPLE_NAME;
  return EXAMPLE_NAME_PATTERN.test(requested) ? requested : DEFAULT_EXAMPLE_NAME;
}

async function fetchExampleSource(exampleName) {
  const response = await fetch(`/site/tutorials/examples/${exampleName}.html`);
  if (!response.ok) throw new Error(`Example ${exampleName} not found`);
  return response.text();
}

function describeExample(source) {
  const parsed = new DOMParser().parseFromString(source, "text/html");
  if (parsed.title) {
    titleLabel.textContent = parsed.title;
    document.title = `${parsed.title} — WebGPU Playground | gpuengine`;
  }
  const lessonPath = parsed.querySelector('meta[name="lesson"]')?.content;
  if (lessonPath && lessonPath.startsWith("/site/tutorials/")) {
    lessonLink.href = lessonPath;
    lessonLink.textContent = "Back to the lesson";
  }
}

function runCode() {
  result.srcdoc = editor.value;
}

function bindControls() {
  document.getElementById("playground-run").addEventListener("click", runCode);
  document.getElementById("playground-reset").addEventListener("click", () => {
    editor.value = originalSource;
    runCode();
  });
  editor.addEventListener("keydown", handleEditorKey);
}

function handleEditorKey(event) {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    runCode();
    return;
  }
  if (event.key === "Tab" && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    if (!document.execCommand("insertText", false, TAB_TEXT)) {
      editor.setRangeText(TAB_TEXT, editor.selectionStart, editor.selectionEnd, "end");
    }
  }
}
