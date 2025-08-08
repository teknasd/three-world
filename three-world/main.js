import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js?module';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js?module';
import Stats from 'https://unpkg.com/three@0.160.0/examples/jsm/libs/stats.module.js?module';

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
let paused = false;
const toggleBtn = document.getElementById('toggleAnimBtn');
if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    paused = !paused;
    toggleBtn.textContent = paused ? 'Resume' : 'Pause';
  });
}

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.z = 10;
camera.position.y = 5;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // smooth camera motion
controls.dampingFactor = 0.05;

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

const CAMERA_SPEED = 3; // units per second camera flies forward (toward -Z)
const DESPAWN_DISTANCE = 10; // how far behind the camera a shape is removed
const SPAWN_AHEAD_MIN = 5; // spawn closer to camera
const SPAWN_AHEAD_MAX = 20; // still some depth variety but nearer
// (keep MAX_SHAPES and MIN_DIST as is)

// ===== Infinite Ground Plane =====
const PLANE_LENGTH = 50;
const NUM_PLANES = 3;
const planeSegments = [];

// ===== Obstacles (cubes) =====
const OBSTACLE_SIZE = 1;
const OBSTACLE_Y = OBSTACLE_SIZE / 2; // sit on plane
const MAX_OBSTACLES = 50;
const OBSTACLE_SPAWN_MIN = 2;
const OBSTACLE_SPAWN_MAX = 50;

const obstacles = [];

function createObstacle() {
  const geometry = new THREE.BoxGeometry(OBSTACLE_SIZE, OBSTACLE_SIZE, OBSTACLE_SIZE);
  const material = new THREE.MeshStandardMaterial({ color: randomColor() });
  const cube = new THREE.Mesh(geometry, material);
  cube.position.set(rand(-20, 20), OBSTACLE_Y, camera.position.z - rand(OBSTACLE_SPAWN_MIN, OBSTACLE_SPAWN_MAX));
  scene.add(cube);
  return cube;
}

// Seed initial obstacles
for (let i = 0; i < MAX_OBSTACLES; i++) {
  obstacles.push(createObstacle());
}

const planeGeometry = new THREE.PlaneGeometry(100, PLANE_LENGTH);
planeGeometry.rotateX(-Math.PI / 2); // make it horizontal (XZ plane)
const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });

for (let i = 0; i < NUM_PLANES; i++) {
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.position.z = -i * PLANE_LENGTH;
  scene.add(plane);
  planeSegments.push(plane);
}

// Responsive handling
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);

// Animation loop
function animate(time) {
  requestAnimationFrame(animate);
  const t = time * 0.001; // convert to seconds
  const delta = clock.getDelta(); // time since last frame

  controls.update(); // required when enableDamping or autoRotate is used
  stats.update(); // refresh FPS meter

  if (!paused) {
    // (shape handling removed)

    // Recycle plane segments to create endless ground
    for (const plane of planeSegments) {
      if (camera.position.z < plane.position.z - PLANE_LENGTH) {
        plane.position.z -= PLANE_LENGTH * NUM_PLANES;
      }
    }

    // Recycle obstacles behind camera and spawn new ones ahead
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      if (obs.position.z - camera.position.z > DESPAWN_DISTANCE) {
        disposeMesh(obs);
        obstacles.splice(i, 1);
      }
    }

    while (obstacles.length < MAX_OBSTACLES) {
      const newObs = createObstacle();
      obstacles.push(newObs);
    }
  }

  // Move camera forward (toward -Z)
  camera.position.z -= CAMERA_SPEED * delta;

  // Keep camera looking slightly ahead along its travel direction
  camera.lookAt(new THREE.Vector3(0, 0, camera.position.z - 10));

  renderer.render(scene, camera);
}

animate(); 