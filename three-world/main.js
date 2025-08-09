import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js?module';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js?module';
import Stats from 'https://unpkg.com/three@0.160.0/examples/jsm/libs/stats.module.js?module';
import { ImprovedNoise } from 'https://unpkg.com/three@0.160.0/examples/jsm/math/ImprovedNoise.js?module';
const textureLoader = new THREE.TextureLoader();
const terrainTexture = textureLoader.load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg');
terrainTexture.wrapS = THREE.RepeatWrapping;
terrainTexture.wrapT = THREE.RepeatWrapping;
terrainTexture.repeat.set(100, 5);
terrainTexture.colorSpace = THREE.SRGBColorSpace;
// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc4e7);
scene.fog = new THREE.Fog(scene.background, 80, 700);

// Clock for delta timing (used for uniform forward motion)
const clock = new THREE.Clock();

// Helpers
const gridHelper = new THREE.GridHelper(20, 40, 0x888888, 0x444444);
scene.add(gridHelper);

const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

// Stats panel
const stats = new Stats();
stats.showPanel(0); // 0: fps
document.body.appendChild(stats.dom);

// Pause/Resume toggle via button
let paused = true;
const toggleBtn = document.getElementById('toggleAnimBtn');
if (toggleBtn) {
  toggleBtn.textContent = paused ? 'Resume' : 'Pause';
  toggleBtn.addEventListener('click', () => {
    console.log('toggleAnimBtn clicked', paused);
    paused = !paused;
    toggleBtn.textContent = paused ? 'Resume' : 'Pause';
  });
}

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 10;
camera.position.y = 60;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // smooth camera motion
controls.dampingFactor = 0.05;
// Aim the camera slightly ahead along -Z initially
controls.target.set(0, 0, camera.position.z - 10);
controls.update();

// Lights
const ambientLight = new THREE.AmbientLight(0xfff3e0, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffe0b2, 1.0);
directionalLight.position.set(10, 15, 8);
directionalLight.castShadow = false;
scene.add(directionalLight);

// Cube
const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xff5722 });
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
cube.position.set(-2, 0, 0);
cube.userData = {};
//scene.add(cube);  // removed object visuals

// Sphere
const sphereGeometry = new THREE.SphereGeometry(0.75, 32, 32);
const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0x2196f3 });
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
sphere.position.set(2, 0, 0);
sphere.userData = {};
//scene.add(sphere);

// Torus
const torusGeometry = new THREE.TorusGeometry(0.7, 0.2, 16, 100);
const torusMaterial = new THREE.MeshStandardMaterial({ color: 0x9c27b0 });
const torus = new THREE.Mesh(torusGeometry, torusMaterial);
torus.position.set(0, 1.5, 0);
torus.userData = {};
//scene.add(torus);

// Cone
const coneGeometry = new THREE.ConeGeometry(0.6, 1.5, 32);
const coneMaterial = new THREE.MeshStandardMaterial({ color: 0x4caf50 });
const cone = new THREE.Mesh(coneGeometry, coneMaterial);
cone.position.set(0, -1.5, 0);
cone.userData = {};
//scene.add(cone);

// Icosahedron
const icoGeometry = new THREE.IcosahedronGeometry(0.8, 0);
const icoMaterial = new THREE.MeshStandardMaterial({ color: 0xffc107 });
const ico = new THREE.Mesh(icoGeometry, icoMaterial);
ico.position.set(0, 0, -2);
ico.userData = {};
//scene.add(ico);

// Group all animating shapes and give them an initial z offset farther from camera
const shapes = [];

const SPAWN_DEPTH = -20; // how far back new shapes spawn

// Ensure originals have base positions recorded and start at spawn depth
shapes.forEach((s) => {
  s.userData = {
    ...(s.userData || {}),
    baseX: s.position.x,
    baseY: s.position.y,
  };
  if (!s.geometry.boundingSphere) s.geometry.computeBoundingSphere();
  s.userData.radius = s.geometry.boundingSphere.radius;
  s.position.z = SPAWN_DEPTH;
});

// ----- Random shape generation helpers -----
const MAX_SHAPES = Infinity; // no hard cap so objects keep generating
const MIN_DIST = 1.5; // minimum allowed distance between meshes at spawn

// Utility: completely dispose of a mesh’s resources to avoid GPU memory leaks
function disposeMesh(mesh) {
  scene.remove(mesh);
  if (mesh.geometry) mesh.geometry.dispose();
  if (mesh.material) {
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => m && m.dispose());
    } else {
      mesh.material.dispose();
    }
  }
}

function assignRadius(mesh) {
  if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
  mesh.userData.radius = mesh.geometry.boundingSphere.radius;
}

function overlaps(mesh) {
  for (const other of shapes) {
    // Only consider shapes that are roughly at spawn depth to avoid needless checks
    if (Math.abs(other.position.z - SPAWN_DEPTH) > 1) continue;
    const dx = other.position.x - mesh.position.x;
    const dy = other.position.y - mesh.position.y;
    const dz = other.position.z - mesh.position.z; // likely ~0

    const rSum = (other.userData.radius || 0.5) + (mesh.userData.radius || 0.5) + 0.1; // 0.1 safety
    if (dx * dx + dy * dy + dz * dz < rSum * rSum) {
      return true; // overlaps
    }
  }
  return false;
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randomColor() {
  return Math.floor(Math.random() * 0xffffff);
}

function createRandomShape() {
  const typeIndex = Math.floor(Math.random() * 5); // 0-4
  let geometry;
  switch (typeIndex) {
    case 0:
      geometry = new THREE.BoxGeometry(1, 1, 1);
      break;
    case 1:
      geometry = new THREE.SphereGeometry(0.75, 32, 32);
      break;
    case 2:
      geometry = new THREE.TorusGeometry(0.7, 0.2, 16, 100);
      break;
    case 3:
      geometry = new THREE.ConeGeometry(0.6, 1.5, 32);
      break;
    default:
      geometry = new THREE.IcosahedronGeometry(0.8, 0);
  }

  const material = new THREE.MeshStandardMaterial({ color: randomColor() });
  const mesh = new THREE.Mesh(geometry, material);

  // After creation compute radius
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  mesh.userData.radius = geometry.boundingSphere.radius;

  // Random lateral placement and animation params
  const baseX = rand(-4, 4);
  const baseY = rand(-2, 2);
  mesh.position.set(baseX, baseY, SPAWN_DEPTH);

  mesh.userData = {
    baseX,
    baseY
  };

  return mesh;
}

const CAMERA_SPEED = 10; // units per second camera flies forward (toward -Z)
const DESPAWN_DISTANCE = 10; // how far behind the camera a shape is removed
const SPAWN_AHEAD_MIN = 5; // spawn closer to camera
const SPAWN_AHEAD_MAX = 20; // still some depth variety but nearer
// (keep MAX_SHAPES and MIN_DIST as is)

// ===== Infinite Ground Plane =====
const PLANE_LENGTH = 50;
const STEPS_AHEAD = 10;  // how many segments ahead of camera to keep
const STEPS_BEHIND = 3;  // how many segments behind camera to keep
const planeSegments = new Map(); // key: integer segment index, value: mesh

// ===== Procedural surface using Perlin-like ImprovedNoise =====
const noise = new ImprovedNoise();
const NOISE_SCALE_X = 0.08;  // frequency across X
const NOISE_SCALE_Z = 0.08;  // frequency across Z
const NOISE_HEIGHT = 6.0;    // amplitude of height variation
// Mountains (rare, very tall)
const MOUNTAIN_SCALE_X = 0.02;
const MOUNTAIN_SCALE_Z = 0.02;
const MOUNTAIN_THRESHOLD = 0.90;
const MOUNTAIN_BAND = 0.5;     // width of smooth transition around threshold
const MOUNTAIN_HEIGHT = 30.0;   // main smooth mountain uplift
const MOUNTAIN_SHARP_EXTRA = 8; // rare additional sharp cap
const MOUNTAIN_SHARPNESS = 3.0; // exponent for rare sharpness

// Biome helpers
const SEA_LEVEL = 0.0;
const SNOW_HEIGHT = 10.0; // above this -> snow
const PLATEAU_SCALE = 0.05;
const PLATEAU_THRESHOLD = 0.6;
const PLATEAU_STEP = 1.5; // quantization step for plateaus
// 2D biome fields (independent of travel direction)
const HEAT_SCALE = 0.002;
const MOISTURE_FIELD_SCALE = 0.002;
const OCEAN_SCALE = 0.0015;
const OCEAN_THRESHOLD = 0.62;
const OCEAN_BAND = 0.06;
// Ordered biome sequence along travel (Z): desert -> plateau -> forest -> mountains
const BIOME_PERIOD = 2000; // world units over which a full cycle occurs
const BIOME_BLEND = 0.05;  // fractional blend width at band edges

// Biome colors
const WATER_DEEP = new THREE.Color(0x0b3954);
const WATER_SHALLOW = new THREE.Color(0x1f7a8c);
const DESERT_COLOR = new THREE.Color(0xC2B280);
const GRASS_COLOR = new THREE.Color(0x6aa84f);
const FOREST_COLOR = new THREE.Color(0x2e7d32);
const PLATEAU_COLOR = new THREE.Color(0x8d6e63);
const ROCK_COLOR = new THREE.Color(0x7d7d7d);
const SNOW_COLOR = new THREE.Color(0xffffff);
const ICE_COLOR = new THREE.Color(0xcfe9ff);
const SHORE_RANGE = 6.0; // units over which land eases into sea level

// Seeded randomness for terrain offsets (stable across reloads; can override via ?seed=...)
function xmur3(str){for(var i=0,h=1779033703^str.length;i<str.length;i++)h=Math.imul(h^str.charCodeAt(i),3432918353),h=h<<13|h>>>19;return function(){h=Math.imul(h^h>>>16,2246822507),h=Math.imul(h^h>>>13,3266489909);return(h^h>>>16)>>>0}}
function sfc32(a,b,c,d){return function(){a>>>0;b>>>0;c>>>0;d>>>0;var t=(a+b|0)+d|0;d=d+1|0;a=b^b>>>9;b=c+(c<<3)|0;c=(c<<21|c>>>11);c=c+t|0;return((t>>>0)/4294967296)}}
const _params = new URLSearchParams(window.location.search);
let _seedStr = _params.get('seed') || window.localStorage.getItem('terrain_seed');
if(!_seedStr){ _seedStr = String(Math.floor(Math.random()*1e9)); window.localStorage.setItem('terrain_seed', _seedStr); }
const _h = xmur3(_seedStr); const _rng = sfc32(_h(), _h(), _h(), _h());
const HEIGHT_OFF_X = _rng()*10000, HEIGHT_OFF_Z = _rng()*10000;
const HEAT_OFF_X = _rng()*10000, HEAT_OFF_Z = _rng()*10000;
const MOIST_OFF_X = _rng()*10000, MOIST_OFF_Z = _rng()*10000;
const OCEAN_OFF_X = _rng()*10000, OCEAN_OFF_Z = _rng()*10000;
const PLATEAU_OFF_X = _rng()*10000, PLATEAU_OFF_Z = _rng()*10000;

// Deform a plane geometry in-place based on world XZ and an offset
function deformPlane(geometry, worldZOffset) {
  const pos = geometry.attributes.position;
  // Ensure color attribute exists
  let colorAttr = geometry.getAttribute('color');
  if (!colorAttr) {
    colorAttr = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
    geometry.setAttribute('color', colorAttr);
  }
  const color = new THREE.Color();
  function bandWeight(p, a0, a1) {
    // returns smooth weight for p within [a0,a1] with soft edges
    const w = BIOME_BLEND;
    const rise = THREE.MathUtils.smoothstep(p, a0 - w, a0 + w);
    const fall = 1.0 - THREE.MathUtils.smoothstep(p, a1 - w, a1 + w);
    return Math.max(0.0, Math.min(1.0, rise * fall));
  }
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i) + worldZOffset;
    // Base sampler
    const n = (noise.noise((x + HEIGHT_OFF_X) * NOISE_SCALE_X, 0, (z + HEIGHT_OFF_Z) * NOISE_SCALE_Z) + 1) * 0.5; // 0..1

    // 2D biome field: heat and moisture
    const heat = (noise.noise((x + HEAT_OFF_X) * HEAT_SCALE, 10, (z + HEAT_OFF_Z) * HEAT_SCALE) + 1) * 0.5;       // 0..1
    const moist = (noise.noise((x + MOIST_OFF_X) * MOISTURE_FIELD_SCALE, 20, (z + MOIST_OFF_Z) * MOISTURE_FIELD_SCALE) + 1) * 0.5; // 0..1

    // Ocean mask (wide blobs); soft band
    const oceanRaw = (noise.noise((x + OCEAN_OFF_X) * OCEAN_SCALE, 30, (z + OCEAN_OFF_Z) * OCEAN_SCALE) + 1) * 0.5; // 0..1
    const oceanW = THREE.MathUtils.smoothstep(oceanRaw, OCEAN_THRESHOLD - OCEAN_BAND, OCEAN_THRESHOLD + OCEAN_BAND);

    // 2D weights from heat/moisture only (no macro 1D progression)
    let wd = (1 - oceanW) * THREE.MathUtils.clamp(heat * (1 - moist), 0, 1);
    let wf = (1 - oceanW) * THREE.MathUtils.clamp(moist * (1 - Math.abs(heat - 0.5) * 2), 0, 1);
    let wm = (1 - oceanW) * THREE.MathUtils.clamp((1 - heat) * (1 - moist), 0, 1);
    let wpl = (1 - oceanW) * (THREE.MathUtils.clamp(1 - Math.abs(heat - 0.5) * 2, 0, 1) * 0.5);
    let wo = oceanW; // ocean weight

    // Normalize terrain weights (not including ocean)
    const terrSum = wd + wpl + wf + wm;
    if (terrSum > 0) { wd/=terrSum; wpl/=terrSum; wf/=terrSum; wm/=terrSum; }

    // Biome-weighted height ranges
    const desertMin = 0.0, desertMax = 5.0;
    const plateauMin = 10.0, plateauMax = 40.0;
    const forestMin = 5.0, forestMax = 20.0;
    const mountainMin = 30.0, mountainMax = 80.0;

    const hDesert = desertMin + (desertMax - desertMin) * n;
    const hPlateau = plateauMin + (plateauMax - plateauMin) * n;
    const hForest = forestMin + (forestMax - forestMin) * n;
    const hMountain = mountainMin + (mountainMax - mountainMin) * n;

    const wSumLocal = wd + wpl + wf + wm;
    let hBase = (wSumLocal > 0)
      ? (hDesert * wd + hPlateau * wpl + hForest * wf + hMountain * wm) / wSumLocal
      : 0.0;

    // Plateaus: quantize where mask is strong
    const plateauMask = noise.noise((x + PLATEAU_OFF_X) * PLATEAU_SCALE, 200, (z + PLATEAU_OFF_Z) * PLATEAU_SCALE);
    if (plateauMask > PLATEAU_THRESHOLD) {
      hBase = Math.round(hBase / PLATEAU_STEP) * PLATEAU_STEP;
    }

    // Sea: smoothly blend toward sea level near coastline using ocean weight and proximity
    const hRaw = hBase;
    const shoreT = THREE.MathUtils.clamp((SEA_LEVEL + SHORE_RANGE - hBase) / SHORE_RANGE, 0, 1); // higher near/below sea level
    const waterBlend = THREE.MathUtils.clamp(wo * shoreT, 0, 1);
    const h = THREE.MathUtils.lerp(Math.max(SEA_LEVEL, hBase), SEA_LEVEL, waterBlend);
    pos.setY(i, h);

    // Mountain sub-blend: dynamic snowline (colder = more snow) and ice tint for very cold
    const coldBoost = THREE.MathUtils.clamp(0.5 - heat, 0, 1) * 15.0; // lower snowline up to 15u in cold zones
    const snowHeight = SNOW_HEIGHT - coldBoost;
    const snowRange = 12.0; // wider blend for gradual snow cover
    const snowT = THREE.MathUtils.clamp((h - snowHeight) / snowRange, 0.0, 1.0);
    const mountainBase = new THREE.Color().lerpColors(ROCK_COLOR, SNOW_COLOR, snowT);
    const iceT = THREE.MathUtils.smoothstep(0.0, 0.35, 1.0 - heat) * snowT; // only in cold + snowy areas
    const mountainCol = new THREE.Color().lerpColors(mountainBase, ICE_COLOR, iceT);

    // Mix biome colors with ocean override
    const colDesert = DESERT_COLOR;
    const colPlateau = PLATEAU_COLOR;
    const colForest = new THREE.Color().lerpColors(GRASS_COLOR, FOREST_COLOR, 0.5);
    const colMountain = mountainCol;

    if (waterBlend > 0.05) {
      const depth = THREE.MathUtils.clamp((SEA_LEVEL - Math.min(hRaw, SEA_LEVEL)) / 5.0, 0, 1);
      color.lerpColors(WATER_SHALLOW, WATER_DEEP, depth);
    } else {
      // Blend terrain colors
      const tmp = new THREE.Color();
      color.setRGB(0, 0, 0);
      tmp.copy(colDesert).multiplyScalar(wd); color.add(tmp);
      tmp.copy(colPlateau).multiplyScalar(wpl); color.add(tmp);
      tmp.copy(colForest).multiplyScalar(wf); color.add(tmp);
      tmp.copy(colMountain).multiplyScalar(wm); color.add(tmp);
      const wSum = wd + wpl + wf + wm;
      if (wSum > 0) color.multiplyScalar(1 / wSum);

      // Beach band: warm sand tint right above shoreline
      if (h > SEA_LEVEL && h < SEA_LEVEL + 2.5) {
        color.lerp(DESERT_COLOR, 0.6);
      }
    }

    colorAttr.setXYZ(i, color.r, color.g, color.b);
  }
  pos.needsUpdate = true;
  colorAttr.needsUpdate = true;
  geometry.computeVertexNormals();
}

// Higher-resolution base; each segment gets its own geometry instance
// Wider plane to cover the viewport at higher altitudes
const basePlaneGeometry = new THREE.PlaneGeometry(1000, PLANE_LENGTH, 200, 50);
basePlaneGeometry.rotateX(-Math.PI / 2); // make it horizontal (XZ plane)
const planeMaterial = new THREE.MeshStandardMaterial({
  map: terrainTexture,
  vertexColors: true,
  roughness: 0.9,
  metalness: 0.0
});

// Large water plane at sea level
const waterGeometry = new THREE.PlaneGeometry(5000, 5000, 1, 1);
waterGeometry.rotateX(-Math.PI / 2);
const waterMaterial = new THREE.MeshStandardMaterial({
  color: 0x1f7a8c,
  transparent: true,
  opacity: 0.7,
  metalness: 0.2,
  roughness: 0.8
});
const water = new THREE.Mesh(waterGeometry, waterMaterial);
water.position.y = SEA_LEVEL + 0.02; // avoid z-fighting
scene.add(water);

function ensurePlaneSegment(index) {
  if (planeSegments.has(index)) return;
  const geom = basePlaneGeometry.clone();
  const mesh = new THREE.Mesh(geom, planeMaterial);
  mesh.position.z = -index * PLANE_LENGTH;
  deformPlane(geom, mesh.position.z);
  scene.add(mesh);
  planeSegments.set(index, mesh);
}

function cullAndSpawnPlanes() {
  const centerIndex = Math.floor(-camera.position.z / PLANE_LENGTH);
  const minIndex = centerIndex - STEPS_BEHIND;
  const maxIndex = centerIndex + STEPS_AHEAD;

  // Ensure required window exists
  for (let i = minIndex; i <= maxIndex; i++) ensurePlaneSegment(i);

  // Remove any segments outside window
  for (const [idx, mesh] of Array.from(planeSegments.entries())) {
    if (idx < minIndex || idx > maxIndex) {
      scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      planeSegments.delete(idx);
    }
  }
}

// Seed initial terrain window so something is visible even when paused
cullAndSpawnPlanes();
// Responsive handling
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);

// UI camera controls
const btn = (id) => document.getElementById(id);
const camInput = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  up: false,
  down: false,
  yawL: false,
  yawR: false,
  pitchUp: false,
  pitchDown: false,
};
const btnForward = btn('btnForward');
const btnBackward = btn('btnBackward');
const btnLeft = btn('btnLeft');
const btnRight = btn('btnRight');
const btnUp = btn('btnUp');
const btnDown = btn('btnDown');
const btnYawL = btn('btnYawL');
const btnYawR = btn('btnYawR');
const btnPitchUp = btn('btnPitchUp');
const btnPitchDown = btn('btnPitchDown');

function bindHold(button, key) {
  if (!button) return;
  const press = () => (camInput[key] = true);
  const release = () => (camInput[key] = false);
  button.addEventListener('mousedown', press);
  button.addEventListener('touchstart', press, { passive: true });
  window.addEventListener('mouseup', release);
  window.addEventListener('touchend', release);
}
[ [btnForward, 'forward'], [btnBackward, 'backward'], [btnLeft, 'left'], [btnRight, 'right'], [btnUp, 'up'], [btnDown, 'down'], [btnYawL, 'yawL'], [btnYawR, 'yawR'], [btnPitchUp, 'pitchUp'], [btnPitchDown, 'pitchDown'] ].forEach(([b, k]) => bindHold(b, k));

// Keyboard fallback (WASD, QE up/down, J/L yaw)
window.addEventListener('keydown', (e) => {
  switch (e.key.toLowerCase()) {
    case 'w': camInput.forward = true; break;
    case 's': camInput.backward = true; break;
    case 'a': camInput.left = true; break;
    case 'd': camInput.right = true; break;
    case 'q': camInput.down = true; break;
    case 'e': camInput.up = true; break;
    case 'j': camInput.yawL = true; break;
    case 'l': camInput.yawR = true; break;
    case 'i': camInput.pitchUp = true; break;   // look up
    case 'k': camInput.pitchDown = true; break; // look down
  }
});
window.addEventListener('keyup', (e) => {
  switch (e.key.toLowerCase()) {
    case 'w': camInput.forward = false; break;
    case 's': camInput.backward = false; break;
    case 'a': camInput.left = false; break;
    case 'd': camInput.right = false; break;
    case 'q': camInput.down = false; break;
    case 'e': camInput.up = false; break;
    case 'j': camInput.yawL = false; break;
    case 'l': camInput.yawR = false; break;
    case 'i': camInput.pitchUp = false; break;
    case 'k': camInput.pitchDown = false; break;
  }
});

const MANUAL_SPEED = 20; // units/s for manual movement
const YAW_SPEED = 1.2;   // radians/s
const PITCH_SPEED = 0.8; // radians/s
const PITCH_MIN = -Math.PI / 3; // look down limit (~-60deg)
const PITCH_MAX = Math.PI / 8;  // look up limit (~22.5deg)
let cameraPitch = 0; // track pitch separately from OrbitControls

function applyCameraInputs(delta) {
  // Yaw rotates the view direction around Y
  if (camInput.yawL) camera.rotation.y += YAW_SPEED * delta;
  if (camInput.yawR) camera.rotation.y -= YAW_SPEED * delta;
  if (camInput.pitchUp) cameraPitch = Math.min(PITCH_MAX, cameraPitch + PITCH_SPEED * delta);
  if (camInput.pitchDown) cameraPitch = Math.max(PITCH_MIN, cameraPitch - PITCH_SPEED * delta);

  const dir = new THREE.Vector3();
  // Forward/back in camera's look direction
  if (camInput.forward) dir.z -= 1;
  if (camInput.backward) dir.z += 1;
  // Strafe left/right
  if (camInput.left) dir.x -= 1;
  if (camInput.right) dir.x += 1;

  if (dir.lengthSq() > 0) {
    dir.normalize();
    // Rotate by camera yaw
    const yaw = camera.rotation.y;
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const worldX = dir.x * cos - dir.z * sin;
    const worldZ = dir.x * sin + dir.z * cos;
    camera.position.x += worldX * MANUAL_SPEED * delta;
    camera.position.z += worldZ * MANUAL_SPEED * delta;
  }
  if (camInput.up) camera.position.y += MANUAL_SPEED * delta;
  if (camInput.down) camera.position.y -= MANUAL_SPEED * delta;
}

// Animation loop
function animate(time) {
  requestAnimationFrame(animate);
  const t = time * 0.001; // convert to seconds
  const delta = clock.getDelta(); // time since last frame

  controls.update(); // required when enableDamping or autoRotate is used
  stats.update(); // refresh FPS meter

  // Maintain terrain window every frame (independent of pause)
  cullAndSpawnPlanes();

  // Allow manual camera control regardless of paused state
  applyCameraInputs(delta);
  // Keep controls target in front of camera based on yaw
  const forwardTarget = new THREE.Vector3(0, 0, -10).applyEuler(new THREE.Euler(cameraPitch, camera.rotation.y, 0));
  const targetPos = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z).add(forwardTarget);
  controls.target.copy(targetPos);
  controls.update();

  if (!paused) {
    // Move camera forward (toward -Z)
    camera.position.z -= CAMERA_SPEED * delta;
    // Controls target already maintained above
  }

  renderer.render(scene, camera);
}

animate(); 