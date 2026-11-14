// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const HEADER_REVEAL_ZONE_PIXELS = 24;
const FULLSCREEN_SHORTCUT_CODE = "KeyF";

setUpGameStage();

function setUpGameStage() {
  const fullscreenButton = document.querySelector(".game-fullscreen-button");
  if (!fullscreenButton) return;
  const pageRoot = document.documentElement;
  const header = document.querySelector(".site-header");

  fullscreenButton.addEventListener("click", () => toggleFullscreen(pageRoot));
  window.addEventListener("keydown", (event) => {
    if (event.code === FULLSCREEN_SHORTCUT_CODE && !event.repeat && !event.metaKey && !event.ctrlKey) toggleFullscreen(pageRoot);
    const isExpandedWithoutFullscreenApi = pageRoot.classList.contains("is-game-fullscreen") && !document.fullscreenElement;
    if (event.code === "Escape" && isExpandedWithoutFullscreenApi) setFullscreenState(pageRoot, fullscreenButton, false);
  });
  document.addEventListener("fullscreenchange", () => setFullscreenState(pageRoot, fullscreenButton, Boolean(document.fullscreenElement)));
  document.addEventListener("mousemove", (event) => updateHeaderPeek(pageRoot, header, event.clientY));
  document.addEventListener("mouseleave", () => pageRoot.classList.remove("is-header-peeking"));
}

function toggleFullscreen(pageRoot) {
  const isFullscreen = pageRoot.classList.contains("is-game-fullscreen");
  if (!pageRoot.requestFullscreen) {
    setFullscreenState(pageRoot, document.querySelector(".game-fullscreen-button"), !isFullscreen);
    return;
  }
  if (isFullscreen) document.exitFullscreen().catch(() => {});
  else pageRoot.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
}

function setFullscreenState(pageRoot, fullscreenButton, isFullscreen) {
  pageRoot.classList.toggle("is-game-fullscreen", isFullscreen);
  pageRoot.classList.remove("is-header-peeking");
  fullscreenButton.setAttribute("aria-label", isFullscreen ? "Exit full screen" : "Enter full screen");
  fullscreenButton.title = isFullscreen ? "Exit full screen (Esc)" : "Full screen (F)";
}

function updateHeaderPeek(pageRoot, header, pointerY) {
  if (!pageRoot.classList.contains("is-game-fullscreen")) return;
  const isPeeking = pageRoot.classList.contains("is-header-peeking");
  const keepVisibleBelowPixels = isPeeking ? header.offsetHeight : HEADER_REVEAL_ZONE_PIXELS;
  pageRoot.classList.toggle("is-header-peeking", pointerY <= keepVisibleBelowPixels);
}
