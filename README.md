# Three World

A performant, procedurally generated endless terrain demo built with Three.js. It features elevation-band biomes (sea, beaches, plains, forests, plateaus, mountains, ice peaks), rivers, beaches, a sky gradient, soft shadows, fog toggle, camera controls (UI + keyboard), deterministic seeding, and origin rebasing to avoid floating‑point jitter.

## Demo Overview
- Elevation bands (absolute, in world units):
  - 0–20: seabed/water
  - 20–60: plains (green)
  - 60–120: forests (deeper green)
  - 120–140: plateaus (brown/earthy)
  - 140–180: mountains (rock→snow gradient)
  - 180–200: ice peaks
- Smooth transitions near coasts and between bands (no harsh steps)
- Rivers carved by procedural masks; visible as darker channels
- Beaches: wide sand band with light geometric flattening near shoreline
- 2D biome fields (heat, moisture, ocean) bias the height distribution
- Dynamic, windowed terrain streaming (spawns ahead, culls behind)
- Shadows (directional sun) and a gradient sky dome
- Fog toggle (On/Off)
- Deterministic seeding via URL/localStorage
- Origin rebasing to prevent camera shake over time

## Getting Started
You can run this as a plain static site.

### Option A: Using a simple server
- Python: `python -m http.server`
- Node: `npx http-server` or `npx serve`

Then open `http://localhost:8000` (or whichever port your server shows) and load `index.html`.

### Option B: VS Code Live Server
Open the folder and click "Go Live".

## Controls
- On-screen D-pad (bottom-right): forward, backward, left, right; center button toggles pause (⏸️/▶️)
- Look controls (bottom-right column): pitch up/down
- Fog toggle (top-left): Fog On/Off
- Biome presets (top-left): Mixed, Desert, Plateau, Forest, Mountain, Islands
- Orbit controls (mouse):
  - Left-drag: orbit yaw/pitch (damped)
  - Wheel: zoom
  - Right-drag: pan

### Keyboard shortcuts
- Movement: W/A/S/D
- Up/Down: E / Q
- Yaw: J / L
- Pitch: I / K
- Pause/Resume: click the center button (⏸️/▶️)

## Seeding (consistent worlds)
- You can seed generation via URL: `?seed=12345`
- On first run, a random seed is saved in localStorage. Biome preset buttons reseed with themed seeds.

## Project Structure
- `index.html`: minimal HTML + UI controls
- `main.js`: all rendering, generation, controls, UI wiring
- `README.md`: this file

## Notable Systems
### Terrain generation
- Base height from fBm with mild domain warping
- Height is mapped to a strict elevation band model (0–200), with smooth blending at thresholds
- Ocean/heat/moisture 2D fields bias the distribution of heights (e.g., wetter zones favor forest-range heights)
- Rivers from Perlin zero-crossings (carved channels), shallower for performance and aesthetics
- Beaches (SEA_LEVEL→SEA_LEVEL+BEACH_MAX) lightly flatten geometry and enforce sand coloring

### Visuals & Performance
- Solid-color materials (terrain uses Lambert for shadowing; water/seabed unlit)
- Shadowed directional sun; skydome gradient shader
- Fog toggle to reduce long-distance detail and add depth
- Origin rebasing when the camera drifts to large coordinates

## Tuning (edit `main.js`)
Key constants (search these names in `main.js`):
- Elevation bands & sea level
  - `SEA_LEVEL` (default 20)
  - Beach: `BEACH_MAX`, `BEACH_FLAT_TARGET()`
- Oceans
  - `OCEAN_THRESHOLD`, `OCEAN_BAND`
- Biome shaping
  - `HEAT_SCALE`, `MOISTURE_FIELD_SCALE`, `HEAT_SHARP`, `MOIST_SHARP`, `MID_EXP`
- Mountain ranges
  - `MOUNTAIN_RIDGE_SCALE`, `MOUNTAIN_PEAK_SCALE`, `MOUNTAIN_PEAK_HEIGHT`, `MOUNTAIN_VALLEY_*`
- Rivers
  - `RIVER_SCALE`, `RIVER_WIDTH`, `RIVER_DEPTH`
- Streaming
  - `PLANE_LENGTH`, `STEPS_AHEAD`, `STEPS_BEHIND`
- Camera & motion
  - `CAMERA_SPEED`, initial camera `position.y` (default 200)

### Biome presets (UI)
Clicking preset buttons reseeds the world and sets runtime biases:
- `RUNTIME_DESERT_BIAS`
- `RUNTIME_PLATEAU_BIAS`
- `RUNTIME_FOREST_BIAS`
- `RUNTIME_MOUNTAIN_BIAS`
- `RUNTIME_OCEAN_THRESHOLD`
These are persisted in localStorage and applied on load.

## Troubleshooting
- Blank page via `file://`: serve via HTTP (see Getting Started)
- Shaky camera after long flight: origin rebasing recenters the world automatically
- Too much/too little water: adjust `OCEAN_THRESHOLD` and `SEA_LEVEL`
- Too few forests: increase `FOREST_BIAS` and/or soften `HEAT_SHARP`/`MOIST_SHARP`
- Performance:
  - Reduce plane geometry segments (currently 1000×PLANE_LENGTH, 200×50 segments)
  - Lower shadow map size or disable shadows
  - Reduce fBm octaves or detail

## License
MIT — do whatever you like. Attribution appreciated if you find it useful. 