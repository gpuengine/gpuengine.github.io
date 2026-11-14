// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const CityDriveGame = {
  title: "Manhattan Drive",

  start({ renderer, treeSpeciesMeshes }) {
    renderer.setTreeMeshLibrary(treeSpeciesMeshes);
    initWorldGraph(renderer);
    bindDriveHudControls();
    updateBiomeButtonsUI();
    onWeatherChange(() => updateBiomeButtonsUI());
  },

  isWorldReady() {
    return isInitialWorldBuilt();
  },

  prepareWorld(dt, { renderer }) {
    streamWorldAroundCar(state.car, renderer, dt);
  },

  update(dt, { renderer, sound }) {
    const dynamicMesh = updateSimulation(dt, renderer, sound);
    updateMinimap(dt);
    return { dynamicMesh };
  },

  handleKeyDown(event) {
    return handleDriveKeyDown(event);
  }
};
