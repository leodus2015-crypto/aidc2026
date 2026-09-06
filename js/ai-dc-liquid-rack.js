import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

const root = document.getElementById('scene');
const loading = document.getElementById('loading');
const fallback = document.getElementById('fallback');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (error) {
  loading.hidden = true;
  fallback.hidden = false;
  fallback.style.display = 'grid';
  throw error;
}

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x07111d, 0.028);

function hostSize() {
  return {
    w: root.clientWidth || window.innerWidth,
    h: Math.max(1, root.clientHeight || window.innerHeight),
  };
}

const initialSize = hostSize();
const camera = new THREE.PerspectiveCamera(34, initialSize.w / initialSize.h, 0.05, 80);
camera.position.set(6.9, 5.35, 7.6);

renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(initialSize.w, initialSize.h, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
root.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(initialSize.w, initialSize.h);
labelRenderer.domElement.style.cssText = 'position:absolute;inset:0;pointer-events:none';
root.appendChild(labelRenderer.domElement);
renderer.domElement.tabIndex = 0;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.target.set(0, 2.3, 0);
controls.minDistance = 4.4;
controls.maxDistance = 18;
controls.maxPolarAngle = Math.PI * 0.62;

const hemisphereLight = new THREE.HemisphereLight(0xdff7ff, 0x07101a, 2.25);
scene.add(hemisphereLight);
const keyLight = new THREE.DirectionalLight(0xe7f8ff, 4.6);
keyLight.position.set(5, 10, 7);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -8;
keyLight.shadow.camera.right = 8;
keyLight.shadow.camera.top = 8;
keyLight.shadow.camera.bottom = -8;
scene.add(keyLight);

const cyanLight = new THREE.PointLight(0x20d9ff, 22, 10, 2);
cyanLight.position.set(-2.5, 1.2, 1.8);
scene.add(cyanLight);
const amberLight = new THREE.PointLight(0xffa739, 16, 10, 2);
amberLight.position.set(2.5, 4.2, -1.2);
scene.add(amberLight);

const materials = {
  slab: new THREE.MeshStandardMaterial({ color: 0x152c3b, roughness: .8, metalness: .1 }),
  // Raised-floor tiles use an unlit neutral material so every tile keeps the
  // same gray value regardless of camera angle, shadows or key-light falloff.
  tile: new THREE.MeshBasicMaterial({ color: 0x9fa5a9, fog: false, toneMapped: false }),
  tileEdge: new THREE.LineBasicMaterial({ color: 0x95aab6, transparent: true, opacity: .35 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x587080, roughness: .34, metalness: .82 }),
  darkSteel: new THREE.MeshStandardMaterial({ color: 0x132837, roughness: .32, metalness: .86 }),
  black: new THREE.MeshStandardMaterial({ color: 0x07111b, roughness: .38, metalness: .68 }),
  server: new THREE.MeshStandardMaterial({ color: 0x162c3a, roughness: .3, metalness: .72 }),
  glass: new THREE.MeshPhysicalMaterial({
    color: 0x8bdff1, transparent: true, opacity: .16, roughness: .12, metalness: .05,
    transmission: .12, side: THREE.DoubleSide, depthWrite: false
  }),
  supply: new THREE.MeshStandardMaterial({ color: 0x36e98a, emissive: 0x078a49, emissiveIntensity: 1.35, roughness: .22, metalness: .3 }),
  return: new THREE.MeshStandardMaterial({ color: 0xff795f, emissive: 0xb43724, emissiveIntensity: .9, roughness: .27, metalness: .28 }),
  powerA: new THREE.MeshStandardMaterial({ color: 0xffd34e, emissive: 0xa66b00, emissiveIntensity: .8, roughness: .3, metalness: .42 }),
  powerB: new THREE.MeshStandardMaterial({ color: 0xff6b48, emissive: 0x9c2415, emissiveIntensity: .8, roughness: .3, metalness: .42 }),
  fiber: new THREE.MeshStandardMaterial({ color: 0x44e09a, emissive: 0x087342, emissiveIntensity: .72, roughness: .38, metalness: .32 }),
  fire: new THREE.MeshStandardMaterial({ color: 0xe33f4c, emissive: 0x671018, emissiveIntensity: .42, roughness: .32, metalness: .3 }),
  beam: new THREE.MeshStandardMaterial({ color: 0x627787, transparent: true, opacity: .36, roughness: .72, metalness: .12, depthWrite: false }),
};

const selectable = [];
const translatedLabels = [];
const shellParts = [];
const waterGroup = new THREE.Group();
const powerGroup = new THREE.Group();
const dimensionGroup = new THREE.Group();
scene.add(waterGroup, powerGroup, dimensionGroup);

function meshBox(w, h, d, material, position, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function component(key, parent = scene) {
  const group = new THREE.Group();
  group.userData.componentKey = key;
  parent.add(group);
  selectable.push(group);
  return group;
}

function addSceneLabel(object, i18nKey, className, position, category = 'core') {
  const node = document.createElement('div');
  node.className = `scene-label ${className || ''}`.trim();
  node.dataset.i18nKey = i18nKey;
  node.dataset.labelCategory = category;
  const tag = new CSS2DObject(node);
  tag.position.copy(position);
  object.add(tag);
  node._labelObject = tag;
  translatedLabels.push(node);
  return tag;
}

function makeCylinderBetween(start, end, radius, material, parent) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 16), material);
  mesh.position.copy(start).add(end).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function orthogonalCurve(points) {
  const curve = new THREE.CurvePath();
  for (let index = 1; index < points.length; index += 1) {
    curve.add(new THREE.LineCurve3(points[index - 1], points[index]));
  }
  return curve;
}

const animatedRoutes = [];
function makeFlowRoute({ key, points, color, radius, parent, direction = 1, particles = 9, opacity = .98 }) {
  const group = component(key, parent);
  const curve = orthogonalCurve(points);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(48, points.length * 20), radius, 12, false),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .7, roughness: .2, metalness: .25, transparent: true, opacity })
  );
  tube.castShadow = true;
  group.add(tube);
  const glow = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(48, points.length * 20), radius * 1.75, 10, false),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .1, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  group.add(glow);
  const dots = [];
  for (let index = 0; index < particles; index += 1) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.3, 12, 12), new THREE.MeshBasicMaterial({ color }));
    group.add(dot);
    dots.push(dot);
  }
  animatedRoutes.push({ curve, dots, direction, group });
  return group;
}

function makeStaticTube(points, radius, material, parent) {
  const curve = orthogonalCurve(points);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, points.length * 16, radius, 9, false), material);
  parent.add(tube);
  return tube;
}

// Structural slab and the 800 mm raised-floor void.
const floorComponent = component('floor');
meshBox(10.6, .18, 7.2, materials.slab, new THREE.Vector3(0, -.09, 0), floorComponent);
for (let x = -4.5; x <= 4.5; x += 1.5) {
  for (let z = -2.7; z <= 2.7; z += 1.35) {
    // Front-left cutaway exposes the complete underfloor liquid route while orbiting.
    if (x < .9 && Math.abs(z) < .75) continue;
    const tile = meshBox(1.43, .08, 1.28, materials.tile.clone(), new THREE.Vector3(x, .76, z), floorComponent);
    tile.userData.surfaceTile = true;
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(tile.geometry), materials.tileEdge);
    edge.position.copy(tile.position);
    floorComponent.add(edge);
  }
}
for (const x of [-4.5, -3, -1.5, 0, 1.5, 3, 4.5]) {
  for (const z of [-2.7, -1.35, 0, 1.35, 2.7]) {
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(.035, .055, .72, 8), materials.steel);
    pedestal.position.set(x, .39, z);
    floorComponent.add(pedestal);
  }
}
addSceneLabel(floorComponent, 'objects.floor.title', '', new THREE.Vector3(-3.7, .95, 2.4), 'water');

// Rack frame, transparent enclosure and detailed compute nodes.
const rack = component('rack');
const rackW = .82;
const rackD = 1.28;
const rackBottom = .8;
const rackTop = 3.05;
for (const x of [-rackW / 2, rackW / 2]) {
  for (const z of [-rackD / 2, rackD / 2]) {
    meshBox(.055, 2.16, .055, materials.darkSteel, new THREE.Vector3(x, 1.925, z), rack);
  }
}
meshBox(rackW + .08, .09, rackD + .08, materials.steel, new THREE.Vector3(0, .845, 0), rack);
meshBox(rackW + .08, .09, rackD + .08, materials.steel, new THREE.Vector3(0, 3.005, 0), rack);
for (const [w, h, d, x, y, z] of [
  [rackW, 2.07, .018, 0, 1.925, -rackD / 2],
  [.018, 2.07, rackD, -rackW / 2, 1.925, 0],
  [.018, 2.07, rackD, rackW / 2, 1.925, 0],
]) {
  const shell = meshBox(w, h, d, materials.glass.clone(), new THREE.Vector3(x, y, z), rack);
  shell.raycast = () => {};
  shellParts.push(shell);
}
const frontDoor = meshBox(rackW, 2.07, .018, materials.glass.clone(), new THREE.Vector3(0, 1.925, rackD / 2), rack);
frontDoor.raycast = () => {};
shellParts.push(frontDoor);
const doorGrid = new THREE.GridHelper(2.02, 18, 0x6e8796, 0x304b5b);
doorGrid.scale.set(.42, 1, .64);
doorGrid.rotation.x = Math.PI / 2;
doorGrid.rotation.z = Math.PI / 2;
doorGrid.position.set(0, 1.925, rackD / 2 + .012);
doorGrid.material.transparent = true;
doorGrid.material.opacity = .42;
doorGrid.raycast = () => {};
rack.add(doorGrid);
shellParts.push(doorGrid);
addSceneLabel(rack, 'objects.rack.title', '', new THREE.Vector3(0, 3.28, .15));

const servers = component('servers');
const nodeCount = 10;
for (let index = 0; index < nodeCount; index += 1) {
  const y = 1.05 + index * .176;
  const chassis = meshBox(.68, .135, 1.03, materials.server.clone(), new THREE.Vector3(0, y, 0), servers);
  const face = meshBox(.62, .092, .018, materials.black.clone(), new THREE.Vector3(0, y, .525), servers);
  for (let led = 0; led < 4; led += 1) {
    const ledMat = new THREE.MeshBasicMaterial({ color: led % 2 ? 0x20d9ff : 0x55e39e });
    meshBox(.018, .018, .014, ledMat, new THREE.Vector3(-.25 + led * .055, y, .54), servers);
  }
  chassis.userData.nodeIndex = index;
  chassis.userData.serverBody = true;
  face.userData.nodeIndex = index;
  face.userData.serverFace = true;
}

// Internal rack manifolds, cold-plate branches and quick-connects.
const manifold = component('manifold', waterGroup);
makeCylinderBetween(new THREE.Vector3(.3, .9, -.48), new THREE.Vector3(.3, 2.9, -.48), .035, materials.supply, manifold);
makeCylinderBetween(new THREE.Vector3(-.3, .9, -.48), new THREE.Vector3(-.3, 2.9, -.48), .035, materials.return, manifold);
for (let index = 0; index < nodeCount; index += 1) {
  const y = 1.05 + index * .176;
  makeStaticTube([
    new THREE.Vector3(.3, y, -.48), new THREE.Vector3(.12, y, -.48), new THREE.Vector3(.12, y, -.18)
  ], .012, materials.supply, manifold);
  makeStaticTube([
    new THREE.Vector3(-.12, y, -.18), new THREE.Vector3(-.12, y + .035, -.48), new THREE.Vector3(-.3, y + .035, -.48)
  ], .012, materials.return, manifold);
  const coldPlate = meshBox(.25, .025, .3, materials.supply.clone(), new THREE.Vector3(0, y, -.05), manifold);
  coldPlate.material.emissiveIntensity = .4;
}
addSceneLabel(manifold, 'objects.manifold.title', 'water-label', new THREE.Vector3(.58, 2.55, -.48), 'water');

// Underfloor supply and return mains rise vertically through the rack base.
const supplyRoute = makeFlowRoute({
  key: 'supply', color: 0x36e98a, radius: .105, parent: waterGroup,
  points: [
    new THREE.Vector3(-5.1, .27, .34), new THREE.Vector3(.3, .27, .34),
    new THREE.Vector3(.3, .27, -.48), new THREE.Vector3(.3, .9, -.48)
  ]
});
const returnRoute = makeFlowRoute({
  key: 'return', color: 0xff5548, radius: .095, parent: waterGroup, direction: -1,
  points: [
    new THREE.Vector3(-5.1, .52, -.18), new THREE.Vector3(-.3, .52, -.18),
    new THREE.Vector3(-.3, .52, -.48), new THREE.Vector3(-.3, .9, -.48)
  ]
});
for (const x of [-3.9, -2.2, -.8]) {
  const valve = new THREE.Mesh(new THREE.TorusGeometry(.135, .025, 8, 18), materials.steel);
  valve.position.set(x, .27, .34);
  valve.rotation.y = Math.PI / 2;
  supplyRoute.add(valve);
}
addSceneLabel(supplyRoute, 'objects.supply.title', 'water-label supply-label', new THREE.Vector3(-3.7, .1, .34), 'water');
addSceneLabel(returnRoute, 'objects.return.title', 'water-label return-label', new THREE.Vector3(-3.7, .72, -.18), 'water');

// Dual vertical PDUs inside the rack.
const pduA = meshBox(.055, 1.82, .055, materials.powerA, new THREE.Vector3(-.34, 1.96, -.54), powerGroup);
const pduB = meshBox(.055, 1.82, .055, materials.powerB, new THREE.Vector3(.34, 1.96, -.54), powerGroup);
for (let index = 0; index < nodeCount; index += 1) {
  const y = 1.05 + index * .176;
  makeStaticTube([new THREE.Vector3(-.34, y, -.54), new THREE.Vector3(-.27, y, -.28)], .008, materials.powerA, powerGroup);
  makeStaticTube([new THREE.Vector3(.34, y, -.54), new THREE.Vector3(.27, y, -.28)], .008, materials.powerB, powerGroup);
}

// Overhead A/B busways and straight vertical drops.
const busway = component('busway', powerGroup);
meshBox(8.2, .19, .16, materials.powerA, new THREE.Vector3(0, 3.95, -.34), busway);
meshBox(8.2, .19, .16, materials.powerB, new THREE.Vector3(0, 3.95, .34), busway);
for (const z of [-.34, .34]) {
  for (let x = -3.7; x <= 3.7; x += .55) meshBox(.035, .215, .18, materials.darkSteel, new THREE.Vector3(x, 3.95, z), busway);
}
addSceneLabel(busway, 'objects.busway.title', 'power-label', new THREE.Vector3(2.8, 4.08, 0), 'power-detail');

makeFlowRoute({
  key: 'busway', color: 0xffd34e, radius: .024, parent: powerGroup, particles: 7,
  points: [
    new THREE.Vector3(-3.8, 3.95, -.34), new THREE.Vector3(-.34, 3.95, -.34),
    new THREE.Vector3(-.34, 3.14, -.34), new THREE.Vector3(-.34, 2.88, -.54)
  ]
});
makeFlowRoute({
  key: 'busway', color: 0xff6b48, radius: .024, parent: powerGroup, particles: 7,
  points: [
    new THREE.Vector3(3.8, 3.95, .34), new THREE.Vector3(.34, 3.95, .34),
    new THREE.Vector3(.34, 3.14, .34), new THREE.Vector3(.34, 2.88, -.54)
  ]
});

function cableTray(key, y, z, material, width = 7.2, depth = .46) {
  const tray = component(key, powerGroup);
  meshBox(width, .055, .055, material, new THREE.Vector3(0, y, z - depth / 2), tray);
  meshBox(width, .055, .055, material, new THREE.Vector3(0, y, z + depth / 2), tray);
  for (let x = -width / 2; x <= width / 2; x += .35) {
    meshBox(.025, .045, depth, material, new THREE.Vector3(x, y, z), tray);
  }
  return tray;
}
const powerTrayA = cableTray('powerBridge', 3.56, -1.35, materials.powerA, 7.4, .42);
const powerTrayB = cableTray('powerBridge', 3.73, -1.35, materials.powerB, 7.4, .42);
const fiberTray = cableTray('fiber', 3.34, -1.35, materials.fiber, 7.4, .38);
addSceneLabel(powerTrayB, 'objects.powerBridge.title', 'power-label', new THREE.Vector3(-2.7, 3.87, -1.35), 'power');
addSceneLabel(fiberTray, 'objects.fiber.title', '', new THREE.Vector3(2.7, 3.48, -1.35), 'power');

// Beam, ceiling return-air plane, and fire protection main from the reference section.
const fire = component('fire');
makeCylinderBetween(new THREE.Vector3(-4.2, 4.65, 1.45), new THREE.Vector3(4.2, 4.65, 1.45), .075, materials.fire, fire);
for (const x of [-2.6, 0, 2.6]) {
  makeCylinderBetween(new THREE.Vector3(x, 4.65, 1.45), new THREE.Vector3(x, 4.58, 1.45), .022, materials.fire, fire);
  const head = new THREE.Mesh(new THREE.ConeGeometry(.08, .06, 12), materials.fire);
  head.position.set(x, 4.54, 1.45);
  head.rotation.x = Math.PI;
  fire.add(head);
}
addSceneLabel(fire, 'objects.fire.title', '', new THREE.Vector3(2.7, 4.76, 1.45), 'power');
meshBox(9.2, .3, .48, materials.beam, new THREE.Vector3(0, 4.9, -2.2));
const ceilingComponent = component('ceiling');
const ceiling = meshBox(9.8, .035, 6.4, materials.beam.clone(), new THREE.Vector3(0, 5.75, 0), ceilingComponent);
ceiling.material.opacity = .12;
addSceneLabel(ceilingComponent, 'objects.ceiling.title', '', new THREE.Vector3(-2.8, 5.61, 1.8), 'power');

// Overhead supports emphasize depth without blocking the rack.
for (const x of [-3.6, 3.6]) {
  for (const z of [-1.35, -.34, .34]) {
    const supportBottom = z === -1.35 ? 3.32 : 3.84;
    meshBox(.045, 4.75 - supportBottom, .045, materials.steel, new THREE.Vector3(x, (4.75 + supportBottom) / 2, z));
  }
  meshBox(.045, .045, 2.5, materials.steel, new THREE.Vector3(x, 4.74, -.45));
}

// Red dimension lines reproduce the key elevations in Rack.png. The overview
// keeps only the principal dimensions; specialist views reveal their details.
const dimensionEntries = [];
function dimension(x, y1, y2, label, descriptionKey, category = 'detail') {
  const group = new THREE.Group();
  dimensionGroup.add(group);
  const material = new THREE.LineBasicMaterial({ color: 0xff6f68, transparent: true, opacity: .78 });
  const vertices = new Float32Array([
    x, y1, 2.2, x, y2, 2.2,
    x - .11, y1, 2.2, x + .11, y1, 2.2,
    x - .11, y2, 2.2, x + .11, y2, 2.2,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  const lines = new THREE.LineSegments(geometry, material);
  group.add(lines);
  const node = document.createElement('div');
  node.className = 'dimension-label';
  const valueNode = document.createElement('b');
  valueNode.textContent = label;
  const descriptionNode = document.createElement('small');
  descriptionNode.dataset.i18nKey = descriptionKey;
  node.append(valueNode, descriptionNode);
  const object = new CSS2DObject(node);
  object.position.set(x + .16, (y1 + y2) / 2, 2.2);
  group.add(object);
  dimensionEntries.push({ group, category, descriptionNode });
}
dimension(1.15, 0, .8, '800 mm', 'dimensions.floor', 'water');
dimension(1.48, .8, 3.05, '2250 mm', 'dimensions.rack', 'rack');
dimension(1.81, 3.05, 4.55, '1450–1500 mm', 'dimensions.rackToPower', 'power');
dimension(2.18, 0, 4.75, '≥ 4750 mm', 'dimensions.beamDatum', 'overall');
dimension(2.55, 0, 5.5, '≥ 5500 mm', 'dimensions.roomHeight', 'overview');
dimension(-2.3, 4.55, 4.75, '200 mm', 'dimensions.fireClearance', 'power');
dimension(-2.68, 4.75, 5.75, '1000–1500 mm', 'dimensions.returnPlenum', 'power');

// A subtle grid and wall datum make perspective and scale easier to read.
const grid = new THREE.GridHelper(10, 20, 0x31576e, 0x1d394a);
grid.position.y = .005;
grid.material.transparent = true;
grid.material.opacity = .38;
scene.add(grid);
const datumWall = meshBox(.035, 5.5, 5.8, materials.beam.clone(), new THREE.Vector3(-5.1, 2.75, 0));
datumWall.material.opacity = .08;

function isDarkTheme() {
  return (window.AidcTheme?.getTheme?.() || document.documentElement.dataset.theme) === 'dark';
}

function applySceneTheme() {
  const dark = isDarkTheme();
  scene.fog.color.setHex(dark ? 0x07111d : 0xdce8ee);
  renderer.toneMappingExposure = dark ? 1.18 : 1.02;
  hemisphereLight.color.setHex(dark ? 0xdff7ff : 0xffffff);
  hemisphereLight.groundColor.setHex(dark ? 0x07101a : 0x9dafb9);
  hemisphereLight.intensity = dark ? 2.25 : 2.7;
  keyLight.color.setHex(dark ? 0xe7f8ff : 0xffffff);
  keyLight.intensity = dark ? 4.6 : 3.35;
  cyanLight.intensity = dark ? 22 : 8;
  amberLight.intensity = dark ? 16 : 6;

  const palette = dark ? {
    slab: 0x152c3b, tile: 0x9fa5a9, steel: 0x587080, darkSteel: 0x132837,
    black: 0x07111b, server: 0x162c3a, glass: 0x8bdff1, beam: 0x627787
  } : {
    slab: 0x8ca1ad, tile: 0xd0d4d6, steel: 0x748b97, darkSteel: 0x425d6c,
    black: 0x203746, server: 0x4c6573, glass: 0x70bfd1, beam: 0x91a6b1
  };
  Object.entries(palette).forEach(([name, color]) => materials[name].color.setHex(color));
  materials.glass.opacity = dark ? .16 : .22;
  materials.beam.opacity = dark ? .36 : .25;
  shellParts.forEach((part) => {
    if (part.material?.color) part.material.color.setHex(palette.glass);
    if (part.material) part.material.opacity = dark ? .16 : .22;
  });
  floorComponent.traverse((object) => {
    if (object.userData.surfaceTile && object.material?.color) object.material.color.setHex(palette.tile);
  });
  servers.traverse((object) => {
    if (!object.isMesh || !object.material?.color) return;
    if (object.userData.serverBody) object.material.color.setHex(palette.server);
    if (object.userData.serverFace) object.material.color.setHex(palette.black);
  });
  ceiling.material.color.setHex(palette.beam);
  ceiling.material.opacity = dark ? .12 : .1;
  datumWall.material.color.setHex(palette.beam);
  datumWall.material.opacity = dark ? .08 : .06;
  grid.material.opacity = dark ? .38 : .24;
}

applySceneTheme();
window.addEventListener('aidc-theme-change', applySceneTheme);

const views = {
  overview: [new THREE.Vector3(6.9, 5.35, 7.6), new THREE.Vector3(0, 2.45, -.05)],
  front: [new THREE.Vector3(0, 3.0, 10.7), new THREE.Vector3(0, 2.45, 0)],
  rack: [new THREE.Vector3(3.65, 3.35, 4.55), new THREE.Vector3(0, 1.95, 0)],
  water: [new THREE.Vector3(5.9, 1.55, 6.2), new THREE.Vector3(-.8, .55, -.1)],
  power: [new THREE.Vector3(5.8, 5.5, 6.5), new THREE.Vector3(0, 3.82, -.35)],
};
let cameraTween = null;
let activeView = 'overview';
let labelsVisible = true;
function flyTo(viewKey) {
  const [position, target] = views[viewKey] || views.overview;
  activeView = views[viewKey] ? viewKey : 'overview';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    camera.position.copy(position);
    controls.target.copy(target);
    cameraTween = null;
  } else {
    cameraTween = {
      fromPosition: camera.position.clone(), fromTarget: controls.target.clone(),
      toPosition: position, toTarget: target, start: performance.now()
    };
  }
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === viewKey));
  refreshSceneLabels();
  refreshDimensions();
}

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => flyTo(button.dataset.view)));
const focusComponents = { rack: 'rack', water: 'supply', power: 'busway' };
document.querySelectorAll('[data-focus]').forEach((button) => button.addEventListener('click', () => {
  const focus = button.dataset.focus;
  flyTo(focus);
  showComponent(focusComponents[focus] || 'rack');
  document.querySelectorAll('[data-focus]').forEach((row) => row.setAttribute('aria-current', row === button ? 'true' : 'false'));
}));

function setToggle(button, active) {
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
}

const simulator = document.getElementById('rack-simulator');
const cardsButton = document.getElementById('toggle-cards');
simulator.dataset.rendering = 'true';
const mobileLayout = matchMedia('(max-width: 760px)');
const savedCardsHidden = localStorage.getItem('aidc-liquid-rack-cards-hidden');
let cardsHidden = savedCardsHidden === null ? mobileLayout.matches : savedCardsHidden === 'true';
function updateCardsButton() {
  const key = cardsHidden ? 'controls.showCards' : 'controls.hideCards';
  const fallbackText = cardsHidden ? '展开卡片' : '收起卡片';
  const label = t(key, fallbackText);
  document.getElementById('toggle-cards-text').textContent = label;
  document.getElementById('toggle-cards-icon').textContent = cardsHidden ? '▶' : '◀';
  cardsButton.setAttribute('aria-label', label);
  cardsButton.setAttribute('aria-pressed', cardsHidden ? 'true' : 'false');
  cardsButton.classList.toggle('active', cardsHidden);
}
cardsButton.addEventListener('click', () => {
  cardsHidden = !cardsHidden;
  simulator.classList.toggle('cards-hidden', cardsHidden);
  localStorage.setItem('aidc-liquid-rack-cards-hidden', String(cardsHidden));
  updateCardsButton();
});

function updateIndividualCardButtons() {
  document.querySelectorAll('[data-card-toggle]').forEach((button) => {
    const card = button.closest('[data-collapsible-card]');
    const collapsed = card?.classList.contains('is-collapsed');
    button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    button.setAttribute('aria-label', t(collapsed ? 'controls.expandCard' : 'controls.collapseCard', collapsed ? '展开此卡片' : '收起此卡片'));
    const icon = button.querySelector('span');
    if (icon) icon.textContent = collapsed ? '+' : '−';
  });
}
document.querySelectorAll('[data-card-toggle]').forEach((button) => {
  button.addEventListener('click', () => {
    const card = button.closest('[data-collapsible-card]');
    if (!card) return;
    if (mobileLayout.matches && card.classList.contains('is-collapsed')) {
      document.querySelectorAll('[data-collapsible-card]').forEach((other) => {
        if (other !== card) other.classList.add('is-collapsed');
      });
    }
    card.classList.toggle('is-collapsed');
    document.querySelectorAll('[data-collapsible-card]').forEach((item) => {
      localStorage.setItem(`aidc-liquid-rack-card-${item.dataset.cardId}`, String(item.classList.contains('is-collapsed')));
    });
    updateIndividualCardButtons();
  });
});

document.querySelectorAll('[data-collapsible-card]').forEach((card) => {
  const saved = localStorage.getItem(`aidc-liquid-rack-card-${card.dataset.cardId}`);
  if (saved === 'true' || (saved === null && mobileLayout.matches)) card.classList.add('is-collapsed');
});
simulator.classList.toggle('cards-hidden', cardsHidden);

document.getElementById('toggle-shell').addEventListener('click', (event) => {
  const active = event.currentTarget.getAttribute('aria-pressed') !== 'true';
  shellParts.forEach((part) => { part.visible = active; });
  setToggle(event.currentTarget, active);
});
document.getElementById('toggle-water').addEventListener('click', (event) => {
  const active = event.currentTarget.getAttribute('aria-pressed') !== 'true';
  waterGroup.visible = active;
  setToggle(event.currentTarget, active);
});
document.getElementById('toggle-power').addEventListener('click', (event) => {
  const active = event.currentTarget.getAttribute('aria-pressed') !== 'true';
  powerGroup.visible = active;
  setToggle(event.currentTarget, active);
});
document.getElementById('toggle-dimensions').addEventListener('click', (event) => {
  const active = event.currentTarget.getAttribute('aria-pressed') !== 'true';
  dimensionGroup.visible = active;
  setToggle(event.currentTarget, active);
  refreshDimensions();
});
document.getElementById('toggle-labels').addEventListener('click', (event) => {
  labelsVisible = event.currentTarget.getAttribute('aria-pressed') !== 'true';
  setToggle(event.currentTarget, labelsVisible);
  refreshSceneLabels();
});

function t(key, fallbackText = '') {
  const translated = window.AidcI18n?.t?.(key);
  return translated && translated !== key ? translated : fallbackText || key;
}

function updateSceneLabels() {
  translatedLabels.forEach((node) => {
    node.textContent = t(node.dataset.i18nKey, node.textContent);
  });
  refreshSceneLabels();
}

function refreshSceneLabels() {
  translatedLabels.forEach((node) => {
    const category = node.dataset.labelCategory || 'core';
    let visible = labelsVisible && category === 'core';
    if (labelsVisible && activeView === 'water') visible = category === 'core' || category === 'water';
    if (labelsVisible && activeView === 'power') visible = category === 'core' || category.startsWith('power');
    if (labelsVisible && (activeView === 'overview' || activeView === 'front')) visible = category === 'core' || category === 'power';
    node.hidden = !visible;
  });
}

function refreshDimensions() {
  const categoriesByView = {
    overview: new Set(['water', 'rack', 'power', 'overall', 'overview']),
    front: new Set(['water', 'rack', 'power', 'overall', 'overview']),
    rack: new Set(['rack']),
    water: new Set(['water']),
    power: new Set(['power', 'overall']),
  };
  const categories = categoriesByView[activeView] || categoriesByView.overview;
  dimensionEntries.forEach(({ group, category }) => {
    group.visible = dimensionGroup.visible && categories.has(category);
  });
}

function updateDimensionLabels() {
  dimensionEntries.forEach(({ descriptionNode }) => {
    descriptionNode.textContent = t(descriptionNode.dataset.i18nKey);
  });
}

function overlaps(a, b, padding = 6) {
  return !(a.right + padding < b.left || a.left - padding > b.right || a.bottom + padding < b.top || a.top - padding > b.bottom);
}

const labelWorldPosition = new THREE.Vector3();
function updateLabelLayout() {
  const occupied = [];
  const panels = Array.from(document.querySelectorAll('.glass'))
    .filter((element) => element.offsetParent !== null)
    .map((element) => element.getBoundingClientRect());
  translatedLabels.forEach((node) => {
    node.style.visibility = 'hidden';
    if (node.hidden || !node._labelObject) return;
    node._labelObject.getWorldPosition(labelWorldPosition);
    const distance = camera.position.distanceTo(labelWorldPosition);
    if (distance > 13.5) return;
    node.style.visibility = 'visible';
    node.style.opacity = String(THREE.MathUtils.clamp(1.35 - distance / 18, .55, .92));
    const rect = node.getBoundingClientRect();
    const hostRect = root.getBoundingClientRect();
    const outside = rect.right < hostRect.left + 4 || rect.left > hostRect.right - 4 || rect.bottom < hostRect.top + 4 || rect.top > hostRect.bottom - 4;
    const blocked = panels.some((panel) => overlaps(rect, panel, 2));
    const collides = occupied.some((existing) => overlaps(rect, existing));
    if (outside || blocked || collides) {
      node.style.visibility = 'hidden';
      return;
    }
    occupied.push(rect);
  });
}

let currentKey = 'rack';
function showComponent(key) {
  currentKey = key;
  document.getElementById('info-title').textContent = t(`objects.${key}.title`);
  document.getElementById('info-copy').textContent = t(`objects.${key}.copy`);
  document.getElementById('info-type').textContent = t(`objects.${key}.type`);
  document.getElementById('info-level').textContent = t(`objects.${key}.level`);
}

const selectionBox = new THREE.BoxHelper(rack, 0x5ee5ff);
selectionBox.material.transparent = true;
selectionBox.material.opacity = .82;
selectionBox.visible = false;
scene.add(selectionBox);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerStart = null;
renderer.domElement.addEventListener('pointerdown', (event) => {
  pointerStart = { x: event.clientX, y: event.clientY };
});
renderer.domElement.addEventListener('pointerup', (event) => {
  if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(selectable, true);
  if (!hits.length) {
    selectionBox.visible = false;
    return;
  }
  let target = hits[0].object;
  while (target && !target.userData.componentKey) target = target.parent;
  if (!target?.userData.componentKey) return;
  showComponent(target.userData.componentKey);
  selectionBox.setFromObject(target);
  selectionBox.visible = true;
});

const clock = new THREE.Clock();
let firstFrame = true;
let sceneVisible = true;
let animationFrameId = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function animate() {
  animationFrameId = 0;
  if (!sceneVisible || document.hidden) return;
  const elapsed = clock.getElapsedTime();
  if (cameraTween) {
    const progress = Math.min(1, (performance.now() - cameraTween.start) / 850);
    const eased = 1 - Math.pow(1 - progress, 3);
    camera.position.lerpVectors(cameraTween.fromPosition, cameraTween.toPosition, eased);
    controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, eased);
    if (progress >= 1) cameraTween = null;
  }
  if (!reducedMotion.matches) {
    animatedRoutes.forEach((route, routeIndex) => {
      if (!route.group.visible || !route.group.parent?.visible) return;
      route.dots.forEach((dot, dotIndex) => {
        const base = (elapsed * .17 + dotIndex / route.dots.length + routeIndex * .071) % 1;
        const progress = route.direction > 0 ? base : 1 - base;
        dot.position.copy(route.curve.getPoint(progress));
        dot.scale.setScalar(1 + Math.sin(elapsed * 5.2 + dotIndex) * .18);
      });
    });
    pduA.material.emissiveIntensity = .75 + Math.sin(elapsed * 2.4) * .18;
    pduB.material.emissiveIntensity = .75 + Math.sin(elapsed * 2.4 + 1.2) * .18;
    if (selectionBox.visible) selectionBox.material.opacity = .6 + Math.sin(elapsed * 3.2) * .22;
  }
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  updateLabelLayout();
  if (firstFrame) {
    firstFrame = false;
    requestAnimationFrame(() => loading.classList.add('done'));
  }
  animationFrameId = requestAnimationFrame(animate);
}

function startRendering() {
  if (!animationFrameId && sceneVisible && !document.hidden) animationFrameId = requestAnimationFrame(animate);
}

function stopRendering() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = 0;
}

function setSceneVisibility(visible) {
  sceneVisible = visible;
  simulator.dataset.rendering = visible ? 'true' : 'false';
  if (visible) startRendering();
  else stopRendering();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopRendering();
  else startRendering();
});

window.addEventListener('message', (event) => {
  if (event.data?.type === 'aidc-visibility') setSceneVisibility(event.data.visible !== false);
});

startRendering();

addEventListener('resize', () => {
  const { w, h } = hostSize();
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  labelRenderer.setSize(w, h);
  startRendering();
});

function applyCanvasAria() {
  renderer?.domElement?.setAttribute('aria-label', t('app.aria'));
}

window.AidcI18nBootstrap.bootstrap('ai-dc-liquid-rack', {
  onReady() {
    applyCanvasAria();
    updateSceneLabels();
    showComponent(currentKey);
    updateCardsButton();
    updateIndividualCardButtons();
    updateDimensionLabels();
    refreshDimensions();
    const { w, h } = hostSize();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    labelRenderer.setSize(w, h);
  },
  onLocaleChange() {
    applyCanvasAria();
    updateSceneLabels();
    showComponent(currentKey);
    updateCardsButton();
    updateIndividualCardButtons();
    updateDimensionLabels();
  },
});

if (window.AidcLocaleBridge) {
  window.AidcLocaleBridge.initIframeListener((locale) => {
    if (window.AidcI18n && window.AidcI18n.getLocale() !== locale) {
      window.AidcI18n.setLocale(locale, { page: 'ai-dc-liquid-rack', common: true, basePath: 'i18n/' });
    }
  }, { selfSource: 'ai-dc-liquid-rack' });
}
