import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js?module';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js?module';
import Stats from 'https://unpkg.com/three@0.160.0/examples/jsm/libs/stats.module.js?module';
import { ImprovedNoise } from 'https://unpkg.com/three@0.160.0/examples/jsm/math/ImprovedNoise.js?module';
// Texture loading removed for performance; using solid colors via vertexColors only
// const textureLoader = new THREE.TextureLoader();
// const terrainTexture = textureLoader.load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg');
// terrainTexture.wrapS = THREE.RepeatWrapping;
// terrainTexture.wrapT = THREE.RepeatWrapping;
// terrainTexture.repeat.set(100, 5); // Texture tiling on X/Z of each plane segment
// terrainTexture.colorSpace = THREE.SRGBColorSpace; // Ensure texture is treated as sRGB for correct color
// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc4e7); // Sky color
scene.fog = new THREE.Fog(scene.background, 80, 700); // Atmospheric fog (near, far)

// Clock for delta timing (used for uniform forward motion)
const clock = new THREE.Clock(); // Frame delta timer

// Helpers
const gridHelper = new THREE.GridHelper(20, 40, 0x888888, 0x444444); // Reference grid (debug)
scene.add(gridHelper);

const axesHelper = new THREE.AxesHelper(5); // XYZ axis helper (debug)
scene.add(axesHelper);

// Stats panel
const stats = new Stats();
stats.showPanel(0); // FPS panel
document.body.appendChild(stats.dom);

// Pause/Resume toggle via button
let paused = true; // Start paused so scene is visible before motion
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
  75, // Field of view (degrees)
  window.innerWidth / window.innerHeight, // Aspect ratio
  0.1, // Near plane
  1000 // Far plane (must see far terrain)
);
camera.position.z = 10; // Start Z
camera.position.y = 400; // Start height above terrain

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true }); // Smooth edges
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Smooth camera motion
controls.dampingFactor = 0.05; // Damping factor for controls
// Aim the camera slightly ahead along -Z initially
controls.target.set(0, 0, camera.position.z - 10);
controls.update();

// Lights
const ambientLight = new THREE.AmbientLight(0xfff3e0, 0.4); // Warm ambient light
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffe0b2, 1.0); // Warm sun light
directionalLight.position.set(10, 15, 8); // Sun position
directionalLight.castShadow = false; // Shadow disabled (perf)
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
const shapes = []; // Shapes system disabled (we use terrain only)

const SPAWN_DEPTH = -20; // Legacy: how far back shapes would spawn

// Ensure originals have base positions recorded and start at spawn depth
shapes.forEach((s) => {
  s.userData = {
    ...(s.userData || {}),
    baseX: s.position.x,
    baseY: s.position.y,
  };
  if (!s.geometry.boundingSphere) s.geometry.computeBoundingSphere();
  s.userData.radius = s.geometry.boundingSphere.radius; // For collision spacing
  s.position.z = SPAWN_DEPTH;
});

// ----- Random shape generation helpers -----
const MAX_SHAPES = Infinity; // Shapes cap (unused; terrain only)
const MIN_DIST = 1.5; // Min spacing between spawned shapes (unused)

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

    const rSum = (other.userData.radius || 0.5) + (mesh.userData.radius || 0.5) + 0.1; // Combined radii + margin
    if (dx * dx + dy * dy + dz * dz < rSum * rSum) {
      return true; // overlaps
    }
  }
  return false;
}

function rand(min, max) {
  return Math.random() * (max - min) + min; // Uniform random in [min,max)
}

function randomColor() {
  return Math.floor(Math.random() * 0xffffff); // Random RGB color
}

function createRandomShape() {
  const typeIndex = Math.floor(Math.random() * 5); // 0-4 type
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

  // Random lateral placement
  const baseX = rand(-4, 4);
  const baseY = rand(-2, 2);
  mesh.position.set(baseX, baseY, SPAWN_DEPTH);

  mesh.userData = {
    baseX,
    baseY
  };

  return mesh;
}

const CAMERA_SPEED = 10; // Auto forward speed (units/sec) when unpaused
const DESPAWN_DISTANCE = 10; // Legacy: despawn distance for shapes behind camera (unused)
const SPAWN_AHEAD_MIN = 5; // Legacy: spawn range min ahead (unused)
const SPAWN_AHEAD_MAX = 20; // Legacy: spawn range max ahead (unused)
// (keep MAX_SHAPES and MIN_DIST as is)

// ===== Infinite Ground Plane =====
const PLANE_LENGTH = 50; // Z-length of each terrain segment
const STEPS_AHEAD = 10;  // Number of segments to keep ahead of camera
const STEPS_BEHIND = 3;  // Number of segments to keep behind camera
const planeSegments = new Map(); // Segment index -> Mesh

// ===== Procedural surface using Perlin-like ImprovedNoise =====
const noise = new ImprovedNoise();
const NOISE_SCALE_X = 0.08;  // Base noise frequency across X (lower = larger features)
const NOISE_SCALE_Z = 0.08;  // Base noise frequency across Z
const NOISE_HEIGHT = 6.0;    // Base noise amplitude used within biome ranges
// Mountains (legacy uplift params kept for reference)
const MOUNTAIN_SCALE_X = 0.02; // Legacy ridge scale X
const MOUNTAIN_SCALE_Z = 0.02; // Legacy ridge scale Z
const MOUNTAIN_THRESHOLD = 0.90; // Legacy ridge threshold
const MOUNTAIN_BAND = 0.5;     // Legacy ridge smoothing band
const MOUNTAIN_HEIGHT = 30.0;   // Legacy uplift amount
const MOUNTAIN_SHARP_EXTRA = 8; // Legacy sharp cap height
const MOUNTAIN_SHARPNESS = 3.0; // Legacy sharpness exponent

// Biome helpers
const SEA_LEVEL = 20.0; // New sea level at 20
const SNOW_HEIGHT = 180.0; // Ice peaks start at 180
const PLATEAU_SCALE = 0.05; // Plateau mask frequency
const PLATEAU_THRESHOLD = 0.6; // Strength threshold for plateau quantization
const PLATEAU_STEP = 1.5; // Plateau step height for quantization
// 2D biome fields (independent of travel direction)
const HEAT_SCALE = 0.002; // Controls size of hot/cold zones
const MOISTURE_FIELD_SCALE = 0.002; // Controls size of wet/dry zones
const OCEAN_SCALE = 0.0015; // Controls size of ocean/land blobs
const OCEAN_THRESHOLD = 0.64; // Ocean mask threshold (higher = less ocean)
const OCEAN_BAND = 0.05; // Narrower ocean edge band
// Biome prevalence/shape controls
const DESERT_BIAS = 0.8;   // reduce desert
const FOREST_BIAS = 2.2;   // increase forest dominance
const MOUNTAIN_BIAS = 1.4; // reduce mountain dominance
const PLATEAU_BIAS = 1.0;  // plateau weighting
const HEAT_SHARP = 1.0;    // softer shaping for more mid climates
const MOIST_SHARP = 1.0;   // softer shaping
const MID_EXP = 1.0;       // neutral mid emphasis
// fBm height + domain warp
const FBM_OCTAVES = 4;         // macro octaves for base height
const FBM_GAIN = 0.5;          // amplitude falloff per octave
const FBM_LACUNARITY = 2.0;    // frequency multiplier per octave
const FBM_DETAIL_OCTAVES = 2;  // extra detail octaves
const HEIGHT_BASE_SCALE = 0.02;   // world->noise scale for macro shapes
const HEIGHT_DETAIL_SCALE = 0.12;  // higher-frequency detail scale
const WARP_FREQ = 0.01;          // mild domain warp frequency
const WARP_STRENGTH = 3.0;       // warp strength in world units
const SLOPE_EPS = 0.5;           // sampling step for slope in noise domain
const SLOPE_DETAIL_POWER = 1.2;  // how strongly slope boosts detail
const SOFTMAX_TAU = 0.8;         // softmax temperature for color weights (lower = sharper)
// Ordered biome sequence along travel (disabled for 2D-only biomes)
const BIOME_PERIOD = 2000; // (unused) macro cycle length along Z
const BIOME_BLEND = 0.05;  // Blend width for band edges

// Biome colors
const WATER_DEEP = new THREE.Color(0x0b3954); // Deep water color (legacy)
const WATER_SHALLOW = new THREE.Color(0x1f7a8c); // Shallow water color (legacy)
const WATER_SOLID = new THREE.Color(0x1f7a8c); // Solid water color for cheap rendering
const DESERT_COLOR = new THREE.Color(0xC2B280); // Sand color
const GRASS_COLOR = new THREE.Color(0x6aa84f); // Grass color
const FOREST_COLOR = new THREE.Color(0x2e7d32); // Dense forest color
const PLATEAU_COLOR = new THREE.Color(0x8d6e63); // Plateau/rocky earth color
const ROCK_COLOR = new THREE.Color(0x7d7d7d); // Bare rock color
const SNOW_COLOR = new THREE.Color(0xffffff); // Snow color
const ICE_COLOR = new THREE.Color(0xcfe9ff); // Ice tint for very cold snow
const SHORE_RANGE = 8.0; // Vertical range over which land eases into sea level (wider = gentler)
const BEACH_SAND_COLOR = new THREE.Color(0xE2C199); // Warm beach sand
const BEACH_MAX = 6.0; // Beach band height above sea level

// Runtime-adjustable biome biases (initialized to defaults, can be overridden after load)
let RUNTIME_DESERT_BIAS = DESERT_BIAS;
let RUNTIME_PLATEAU_BIAS = PLATEAU_BIAS;
let RUNTIME_FOREST_BIAS = FOREST_BIAS;
let RUNTIME_MOUNTAIN_BIAS = MOUNTAIN_BIAS;
let RUNTIME_OCEAN_THRESHOLD = OCEAN_THRESHOLD;

// Seeded randomness for terrain offsets (stable across reloads; can override via ?seed=...)
function xmur3(str){for(var i=0,h=1779033703^str.length;i<str.length;i++)h=Math.imul(h^str.charCodeAt(i),3432918353),h=h<<13|h>>>19;return function(){h=Math.imul(h^h>>>16,2246822507),h=Math.imul(h^h>>>13,3266489909);return(h^h>>>16)>>>0}} // String hash -> 32-bit
function sfc32(a,b,c,d){return function(){a>>>0;b>>>0;c>>>0;d>>>0;var t=(a+b|0)+d|0;d=d+1|0;a=b^b>>>9;b=c+(c<<3)|0;c=(c<<21|c>>>11);c=c+t|0;return((t>>>0)/4294967296)}} // Small fast counter PRNG
const _params = new URLSearchParams(window.location.search);
let _seedStr = _params.get('seed') || window.localStorage.getItem('terrain_seed'); // Seed source
if(!_seedStr){ _seedStr = String(Math.floor(Math.random()*1e9)); window.localStorage.setItem('terrain_seed', _seedStr); }
let _h = xmur3(_seedStr); let _rng = sfc32(_h(), _h(), _h(), _h()); // Deterministic RNG
let HEIGHT_OFF_X = _rng()*10000, HEIGHT_OFF_Z = _rng()*10000; // Height noise offsets
let HEAT_OFF_X = _rng()*10000, HEAT_OFF_Z = _rng()*10000; // Heat field offsets
let MOIST_OFF_X = _rng()*10000, MOIST_OFF_Z = _rng()*10000; // Moisture field offsets
let OCEAN_OFF_X = _rng()*10000, OCEAN_OFF_Z = _rng()*10000; // Ocean mask offsets
let PLATEAU_OFF_X = _rng()*10000, PLATEAU_OFF_Z = _rng()*10000; // Plateau mask offsets
const RIDGE_OFF_X = _rng()*10000, RIDGE_OFF_Z = _rng()*10000;     // Mountain ridge offsets
const MOUNTAIN_RIDGE_SCALE = 0.0018;   // Large-scale ridges
const MOUNTAIN_RIDGE_FACTOR = 0.7;     // Ridge contribution to mountain weight
// Sharp mountain range controls
const MOUNTAIN_RANGE_SHARPNESS = 1.6;   // how coherent/continuous ranges are
const MOUNTAIN_PEAK_SCALE = 0.06;       // peak detail frequency
const MOUNTAIN_PEAK_HEIGHT = 35.0;      // additional peak height
const MOUNTAIN_PEAK_SHARPNESS = 2.2;    // sharpness of peaks
const MOUNTAIN_VALLEY_SCALE = 0.01;     // broad valley frequency
const MOUNTAIN_VALLEY_DEPTH = 6.0;      // how much to carve valleys
// Rivers
const RIVER_SCALE = 0.0016;             // lower frequency (fewer rivers)
const RIVER_WIDTH = 0.03;               // narrower core (thinner rivers)
const RIVER_DEPTH = 1.6;                // shallower carving
const RIVER_BANK_BAND = 2.0;            // bank band height above riverbed for coloring
const RIVER_DEEP_COLOR = new THREE.Color(0x1a4b7a);
const RIVER_SHALLOW_COLOR = new THREE.Color(0x2b6ea6);
const RIVER_OFF_X = _rng()*10000, RIVER_OFF_Z = _rng()*10000;     // River noise offsets

// fBm and domain warping helpers (Perlin-based via ImprovedNoise)
function fbm2D(nx, nz, octaves = FBM_OCTAVES, lac = FBM_LACUNARITY, gain = FBM_GAIN, seedY = 0) {
  let amp = 1.0, freq = 1.0, sum = 0.0, norm = 0.0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise.noise(nx * freq, seedY + i * 13.37, nz * freq);
    norm += amp;
    amp *= gain;
    freq *= lac;
  }
  return sum / Math.max(1e-6, norm); // ~[-1,1]
}
function domainWarp(wx, wz) {
  const wxn = fbm2D((wx + HEIGHT_OFF_X) * WARP_FREQ, (wz + HEIGHT_OFF_Z) * WARP_FREQ, 3, 2.0, 0.5, 111.0);
  const wzn = fbm2D((wx - HEIGHT_OFF_X) * WARP_FREQ, (wz - HEIGHT_OFF_Z) * WARP_FREQ, 3, 2.0, 0.5, 222.0);
  return { x: wx + wxn * WARP_STRENGTH, z: wz + wzn * WARP_STRENGTH };
}

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
    // Base sampler using fBm + mild domain warp
    const warped = domainWarp(x, z);
    const fMacro = fbm2D((warped.x + HEIGHT_OFF_X) * HEIGHT_BASE_SCALE, (warped.z + HEIGHT_OFF_Z) * HEIGHT_BASE_SCALE);
    const fDetail = fbm2D((warped.x + HEIGHT_OFF_X) * HEIGHT_DETAIL_SCALE, (warped.z + HEIGHT_OFF_Z) * HEIGHT_DETAIL_SCALE, FBM_DETAIL_OCTAVES);
    // Approximate slope via central differences on macro field in noise domain
    const fx1 = fbm2D((warped.x + HEIGHT_OFF_X + SLOPE_EPS) * HEIGHT_BASE_SCALE, (warped.z + HEIGHT_OFF_Z) * HEIGHT_BASE_SCALE);
    const fx0 = fbm2D((warped.x + HEIGHT_OFF_X - SLOPE_EPS) * HEIGHT_BASE_SCALE, (warped.z + HEIGHT_OFF_Z) * HEIGHT_BASE_SCALE);
    const fz1 = fbm2D((warped.x + HEIGHT_OFF_X) * HEIGHT_BASE_SCALE, (warped.z + HEIGHT_OFF_Z + SLOPE_EPS) * HEIGHT_BASE_SCALE);
    const fz0 = fbm2D((warped.x + HEIGHT_OFF_X) * HEIGHT_BASE_SCALE, (warped.z + HEIGHT_OFF_Z - SLOPE_EPS) * HEIGHT_BASE_SCALE);
    const dfdx = (fx1 - fx0) / (2 * SLOPE_EPS);
    const dfdz = (fz1 - fz0) / (2 * SLOPE_EPS);
    const slope = Math.sqrt(dfdx * dfdx + dfdz * dfdz);
    const detailBoost = Math.pow(THREE.MathUtils.clamp(slope * 2.0, 0, 1), SLOPE_DETAIL_POWER);
    // Combine macro/detail into 0..1
    const n = THREE.MathUtils.clamp((fMacro + 1) * 0.5 * 0.8 + (fDetail + 1) * 0.5 * 0.2 * detailBoost, 0, 1);

    // 2D biome field: heat and moisture
    const heat = (noise.noise((x + HEAT_OFF_X) * HEAT_SCALE, 10, (z + HEAT_OFF_Z) * HEAT_SCALE) + 1) * 0.5;       // 0..1
    const moist = (noise.noise((x + MOIST_OFF_X) * MOISTURE_FIELD_SCALE, 20, (z + MOIST_OFF_Z) * MOISTURE_FIELD_SCALE) + 1) * 0.5; // 0..1

    // Ocean mask (wide blobs); soft band
    const oceanRaw = (noise.noise((x + OCEAN_OFF_X) * OCEAN_SCALE, 30, (z + OCEAN_OFF_Z) * OCEAN_SCALE) + 1) * 0.5; // 0..1
    const oceanW = THREE.MathUtils.smoothstep(oceanRaw, RUNTIME_OCEAN_THRESHOLD - OCEAN_BAND, RUNTIME_OCEAN_THRESHOLD + OCEAN_BAND);
    // Coastal proximity (0 away from coast, 1 at the coastline band)
    const coastProx = THREE.MathUtils.clamp(1 - Math.abs(oceanRaw - RUNTIME_OCEAN_THRESHOLD) / OCEAN_BAND, 0, 1);
    const coast = THREE.MathUtils.smoothstep(coastProx, 0.0, 1.0);

    // Shape heat/moist to reduce grass dominance and increase extremes
    const hot = Math.pow(heat, HEAT_SHARP);
    const cold = Math.pow(1 - heat, HEAT_SHARP);
    const wet = Math.pow(moist, MOIST_SHARP);
    const dry = Math.pow(1 - moist, MOIST_SHARP);
    const midHeat = Math.pow(THREE.MathUtils.clamp(1 - Math.abs(heat - 0.5) * 2, 0, 1), MID_EXP);
    const midMoist = Math.pow(THREE.MathUtils.clamp(1 - Math.abs(moist - 0.5) * 2, 0, 1), MID_EXP);

    // Ridge noise to seed more mountain chains
    const ridgeRaw = 1 - Math.abs(noise.noise((x + RIDGE_OFF_X) * MOUNTAIN_RIDGE_SCALE, 300, (z + RIDGE_OFF_Z) * MOUNTAIN_RIDGE_SCALE));
    const ridgeBoost = THREE.MathUtils.clamp((ridgeRaw - 0.6) / 0.4, 0, 1); // 0 if <0.6, up to 1 near 1.0

    // 2D weights driven purely by fields (ocean masks everything)
    let wd = (1 - oceanW) * RUNTIME_DESERT_BIAS   * (hot * dry);
    let wf = (1 - oceanW) * RUNTIME_FOREST_BIAS   * (wet * (0.7*midHeat + 0.3)); // allow greener lowlands
    let wpl = (1 - oceanW) * RUNTIME_PLATEAU_BIAS * (midHeat * midMoist);
    let wm = (1 - oceanW) * RUNTIME_MOUNTAIN_BIAS * (cold * dry) + (1 - oceanW) * (MOUNTAIN_RIDGE_FACTOR * ridgeBoost);
    let wo = oceanW; // Ocean weight

    // Normalize terrain weights (not including ocean) for height blending
    let terrSum = wd + wpl + wf + wm;
    if (terrSum > 0) { wd/=terrSum; wpl/=terrSum; wf/=terrSum; wm/=terrSum; }

    // Height-based elevation system: 0-20 seabed/water, 20-60 plains, 60-120 forests, 120-140 plateau, 140-180 mountains, 180-200 ice peaks
    // Map noise (0..1) to full elevation range (0..200) with biome influence on distribution
    let hRaw = n * 200.0; // Raw height 0-200
    
    // Apply biome influence to shift height distribution
    // Ocean areas stay low, deserts stay in plains range, forests in forest range, etc.
    let hBiased = hRaw;
    if (oceanW > 0.1) {
      // Ocean areas: strongly bias toward 0-20 range
      hBiased = hRaw * 0.1; // compress to 0-20
    } else {
      // Land areas: apply biome-based height shifts
      const biasStrength = 0.6;
      if (wd > 0.3) {
        // Desert bias toward plains (20-60)
        hBiased = THREE.MathUtils.lerp(hRaw, 20 + (hRaw * 0.2), biasStrength);
      } else if (wf > 0.3) {
        // Forest bias toward forest range (60-120)
        hBiased = THREE.MathUtils.lerp(hRaw, 60 + (hRaw * 0.3), biasStrength);
      } else if (wpl > 0.3) {
        // Plateau bias toward plateau range (120-140)
        hBiased = THREE.MathUtils.lerp(hRaw, 120 + (hRaw * 0.1), biasStrength);
      } else if (wm > 0.3) {
        // Mountain bias toward mountain/peak range (140-200)
        hBiased = THREE.MathUtils.lerp(hRaw, 140 + (hRaw * 0.3), biasStrength);
      }
    }
    
    let hBase = THREE.MathUtils.clamp(hBiased, 0, 200);

    // Add sharp mountain ranges using ridged uplift, only where mountain weight is high
    if (wm > 0.05) {
      // Range mask from large-scale ridged noise
      const rangeNoise = 1 - Math.abs(noise.noise((warped.x + RIDGE_OFF_X) * MOUNTAIN_RIDGE_SCALE, 700, (warped.z + RIDGE_OFF_Z) * MOUNTAIN_RIDGE_SCALE));
      const rangeMask = Math.pow(THREE.MathUtils.clamp((rangeNoise - 0.5) / 0.5, 0, 1), MOUNTAIN_RANGE_SHARPNESS);
      // Peak detail (ridged) for spiky tops
      const peakNoise = 1 - Math.abs(noise.noise((warped.x + HEIGHT_OFF_X) * MOUNTAIN_PEAK_SCALE, 900, (warped.z + HEIGHT_OFF_Z) * MOUNTAIN_PEAK_SCALE));
      const peak = Math.pow(THREE.MathUtils.clamp(peakNoise, 0, 1), MOUNTAIN_PEAK_SHARPNESS);
      const uplift = wm * rangeMask * peak * 40.0; // Scale peak uplift for new height system
      hBase += uplift;
      // Carve broad valleys between ranges to emphasize ridges
      const valley = (noise.noise(warped.x * MOUNTAIN_VALLEY_SCALE, 1200, warped.z * MOUNTAIN_VALLEY_SCALE) + 1) * 0.5;
      hBase -= (1 - rangeMask) * wm * valley * 10.0; // Scale valley carving
    }

    // Rivers: carve channels along Perlin zero-crossings, prefer gentle slopes & moist areas
    const riverField = noise.noise((warped.x + RIVER_OFF_X) * RIVER_SCALE, 400, (warped.z + RIVER_OFF_Z) * RIVER_SCALE);
    const riverCore = 1.0 - THREE.MathUtils.smoothstep(0.0, RIVER_WIDTH, Math.abs(riverField)); // ~1 at zero-crossing lines
    const lowSlope = 1.0 - THREE.MathUtils.clamp(slope * 3.0, 0, 1); // prefer flats
    const moistFavor = Math.pow(THREE.MathUtils.clamp(moist, 0, 1), 1.2);
    let riverMask = 0.6 * riverCore * lowSlope * moistFavor; // global reduction
    // Only carve where above sea to avoid conflicts with ocean flattening
    if (hBase > SEA_LEVEL + 0.2) {
      hBase -= riverMask * 5.0; // Scale river depth for new system
    }

    // Plateaus: quantize where mask is strong
    const plateauMask = noise.noise((x + PLATEAU_OFF_X) * PLATEAU_SCALE, 200, (z + PLATEAU_OFF_Z) * PLATEAU_SCALE);
    if (plateauMask > PLATEAU_THRESHOLD) {
      hBase = Math.round(hBase / 5.0) * 5.0; // Quantize to 5-unit steps
    }

    // Final height clamping and sea interaction
    let h = hBase;
    // Smooth transition to sea level in ocean areas
    if (oceanW > 0.1) {
      const oceanFlatten = Math.pow(oceanW, 0.8);
      h = THREE.MathUtils.lerp(h, SEA_LEVEL * 0.5, oceanFlatten); // Blend toward half sea level (10) in ocean areas
    }
    h = THREE.MathUtils.clamp(h, 0, 200); // Final clamp
    pos.setY(i, h);

    // Height-based color assignment (ignoring biome weights, purely elevation-driven)
    if (h < SEA_LEVEL) {
      // Solid water color (no per-vertex depth blending)
      color.copy(WATER_SOLID);
    } else {
      // Height-based color bands
      if (h >= 180.0) {
        // 180-200: Ice peaks
        color.copy(ICE_COLOR);
      } else if (h >= 140.0) {
        // 140-180: Mountains (rock/snow blend)
        const snowT = THREE.MathUtils.clamp((h - 140.0) / 40.0, 0, 1);
        color.lerpColors(ROCK_COLOR, SNOW_COLOR, snowT);
      } else if (h >= 120.0) {
        // 120-140: Plateau
        color.copy(PLATEAU_COLOR);
      } else if (h >= 60.0) {
        // 60-120: Forests
        color.copy(FOREST_COLOR);
      } else if (h >= 20.0) {
        // 20-60: Plains/desert
        color.copy(GRASS_COLOR);
      } else {
        // 0-20: Should be underwater, but show as beach sand near shore
        color.copy(BEACH_SAND_COLOR);
      }
      // Beach band: warm sand tint right above shoreline, wider and linked to coast proximity
      if (h > SEA_LEVEL && h < SEA_LEVEL + BEACH_MAX) {
        const beachT = THREE.MathUtils.clamp((SEA_LEVEL + BEACH_MAX - h) / BEACH_MAX, 0, 1);
        color.lerp(BEACH_SAND_COLOR, 0.6 * beachT);
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
const basePlaneGeometry = new THREE.PlaneGeometry(1000, PLANE_LENGTH, 200, 50); // width, length, segmentsX, segmentsZ
basePlaneGeometry.rotateX(-Math.PI / 2); // Make horizontal (XZ plane)
const planeMaterial = new THREE.MeshBasicMaterial({
  vertexColors: true, // Use per-vertex colors from deformPlane
  fog: true
});

// Large water plane at sea level
const waterGeometry = new THREE.PlaneGeometry(5000, 5000, 1, 1); // Big ocean plane
waterGeometry.rotateX(-Math.PI / 2); // Horizontal
// Use unlit, opaque material for cheapest water rendering
const waterMaterial = new THREE.MeshBasicMaterial({
  color: 0x1f7a8c
});
const water = new THREE.Mesh(waterGeometry, waterMaterial);
water.position.y = SEA_LEVEL + 0.02; // Slightly above sea level to avoid z-fighting
scene.add(water);

// Seabed plane to give depth under oceans and rivers
const seabedGeometry = new THREE.PlaneGeometry(5000, 5000, 1, 1);
seabedGeometry.rotateX(-Math.PI / 2);
const seabedMaterial = new THREE.MeshBasicMaterial({
  color: 0x9c8f7a, // sandy seabed
  side: THREE.DoubleSide
});
const seabed = new THREE.Mesh(seabedGeometry, seabedMaterial);
seabed.position.y = 0.0; // Seabed at absolute 0
scene.add(seabed);

function ensurePlaneSegment(index) {
  if (planeSegments.has(index)) return;
  const geom = basePlaneGeometry.clone(); // Unique geometry per segment (independent deformation)
  const mesh = new THREE.Mesh(geom, planeMaterial);
  mesh.position.z = -index * PLANE_LENGTH; // Position by segment index
  deformPlane(geom, mesh.position.z); // Apply noise-based deformation
  scene.add(mesh);
  planeSegments.set(index, mesh);
}

function cullAndSpawnPlanes() {
  const centerIndex = Math.floor(-camera.position.z / PLANE_LENGTH); // Segment index under camera
  const minIndex = centerIndex - STEPS_BEHIND; // Oldest segment to keep behind
  const maxIndex = centerIndex + STEPS_AHEAD; // Furthest segment to keep ahead

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

// Fog toggle
const fogBtn = document.getElementById('toggleFogBtn');
let fogEnabled = !!scene.fog;
function setFogEnabled(enabled) {
  if (enabled) {
    scene.fog = new THREE.Fog(scene.background, 80, 700);
  } else {
    scene.fog = null;
  }
  if (fogBtn) fogBtn.textContent = `Fog: ${enabled ? 'On' : 'Off'}`;
}
if (fogBtn) {
  setFogEnabled(fogEnabled);
  fogBtn.addEventListener('click', () => {
    fogEnabled = !fogEnabled;
    setFogEnabled(fogEnabled);
  });
}

// Biome preference handlers: adjust biases and reseed offsets
function rebuildTerrainWithSeed(seed, biases){
  if (biases){
    if (biases.desert !== undefined) {
      window.localStorage.setItem('bias_desert', String(biases.desert));
      RUNTIME_DESERT_BIAS = biases.desert;
    }
    if (biases.plateau !== undefined) {
      window.localStorage.setItem('bias_plateau', String(biases.plateau));
      RUNTIME_PLATEAU_BIAS = biases.plateau;
    }
    if (biases.forest !== undefined) {
      window.localStorage.setItem('bias_forest', String(biases.forest));
      RUNTIME_FOREST_BIAS = biases.forest;
    }
    if (biases.mountain !== undefined) {
      window.localStorage.setItem('bias_mountain', String(biases.mountain));
      RUNTIME_MOUNTAIN_BIAS = biases.mountain;
    }
    if (biases.oceanThreshold !== undefined) {
      window.localStorage.setItem('ocean_threshold', String(biases.oceanThreshold));
      RUNTIME_OCEAN_THRESHOLD = biases.oceanThreshold;
    }
  }
  if (seed){ window.localStorage.setItem('terrain_seed', seed); }
  // Recompute RNG and offsets
  _seedStr = window.localStorage.getItem('terrain_seed') || String(Math.floor(Math.random()*1e9));
  _h = xmur3(_seedStr); _rng = sfc32(_h(), _h(), _h(), _h());
  HEIGHT_OFF_X = _rng()*10000; HEIGHT_OFF_Z = _rng()*10000;
  HEAT_OFF_X = _rng()*10000; HEAT_OFF_Z = _rng()*10000;
  MOIST_OFF_X = _rng()*10000; MOIST_OFF_Z = _rng()*10000;
  OCEAN_OFF_X = _rng()*10000; OCEAN_OFF_Z = _rng()*10000;
  PLATEAU_OFF_X = _rng()*10000; PLATEAU_OFF_Z = _rng()*10000;
  // Clear existing segments and rebuild window
  for (const [,mesh] of planeSegments) { scene.remove(mesh); if (mesh.geometry) mesh.geometry.dispose(); }
  planeSegments.clear();
  cullAndSpawnPlanes();
}

// Apply stored biases
const _bd = parseFloat(window.localStorage.getItem('bias_desert')||`${DESERT_BIAS}`);
const _bp = parseFloat(window.localStorage.getItem('bias_plateau')||`${PLATEAU_BIAS}`);
const _bf = parseFloat(window.localStorage.getItem('bias_forest')||`${FOREST_BIAS}`);
const _bm = parseFloat(window.localStorage.getItem('bias_mountain')||`${MOUNTAIN_BIAS}`);
const _ot = parseFloat(window.localStorage.getItem('ocean_threshold')||`${OCEAN_THRESHOLD}`);
// Note: constants declared above; assign runtime overrides here if present
RUNTIME_DESERT_BIAS = isNaN(_bd)? DESERT_BIAS : _bd;
RUNTIME_PLATEAU_BIAS = isNaN(_bp)? PLATEAU_BIAS : _bp;
RUNTIME_FOREST_BIAS = isNaN(_bf)? FOREST_BIAS : _bf;
RUNTIME_MOUNTAIN_BIAS = isNaN(_bm)? MOUNTAIN_BIAS : _bm;
RUNTIME_OCEAN_THRESHOLD = isNaN(_ot)? OCEAN_THRESHOLD : _ot;

const prefButtons = [
  ['prefMixed',    () => rebuildTerrainWithSeed(String(Math.floor(Math.random()*1e9)), { desert:1.0, plateau:1.0, forest:1.0, mountain:1.0, oceanThreshold:0.58 })],
  ['prefDesert',   () => rebuildTerrainWithSeed('desert-'+Math.floor(Math.random()*1e9),  { desert:1.8, plateau:0.8, forest:0.6, mountain:0.8, oceanThreshold:0.6 })],
  ['prefPlateau',  () => rebuildTerrainWithSeed('plateau-'+Math.floor(Math.random()*1e9), { desert:0.8, plateau:1.8, forest:0.8, mountain:0.9, oceanThreshold:0.6 })],
  ['prefForest',   () => rebuildTerrainWithSeed('forest-'+Math.floor(Math.random()*1e9),  { desert:0.6, plateau:0.9, forest:1.8, mountain:0.8, oceanThreshold:0.62 })],
  ['prefMountain', () => rebuildTerrainWithSeed('mount-'+Math.floor(Math.random()*1e9),   { desert:0.6, plateau:1.0, forest:0.6, mountain:2.2, oceanThreshold:0.6 })],
  ['prefIslands',  () => rebuildTerrainWithSeed('island-'+Math.floor(Math.random()*1e9),  { desert:1.0, plateau:1.0, forest:1.0, mountain:1.2, oceanThreshold:0.5 })],
];
for (const [id, fn] of prefButtons){ const el = document.getElementById(id); if (el) el.addEventListener('click', fn); }

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

// Keyboard fallback (WASD, QE up/down, J/L yaw, I/K pitch)
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

const MANUAL_SPEED = 20; // Manual navigation speed (units/sec)
const YAW_SPEED = 1.2;   // Yaw rotation speed (radians/sec)
const PITCH_SPEED = 0.8; // Pitch rotation speed (radians/sec)
const PITCH_MIN = -Math.PI / 3; // Min pitch (look down)
const PITCH_MAX = Math.PI / 8;  // Max pitch (look up)
let cameraPitch = 0; // Accumulated camera pitch

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
  // Keep controls target in front of camera based on yaw & pitch
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