// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const HARD_RELOAD_MAX_WAIT_MILLISECONDS = 4000;
const HARD_RELOAD_BUTTON_SELECTOR = "[data-hard-reload]";
const HARD_RELOAD_BUSY_CLASS = "is-reloading";

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(HARD_RELOAD_BUTTON_SELECTOR).forEach((button) => {
    button.addEventListener("click", hardReloadPage);
  });
});

async function hardReloadPage() {
  document.querySelectorAll(HARD_RELOAD_BUTTON_SELECTOR).forEach((button) => {
    button.disabled = true;
    button.classList.add(HARD_RELOAD_BUSY_CLASS);
  });
  await Promise.race([discardCachedCopies(), waitMilliseconds(HARD_RELOAD_MAX_WAIT_MILLISECONDS)]);
  location.reload();
}

function discardCachedCopies() {
  return Promise.allSettled([unregisterServiceWorkers(), clearCacheStorage(), refetchPageResources()]);
}

async function unregisterServiceWorkers() {
  if (!navigator.serviceWorker) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}

async function clearCacheStorage() {
  if (!window.caches) return;
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
}

function refetchPageResources() {
  return Promise.allSettled(collectPageResourceUrls().map((url) => fetch(url, { cache: "reload" })));
}

function collectPageResourceUrls() {
  const scriptUrls = [...document.scripts].map((script) => script.src).filter(Boolean);
  const stylesheetUrls = [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.href);
  const workerUrls = typeof WORLD_BUILD_WORKER_URL === "string" ? [new URL(WORLD_BUILD_WORKER_URL, location.href).href] : [];
  return [location.href, ...scriptUrls, ...stylesheetUrls, ...workerUrls];
}

function waitMilliseconds(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
