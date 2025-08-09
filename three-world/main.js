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
scene.background = new THREE.Color(0x20232a);

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
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 5, 5);
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

const CAMERA_SPEED = 4; // units per second camera flies forward (toward -Z)
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
const MOISTURE_SCALE = 0.03; // lower = large swaths of biomes
const PLATEAU_SCALE = 0.05;
const PLATEAU_THRESHOLD = 0.6;
const PLATEAU_STEP = 1.5; // quantization step for plateaus

// Biome colors
const WATER_DEEP = new THREE.Color(0x0b3954);
const WATER_SHALLOW = new THREE.Color(0x1f7a8c);
const DESERT_COLOR = new THREE.Color(0xC2B280);
const GRASS_COLOR = new THREE.Color(0x6aa84f);
const FOREST_COLOR = new THREE.Color(0x2e7d32);
const PLATEAU_COLOR = new THREE.Color(0x8d6e63);
const SNOW_COLOR = new THREE.Color(0xffffff);

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
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i) + worldZOffset;
    // Base terrain
    let hBase = noise.noise(x * NOISE_SCALE_X, 0, z * NOISE_SCALE_Z) * NOISE_HEIGHT;

    // Mountains: smooth, gradual uplift using a banded smoothstep mask
    const ridged = 1 - Math.abs(noise.noise(x * MOUNTAIN_SCALE_X, 100, z * MOUNTAIN_SCALE_Z));
    const s = THREE.MathUtils.smoothstep(
      ridged,
      MOUNTAIN_THRESHOLD - MOUNTAIN_BAND,
      MOUNTAIN_THRESHOLD + MOUNTAIN_BAND
    );
    // Smooth hump (s^2 eases in/out more)
    hBase += (s * s) * MOUNTAIN_HEIGHT;
    // Very rare sharp cap on top of smooth mountains
    const sharpStart = MOUNTAIN_THRESHOLD + MOUNTAIN_BAND + 0.07;
    if (ridged > sharpStart) {
      const tSharp = (ridged - sharpStart) / (1 - sharpStart);
      hBase += Math.pow(tSharp, MOUNTAIN_SHARPNESS) * MOUNTAIN_SHARP_EXTRA;
    }

    // Plateaus: quantize where mask is strong
    const plateauMask = noise.noise(x * PLATEAU_SCALE, 200, z * PLATEAU_SCALE);
    if (plateauMask > PLATEAU_THRESHOLD) {
      hBase = Math.round(hBase / PLATEAU_STEP) * PLATEAU_STEP;
    }

    // Sea: clamp below sea level to flat water surface
    const hRaw = hBase;
    const h = hBase < SEA_LEVEL ? SEA_LEVEL : hBase;
    pos.setY(i, h);

    // Biome coloring
    const moisture = (noise.noise(x * MOISTURE_SCALE, 50, z * MOISTURE_SCALE) + 1) * 0.5; // 0..1

    if (h === SEA_LEVEL) {
      const depth = THREE.MathUtils.clamp((SEA_LEVEL - hRaw) / 5.0, 0, 1);
      color.lerpColors(WATER_SHALLOW, WATER_DEEP, depth);
    } else if (h > SNOW_HEIGHT) {
      color.copy(SNOW_COLOR);
    } else if (plateauMask > PLATEAU_THRESHOLD) {
      color.copy(PLATEAU_COLOR);
    } else if (moisture < 0.35) {
      color.copy(DESERT_COLOR);
    } else if (moisture > 0.65) {
      color.copy(FOREST_COLOR);
    } else {
      color.copy(GRASS_COLOR);
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