import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

const host = document.getElementById('scene-host');
const loading = document.getElementById('loading');
const fallback = document.getElementById('webgl-fallback');
const titleEl = document.getElementById('view-title');
const descriptionEl = document.getElementById('view-description');
const infoTitleEl = document.getElementById('info-title');
const infoBodyEl = document.getElementById('info-body');
const infoStatsEl = document.getElementById('info-stats');
const actionEl = document.getElementById('scene-actions');
const tooltipEl = document.getElementById('tooltip');
const backButton = document.getElementById('back-button');
const resetButton = document.getElementById('reset-button');
const floorCrumb = document.getElementById('floor-crumb');
const referenceImage = document.querySelector('.reference-image');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let referenceImageReady = false;
if (referenceImage) {
  referenceImage.addEventListener('error', () => {
    referenceImageReady = false;
    referenceImage.hidden = true;
  });
  referenceImage.addEventListener('load', () => {
    referenceImageReady = true;
    if (state.view === 'campus') referenceImage.hidden = false;
  });
}
const overlayPanels = [...document.querySelectorAll('.hud-collapsible')];

const state = { view: 'campus', floor: '1F', initialized: false };
const interactive = [];
const pulseMaterials = [];
const rackLightMaterials = [];
const pointerDown = new THREE.Vector2();
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let hovered = null;
let cameraAnimating = false;
let cameraGoal = new THREE.Vector3();
let targetGoal = new THREE.Vector3();

let renderer;
let labelRenderer;
let scene;
let camera;
let controls;
let modelRoot;
let hemisphereLight;
let sunLight;
let rimLight;

const COLORS = {
  structure: 0x26394a,
  structureDark: 0x162635,
  glass: 0x256d8f,
  cyan: 0x22d3ee,
  cyanSoft: 0x38bdf8,
  grass: 0x173d34,
  road: 0x334654,
  slab: 0x7b94a6,
  ehu: 0x0ea5e9,
  hall: 0x475569,
  power: 0xf59e0b,
  powerFunction: 0xfbbf24,
  medium: 0xeab308,
  hydraulic: 0x14b8a6,
  battery: 0x4d7c0f,
  coolingTower: 0x1f6678,
  reserve: 0x64748b,
};

const BUILDING_COLORS = {
  slabLight: 0xc3cdd3,
  slabDark: 0x566b78,
  dataHall: 0x334a5b,
  cooling: 0x147589,
  power: 0xa16207,
  battery: 0x4d7c0f,
  rooftopCooling: 0x1f6678,
  coolingAccent: 0x0891b2,
  powerAccent: 0xd97706,
};

function isDarkTheme() {
  return (window.AidcTheme?.getTheme?.() || document.documentElement.dataset.theme) === 'dark';
}

function themeColor(light, dark) {
  return isDarkTheme() ? dark : light;
}

function t(key, params) {
  return window.AidcI18n?.t?.(key, params) || key;
}

function setOverlayCollapsed(panel, collapsed) {
  panel.classList.toggle('is-collapsed', collapsed);
  const toggle = panel.querySelector('.overlay-toggle');
  toggle?.setAttribute('aria-expanded', String(!collapsed));
  if (collapsed) toggle?.blur();
}

overlayPanels.forEach((panel) => {
  panel.querySelector('.overlay-toggle')?.addEventListener('click', () => {
    setOverlayCollapsed(panel, !panel.classList.contains('is-collapsed'));
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') overlayPanels.forEach((panel) => setOverlayCollapsed(panel, true));
});

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.65,
    metalness: options.metalness ?? 0.08,
    transparent: Boolean(options.transparent),
    opacity: options.opacity ?? 1,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    side: options.side ?? THREE.FrontSide,
  });
}

function box(size, position, mat, parent = modelRoot) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addEdges(mesh, color = 0x7dd3fc, opacity = 0.42) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
  edges.position.copy(mesh.position);
  edges.rotation.copy(mesh.rotation);
  mesh.parent.add(edges);
  return edges;
}

function addLabel(text, position, options = {}) {
  const wrap = document.createElement('div');
  wrap.className = `model-label${options.hot ? ' hot' : ''}${options.className ? ` ${options.className}` : ''}`;
  const label = document.createElement('span');
  label.textContent = text;
  wrap.appendChild(label);
  const object = new CSS2DObject(wrap);
  object.position.set(position[0], position[1], position[2]);
  (options.parent || modelRoot).add(object);
  return object;
}

function makePickable(mesh, tooltip, action) {
  mesh.userData.tooltip = tooltip;
  mesh.userData.action = action || null;
  interactive.push(mesh);
  return mesh;
}

function clearModel() {
  interactive.length = 0;
  pulseMaterials.length = 0;
  rackLightMaterials.length = 0;
  hovered = null;
  tooltipEl.hidden = true;
  document.body.style.cursor = '';
  modelRoot.traverse((object) => {
    if (object.isCSS2DObject) object.element.remove();
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((item) => {
        item.map?.dispose?.();
        item.dispose?.();
      });
    }
  });
  while (modelRoot.children.length) modelRoot.remove(modelRoot.children[0]);
}

function addGround() {
  const ground = box([36, 0.18, 25], [0, -0.14, 0], material(themeColor(0x83aa88, COLORS.grass), { roughness: 0.95 }));
  ground.receiveShadow = true;
  const grid = new THREE.GridHelper(36, 36, themeColor(0x5d9b96, 0x2b8c86), themeColor(0x91b4ae, 0x23505a));
  grid.position.y = -0.035;
  grid.material.transparent = true;
  grid.material.opacity = 0.2;
  modelRoot.add(grid);

  const roadColor = themeColor(0x8798a3, COLORS.road);
  box([35, 0.03, 2.1], [0, 0.01, 7.4], material(roadColor, { roughness: 1 }));
  box([2.1, 0.035, 23], [-3.8, 0.015, 0.5], material(roadColor, { roughness: 1 }));
  box([17, 0.03, 1.25], [5.8, 0.02, -4.6], material(roadColor, { roughness: 1 }));

  const lakeMat = material(themeColor(0x70b7cf, 0x174b66), { roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.8 });
  box([7.2, 0.05, 8.6], [-14.0, -0.02, -6.7], lakeMat);
  box([11, 0.05, 4.5], [-12.3, -0.02, 10.1], lakeMat.clone());

  [[-13, 2], [-10, 0], [-12, 6], [-7, 9], [1, 10], [13, 9], [14, 3], [14, -8], [-1, -9]].forEach(([x, z]) => {
    const trunk = box([0.18, 0.8, 0.18], [x, 0.4, z], material(0x694b35));
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 8), material(themeColor(0x3f805f, 0x1e6b54)));
    crown.position.set(x, 1.45, z);
    crown.castShadow = true;
    modelRoot.add(crown);
    trunk.castShadow = true;
  });
}

function createCampusBuilding(config) {
  const group = new THREE.Group();
  group.position.set(config.x, 0, config.z);
  modelRoot.add(group);

  const bodyMat = material(config.color || themeColor(0x718797, COLORS.structure), {
    metalness: 0.2,
    roughness: 0.55,
    emissive: config.hot ? 0x075985 : 0x000000,
    emissiveIntensity: config.hot ? 0.22 : 0,
  });
  const body = box([config.w, config.h, config.d], [0, config.h / 2, 0], bodyMat, group);
  const roof = box([config.w + 0.18, 0.22, config.d + 0.18], [0, config.h + 0.11, 0], material(themeColor(0xb4c4cd, 0x7b94a6), { metalness: 0.35 }), group);
  addEdges(body, config.hot ? COLORS.cyan : 0x8aa6b8, config.hot ? 0.85 : 0.28);

  const stripeMat = material(config.hot ? COLORS.cyan : themeColor(0x3181a0, COLORS.glass), {
    metalness: 0.35,
    roughness: 0.3,
    emissive: config.hot ? COLORS.cyan : 0x0a4963,
    emissiveIntensity: config.hot ? 0.55 : 0.14,
  });
  const stripeCount = Math.max(4, Math.floor(config.w / 1.4));
  for (let i = 0; i < stripeCount; i += 1) {
    const x = -config.w / 2 + 0.55 + i * ((config.w - 1.1) / Math.max(1, stripeCount - 1));
    box([0.2, config.h * 0.76, 0.08], [x, config.h * 0.52, config.d / 2 + 0.045], stripeMat.clone(), group);
  }
  for (let i = 0; i < Math.max(2, Math.floor(config.w / 2.3)); i += 1) {
    const x = -config.w / 2 + 0.8 + i * 2.2;
    box([1.1, 0.32, 0.9], [x, config.h + 0.38, 0], material(themeColor(0xb7c5cb, 0x8ca2ad), { metalness: 0.35 }), group);
  }

  const tooltip = t(config.labelKey);
  makePickable(body, tooltip, config.action);
  makePickable(roof, tooltip, config.action);
  addLabel(tooltip, [config.x, config.h + 1.15, config.z], { hot: config.hot });

  if (config.hot) {
    const ringMat = new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.32, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(Math.max(config.w, config.d) * 0.52, Math.max(config.w, config.d) * 0.58, 64), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(config.x, 0.05, config.z);
    ring.userData.pulse = true;
    modelRoot.add(ring);
    pulseMaterials.push(ringMat);
  }
}

function addSubstationYard() {
  const centerX = -7.7;
  const centerZ = -5.2;
  const steel = material(themeColor(0x718795, 0x506574), { metalness: 0.72, roughness: 0.34 });
  const liveMetal = material(0xf59e0b, { emissive: 0xf59e0b, emissiveIntensity: 0.12, metalness: 0.4, roughness: 0.42 });
  const transformerMat = material(themeColor(0x78909c, 0x344d5d), { metalness: 0.5, roughness: 0.44 });
  const fenceMat = material(themeColor(0x8ea3ae, 0x557080), { metalness: 0.64, roughness: 0.38 });
  const pad = box([4.8, 0.12, 3.55], [centerX, 0.06, centerZ], material(themeColor(0xc4cdd1, 0x334653), { roughness: 0.9 }));
  addEdges(pad, themeColor(0x78909c, 0x7898a8), 0.48);

  [-8.65, -6.8].forEach((x) => {
    const transformer = box([1.18, 0.92, 1.38], [x, 0.58, centerZ], transformerMat.clone());
    addEdges(transformer, 0x7dd3fc, 0.28);
    makePickable(transformer, t('objects.transformer'));
    for (let i = -2; i <= 2; i += 1) {
      box([0.08, 0.62, 1.14], [x + 0.64 + i * 0.02, 0.58, centerZ + i * 0.2], steel.clone());
    }
    [-0.28, 0.28].forEach((offset) => {
      const insulator = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.42, 10), liveMetal.clone());
      insulator.position.set(x + offset, 1.18, centerZ);
      modelRoot.add(insulator);
    });
  });

  [-8.65, -6.8].forEach((x) => {
    [-3.9, -6.5].forEach((z) => box([0.09, 1.35, 0.09], [x, 0.74, z], steel.clone()));
  });
  [-3.9, -6.5].forEach((z) => {
    box([2.05, 0.09, 0.09], [-7.72, 1.38, z], steel.clone());
  });

  const bounds = { left: -10.12, right: -5.28, front: -3.42, back: -6.98 };
  box([bounds.right - bounds.left, 0.06, 0.06], [(bounds.left + bounds.right) / 2, 0.42, bounds.front], fenceMat.clone());
  box([bounds.right - bounds.left, 0.06, 0.06], [(bounds.left + bounds.right) / 2, 0.42, bounds.back], fenceMat.clone());
  box([0.06, 0.06, bounds.front - bounds.back], [bounds.left, 0.42, (bounds.front + bounds.back) / 2], fenceMat.clone());
  box([0.06, 0.06, bounds.front - bounds.back], [bounds.right, 0.42, (bounds.front + bounds.back) / 2], fenceMat.clone());
  [-10.12, -8.5, -6.9, -5.28].forEach((x) => {
    [bounds.front, bounds.back].forEach((z) => box([0.07, 0.82, 0.07], [x, 0.43, z], fenceMat.clone()));
  });
}

function addGeneratorPlant() {
  const plantMat = material(themeColor(0x667f8d, 0x304958), { metalness: 0.48, roughness: 0.4 });
  const louverMat = material(themeColor(0x314957, 0x122d3c), { metalness: 0.7, roughness: 0.3 });
  const exhaustMat = material(themeColor(0x9ba9af, 0x728995), { metalness: 0.82, roughness: 0.25 });
  const pad = box([7.65, 0.12, 3.45], [9.1, 0.06, -5.8], material(themeColor(0xc4cdd1, 0x334653), { roughness: 0.9 }));
  addEdges(pad, themeColor(0x78909c, 0x7898a8), 0.48);

  [6.8, 9.1, 11.4].forEach((x, index) => {
    const unit = box([1.85, 1.42, 2.42], [x, 0.82, -5.8], plantMat.clone());
    addEdges(unit, index === 1 ? COLORS.cyan : 0x8fb0bf, index === 1 ? 0.5 : 0.28);
    makePickable(unit, t('objects.generatorUnit'));
    for (let z = -6.55; z <= -5.05; z += 0.28) {
      box([0.05, 0.07, 0.18], [x + 0.95, 0.9, z], louverMat.clone());
    }
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 1.18, 14), exhaustMat.clone());
    exhaust.position.set(x + 0.48, 2.04, -5.55);
    exhaust.castShadow = true;
    modelRoot.add(exhaust);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.11, 0.08, 14), exhaustMat.clone());
    cap.position.set(x + 0.48, 2.65, -5.55);
    modelRoot.add(cap);
  });
  addLabel(t('objects.generator'), [9.1, 3.25, -5.8]);
}

function buildCampus() {
  addGround();
  createCampusBuilding({ labelKey: 'objects.a02', x: 0.7, z: -1.1, w: 13.8, d: 5.8, h: 5.3, hot: true, action: { type: 'building' } });
  createCampusBuilding({ labelKey: 'objects.a01', x: 8.4, z: 5.3, w: 10.4, d: 5.4, h: 4.5 });
  createCampusBuilding({ labelKey: 'objects.office', x: -10.6, z: 5.1, w: 6.2, d: 4.3, h: 3.2, color: themeColor(0x91a4b2, 0x516678) });
  createCampusBuilding({ labelKey: 'objects.substation', x: -11.35, z: -5.15, w: 2.4, d: 2.35, h: 1.65, color: themeColor(0x8198a7, 0x3d5363) });
  addSubstationYard();
  addGeneratorPlant();
}

const FLOOR_ZONE_ROWS = [
  { z: -4.35, color: BUILDING_COLORS.cooling },
  { z: -2.2, color: BUILDING_COLORS.dataHall },
  { z: 0, color: BUILDING_COLORS.power },
  { z: 2.2, color: BUILDING_COLORS.dataHall },
  { z: 4.35, color: BUILDING_COLORS.cooling },
];

function buildFloorPlate(floor, y, clickable) {
  const slabMat = material(themeColor(BUILDING_COLORS.slabLight, BUILDING_COLORS.slabDark), {
    metalness: 0.22,
    roughness: 0.62,
    emissive: clickable && isDarkTheme() ? 0x0a3542 : 0x000000,
    emissiveIntensity: clickable && isDarkTheme() ? 0.055 : 0,
  });
  const slab = box([18.5, 0.42, 11.8], [0, y, 0], slabMat);
  addEdges(slab, clickable ? themeColor(0x708895, 0x6b8796) : themeColor(0x8799a3, 0x526875), clickable ? 0.44 : 0.3);
  if (clickable) makePickable(slab, t('building.selectFloor', { floor }), { type: 'floor', floor });

  if (floor === 'RF') {
    [
      { x: 0, z: -4.15, w: 17.5, d: 1.85, color: BUILDING_COLORS.battery },
      { x: -4.4, z: 0, w: 8.5, d: 3.15, color: BUILDING_COLORS.rooftopCooling },
      { x: 4.4, z: 0, w: 8.5, d: 3.15, color: BUILDING_COLORS.rooftopCooling },
      { x: 0, z: 4.15, w: 17.5, d: 1.85, color: BUILDING_COLORS.battery },
    ].forEach((roofZone) => {
      box([roofZone.w, 0.22, roofZone.d], [roofZone.x, y + 0.32, roofZone.z], material(roofZone.color, {
        roughness: 0.7,
        emissive: roofZone.color,
        emissiveIntensity: 0.018,
      }));
    });
  } else {
    FLOOR_ZONE_ROWS.forEach((row, index) => {
      const zoneDepth = index === 2 ? 1.55 : 1.75;
      [-4.65, 4.65].forEach((x) => {
        const zone = box([8.6, 0.22, zoneDepth], [x, y + 0.32, row.z], material(row.color, {
          roughness: 0.72,
          emissive: row.color,
          emissiveIntensity: 0.014,
        }));
        if (clickable) makePickable(zone, t('building.selectFloor', { floor }), { type: 'floor', floor });
      });
    });
  }
  addLabel(floor, [-10.7, y + 0.8, 0], { hot: clickable });
}

function addDimensionSegment(x, z, startY, endY, label, options = {}) {
  const color = options.total ? 0x0284c7 : 0x38bdf8;
  const points = [
    new THREE.Vector3(x, startY, z),
    new THREE.Vector3(x, endY, z),
  ];
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: options.total ? 0.95 : 0.72 }),
  );
  modelRoot.add(line);
  [startY, endY].forEach((y) => {
    const tick = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x - 0.32, y, z),
        new THREE.Vector3(x + 0.32, y, z),
      ]),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.82 }),
    );
    modelRoot.add(tick);
  });
  addLabel(label, [x + 0.72, (startY + endY) / 2, z], {
    hot: Boolean(options.total),
    className: 'dimension-label',
  });
}

function addFacadeLevel(y) {
  const facadeMat = material(themeColor(0xbdd4df, 0x27475d), {
    transparent: true,
    opacity: isDarkTheme() ? 0.2 : 0.28,
    roughness: 0.35,
    metalness: 0.16,
    side: THREE.DoubleSide,
  });
  const beamMat = material(themeColor(0x7894a5, 0x5b788b), {
    metalness: isDarkTheme() ? 0.5 : 0.32,
    roughness: isDarkTheme() ? 0.34 : 0.48,
    emissive: isDarkTheme() ? 0x0b4154 : 0x000000,
    emissiveIntensity: isDarkTheme() ? 0.13 : 0,
  });
  const wallY = y + 1.43;
  box([18.45, 2.15, 0.1], [0, wallY, -5.82], facadeMat.clone());
  box([18.45, 2.15, 0.1], [0, wallY, 5.82], facadeMat.clone());
  box([0.1, 2.15, 11.55], [-9.18, wallY, 0], facadeMat.clone());
  box([0.1, 2.15, 11.55], [9.18, wallY, 0], facadeMat.clone());
  box([18.6, 0.16, 0.22], [0, y + 0.62, -5.88], beamMat.clone());
  box([18.6, 0.16, 0.22], [0, y + 0.62, 5.88], beamMat.clone());

  for (let x = -8; x <= 8; x += 2) {
    box([0.09, 1.82, 0.12], [x, wallY, -5.9], beamMat.clone());
    box([0.09, 1.82, 0.12], [x, wallY, 5.9], beamMat.clone());
  }
}

function addBatteryBank(z) {
  const cabinetMat = material(themeColor(0x536575, 0x1c2937), { metalness: 0.48, roughness: 0.38 });
  const doorMat = material(COLORS.battery, { emissive: COLORS.battery, emissiveIntensity: 0.18, metalness: 0.28 });
  const faceZ = z < 0 ? z + 0.43 : z - 0.43;
  for (let index = 0; index < 9; index += 1) {
    const x = -7.2 + index * 1.8;
    const cabinet = box([1.28, 1.18, 0.76], [x, 10.58, z], cabinetMat.clone());
    makePickable(cabinet, t('objects.batteryBank'));
    box([0.96, 0.82, 0.035], [x, 10.58, faceZ], doorMat.clone());
    const statusMat = material(0x34d399, { emissive: 0x34d399, emissiveIntensity: 0.72, roughness: 0.2 });
    box([0.42, 0.045, 0.025], [x, 10.82, z < 0 ? faceZ + 0.02 : faceZ - 0.02], statusMat);
    rackLightMaterials.push({ material: statusMat, phase: index * 0.42 + (z < 0 ? 0 : 1.3) });
  }
  addLabel(t('objects.batteryBank'), [0, 11.55, z], { className: 'battery-label' });
}

function addCoolingTower(x, z) {
  const towerMat = material(themeColor(0x8aa4b3, 0x24485e), {
    metalness: 0.42,
    roughness: 0.38,
    emissive: COLORS.coolingTower,
    emissiveIntensity: 0.08,
  });
  const housing = box([2.8, 0.92, 2.2], [x, 10.48, z], towerMat);
  addEdges(housing, COLORS.coolingTower, 0.55);
  makePickable(housing, t('objects.coolingTower'));

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.72, 0.16, 28),
    material(themeColor(0x5f7684, 0x142a39), { metalness: 0.65, roughness: 0.28 }),
  );
  rim.position.set(x, 11.02, z);
  rim.castShadow = true;
  modelRoot.add(rim);

  const bladeMat = material(themeColor(0xd1dde2, 0x638093), { metalness: 0.5, roughness: 0.32 });
  [0, Math.PI / 2].forEach((rotation) => {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.06, 0.16), bladeMat.clone());
    blade.position.set(x, 11.12, z);
    blade.rotation.y = rotation;
    modelRoot.add(blade);
  });
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 18), bladeMat.clone());
  hub.position.set(x, 11.15, z);
  modelRoot.add(hub);

  [-0.72, -0.24, 0.24, 0.72].forEach((offset) => {
    box([0.06, 0.58, 0.035], [x + offset, 10.44, z + 1.12], material(COLORS.coolingTower, {
      emissive: COLORS.coolingTower,
      emissiveIntensity: 0.18,
    }));
  });
}

function buildBuilding() {
  const base = box([22, 0.26, 15], [0, -0.18, 0], material(themeColor(0xd7e5e8, 0x132a32), { roughness: 0.95 }));
  base.receiveShadow = true;
  const grid = new THREE.GridHelper(22, 22, themeColor(0x5c9ca7, 0x237282), themeColor(0x9cb7bf, 0x244655));
  grid.position.y = -0.03;
  grid.material.transparent = true;
  grid.material.opacity = 0.24;
  modelRoot.add(grid);

  buildFloorPlate('1F', 0.55, true);
  buildFloorPlate('2F', 3.55, true);
  buildFloorPlate('3F', 6.55, true);
  buildFloorPlate('RF', 9.55, false);

  [0.55, 3.55, 6.55].forEach(addFacadeLevel);

  addBatteryBank(-4.15);
  addBatteryBank(4.15);
  [-6.1, -2.05, 2.05, 6.1].forEach((x) => addCoolingTower(x, 0));
  addLabel(t('objects.coolingTower'), [0, 11.72, 0], { className: 'cooling-label' });
  addLabel(t('objects.a02'), [0, 12.6, -5.8], { hot: true });

  const columnMat = material(themeColor(0x708695, 0x607c8f), {
    metalness: isDarkTheme() ? 0.48 : 0.25,
    roughness: isDarkTheme() ? 0.34 : 0.65,
    emissive: isDarkTheme() ? 0x0b3f52 : 0x000000,
    emissiveIntensity: isDarkTheme() ? 0.16 : 0,
  });
  [[-9, -5.5], [9, -5.5], [-9, 5.5], [9, 5.5]].forEach(([x, z]) => {
    const column = box([0.34, 9.1, 0.34], [x, 4.9, z], columnMat.clone());
    addEdges(column, themeColor(0x8da3af, 0x67e8f9), isDarkTheme() ? 0.34 : 0.16);
  });

  const coreMat = material(themeColor(0x8fa9b8, 0x1d3a50), {
    transparent: true,
    opacity: 0.72,
    metalness: 0.24,
    roughness: 0.46,
  });
  const core = box([2.6, 8.85, 2.1], [0, 4.95, 4.45], coreMat);
  addEdges(core, COLORS.cyanSoft, 0.55);

  const coolingRiser = box([0.48, 8.65, 0.48], [-0.78, 4.9, 0], material(BUILDING_COLORS.coolingAccent, {
    emissive: BUILDING_COLORS.coolingAccent,
    emissiveIntensity: 0.1,
    metalness: 0.3,
  }));
  const powerRiser = box([0.48, 8.65, 0.48], [0.78, 4.9, 0], material(BUILDING_COLORS.powerAccent, {
    emissive: BUILDING_COLORS.powerAccent,
    emissiveIntensity: 0.09,
    metalness: 0.3,
  }));
  addEdges(coolingRiser, BUILDING_COLORS.coolingAccent, 0.58);
  addEdges(powerRiser, BUILDING_COLORS.powerAccent, 0.58);
  makePickable(coolingRiser, t('objects.coolingRiser'));
  makePickable(powerRiser, t('objects.powerRiser'));

  addDimensionSegment(10.7, 5.9, 0.55, 3.55, '8.0 m');
  addDimensionSegment(10.7, 5.9, 3.55, 6.55, '7.0 m');
  addDimensionSegment(10.7, 5.9, 6.55, 9.55, '7.0 m');
}

function addRoom(config) {
  const roomMat = material(config.color, {
    transparent: true,
    opacity: config.opacity ?? 0.86,
    roughness: 0.66,
    emissive: config.color,
    emissiveIntensity: 0.045,
  });
  const room = box([config.w, config.h || 0.5, config.d], [config.x, (config.h || 0.5) / 2 + 0.12, config.z], roomMat);
  addEdges(room, config.color, 0.68);
  makePickable(room, t(config.labelKey));
  if (config.label !== false) addLabel(t(config.labelKey), [config.x, config.labelY ?? (config.h || 0.5) + 0.65, config.z]);
  return room;
}

function addAisleDetails(x, z, w, d, direction) {
  const coldMat = material(0x38bdf8, { emissive: 0x38bdf8, emissiveIntensity: 0.78, roughness: 0.25 });
  const hotMat = material(0xfb923c, { emissive: 0xfb923c, emissiveIntensity: 0.52, roughness: 0.3 });
  box([w, 0.035, 0.09], [x, 0.31, z], coldMat);
  box([w, 0.028, 0.055], [x, 0.305, z - d / 2 + 0.12], hotMat.clone());
  box([w, 0.028, 0.055], [x, 0.305, z + d / 2 - 0.12], hotMat.clone());
  box([w, 0.1, 0.18], [x, 2.34, z], material(themeColor(0x708896, 0x243746), { metalness: 0.5, roughness: 0.38 }));
}

function addEhuEquipment(x, z, w) {
  const unitMat = material(themeColor(0xc5d3da, 0x355266), { metalness: 0.35, roughness: 0.46 });
  const sectionMat = material(themeColor(0x8298a5, 0x1d3546), { metalness: 0.56, roughness: 0.34 });
  const fanMat = material(themeColor(0x4b6270, 0x102635), { metalness: 0.7, roughness: 0.26 });
  const pipeMat = material(0x14b8a6, { emissive: 0x14b8a6, emissiveIntensity: 0.12, metalness: 0.48, roughness: 0.3 });
  const count = 4;
  for (let index = 0; index < count; index += 1) {
    const px = x - w / 2 + 1.35 + index * ((w - 2.7) / (count - 1));
    const unit = box([1.82, 1.28, 1.18], [px, 0.94, z], unitMat.clone());
    addEdges(unit, 0x38bdf8, 0.24);
    makePickable(unit, t('objects.ehu'));

    // AHU 典型分段：过滤/盘管段、风机段和顶部送风风管。
    box([0.06, 1.12, 1.2], [px - 0.18, 0.94, z], sectionMat.clone());
    [-0.24, -0.12, 0, 0.12, 0.24].forEach((offset) => {
      box([0.58, 0.035, 0.025], [px - 0.5, 0.94 + offset, z + 0.605], fanMat.clone());
    });
    const fanRing = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 8, 28), fanMat.clone());
    fanRing.position.set(px + 0.43, 0.97, z + 0.61);
    modelRoot.add(fanRing);
    [0, Math.PI / 2].forEach((rotation) => {
      const blade = box([0.07, 0.48, 0.025], [px + 0.43, 0.97, z + 0.615], fanMat.clone());
      blade.rotation.z = rotation;
    });
    const duct = box([1.0, 0.42, 0.76], [px, 1.79, z], sectionMat.clone());
    addEdges(duct, 0x7dd3fc, 0.2);

    [-0.7, 0.7].forEach((offset) => {
      const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.92, 12), pipeMat.clone());
      riser.position.set(px + offset, 1.45, z - 0.42);
      modelRoot.add(riser);
    });
  }
}

function addSwitchgearLineup(room, kind) {
  const isMedium = kind === 'medium';
  const isPowerZone = kind === 'powerFunction';
  const bodyColor = isMedium ? themeColor(0x5f7480, 0x263d4c) : themeColor(0x8397a2, 0x304958);
  const accentColor = isMedium ? 0xf97316 : isPowerZone ? 0xf59e0b : 0x38bdf8;
  const cabinetMat = material(bodyColor, { metalness: 0.56, roughness: 0.38 });
  const doorMat = material(themeColor(0x9fb0b8, 0x1c3342), { metalness: 0.45, roughness: 0.42 });
  const lightMat = material(accentColor, { emissive: accentColor, emissiveIntensity: 0.64, roughness: 0.24 });
  const count = Math.max(2, Math.min(8, Math.floor((room.w - 0.25) / 0.62)));
  const cabinetW = Math.max(0.42, (room.w - 0.36) / count);

  for (let index = 0; index < count; index += 1) {
    const px = room.x - room.w / 2 + 0.18 + cabinetW / 2 + index * cabinetW;
    const cabinet = box([cabinetW * 0.92, 1.62, 0.82], [px, 1.12, room.z], cabinetMat.clone());
    addEdges(cabinet, accentColor, 0.26);
    makePickable(cabinet, t(isMedium ? 'objects.mvSwitchgear' : isPowerZone ? 'objects.powerCabinet' : 'objects.lvSwitchgear'));
    box([cabinetW * 0.66, 1.16, 0.025], [px, 1.08, room.z + 0.425], doorMat.clone());
    box([cabinetW * 0.36, 0.045, 0.025], [px, 1.56, room.z + 0.445], lightMat.clone());
  }
  box([Math.max(0.5, room.w - 0.36), 0.12, 0.16], [room.x, 2.02, room.z - 0.42], lightMat.clone());
}

function addPipeSegment(start, end, radius, pipeMaterial, tooltipKey) {
  const startPoint = new THREE.Vector3(...start);
  const endPoint = new THREE.Vector3(...end);
  const direction = endPoint.clone().sub(startPoint);
  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), 16),
    pipeMaterial.clone(),
  );
  pipe.position.copy(startPoint).add(endPoint).multiplyScalar(0.5);
  pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  pipe.castShadow = true;
  makePickable(pipe, t(tooltipKey));
  modelRoot.add(pipe);
  return pipe;
}

function addHydraulicSkid(room) {
  const skidMat = material(themeColor(0x708895, 0x294453), { metalness: 0.62, roughness: 0.34 });
  const supplyMat = material(0x14b8a6, { emissive: 0x14b8a6, emissiveIntensity: 0.22, metalness: 0.5, roughness: 0.28 });
  const returnMat = material(0x0ea5e9, { emissive: 0x0ea5e9, emissiveIntensity: 0.2, metalness: 0.5, roughness: 0.28 });
  const pumpMat = material(themeColor(0x9fb3bc, 0x3c596a), { metalness: 0.52, roughness: 0.36 });
  const valveMat = material(0xf59e0b, { emissive: 0xf59e0b, emissiveIntensity: 0.18, metalness: 0.48, roughness: 0.3 });
  const centerZ = room.z ?? 0;
  const skidWidth = Math.max(1.4, room.w - 0.34);
  box([skidWidth, 0.14, 1.72], [room.x, 0.44, centerZ], skidMat.clone());

  const pumpOffsets = room.w > 3 ? [-0.72, 0] : [-0.45, 0.35];
  pumpOffsets.forEach((offset) => {
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.78, 18), pumpMat.clone());
    pump.position.set(room.x + offset, 0.9, centerZ + 0.28);
    pump.castShadow = true;
    makePickable(pump, t('objects.hydraulicPump'));
    modelRoot.add(pump);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.42, 16), supplyMat.clone());
    motor.position.set(room.x + offset, 1.48, centerZ + 0.28);
    modelRoot.add(motor);
  });

  const exchangerX = room.x + Math.min(room.w * 0.28, 0.9);
  const exchanger = box([0.66, 1.42, 0.76], [exchangerX, 1.18, centerZ - 0.3], pumpMat.clone());
  addEdges(exchanger, 0x2dd4bf, 0.45);
  makePickable(exchanger, t('objects.heatExchanger'));

  const pipeStartX = room.x - skidWidth / 2 + 0.14;
  const pipeEndX = room.x + skidWidth / 2 - 0.14;
  const supplyZ = centerZ - 0.58;
  const returnZ = centerZ + 0.58;
  addPipeSegment([pipeStartX, 1.94, supplyZ], [pipeEndX, 1.94, supplyZ], 0.085, supplyMat, 'objects.coolingSupplyPipe');
  addPipeSegment([pipeEndX, 1.66, returnZ], [pipeStartX, 1.66, returnZ], 0.085, returnMat, 'objects.coolingReturnPipe');

  const riserX = room.x + (room.x < 0 ? -skidWidth / 2 + 0.18 : skidWidth / 2 - 0.18);
  addPipeSegment([riserX, 0.52, supplyZ], [riserX, 2.58, supplyZ], 0.085, supplyMat, 'objects.coolingSupplyPipe');
  addPipeSegment([riserX, 0.52, returnZ], [riserX, 2.34, returnZ], 0.085, returnMat, 'objects.coolingReturnPipe');

  pumpOffsets.forEach((offset) => {
    const pumpX = room.x + offset;
    addPipeSegment([pumpX, 1.94, supplyZ], [pumpX, 1.5, centerZ + 0.28], 0.055, supplyMat, 'objects.coolingSupplyPipe');
    addPipeSegment([pumpX, 1.66, returnZ], [pumpX, 1.28, centerZ + 0.28], 0.055, returnMat, 'objects.coolingReturnPipe');
  });

  [
    { x: room.x - skidWidth * 0.18, y: 1.94, z: supplyZ },
    { x: room.x + skidWidth * 0.18, y: 1.66, z: returnZ },
  ].forEach((position, index) => {
    const valve = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.032, 8, 22), valveMat.clone());
    valve.rotation.y = Math.PI / 2;
    valve.position.set(position.x, position.y + 0.18, position.z);
    makePickable(valve, t('objects.coolingValve'));
    modelRoot.add(valve);
  });

  // 从水力模块间向上下两个 POD 区域延伸的架空供回水干管。
  const supplyHeaderX = room.x - 0.13;
  const returnHeaderX = room.x + 0.13;
  addPipeSegment([supplyHeaderX, 2.44, -2.72], [supplyHeaderX, 2.44, 2.72], 0.095, supplyMat, 'objects.coolingSupplyPipe');
  addPipeSegment([returnHeaderX, 2.22, 2.72], [returnHeaderX, 2.22, -2.72], 0.095, returnMat, 'objects.coolingReturnPipe');
  [-2.58, 2.58].forEach((targetZ) => {
    addPipeSegment([supplyHeaderX, 2.44, targetZ], [supplyHeaderX, 1.18, targetZ], 0.07, supplyMat, 'objects.coolingSupplyPipe');
    addPipeSegment([returnHeaderX, 2.22, targetZ], [returnHeaderX, 1.18, targetZ], 0.07, returnMat, 'objects.coolingReturnPipe');
  });
}

function addReservedBay(room) {
  const markerMat = material(0xfbbf24, { emissive: 0xfbbf24, emissiveIntensity: 0.12, roughness: 0.42 });
  const depth = room.d || 2.75;
  box([room.w - 0.32, 0.045, 0.08], [room.x, 0.44, room.z - depth / 2 + 0.18], markerMat.clone());
  box([room.w - 0.32, 0.045, 0.08], [room.x, 0.44, room.z + depth / 2 - 0.18], markerMat.clone());
  box([0.08, 0.045, depth - 0.36], [room.x - room.w / 2 + 0.18, 0.44, room.z], markerMat.clone());
  box([0.08, 0.045, depth - 0.36], [room.x + room.w / 2 - 0.18, 0.44, room.z], markerMat.clone());
  [-1, 1].forEach((side) => {
    box([0.12, 0.72, 0.12], [room.x + side * (room.w / 2 - 0.28), 0.78, room.z - depth / 2 + 0.28], markerMat.clone());
  });
}

function addUtilityEquipment(room) {
  if (room.key === 'objects.hydraulic') addHydraulicSkid(room);
  if (room.key === 'objects.powerFunction') addSwitchgearLineup(room, 'powerFunction');
  if (room.key === 'objects.medium') addSwitchgearLineup(room, 'medium');
  if (room.key === 'objects.power') addSwitchgearLineup(room, 'lowVoltage');
  if (room.key === 'objects.reserve') addReservedBay(room);
}

function addInspectionRoutes() {
  const routeMat = material(themeColor(0x7dd3fc, 0x0e7490), {
    transparent: true,
    opacity: isDarkTheme() ? 0.38 : 0.28,
    emissive: 0x22d3ee,
    emissiveIntensity: isDarkTheme() ? 0.38 : 0.18,
    roughness: 0.42,
  });
  box([1.05, 0.045, 17.2], [0, 0.285, 0], routeMat);
  box([25.4, 0.045, 0.62], [0, 0.285, -2.45], routeMat.clone());
  box([25.4, 0.045, 0.62], [0, 0.285, 2.45], routeMat.clone());
}

function addRackArray(x, z, w, d) {
  const rackMat = material(0x1d2935, { metalness: 0.55, roughness: 0.38 });
  const lightMat = material(COLORS.cyan, { emissive: COLORS.cyan, emissiveIntensity: 0.72, roughness: 0.25 });
  const columns = Math.max(5, Math.floor(w / 1.15));
  const rows = 2;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const px = x - w / 2 + 0.65 + col * ((w - 1.3) / Math.max(1, columns - 1));
      const pz = z - d / 2 + 0.55 + row * (d - 1.1);
      const rack = box([0.58, 1.72, 0.42], [px, 1.14, pz], rackMat.clone());
      addEdges(rack, themeColor(0x718897, 0x486272), 0.3);
      makePickable(rack, t('floor.rackRows'));
      const rackLight = lightMat.clone();
      box([0.36, 0.045, 0.025], [px, 1.46, pz + 0.225], rackLight);
      rackLightMaterials.push({ material: rackLight, phase: row * 0.7 + col * 0.29 });
    }
  }
}

function addColdAisleContainment(x, z, w) {
  const glassMat = material(themeColor(0x67e8f9, 0x22d3ee), {
    transparent: true,
    opacity: isDarkTheme() ? 0.13 : 0.16,
    metalness: 0.05,
    roughness: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  box([w, 0.055, 0.96], [x, 2.18, z], glassMat.clone());
  [-0.5, 0.5].forEach((offset) => box([w, 1.46, 0.035], [x, 1.45, z + offset], glassMat.clone()));
  [-w / 2, w / 2].forEach((offset) => box([0.035, 1.46, 1], [x + offset, 1.45, z], glassMat.clone()));
}

function addRackPowerUnits(x, z, w) {
  const cabinetMat = material(0xf59e0b, {
    emissive: 0xf59e0b,
    emissiveIntensity: isDarkTheme() ? 0.18 : 0.08,
    metalness: 0.38,
    roughness: 0.46,
  });
  [-1, 1].forEach((side) => {
    const px = x + side * (w / 2 + 0.22);
    const cabinet = box([0.36, 1.55, 0.62], [px, 1.05, z], cabinetMat.clone());
    addEdges(cabinet, 0xfbbf24, 0.46);
    makePickable(cabinet, t('objects.rackPowerUnit'));
  });
}

function addOverheadServices(x, z, w) {
  const trayMat = material(themeColor(0x748b99, 0x294353), { metalness: 0.68, roughness: 0.3 });
  const buswayMat = material(0xf59e0b, {
    emissive: 0xf59e0b,
    emissiveIntensity: isDarkTheme() ? 0.15 : 0.06,
    metalness: 0.56,
    roughness: 0.35,
  });
  const networkMat = material(0x22d3ee, {
    emissive: 0x22d3ee,
    emissiveIntensity: isDarkTheme() ? 0.16 : 0.07,
    metalness: 0.48,
    roughness: 0.34,
  });
  box([w, 0.12, 0.18], [x, 2.58, z - 0.68], buswayMat);
  box([w, 0.1, 0.26], [x, 2.72, z + 0.68], networkMat);
  [-w / 2 + 0.35, -w / 4, 0, w / 4, w / 2 - 0.35].forEach((offset) => {
    box([0.055, 0.66, 0.055], [x + offset, 2.34, z - 0.68], trayMat.clone());
    box([0.055, 0.52, 0.055], [x + offset, 2.46, z + 0.68], trayMat.clone());
  });
  [-w / 2 + 0.25, w / 2 - 0.25].forEach((offset) => {
    box([0.1, 0.1, 1.62], [x + offset, 2.76, z], trayMat.clone());
  });
}

function addPodOutlines() {
  [
    { name: 'POD-A', x1: -12.25, x2: -0.65, z1: -8.2, z2: -1.05 },
    { name: 'POD-B', x1: 0.65, x2: 12.25, z1: -8.2, z2: -1.05 },
    { name: 'POD-C', x1: -12.25, x2: -0.65, z1: 1.05, z2: 8.2 },
    { name: 'POD-D', x1: 0.65, x2: 12.25, z1: 1.05, z2: 8.2 },
  ].forEach((pod) => {
    const labelZ = pod.z1 < 0 ? pod.z1 + 0.68 : pod.z2 - 0.68;
    addLabel(pod.name, [pod.x1 + 0.92, 2.82, labelZ], { hot: true });
  });
}

function createUtilityWing(startX, sourceWidths, rooms) {
  const wingWidth = 12;
  const sourceTotal = sourceWidths.reduce((sum, width) => sum + width, 0);
  const scale = wingWidth / sourceTotal;
  let cursor = startX;
  return rooms.map((room, index) => {
    const width = sourceWidths[index] * scale;
    const result = { ...room, x: cursor + width / 2, w: width, z: room.z ?? 0, d: room.d ?? 2.75 };
    cursor += width;
    return result;
  });
}

function buildFloorDetail() {
  const base = box([27, 0.24, 18.5], [0, 0, 0], material(themeColor(0xe2ebef, 0x8ea4b0), { metalness: 0.08, roughness: 0.82 }));
  addEdges(base, 0x94a3b8, 0.7);
  const grid = new THREE.GridHelper(27, 27, themeColor(0x82aeb5, 0x4c7b85), themeColor(0xb0c4ca, 0x67808c));
  grid.position.y = 0.14;
  grid.material.transparent = true;
  grid.material.opacity = 0.18;
  modelRoot.add(grid);

  const wallMat = material(themeColor(0x9badb8, 0x425666), { transparent: true, opacity: isDarkTheme() ? 0.42 : 0.34 });
  box([27, 1.78, 0.22], [0, 1.01, -9.15], wallMat.clone());
  box([27, 1.78, 0.22], [0, 1.01, 9.15], wallMat.clone());
  box([0.22, 1.78, 18.3], [-13.4, 1.01, 0], wallMat.clone());
  box([0.22, 1.78, 18.3], [13.4, 1.01, 0], wallMat.clone());
  const frameMat = material(themeColor(0x6f8795, 0x648397), {
    metalness: 0.58,
    roughness: isDarkTheme() ? 0.3 : 0.36,
    emissive: isDarkTheme() ? 0x0b4358 : 0x000000,
    emissiveIntensity: isDarkTheme() ? 0.14 : 0,
  });
  [[-13.3, -9.05], [0, -9.05], [13.3, -9.05], [-13.3, 0], [13.3, 0], [-13.3, 9.05], [0, 9.05], [13.3, 9.05]].forEach(([x, z]) => {
    const column = box([0.18, 2.65, 0.18], [x, 1.45, z], frameMat.clone());
    addEdges(column, themeColor(0x8ea5b2, 0x67e8f9), isDarkTheme() ? 0.42 : 0.18);
  });
  const northBeam = box([27, 0.16, 0.16], [0, 2.72, -9.05], frameMat.clone());
  const southBeam = box([27, 0.16, 0.16], [0, 2.72, 9.05], frameMat.clone());
  addEdges(northBeam, themeColor(0x8ea5b2, 0x67e8f9), isDarkTheme() ? 0.36 : 0.14);
  addEdges(southBeam, themeColor(0x8ea5b2, 0x67e8f9), isDarkTheme() ? 0.36 : 0.14);
  addInspectionRoutes();

  [-6.7, 6.7].forEach((x) => {
    addRoom({ x, z: -7.2, w: 12, d: 2.45, color: COLORS.ehu, labelKey: 'objects.ehu', labelY: 2.18 });
    addEhuEquipment(x, -7.2, 12);
    addRoom({ x, z: -4.2, w: 12, d: 2.9, color: COLORS.hall, labelKey: 'objects.hall', label: false });
    addRackArray(x, -4.2, 10.9, 2.35);
    addAisleDetails(x, -4.2, 10.9, 2.35, x < 0 ? 1 : -1);
    addColdAisleContainment(x, -4.2, 10.9);
    addRackPowerUnits(x, -4.2, 10.9);
    addOverheadServices(x, -4.2, 10.9);
    addRoom({ x, z: 4.2, w: 12, d: 2.9, color: COLORS.hall, labelKey: 'objects.hall', label: false });
    addRackArray(x, 4.2, 10.9, 2.35);
    addAisleDetails(x, 4.2, 10.9, 2.35, x < 0 ? -1 : 1);
    addColdAisleContainment(x, 4.2, 10.9);
    addRackPowerUnits(x, 4.2, 10.9);
    addOverheadServices(x, 4.2, 10.9);
    addRoom({ x, z: 7.2, w: 12, d: 2.45, color: COLORS.ehu, labelKey: 'objects.ehu', labelY: 2.18 });
    addEhuEquipment(x, 7.2, 12);
  });

  // 与 2D 原图保持一致：左右功能翼原始宽度均为 395。
  const leftUtilityRooms = createUtilityWing(-12.7, [119.6, 209.2, 66.2], [
    { color: COLORS.hydraulic, key: 'objects.hydraulic' },
    { color: COLORS.powerFunction, key: 'objects.powerFunction' },
    { color: COLORS.medium, key: 'objects.medium' },
  ]);
  const rightUtilityRooms = createUtilityWing(0.7, [95.6, 89.3, 116.4, 93.7], [
    { color: COLORS.medium, key: 'objects.medium' },
    { color: COLORS.power, key: 'objects.power' },
    { color: COLORS.reserve, key: 'objects.reserve' },
    { color: COLORS.hydraulic, key: 'objects.hydraulic' },
  ]);
  const middleRooms = [...leftUtilityRooms, ...rightUtilityRooms];
  middleRooms.forEach((room) => {
    addRoom({
      x: room.x,
      z: 0,
      w: room.w,
      d: 2.75,
      h: room.key === 'objects.reserve' ? 0.18 : 0.3,
      opacity: 0.54,
      color: room.color,
      labelKey: room.key,
      labelY: 2.48,
    });
    addUtilityEquipment(room);
  });
  addPodOutlines();
  addLabel(`${state.floor} · 133m × 92m`, [0, 3.28, -8.8], { hot: true });
}

const PRESETS = {
  campus: { camera: [27, 22, 30], target: [0, 1.6, 1], min: 16, max: 58 },
  building: { camera: [22, 17, 24], target: [0, 5.4, 0], min: 13, max: 48 },
  floor: { camera: [24, 15.5, 25], target: [0, 1.05, 0], min: 12, max: 48 },
};

function setCameraPreset(immediate = false) {
  const preset = PRESETS[state.view];
  controls.minDistance = preset.min;
  controls.maxDistance = preset.max;
  cameraGoal.set(...preset.camera);
  targetGoal.set(...preset.target);
  if (immediate) {
    camera.position.copy(cameraGoal);
    controls.target.copy(targetGoal);
    controls.update();
    cameraAnimating = false;
  } else {
    cameraAnimating = true;
  }
}

function setStats(items) {
  infoStatsEl.replaceChildren();
  items.forEach((item) => {
    const wrap = document.createElement('span');
    const value = document.createElement('b');
    const label = document.createElement('small');
    value.textContent = item.value;
    label.textContent = item.label;
    wrap.append(value, label);
    infoStatsEl.appendChild(wrap);
  });
}

function setActions(items) {
  actionEl.replaceChildren();
  items.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action-button';
    button.textContent = item.label;
    button.addEventListener('click', () => runAction(item.action));
    actionEl.appendChild(button);
  });
}

function updateBreadcrumbs() {
  const crumbs = [...document.querySelectorAll('#breadcrumbs button')];
  const campus = crumbs.find((button) => button.dataset.view === 'campus');
  const building = crumbs.find((button) => button.dataset.view === 'building');
  const floor = crumbs.find((button) => button.dataset.view === 'floor');
  campus.disabled = false;
  building.disabled = state.view === 'campus';
  floor.disabled = state.view !== 'floor';
  floorCrumb.textContent = t('breadcrumb.floor', { floor: state.floor });
  crumbs.forEach((button) => button.removeAttribute('aria-current'));
  if (state.view === 'campus') campus.setAttribute('aria-current', 'page');
  if (state.view === 'building') building.setAttribute('aria-current', 'page');
  if (state.view === 'floor') floor.setAttribute('aria-current', 'page');
}

function updateCopy() {
  updateBreadcrumbs();
  backButton.hidden = state.view === 'campus';
  if (referenceImage) referenceImage.hidden = !(referenceImageReady && state.view === 'campus');

  if (state.view === 'campus') {
    titleEl.textContent = t('campus.title');
    descriptionEl.textContent = t('campus.description');
    infoTitleEl.textContent = t('objects.a02');
    infoBodyEl.textContent = t('campus.info');
    setStats([
      { value: '3', label: t('stats.dataFloors') },
      { value: '12', label: t('stats.pods') },
      { value: '3,840', label: t('stats.racks') },
    ]);
    setActions([{ label: t('campus.enter'), action: { type: 'building' } }]);
  } else if (state.view === 'building') {
    titleEl.textContent = t('building.title');
    descriptionEl.textContent = t('building.description');
    infoTitleEl.textContent = t('objects.a02');
    infoBodyEl.textContent = t('building.info');
    setStats([
      { value: '1F–3F', label: t('stats.dataFloors') },
      { value: 'RF', label: t('objects.rf') },
    ]);
    setActions(['1F', '2F', '3F'].map((floor) => ({ label: t('building.selectFloor', { floor }), action: { type: 'floor', floor } })));
  } else {
    titleEl.textContent = t('floor.title', { floor: state.floor });
    descriptionEl.textContent = t('floor.description');
    infoTitleEl.textContent = `${t('objects.a02')} · ${state.floor}`;
    infoBodyEl.textContent = t('floor.info');
    setStats([
      { value: state.floor, label: t('floor.selected') },
      { value: '4', label: t('stats.pods') },
      { value: '1,280', label: t('stats.racks') },
    ]);
    setActions(['1F', '2F', '3F'].filter((floor) => floor !== state.floor).map((floor) => ({ label: t('building.selectFloor', { floor }), action: { type: 'floor', floor } })));
  }
}

function renderView(options = {}) {
  clearModel();
  if (state.view === 'campus') buildCampus();
  if (state.view === 'building') buildBuilding();
  if (state.view === 'floor') buildFloorDetail();
  updateCopy();
  setCameraPreset(Boolean(options.immediate));
}

function runAction(action) {
  if (!action) return;
  if (action.type === 'building') {
    state.view = 'building';
    renderView();
  } else if (action.type === 'floor') {
    state.view = 'floor';
    state.floor = action.floor;
    renderView();
  }
}

function goBack() {
  if (state.view === 'floor') state.view = 'building';
  else if (state.view === 'building') state.view = 'campus';
  renderView();
}

function setHovered(next) {
  if (hovered === next) return;
  if (hovered?.material?.emissive) {
    hovered.material.emissive.copy(hovered.userData.baseEmissive || new THREE.Color(0x000000));
    hovered.material.emissiveIntensity = hovered.userData.baseEmissiveIntensity ?? 0;
  }
  hovered = next;
  if (hovered?.material?.emissive) {
    hovered.userData.baseEmissive = hovered.material.emissive.clone();
    hovered.userData.baseEmissiveIntensity = hovered.material.emissiveIntensity;
    hovered.material.emissive.setHex(COLORS.cyan);
    hovered.material.emissiveIntensity = 0.45;
  }
  document.body.style.cursor = hovered?.userData?.action ? 'pointer' : hovered ? 'help' : '';
}

function hitAt(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(interactive, false)[0]?.object || null;
}

function onPointerMove(event) {
  const hit = hitAt(event);
  setHovered(hit);
  if (!hit?.userData?.tooltip) {
    tooltipEl.hidden = true;
    return;
  }
  const hostRect = host.getBoundingClientRect();
  tooltipEl.textContent = hit.userData.tooltip;
  tooltipEl.style.left = `${Math.min(event.clientX - hostRect.left + 14, hostRect.width - 230)}px`;
  tooltipEl.style.top = `${Math.max(8, event.clientY - hostRect.top - 34)}px`;
  tooltipEl.hidden = false;
}

function onResize() {
  const width = host.clientWidth || window.innerWidth;
  const height = host.clientHeight || window.innerHeight;
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  labelRenderer.setSize(width, height);
}

function applySceneTheme(rebuild = false) {
  if (!scene || !renderer) return;
  const dark = isDarkTheme();
  const background = dark ? 0x07111f : 0xeaf2f6;
  scene.background.setHex(background);
  scene.fog.color.setHex(background);
  scene.fog.density = dark ? 0.015 : 0.009;
  renderer.toneMappingExposure = dark ? 1.06 : 1.18;

  if (hemisphereLight) {
    hemisphereLight.color.setHex(dark ? 0xb9e6ff : 0xffffff);
    hemisphereLight.groundColor.setHex(dark ? 0x0f241e : 0x789281);
    hemisphereLight.intensity = dark ? 2.15 : 2.45;
  }
  if (sunLight) {
    sunLight.color.setHex(dark ? 0xffffff : 0xfffdf7);
    sunLight.intensity = dark ? 3.4 : 2.75;
  }
  if (rimLight) {
    rimLight.color.setHex(dark ? 0x22d3ee : 0x0ea5e9);
    rimLight.intensity = dark ? 1.5 : 0.85;
  }

  if (rebuild && state.initialized) renderView({ immediate: true });
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07111f);
  scene.fog = new THREE.FogExp2(0x07111f, 0.015);

  camera = new THREE.PerspectiveCamera(43, 1, 0.1, 180);
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.style.userSelect = 'none';
  renderer.domElement.setAttribute('aria-label', t('app.aria'));
  host.appendChild(renderer.domElement);

  labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.style.pointerEvents = 'none';
  host.appendChild(labelRenderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.maxPolarAngle = Math.PI * 0.475;
  controls.minPolarAngle = Math.PI * 0.08;
  controls.screenSpacePanning = true;
  controls.enableRotate = true;
  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
  controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  controls.addEventListener('start', () => {
    cameraAnimating = false;
    tooltipEl.hidden = true;
  });

  hemisphereLight = new THREE.HemisphereLight(0xb9e6ff, 0x0f241e, 2.15);
  scene.add(hemisphereLight);
  sunLight = new THREE.DirectionalLight(0xffffff, 3.4);
  sunLight.position.set(18, 28, 14);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -30;
  sunLight.shadow.camera.right = 30;
  sunLight.shadow.camera.top = 30;
  sunLight.shadow.camera.bottom = -30;
  scene.add(sunLight);
  rimLight = new THREE.DirectionalLight(0x22d3ee, 1.5);
  rimLight.position.set(-20, 8, -18);
  scene.add(rimLight);

  modelRoot = new THREE.Group();
  scene.add(modelRoot);
  applySceneTheme();

  renderer.domElement.addEventListener('pointerdown', (event) => {
    // 场景切换中的相机补间不能覆盖用户刚开始的拖动操作。
    cameraAnimating = false;
    pointerDown.set(event.clientX, event.clientY);
    renderer.domElement.focus({ preventScroll: true });
  });
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerleave', () => {
    setHovered(null);
    tooltipEl.hidden = true;
  });
  renderer.domElement.addEventListener('pointerup', (event) => {
    const moved = pointerDown.distanceTo(new THREE.Vector2(event.clientX, event.clientY));
    if (moved <= 6) runAction(hitAt(event)?.userData?.action);
  });
  renderer.domElement.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && hovered?.userData?.action) {
      event.preventDefault();
      runAction(hovered.userData.action);
    }
  });
  window.addEventListener('resize', onResize);
  onResize();
}

function animate(time) {
  requestAnimationFrame(animate);
  if (cameraAnimating) {
    camera.position.lerp(cameraGoal, 0.085);
    controls.target.lerp(targetGoal, 0.085);
    if (camera.position.distanceTo(cameraGoal) < 0.035 && controls.target.distanceTo(targetGoal) < 0.025) {
      camera.position.copy(cameraGoal);
      controls.target.copy(targetGoal);
      cameraAnimating = false;
    }
  }
  if (!reduceMotion.matches) {
    pulseMaterials.forEach((item, index) => {
      item.opacity = 0.22 + Math.sin(time * 0.0025 + index) * 0.11;
    });
    rackLightMaterials.forEach((item) => {
      item.material.emissiveIntensity = 0.52 + (Math.sin(time * 0.0022 + item.phase) + 1) * 0.18;
    });
  }
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

function refreshLocale() {
  if (!state.initialized) return;
  renderer.domElement.setAttribute('aria-label', t('app.aria'));
  renderView({ immediate: true });
}

function init() {
  if (state.initialized) return;
  try {
    initScene();
    state.initialized = true;
    renderView({ immediate: true });
    requestAnimationFrame(animate);
    loading.hidden = true;
  } catch (error) {
    console.error('[AIDC 3D]', error);
    loading.hidden = true;
    fallback.hidden = false;
  }
}

backButton.addEventListener('click', goBack);
resetButton.addEventListener('click', () => setCameraPreset());
document.getElementById('breadcrumbs').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-view]');
  if (!button || button.disabled) return;
  if (button.dataset.view === 'campus') state.view = 'campus';
  if (button.dataset.view === 'building') state.view = 'building';
  renderView();
});

window.AidcI18nBootstrap.bootstrap('ai-dc-room-layout-3d', {
  onReady: init,
  onLocaleChange: refreshLocale,
});

window.addEventListener('aidc-theme-change', () => applySceneTheme(true));

if (window.AidcLocaleBridge) {
  window.AidcLocaleBridge.initIframeListener((locale) => {
    if (window.AidcI18n && window.AidcI18n.getLocale() !== locale) {
      window.AidcI18n.setLocale(locale, { page: 'ai-dc-room-layout-3d', common: true, basePath: 'i18n/' });
    }
  }, { selfSource: 'ai-dc-room-layout-3d' });
}
