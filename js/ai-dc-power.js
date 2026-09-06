import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const host = document.getElementById('scene');
const loading = document.getElementById('loading');
const fallback = document.getElementById('webgl-fallback');
const infoTitle = document.getElementById('infoTitle');
const infoCopy = document.getElementById('infoCopy');
const stateText = document.getElementById('stateText');
const progressText = document.getElementById('progressText');
const infoPanel = document.getElementById('info');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function t(key, params) {
  return window.AidcI18n?.t?.(key, params) || key;
}

function displayTitle(name) {
  return String(name || '').replace(/^[①-⑳]\s*/, '');
}

function setLabelContent(el, title, sub) {
  el.replaceChildren();
  el.append(title);
  if (sub) {
    el.appendChild(document.createElement('br'));
    const small = document.createElement('small');
    small.textContent = sub;
    el.appendChild(small);
  }
}

function hostSize() {
  return {
    w: host.clientWidth || window.innerWidth,
    h: Math.max(1, host.clientHeight || window.innerHeight),
  };
}

const selectable = [];
const walls = [];
const powerObjects = [];
const flowParticles = [];
const numberedLabels = [];
const voltageObjects = [];
const smoke = [];
let racks = [];
let fan;
let linesVisible = true;
let mode = 'normal';
let selected = null;
let viewTween = null;
let sequenceTimers = [];
let initialized = false;

let renderer;
let labels;
let scene;
let camera;
let controls;
let grid;
let clock;

const COLOR = { blue: 0x2563eb, cyan: 0x00a6b4, green: 0x16a34a, orange: 0xffb020 };
const ACTIVE = {
  normal: new Set(['utility', 'lowVoltage', 'atsOutput', 'upsOutput', 'rackFeed']),
  battery: new Set(['battery', 'upsOutput', 'rackFeed']),
  starting: new Set(['battery', 'upsOutput', 'rackFeed']),
  generator: new Set(['generator', 'atsOutput', 'upsOutput', 'rackFeed']),
  recharging: new Set(['utility', 'lowVoltage', 'atsOutput', 'battery', 'upsOutput', 'rackFeed']),
};

const materials = {
  white: new THREE.MeshStandardMaterial({ color: 0xe8eef4, roughness: 0.52, metalness: 0.38 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x26384b, roughness: 0.42, metalness: 0.5 }),
  black: new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.35, metalness: 0.55 }),
  blue: new THREE.MeshStandardMaterial({ color: COLOR.blue, emissive: 0x071f57, emissiveIntensity: 0.62 }),
  cyan: new THREE.MeshStandardMaterial({ color: COLOR.cyan, emissive: 0x023f46, emissiveIntensity: 0.6 }),
  green: new THREE.MeshStandardMaterial({ color: COLOR.green, emissive: 0x064220, emissiveIntensity: 0.45 }),
  orange: new THREE.MeshStandardMaterial({ color: COLOR.orange, emissive: 0x663600, emissiveIntensity: 0.56 }),
  floor: new THREE.MeshStandardMaterial({ color: 0xdce5ed, roughness: 0.92 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xbdd6ed, transparent: true, opacity: 0.1, roughness: 0.2, side: THREE.DoubleSide }),
};
const edgeMat = new THREE.LineBasicMaterial({ color: 0x8aa1b8, transparent: true, opacity: 0.32 });

function box(w, h, d, mat = materials.white) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  if (mat !== materials.floor && mat !== materials.glass) {
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 24), edgeMat);
    edges.renderOrder = 2;
    m.add(edges);
  }
  return m;
}

function addLabel(parent, title, sub = '', y = 4) {
  const d = document.createElement('div');
  d.className = 'label';
  setLabelContent(d, title, sub);
  const o = new CSS2DObject(d);
  o.position.set(0, y, 0);
  parent.add(o);
  if (/^[①-⑳]/.test(title)) numberedLabels.push(o);
  return o;
}

function equipment(nameKey, descKey, x, z, w = 3, h = 4, d = 2.2, accent = 0x1677ff, labelPos) {
  const g = new THREE.Group();
  g.position.set(x, h / 2 + 0.18, z);
  g.add(box(w, h, d, materials.white));
  const face = box(w * 0.72, h * 0.72, 0.05, materials.dark);
  face.position.set(0, 0, d / 2 + 0.03);
  g.add(face);
  for (let i = -1; i <= 1; i += 1) {
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 8, 8),
      new THREE.MeshBasicMaterial({ color: i === 1 ? 0x22c55e : accent }),
    );
    led.position.set(-w * 0.24 + i * 0.22, h * 0.23, d / 2 + 0.07);
    g.add(led);
  }
  const label = addLabel(g, t(nameKey), '', h / 2 + 0.55);
  g.userData = {
    nameKey,
    descKey,
    name: t(nameKey),
    desc: t(descKey),
    baseY: g.position.y,
    label,
    labelEl: label.element,
    labelPos,
  };
  if (labelPos) label.position.set(...(isEn() ? labelPos.en : labelPos.zh));
  selectable.push(g);
  scene.add(g);
  return g;
}

function isEn() {
  return window.AidcI18n?.getLocale?.() === 'en';
}

function cabinetDetails(g, count, w, h, d, screenColor = 0x38bdf8) {
  for (let i = 0; i < count; i += 1) {
    const cw = w / count;
    const x = -w / 2 + cw * (i + 0.5);
    const door = box(cw - 0.06, h - 0.18, 0.055, new THREE.MeshStandardMaterial({ color: 0xdbe4eb, roughness: 0.45, metalness: 0.5 }));
    door.position.set(x, 0, d / 2 + 0.05);
    g.add(door);
    const screen = box(cw * 0.42, 0.42, 0.035, new THREE.MeshBasicMaterial({ color: 0x071827 }));
    screen.position.set(x, h * 0.2, d / 2 + 0.09);
    g.add(screen);
    const glow = box(cw * 0.28, 0.08, 0.012, new THREE.MeshBasicMaterial({ color: screenColor }));
    glow.position.set(x, h * 0.2, d / 2 + 0.115);
    g.add(glow);
    const handle = box(0.045, 0.45, 0.035, materials.dark);
    handle.position.set(x + cw * 0.33, -h * 0.1, d / 2 + 0.1);
    g.add(handle);
  }
}

function baseHalo(g, color) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 1.75, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -g.userData.baseY + 0.08;
  g.add(ring);
}

function decorateUps(g, w = 3.1, h = 4.6, d = 2.3, color = 0x38bdf8) {
  cabinetDetails(g, 2, w, h, d, color);
  const screen = box(0.64, 0.5, 0.04, new THREE.MeshBasicMaterial({ color }));
  screen.position.set(0, 0.62, d / 2 + 0.06);
  g.add(screen);
  baseHalo(g, color);
}

function decorateBattery(g, w = 2.8) {
  g.children[0].visible = false;
  g.children[1].visible = false;
  for (let i = 0; i < 2; i += 1) {
    const cab = box(w / 2 - 0.08, 2.65, 2.15, materials.black);
    cab.position.x = -w / 4 + i * w / 2;
    g.add(cab);
    for (let j = -1; j <= 1; j += 1) {
      const cell = box(w * 0.32, 0.3, 0.05, materials.orange);
      cell.position.set(cab.position.x, j * 0.58, 1.1);
      g.add(cell);
    }
  }
  baseHalo(g, 0xf59e0b);
}

function decorateSubstation(g, color = COLOR.blue) {
  g.children.forEach((child) => {
    if (!child.element) child.visible = false;
  });
  const pad = box(5.4, 0.16, 3.4, new THREE.MeshStandardMaterial({ color: 0xd3dde8, roughness: 0.86 }));
  pad.position.y = -g.userData.baseY + 0.11;
  g.add(pad);
  const transformerTank = box(1.65, 1.05, 1.28, new THREE.MeshStandardMaterial({ color: 0x71869a, roughness: 0.48, metalness: 0.52 }));
  transformerTank.position.set(-1.05, -0.9, 0.28);
  g.add(transformerTank);
  for (let i = -0.72; i <= 0.72; i += 0.24) {
    const fin = box(0.045, 1.1, 1.5, materials.dark);
    fin.position.set(-1.05 + i, -0.9, 0.28);
    g.add(fin);
  }
  for (const x of [-1.55, -0.55, 0.55, 1.55]) {
    const pole = box(0.08, 2.55, 0.08, materials.dark);
    pole.position.set(x, -0.38, -1.02);
    g.add(pole);
  }
  const beam = box(3.3, 0.09, 0.09, materials.dark);
  beam.position.set(0, 0.92, -1.02);
  g.add(beam);
  for (const x of [-1.35, -0.45, 0.45, 1.35]) {
    const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.62, 12), new THREE.MeshStandardMaterial({ color: 0x8b5e34, roughness: 0.68 }));
    ins.position.set(x, 0.48, -1.02);
    g.add(ins);
    const breaker = box(0.22, 0.82, 0.22, new THREE.MeshStandardMaterial({ color: 0xe8eef4, roughness: 0.5, metalness: 0.25 }));
    breaker.position.set(x, -0.92, -0.55);
    g.add(breaker);
  }
  const busA = box(4.2, 0.06, 0.06, new THREE.MeshBasicMaterial({ color }));
  busA.position.set(0, 0.7, -1.02);
  g.add(busA);
  const busB = box(3.2, 0.06, 0.06, new THREE.MeshBasicMaterial({ color }));
  busB.position.set(0.15, 0.2, -0.55);
  g.add(busB);
  for (const x of [-2.3, 2.3]) {
    for (const z of [-1.45, 1.45]) {
      const post = box(0.05, 0.62, 0.05, materials.dark);
      post.position.set(x, -1.45, z);
      g.add(post);
    }
  }
  baseHalo(g, color);
}

function wall(x, z, w, d) {
  const m = box(w, 3.2, d, materials.glass);
  m.position.set(x, 1.6, z);
  walls.push(m);
  scene.add(m);
}

function tower(x, z) {
  const g = new THREE.Group();
  for (const sx of [-0.65, 0.65]) {
    for (const sz of [-0.42, 0.42]) {
      const leg = box(0.11, 6, 0.11, materials.dark);
      leg.position.set(sx * 0.35, 3, sz * 0.35);
      leg.rotation.z = -sx * 0.075;
      g.add(leg);
    }
  }
  for (let y = 0.7; y < 5.7; y += 0.7) {
    const span = 1.25 - y * 0.11;
    const a = box(Math.max(0.4, span), 0.07, 0.07, materials.dark);
    a.position.y = y;
    a.rotation.z = y % 1.4 < 0.2 ? 0.4 : -0.4;
    g.add(a);
  }
  for (const y of [3.3, 4.4, 5.35]) {
    const arm = box(3.1, 0.12, 0.12, materials.dark);
    arm.position.y = y;
    g.add(arm);
    for (const sx of [-1.35, 1.35]) {
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.35, 8), materials.blue);
      ins.position.set(sx, y - 0.22, 0);
      g.add(ins);
    }
  }
  g.position.set(x, 0, z);
  scene.add(g);
}

function makePath(points, color, name, opts = {}) {
  const { radius = 0.08, dotRadius = 0.14, dotCount = 4, opacity = 0.84, glow = 0.18 } = opts;
  const curve = new THREE.CurvePath();
  for (let i = 0; i < points.length - 1; i += 1) curve.add(new THREE.LineCurve3(points[i], points[i + 1]));
  const segments = Math.max(28, points.length * 18);
  const halo = new THREE.Mesh(
    new THREE.TubeGeometry(curve, segments, radius * 2.25, 10, false),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: glow, depthWrite: false }),
  );
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, segments, radius, 10, false),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
  );
  tube.userData.pathType = name;
  halo.userData.pathType = name;
  scene.add(halo, tube);
  powerObjects.push(halo, tube);
  const dots = [];
  for (let i = 0; i < dotCount; i += 1) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(dotRadius, 12, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.96, depthWrite: false }),
    );
    scene.add(dot);
    dots.push(dot);
    powerObjects.push(dot);
  }
  flowParticles.push({ curve, dots, type: name, tube, halo, opacity, glow });
  return tube;
}

function voltageLabel(key, x, y, z, dc = false) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const d = document.createElement('div');
  d.className = `label voltage${dc ? ' dc' : ''}`;
  d.textContent = t(key);
  g.userData = { voltKey: key, el: d };
  g.add(new CSS2DObject(d));
  g.visible = false;
  scene.add(g);
  voltageObjects.push(g);
}

function buildPlant() {
  const ground = box(72, 0.35, 39, materials.floor);
  ground.position.y = -0.18;
  ground.receiveShadow = true;
  scene.add(ground);
  grid = new THREE.GridHelper(72, 36, 0x9bb4cb, 0xc8d6e3);
  grid.position.y = 0.01;
  scene.add(grid);
  const outdoorPad = box(10, 0.08, 19, new THREE.MeshStandardMaterial({ color: 0xd7ded3, roughness: 0.95 }));
  outdoorPad.position.set(-31, 0.05, 0);
  scene.add(outdoorPad);
  const energyPad = box(34, 0.08, 19, new THREE.MeshStandardMaterial({ color: 0xcbd8e5, roughness: 0.88 }));
  energyPad.position.set(-9, 0.05, 0);
  scene.add(energyPad);
  const hallPad = box(31, 0.08, 25, new THREE.MeshStandardMaterial({ color: 0xe5edf4, roughness: 0.88 }));
  hallPad.position.set(19, 0.055, -1);
  scene.add(hallPad);
  for (let x = -26; x < 8; x += 1.25) {
    const stripe = box(0.62, 0.035, 0.34, Math.round(x * 10) % 2 === 0 ? materials.orange : materials.dark);
    stripe.position.set(x, 0.115, 9.25);
    scene.add(stripe);
  }
  wall(-9, -10, 34, 0.18);
  wall(-26, 0, 0.18, 20);
  wall(8, 0, 0.18, 20);
  wall(-18.5, -4, 0.12, 12);
  wall(-11.5, -4, 0.12, 12);
  wall(-5, -4, 0.12, 12);
  wall(1.9, 0, 0.12, 20);
  wall(19, -14, 32, 0.18);
  wall(35, -1, 0.18, 26);
  wall(19, 12, 32, 0.18);
  tower(-34, -4);
  tower(-34, 4);
  const gridNode = new THREE.Vector3(-34, 2, -4);

  const hub500 = equipment('eq.n500', 'eq.d500', -34, -7.35, 4.2, 3.2, 2.4, COLOR.blue, {
    zh: [-1.85, 3.45, -2.65],
    en: [-2.1, 3.75, -2.95],
  });
  cabinetDetails(hub500, 3, 4.2, 3.2, 2.4, COLOR.blue);
  baseHalo(hub500, COLOR.blue);

  const sub220 = equipment('eq.n220', 'eq.d220', -28.6, -1.15, 5.2, 3.6, 3.2, COLOR.blue, {
    zh: [2.65, 2.65, -2.05],
    en: [2.35, 3.2, -2.9],
  });
  decorateSubstation(sub220, COLOR.blue);

  const mv = equipment('eq.n10', 'eq.d10', -21, -5.25, 4.5, 5, 2.6, 0x1677ff, {
    zh: [1.95, 4.35, -1.55],
    en: [1.55, 5.25, -2.55],
  });
  cabinetDetails(mv, 4, 4.5, 5, 2.6);
  baseHalo(mv, COLOR.blue);

  const transformer = equipment('eq.nTransformer', 'eq.dTransformer', -15, -5.25, 4, 3.8, 3.1, 0xf59e0b, {
    zh: [0.95, 3.05, 1.45],
    en: [-2.35, 4.45, 2.9],
  });
  transformer.children[0].visible = false;
  transformer.children[1].visible = false;
  const tank = box(2.9, 2.35, 2.45, new THREE.MeshStandardMaterial({ color: 0x6f8292, roughness: 0.48, metalness: 0.55 }));
  tank.position.y = -0.35;
  transformer.add(tank);
  for (let i = -1.75; i <= 1.75; i += 0.32) {
    const fin = box(0.075, 2.35, 2.8, materials.dark);
    fin.position.set(i, -0.35, 0);
    transformer.add(fin);
  }
  for (const x of [-0.95, 0, 0.95]) {
    const bushing = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 1.2, 12), new THREE.MeshStandardMaterial({ color: 0x7c3f1d, roughness: 0.7 }));
    bushing.position.set(x, 1.45, 0);
    transformer.add(bushing);
    for (const y of [-0.3, 0, 0.3]) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.08, 12), new THREE.MeshStandardMaterial({ color: 0x9a4f22 }));
      disc.position.set(x, 1.45 + y, 0);
      transformer.add(disc);
    }
  }
  baseHalo(transformer, 0xf59e0b);

  const lv = equipment('eq.nLv', 'eq.dLv', -9, -5.25, 4.7, 5, 2.6, 0x1677ff, {
    zh: [0.95, 3.75, 1.25],
    en: [3.65, 4.75, 2.05],
  });
  cabinetDetails(lv, 4, 4.7, 5, 2.6, 0x22c55e);
  baseHalo(lv, COLOR.cyan);

  const ats = equipment('eq.nAts', 'eq.dAts', -8, 4, 3.5, 4, 2.3, 0x22a559, {
    zh: [0, 2.55, 0],
    en: [-0.2, 3.25, 2.25],
  });
  cabinetDetails(ats, 2, 3.5, 4, 2.3, 0x22c55e);
  baseHalo(ats, 0x22a559);

  const upsA = equipment('eq.nUps', 'eq.dUps', -1, -5.8, 3.1, 4.6, 2.3, 0x1677ff, {
    zh: [0, 2.85, 0],
    en: [0.25, 3.25, -1.65],
  });
  decorateUps(upsA, 3.1, 4.6, 2.3, COLOR.cyan);

  const batteryA = equipment('eq.nBattery1', 'eq.dBattery1', -3.1, 6.2, 2.8, 2.8, 2.3, 0xf59e0b, {
    zh: [0, 1.95, 0],
    en: [-1.2, 2.5, 1.55],
  });
  decorateBattery(batteryA, 2.8);
  const batteryB = equipment('eq.nBattery2', 'eq.dBattery2', 0.2, 6.2, 2.8, 2.8, 2.3, 0xf59e0b, {
    zh: [0, 1.95, 0],
    en: [1.15, 2.25, 1.55],
  });
  decorateBattery(batteryB, 2.8);

  const generator = equipment('eq.nGen', 'eq.dGen', -34.2, 5.85, 6, 2.5, 3, 0x159447, {
    zh: [-2.65, 1.85, 1.65],
    en: [-2.65, 1.85, 1.65],
  });
  generator.children[0].visible = false;
  generator.children[1].visible = false;
  const skid = box(6, 0.35, 3, materials.dark);
  skid.position.y = -1.05;
  generator.add(skid);
  const engineBlock = box(2.6, 1.35, 1.65, materials.green);
  engineBlock.position.set(-0.45, -0.25, 0);
  generator.add(engineBlock);
  for (let i = -1; i <= 1; i += 1) {
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.25, 16), materials.green);
    cyl.rotation.z = Math.PI / 2;
    cyl.position.set(-0.55 + i * 0.75, 0.5, 0);
    generator.add(cyl);
  }
  const radiator = box(1.1, 2.05, 2.35, materials.dark);
  radiator.position.set(2.25, -0.05, 0);
  generator.add(radiator);
  fan = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.11, 8, 24), materials.green);
  fan.rotation.y = Math.PI / 2;
  fan.position.set(2.82, -0.05, 0);
  generator.add(fan);
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2, 12), materials.dark);
  exhaust.position.set(-1.35, 1.15, -0.65);
  generator.add(exhaust);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 12), materials.dark);
  cap.position.set(-1.35, 2.12, -0.65);
  generator.add(cap);
  baseHalo(generator, 0x22a559);

  for (let i = 0; i < 5; i += 1) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 + i * 0.04, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0 }),
    );
    puff.position.set(-35.55, 4 + i * 0.45, 5.2);
    scene.add(puff);
    smoke.push(puff);
  }

  const trenchMat = new THREE.MeshStandardMaterial({ color: 0x263648, roughness: 0.72, metalness: 0.4 });
  for (const z of [-6.05, -1.9]) {
    const trench = box(25, 0.09, 0.5, trenchMat);
    trench.position.set(-10.5, 0.14, z);
    scene.add(trench);
    for (let x = -22; x < 1; x += 1) {
      const bar = box(0.06, 0.035, 0.48, materials.white);
      bar.position.set(x, 0.205, z);
      scene.add(bar);
    }
  }
  for (const x of [-22, -15, -8, -1]) {
    const spur = box(0.5, 0.09, 4.1, trenchMat);
    spur.position.set(x, 0.14, -4);
    scene.add(spur);
  }
  const pduA = equipment('eq.nPdu', 'eq.dPdu', 5, -5.6, 3.4, 4.2, 2.2);
  cabinetDetails(pduA, 2, 3.4, 4.2, 2.2, COLOR.cyan);

  const rowZ = [-4, 4];
  racks = [];
  rowZ.forEach((z, row) => {
    for (let col = 0; col < 7; col += 1) {
      const x = 11 + col * 3.3;
      const r = box(2.2, 4.7, 2.5, materials.black);
      r.position.set(x, 2.35, z);
      const suffix = ` ${String.fromCharCode(65 + row)}-${col + 1}`;
      r.userData = {
        nameKey: 'eq.nRack',
        descKey: 'eq.dRack',
        nameSuffix: suffix,
        name: `${t('eq.nRack')}${suffix}`,
        desc: t('eq.dRack'),
        baseY: 2.35,
      };
      selectable.push(r);
      scene.add(r);
      racks.push(r);
      for (let u = -1.5; u <= 1.5; u += 0.55) {
        const slot = box(1.75, 0.32, 0.05, materials.blue);
        slot.position.set(x, 2.35 + u, z + 1.28);
        scene.add(slot);
      }
    }
  });
  const rackLabel = addLabel(racks[10], t('eq.nRack'), t('eq.rackSub'), 3.1);
  racks[10].userData.label = rackLabel;
  racks[10].userData.labelEl = rackLabel.element;
  racks[10].userData.subKey = 'eq.rackSub';

  rowZ.forEach((z, row) => {
    const bus = box(24, 0.34, 0.42, materials.cyan);
    bus.position.set(21, 6.1, z);
    scene.add(bus);
    if (row === 0) {
      const lb = addLabel(bus, t('eq.nBusway'), t('eq.buswaySub'), 0.72);
      lb.position.x = 2;
      bus.userData = { nameKey: 'eq.nBusway', subKey: 'eq.buswaySub', label: lb, labelEl: lb.element };
    }
  });
  const rackPdu = box(0.18, 3.8, 0.14, materials.cyan);
  rackPdu.position.set(21.6, 2.35, -2.72);
  scene.add(rackPdu);

  const blue = COLOR.blue;
  const cyan = COLOR.cyan;
  const orange = COLOR.orange;
  const green = COLOR.green;
  const trenchY = 0.58;
  const feederY = 1.2;
  const trayY = 2.45;
  const busY = 6.12;
  makePath([gridNode, new THREE.Vector3(-34, 2, -4), new THREE.Vector3(-34, 2, -7.35), new THREE.Vector3(-34, trenchY, -7.35)], blue, 'utility', { radius: 0.09, dotRadius: 0.15 });
  makePath([new THREE.Vector3(-31.9, trenchY, -7.35), new THREE.Vector3(-28.6, trenchY, -7.35), new THREE.Vector3(-28.6, trenchY, -1.15)], blue, 'utility', { radius: 0.08, dotRadius: 0.13 });
  makePath([new THREE.Vector3(-26, trenchY, -1.15), new THREE.Vector3(-24.2, trenchY, -1.15), new THREE.Vector3(-24.2, trenchY, -5.25), new THREE.Vector3(-23.3, trenchY, -5.25)], blue, 'utility', { radius: 0.08, dotRadius: 0.13 });
  makePath([new THREE.Vector3(-18.7, trenchY, -5.25), new THREE.Vector3(-17.1, trenchY, -5.25)], blue, 'utility', { radius: 0.075, dotRadius: 0.12, dotCount: 3 });
  makePath([new THREE.Vector3(-13, trenchY, -5.25), new THREE.Vector3(-11.4, trenchY, -5.25)], cyan, 'lowVoltage', { radius: 0.075, dotRadius: 0.12, dotCount: 3 });
  makePath([new THREE.Vector3(-8, 1.05, -1.7), new THREE.Vector3(-8, 1.05, 2.05)], cyan, 'lowVoltage', { radius: 0.07, dotRadius: 0.12, dotCount: 3 });
  makePath([new THREE.Vector3(-6.2, feederY, 4), new THREE.Vector3(-4.6, feederY, 4), new THREE.Vector3(-4.6, feederY, -5.8), new THREE.Vector3(-1.3, feederY, -5.8), new THREE.Vector3(-1.3, 1.55, -5.8)], cyan, 'atsOutput', { radius: 0.07, dotRadius: 0.12 });
  makePath([new THREE.Vector3(-3.1, 0.72, 4.85), new THREE.Vector3(-4.65, 0.72, 4.85), new THREE.Vector3(-4.65, 0.72, -5.8), new THREE.Vector3(-1.65, 0.72, -5.8), new THREE.Vector3(-1.65, 1.55, -5.8)], orange, 'battery', { radius: 0.07, dotRadius: 0.13, glow: 0.24 });
  makePath([new THREE.Vector3(0.2, 0.72, 4.85), new THREE.Vector3(-4.65, 0.72, 4.85)], orange, 'battery', { radius: 0.055, dotRadius: 0.09, dotCount: 2, opacity: 0.7, glow: 0.16 });
  makePath([new THREE.Vector3(0.75, 2.05, -5.8), new THREE.Vector3(5, 2.05, -5.8)], cyan, 'upsOutput', { radius: 0.085, dotRadius: 0.14 });
  rowZ.forEach((z) => {
    makePath([new THREE.Vector3(6.75, trayY, -5.6), new THREE.Vector3(8.85, trayY, -5.6), new THREE.Vector3(8.85, trayY, z), new THREE.Vector3(8.85, busY, z), new THREE.Vector3(9.15, busY, z)], cyan, 'rackFeed', { radius: 0.075, dotRadius: 0.12 });
  });
  makePath([new THREE.Vector3(-31.2, 0.78, 5.85), new THREE.Vector3(-10.5, 0.78, 5.85), new THREE.Vector3(-10.5, 0.98, 4.2), new THREE.Vector3(-8.2, 0.98, 4.2)], green, 'generator', { radius: 0.085, dotRadius: 0.14, glow: 0.22 });
  rowZ.forEach((z) => {
    for (let col = 0; col < 7; col += 1) {
      const x = 11 + col * 3.3;
      makePath([new THREE.Vector3(x, busY, z), new THREE.Vector3(x, 5.35, z), new THREE.Vector3(x, 4.7, z)], cyan, 'rackFeed', { radius: 0.045, dotRadius: 0.075, dotCount: 2, opacity: 0.72, glow: 0.1 });
    }
  });
  voltageLabel('volt.v500', -35.2, 2.4, -7.2);
  voltageLabel('volt.v220', -29.6, 1.25, -1.15);
  voltageLabel('volt.v10', -21, 1.2, -5.25);
  voltageLabel('volt.v380', -12.2, 1, -5.25);
  voltageLabel('volt.vUpsIn', -4.3, 1.4, -2.7);
  voltageLabel('volt.vBattery', -1.5, 1, 4.1, true);
  voltageLabel('volt.vUpsOut', 2, 2.7, -5.7);
  voltageLabel('volt.vBusway', 12, 6.8, -4);
  voltageLabel('volt.v48', 23, 3.2, -4, true);
}

function applyMode(next) {
  mode = next;
  const outageOn = ['battery', 'starting', 'generator'].includes(next);
  document.getElementById('normal').classList.toggle('active', next === 'normal' || next === 'recharging');
  document.getElementById('outage').classList.toggle('active', outageOn);
  document.getElementById('normal').setAttribute('aria-pressed', String(next === 'normal' || next === 'recharging'));
  document.getElementById('outage').setAttribute('aria-pressed', String(outageOn));
  stateText.textContent = t(`mode.${next}Status`);
  progressText.textContent = t(`mode.${next}Progress`);
  const activeSet = ACTIVE[next];
  flowParticles.forEach((p) => {
    const active = activeSet.has(p.type);
    p.dots.forEach((d) => {
      d.visible = linesVisible && active;
    });
    p.tube.visible = linesVisible;
    p.halo.visible = linesVisible;
    p.tube.material.opacity = active ? p.opacity : 0.08;
    p.halo.material.opacity = active ? p.glow : 0.035;
    p.active = active;
  });
}

function clearSequence() {
  sequenceTimers.forEach(clearTimeout);
  sequenceTimers = [];
}

function simulateOutage() {
  clearSequence();
  applyMode('battery');
  if (reduceMotion.matches) {
    applyMode('generator');
    return;
  }
  sequenceTimers.push(setTimeout(() => applyMode('starting'), 1800));
  sequenceTimers.push(setTimeout(() => applyMode('generator'), 4300));
}

function restoreUtility() {
  clearSequence();
  if (mode === 'normal') return applyMode('normal');
  if (reduceMotion.matches) return applyMode('normal');
  applyMode('recharging');
  sequenceTimers.push(setTimeout(() => applyMode('normal'), 2600));
}

function flyTo(position, target) {
  if (reduceMotion.matches) {
    camera.position.copy(position);
    controls.target.copy(target);
    viewTween = null;
    return;
  }
  viewTween = {
    fromPos: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPos: position,
    toTarget: target,
    start: performance.now(),
  };
}

function applySceneTheme() {
  if (!scene || !grid) return;
  const dark = document.documentElement.dataset.theme === 'dark';
  scene.fog.color.set(dark ? 0x07111f : 0xdce8f4);
  grid.material.opacity = dark ? 0.28 : 1;
  grid.material.transparent = dark;
}

function refreshDynamicCopy() {
  const voltagesBtn = document.getElementById('voltages');
  const linesBtn = document.getElementById('lines');
  const wallsBtn = document.getElementById('walls');
  const voltagesOn = voltageObjects[0]?.visible;
  voltagesBtn.textContent = t(voltagesOn ? 'controls.hideVoltages' : 'controls.showVoltages');
  voltagesBtn.setAttribute('aria-pressed', String(Boolean(voltagesOn)));
  linesBtn.textContent = t(linesVisible ? 'controls.hideLines' : 'controls.showLines');
  linesBtn.setAttribute('aria-pressed', String(linesVisible));
  const wallsHidden = walls.some((w) => w.visible === false);
  wallsBtn.textContent = t(wallsHidden ? 'controls.showWalls' : 'controls.hideWalls');
  wallsBtn.setAttribute('aria-pressed', String(!wallsHidden));
  applyMode(mode);
  if (selected?.userData?.nameKey) {
    selected.userData.name = `${t(selected.userData.nameKey)}${selected.userData.nameSuffix || ''}`;
    selected.userData.desc = t(selected.userData.descKey);
    infoTitle.textContent = displayTitle(selected.userData.name);
    infoCopy.textContent = selected.userData.desc;
  } else if (!infoPanel.classList.contains('expanded')) {
    infoTitle.textContent = t('info.title');
    infoCopy.textContent = t('info.copy');
  }
}

function refreshLocale() {
  if (!initialized) return;
  selectable.forEach((obj) => {
    if (!obj.userData?.nameKey) return;
    obj.userData.name = `${t(obj.userData.nameKey)}${obj.userData.nameSuffix || ''}`;
    obj.userData.desc = t(obj.userData.descKey);
    if (obj.userData.labelEl) {
      setLabelContent(obj.userData.labelEl, obj.userData.subKey ? t(obj.userData.nameKey) : displayTitle(obj.userData.name), obj.userData.subKey ? t(obj.userData.subKey) : '');
    }
    if (obj.userData.label && obj.userData.labelPos) {
      obj.userData.label.position.set(...(isEn() ? obj.userData.labelPos.en : obj.userData.labelPos.zh));
    }
  });
  scene.traverse((obj) => {
    if (obj.userData?.nameKey && obj.userData.labelEl && !selectable.includes(obj)) {
      setLabelContent(obj.userData.labelEl, t(obj.userData.nameKey), obj.userData.subKey ? t(obj.userData.subKey) : '');
    }
  });
  voltageObjects.forEach((g) => {
    if (g.userData?.el && g.userData.voltKey) g.userData.el.textContent = t(g.userData.voltKey);
  });
  renderer.domElement.setAttribute('aria-label', t('app.aria'));
  refreshDynamicCopy();
}

function pickAt(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(pointer, camera);
  const hits = ray.intersectObjects(selectable, true);
  if (!hits.length) {
    selected = null;
    infoPanel.classList.remove('expanded');
    infoTitle.textContent = t('info.title');
    infoCopy.textContent = t('info.copy');
    return;
  }
  let obj = hits[0].object;
  while (obj.parent && !obj.userData.name) obj = obj.parent;
  if (!obj.userData.name) return;
  selected = obj;
  infoTitle.textContent = displayTitle(obj.userData.name);
  infoCopy.textContent = obj.userData.desc;
  infoPanel.classList.add('expanded');
  controls.target.lerp(obj.getWorldPosition(new THREE.Vector3()), reduceMotion.matches ? 1 : 0.55);
}

function onResize() {
  if (!camera || !renderer || !labels) return;
  const { w, h } = hostSize();
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio || 1, 1), 2));
  renderer.setSize(w, h, false);
  labels.setSize(w, h);
}

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const elapsed = clock.getElapsedTime();
  if (viewTween) {
    const k = Math.min(1, (now - viewTween.start) / 850);
    const e = 1 - (1 - k) ** 3;
    camera.position.lerpVectors(viewTween.fromPos, viewTween.toPos, e);
    controls.target.lerpVectors(viewTween.fromTarget, viewTween.toTarget, e);
    if (k >= 1) viewTween = null;
  }
  controls.update();
  const generatorOn = mode === 'starting' || mode === 'generator';
  if (!reduceMotion.matches) {
    flowParticles.forEach((p, pi) => {
      if (!p.active) return;
      p.dots.forEach((d, i) => d.position.copy(p.curve.getPoint((elapsed * 0.16 + i / p.dots.length + pi * 0.03) % 1)));
    });
    if (fan) fan.rotation.x = generatorOn ? elapsed * 9 : 0;
    smoke.forEach((p, i) => {
      p.material.opacity = generatorOn ? Math.max(0, 0.22 - ((elapsed * 0.32 + i * 0.18) % 1) * 0.22) : 0;
      p.position.y = 4 + ((elapsed * 0.7 + i * 0.65) % 3);
      p.position.x = -35.55 + Math.sin(elapsed + i) * 0.12;
      p.position.z = 5.2;
    });
    if (selected) selected.position.y = selected.userData.baseY + Math.sin(elapsed * 3) * 0.04;
  } else {
    if (fan) fan.rotation.x = 0;
    smoke.forEach((p) => {
      p.material.opacity = 0;
    });
    if (selected) selected.position.y = selected.userData.baseY;
  }
  renderer.render(scene, camera);
  labels.render(scene, camera);
}

function initScene() {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xdce8f4, 120, 220);
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  camera.position.set(42, 31, 49);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', t('app.aria'));
  host.appendChild(renderer.domElement);
  labels = new CSS2DRenderer();
  labels.domElement.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  host.appendChild(labels.domElement);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(-5, 1, -1);
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minDistance = 18;
  controls.maxDistance = 92;
  scene.add(new THREE.HemisphereLight(0xeaf5ff, 0x64748b, 2.5));
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(20, 35, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 35;
  sun.shadow.camera.bottom = -35;
  scene.add(sun);
  buildPlant();
  onResize();
  applySceneTheme();
  applyMode('normal');
  clock = new THREE.Clock();
  const pointerDown = new THREE.Vector2();
  renderer.domElement.addEventListener('pointerdown', (event) => {
    pointerDown.set(event.clientX, event.clientY);
  });
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (event.button !== 0) return;
    const moved = pointerDown.distanceTo(new THREE.Vector2(event.clientX, event.clientY));
    if (moved <= 6) pickAt(event);
  });
  renderer.domElement.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      pickAt(event);
    }
  });
  window.addEventListener('resize', onResize);
}

function bindControls() {
  document.getElementById('normal').addEventListener('click', restoreUtility);
  document.getElementById('outage').addEventListener('click', simulateOutage);
  document.getElementById('energyView').addEventListener('click', () => flyTo(new THREE.Vector3(2, 21, 31), new THREE.Vector3(-11, 1, 0)));
  document.getElementById('hallView').addEventListener('click', () => flyTo(new THREE.Vector3(39, 23, 30), new THREE.Vector3(19, 2, -1)));
  document.getElementById('reset').addEventListener('click', () => flyTo(new THREE.Vector3(42, 31, 49), new THREE.Vector3(-5, 1, -1)));
  document.getElementById('voltages').addEventListener('click', () => {
    const show = !voltageObjects[0].visible;
    voltageObjects.forEach((o) => {
      o.visible = show;
    });
    numberedLabels.forEach((o) => {
      o.visible = !show;
    });
    refreshDynamicCopy();
  });
  document.getElementById('lines').addEventListener('click', () => {
    linesVisible = !linesVisible;
    powerObjects.forEach((o) => {
      o.visible = linesVisible;
    });
    applyMode(mode);
    refreshDynamicCopy();
  });
  document.getElementById('walls').addEventListener('click', () => {
    const show = walls.some((w) => w.visible === false);
    walls.forEach((w) => {
      w.visible = show;
    });
    refreshDynamicCopy();
  });
}

function init() {
  if (initialized) return;
  try {
    initScene();
    bindControls();
    initialized = true;
    requestAnimationFrame(animate);
    loading.hidden = true;
  } catch (error) {
    console.error('[AIDC Power]', error);
    loading.hidden = true;
    fallback.hidden = false;
  }
}

window.AidcI18nBootstrap.bootstrap('ai-dc-power', {
  onReady: init,
  onLocaleChange: refreshLocale,
});

window.addEventListener('aidc-theme-change', applySceneTheme);

if (window.AidcLocaleBridge) {
  window.AidcLocaleBridge.initIframeListener((locale) => {
    if (window.AidcI18n && window.AidcI18n.getLocale() !== locale) {
      window.AidcI18n.setLocale(locale, { page: 'ai-dc-power', common: true, basePath: 'i18n/' });
    }
  }, { selfSource: 'ai-dc-power' });
}
