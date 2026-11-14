const UNSUPPORTED_MESSAGE = "This demo needs WebGPU: a recent Chrome, Edge or Safari, or Firefox on Windows.";

for (const figure of document.querySelectorAll("[data-wgpu3d-demo]")) prepareDemo(figure);

function prepareDemo(figure) {
  const startButton = figure.querySelector(".wgpu3d-demo-start");
  if (!navigator.gpu) {
    startButton.disabled = true;
    showMessage(figure, UNSUPPORTED_MESSAGE);
    return;
  }
  startButton.addEventListener("click", () => runDemo(figure), { once: true });
}

async function runDemo(figure) {
  figure.classList.add("is-running");
  const source = document.getElementById(figure.dataset.wgpu3dDemo).textContent;
  const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  try {
    await import(moduleUrl);
    figure.querySelector("canvas").focus({ preventScroll: true });
  } catch (error) {
    figure.classList.remove("is-running");
    showMessage(figure, `The demo could not start: ${error.message}`);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}

function showMessage(figure, text) {
  const message = figure.querySelector(".wgpu3d-demo-message");
  message.textContent = text;
  message.hidden = false;
}
