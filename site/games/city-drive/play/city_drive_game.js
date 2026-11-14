// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar
const CityDriveGame={title:"Manhattan Drive",start({renderer:e,treeSpeciesMeshes:t}){e.setTreeMeshLibrary(t),initWorldGraph(e),bindDriveHudControls(),updateBiomeButtonsUI(),onWeatherChange(()=>updateBiomeButtonsUI())},isWorldReady(){return isInitialWorldBuilt()},prepareWorld(e,{renderer:t}){streamWorldAroundCar(state.car,t,e)},update(e,{renderer:t,sound:a}){const r=updateSimulation(e,t,a);return updateMinimap(e),{dynamicMesh:r}},handleKeyDown(e){return handleDriveKeyDown(e)}};
