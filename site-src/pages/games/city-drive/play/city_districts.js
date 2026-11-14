// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2026 Abhishek Sengar

const GROUND_COVER = Object.freeze({ paved: "paved", lawn: "lawn" });

const CITY_DISTRICTS = [
  {
    name: "BROWNSTONE ROW",
    singleLotWeights: { brownstone: 3.0, georgian: 2.2, victorian: 1.8, savingsBank: 0.5, castIron: 0.4, gothicClock: 0.3, brutalistTower: 2.0 },
    doubleLotWeights: { grandStair: 1.0, publicSchool: 0.9, artDeco: 0.2 },
    doubleLotChance: 0.12,
    otherStyleWeight: 0.12,
    pavementStyles: [2, 4, 5],
    backdropTower: { minHeightMeters: 14, heightRangeMeters: 18, colors: [[0.52, 0.36, 0.28], [0.60, 0.46, 0.36]] },
    farTowerHeightScale: 0.55,
    farFacadeTones: [[0.55, 0.38, 0.30], [0.62, 0.48, 0.38], [0.48, 0.34, 0.28], [0.66, 0.58, 0.48]]
  },
  {
    name: "FINANCIAL CANYON",
    singleLotWeights: { limestoneSetback: 2.5, colonnade: 2.0, templeBank: 1.6, savingsBank: 1.2, bronzeGlass: 1.2, gothicClock: 0.6, brutalistTower: 4.0 },
    doubleLotWeights: { artDeco: 2.0, grandStair: 1.0 },
    doubleLotChance: 0.5,
    otherStyleWeight: 0.1,
    pavementStyles: [3, 1, 6],
    backdropTower: { minHeightMeters: 60, heightRangeMeters: 70, colors: [[0.62, 0.60, 0.56], [0.50, 0.52, 0.55]] },
    farTowerHeightScale: 1.6,
    farFacadeTones: [[0.64, 0.62, 0.58], [0.54, 0.56, 0.60], [0.70, 0.67, 0.61], [0.46, 0.48, 0.52]]
  },
  {
    name: "CAST-IRON LOFTS",
    singleLotWeights: { castIron: 3.2, storageWarehouse: 1.6, brownstone: 1.0, victorian: 1.0, georgian: 0.5, bronzeGlass: 0.4, brutalistTower: 3.0 },
    doubleLotWeights: { grandStair: 0.6, publicSchool: 0.5, artDeco: 0.4 },
    doubleLotChance: 0.15,
    otherStyleWeight: 0.12,
    pavementStyles: [4, 2, 4],
    backdropTower: { minHeightMeters: 22, heightRangeMeters: 26, colors: [[0.66, 0.60, 0.50], [0.56, 0.44, 0.36]] },
    farTowerHeightScale: 0.8,
    farFacadeTones: [[0.66, 0.58, 0.48], [0.52, 0.40, 0.34], [0.70, 0.66, 0.58], [0.58, 0.50, 0.42]]
  },
  {
    name: "CIVIC AVENUE",
    singleLotWeights: { templeBank: 2.4, colonnade: 2.2, gothicClock: 1.6, fountainPlaza: 1.6, savingsBank: 1.4, limestoneSetback: 1.0, brutalistTower: 3.0 },
    doubleLotWeights: { grandStair: 2.0, publicSchool: 1.2, artDeco: 0.5 },
    doubleLotChance: 0.4,
    otherStyleWeight: 0.12,
    pavementStyles: [1, 5, 3],
    backdropTower: { minHeightMeters: 34, heightRangeMeters: 34, colors: [[0.74, 0.71, 0.64], [0.66, 0.64, 0.58]] },
    farTowerHeightScale: 1.0,
    farFacadeTones: [[0.74, 0.71, 0.64], [0.66, 0.64, 0.58], [0.60, 0.58, 0.54], [0.70, 0.67, 0.61]]
  },
  {
    name: "GLASS MIDTOWN",
    singleLotWeights: { bronzeGlass: 3.0, fountainPlaza: 1.6, limestoneSetback: 1.0, savingsBank: 0.6, colonnade: 0.6, brutalistTower: 4.5 },
    doubleLotWeights: { artDeco: 2.0, grandStair: 0.6 },
    doubleLotChance: 0.55,
    otherStyleWeight: 0.08,
    pavementStyles: [3, 6, 1],
    backdropTower: { minHeightMeters: 70, heightRangeMeters: 70, colors: [[0.36, 0.42, 0.50], [0.44, 0.50, 0.56]] },
    farTowerHeightScale: 1.8,
    farFacadeTones: [[0.38, 0.44, 0.52], [0.46, 0.52, 0.58], [0.54, 0.56, 0.60], [0.32, 0.36, 0.42]]
  },
  {
    name: "MAPLE HEIGHTS",
    groundCover: GROUND_COVER.lawn,
    singleLotWeights: { suburbanHome: 7.0, savingsBank: 0.25, georgian: 0.3 },
    doubleLotWeights: { publicSchool: 1.0 },
    doubleLotChance: 0.1,
    otherStyleWeight: 0.0,
    pavementStyles: [2, 5, 4],
    backdropTower: null,
    farTowerHeightScale: 0.32,
    farFacadeTones: [[0.93, 0.93, 0.91], [0.88, 0.86, 0.82], [0.72, 0.67, 0.58], [0.90, 0.89, 0.86]]
  },
  {
    name: "WEST SIDE WAREHOUSES",
    singleLotWeights: { storageWarehouse: 3.4, castIron: 1.2, savingsBank: 0.4, victorian: 0.4, brutalistTower: 3.0 },
    doubleLotWeights: { publicSchool: 0.6, grandStair: 0.3 },
    doubleLotChance: 0.14,
    otherStyleWeight: 0.06,
    pavementStyles: [4, 1, 3],
    backdropTower: { minHeightMeters: 18, heightRangeMeters: 22, colors: [[0.50, 0.30, 0.24], [0.62, 0.48, 0.34]] },
    farTowerHeightScale: 0.7,
    farFacadeTones: [[0.52, 0.32, 0.26], [0.64, 0.50, 0.36], [0.56, 0.52, 0.48], [0.46, 0.30, 0.24]]
  }
];

const DEFAULT_DISTRICT_INDEX = 3;

function districtAt(districtIndex) {
  return CITY_DISTRICTS[districtIndex] || CITY_DISTRICTS[DEFAULT_DISTRICT_INDEX];
}

function chooseDistrictAvoiding(takenDistrictIndices, seed) {
  const candidates = CITY_DISTRICTS.map((_, index) => index).filter(index => !takenDistrictIndices.has(index));
  const pool = candidates.length ? candidates : CITY_DISTRICTS.map((_, index) => index);
  return pool[Math.floor(seed * pool.length) % pool.length];
}

function pickFromList(list, seed) {
  return list[Math.floor(seed * list.length) % list.length];
}
