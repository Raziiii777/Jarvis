/* ================================================================
   JARVIS GOD'S EYE — 3D Cesium Globe (OPTIMIZED)
   ================================================================ */

const GLOBE = {
  viewer: null,
  entities: {},
  refreshTimers: {},
  MAX: {
    flights: 500,
    military: 50,
    vessels: 100,
    satellites: 200,
    earthquakes: 100,
    traffic: 100,
    radio: 100,
    bikeshare: 100,
    fires: 100,
  },
  layerDefs: [
    { id: "flights",       icon: "✈",  label: "Live Flights",       auth: "🟢", endpoint: "/api/globe/flights",       refresh: 30000  },
    { id: "military",      icon: "🎖", label: "Military Flights",    auth: "🟢", endpoint: "/api/globe/military",      refresh: 30000  },
    { id: "vessels",       icon: "🚢", label: "Live Vessels",        auth: "🟢", endpoint: "/api/globe/vessels",       refresh: 60000  },
    { id: "satellites",    icon: "🛰",  label: "Satellites",          auth: "🟢", endpoint: "/api/globe/satellites",    refresh: 600000 },
    { id: "earthquakes",   icon: "🌍", label: "Earthquakes",         auth: "🟢", endpoint: "/api/globe/earthquakes",   refresh: 120000 },
    { id: "traffic",       icon: "🚗", label: "Traffic",             auth: "🟢", endpoint: "/api/globe/traffic",       refresh: 60000  },
    { id: "cctv",          icon: "📹", label: "CCTV Mesh",           auth: "🟢", endpoint: "/api/globe/cctv",          refresh: 600000 },
    { id: "radio",         icon: "📻", label: "Radio",               auth: "🟢", endpoint: "/api/globe/radio",         refresh: 600000 },
    { id: "bikeshare",     icon: "🚲", label: "Bikeshare",           auth: "🟢", endpoint: "/api/globe/bikeshare",     refresh: 600000 },
    { id: "fires",         icon: "🔥", label: "Active Fires",        auth: "🟡", endpoint: "/api/globe/fires",         refresh: 600000 },
    { id: "space",         icon: "🚀", label: "Space Missions",      auth: "🟢", endpoint: "/api/globe/space",         refresh: 600000 },
    { id: "installations", icon: "🎖", label: "Installations",       auth: "🟢", endpoint: "/api/globe/installations", refresh: 3600000 },
  ],
};

/* ==================== INIT ==================== */
async function initGlobe() {
  const container = document.getElementById("globe-container");
  if (!container) return;
  if (!window.Cesium) { setTimeout(initGlobe, 500); return; }

  Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IklQZGU3ZUJSSkNiN281cnEiLCJqdGkiOiJlMTBjZGNiYi1iY2FjLTQ4MjYtYTEzZS00NjM0ODc4YjliNzQiLCJpZCI6NDgyMjI1LCJzdWIiOiJBY3Rpb24gR2FtaW5nIiwiaXNzIjoiaHR0cHM6Ly9hcGkuY2VzaXVtLmNvbSIsImF1ZCI6IlVudGl0bGVkIiwiaWF0IjoxNzg4NzM0NDg1fQ.heTV0p2mDPTNvcOVXc3Ac_Edji39SBNFbXrh5Ik3qlA";

  GLOBE.viewer = new Cesium.Viewer("globe-container", {
    baseLayer: false,
    baseLayerPicker: false,
    geocoder: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    vrButton: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    infoBox: false,
    selectionIndicator: false,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
    msaaSamples: 1,
    contextOptions: {
      webgl: { antialias: false, alpha: false },
    },
  });

  const viewer = GLOBE.viewer;
  const scene = viewer.scene;

  scene.backgroundColor = Cesium.Color.fromCssColorString("#04060d");
  scene.globe.baseColor = Cesium.Color.fromCssColorString("#060b15");
  scene.fog.enabled = false;
  scene.skyAtmosphere.show = false;
  scene.skyBox.show = false;
  scene.globe.enableLighting = false;
  scene.highDynamicRange = false;

  viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  // OSM base layer
  viewer.imageryLayers.addImageryProvider(
    new Cesium.OpenStreetMapImageryProvider({
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    })
  );

  // Darken the tiles
  const baseImagery = viewer.imageryLayers.get(0);
  baseImagery.alpha = 0.5;
  baseImagery.brightness = 0.4;
  baseImagery.contrast = 1.4;
  baseImagery.saturation = 0.3;

  // Add Ion World Imagery (satellite)
  try {
    viewer.imageryLayers.addImageryProvider(
      await Cesium.IonImageryProvider.fromAssetId(2)
    );
    const satLayer = viewer.imageryLayers.get(1);
    if (satLayer) { satLayer.alpha = 0.4; satLayer.brightness = 0.7; }
  } catch {}

  // Add Ion World Terrain
  try {
    viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
  } catch {}

  buildLayerPanel();
}

/* ==================== LAYER PANEL ==================== */
function buildLayerPanel() {
  const panel = document.getElementById("layer-panel");
  if (!panel) return;

  panel.innerHTML = '<div class="layer-title"><span class="blink-dot"></span> GOD\'S EYE LAYERS</div>';
  const list = document.createElement("div");
  list.className = "layer-list";

  GLOBE.layerDefs.forEach(def => {
    const row = document.createElement("div");
    row.className = "layer-row";
    row.innerHTML = `
      <label class="layer-toggle"><input type="checkbox" data-layer="${def.id}"><span class="layer-slider"></span></label>
      <span class="layer-icon">${def.icon}</span>
      <span class="layer-name">${def.label}</span>
      <span class="layer-auth">${def.auth}</span>
      <span class="layer-count" id="lc-${def.id}">0</span>
    `;
    row.querySelector("input").addEventListener("change", e => {
      e.target.checked ? enableLayer(def.id) : disableLayer(def.id);
    });
    list.appendChild(row);
  });

  panel.appendChild(list);
}

/* ==================== TOGGLE ==================== */
function enableLayer(id) {
  const def = GLOBE.layerDefs.find(d => d.id === id);
  if (!def || !GLOBE.viewer) return;
  GLOBE.entities[id] = new Cesium.CustomDataSource(id);
  GLOBE.viewer.dataSources.add(GLOBE.entities[id]);
  fetchAndRender(id, def);
  GLOBE.refreshTimers[id] = setInterval(() => fetchAndRender(id, def), def.refresh);
}

function disableLayer(id) {
  if (GLOBE.refreshTimers[id]) { clearInterval(GLOBE.refreshTimers[id]); delete GLOBE.refreshTimers[id]; }
  if (GLOBE.entities[id]) {
    GLOBE.viewer.dataSources.remove(GLOBE.entities[id], true);
    delete GLOBE.entities[id];
  }
  updateCount(id, 0);
  requestRender();
}

function updateCount(id, n) {
  const el = document.getElementById("lc-" + id);
  if (el) el.textContent = n;
}

function requestRender() {
  if (GLOBE.viewer && GLOBE.viewer.scene) GLOBE.viewer.scene.requestRender();
}

/* ==================== FETCH + RENDER ==================== */
async function fetchAndRender(id, def) {
  try {
    const res = await fetch(def.endpoint);
    if (!res.ok) return;
    const data = await res.json();
    const ds = GLOBE.entities[id];
    if (!ds) return;
    ds.entities.removeAll();

    switch (id) {
      case "flights": renderFlights(ds, data); break;
      case "military": renderMilitary(ds, data); break;
      case "vessels": renderVessels(ds, data); break;
      case "satellites": renderSatellites(ds, data); break;
      case "earthquakes": renderEarthquakes(ds, data); break;
      case "traffic": renderTraffic(ds, data); break;
      case "cctv": renderCCTV(ds, data); break;
      case "radio": renderRadio(ds, data); break;
      case "bikeshare": renderBikeshare(ds, data); break;
      case "fires": renderFires(ds, data); break;
      case "space": renderSpace(ds, data); break;
      case "installations": renderInstallations(ds, data); break;
    }

    updateCount(id, ds.entities.values.length);
    requestRender();
  } catch {}
}

/* ==================== RENDERERS (NO LABELS — FAST) ==================== */

function renderFlights(ds, data) {
  if (!data.entities) return;
  const max = GLOBE.MAX.flights;
  const items = data.entities.slice(0, max);
  for (let i = 0; i < items.length; i++) {
    const e = items[i];
    if (!e.lon || !e.lat) continue;
    const alt = (e.alt || 10000) * 0.3048;
    const heading = (e.heading || 0) * Cesium.Math.RADIANS_PER_DEGREE;
    const pos = Cesium.Cartesian3.fromDegrees(e.lon, e.lat, alt);

    if (i < 15) {
      // Top 15 get 3D box aircraft shape
      ds.entities.add({
        position: pos,
        orientation: Cesium.Transforms.headingPitchRollQuaternion(
          pos, new Cesium.HeadingPitchRoll(heading, 0, 0)
        ),
        box: {
          dimensions: new Cesium.Cartesian3(30, 15, 3),
          material: Cesium.Color.CYAN.withAlpha(0.9),
          outline: true,
          outlineColor: Cesium.Color.WHITE.withAlpha(0.5),
        },
        properties: { callsign: e.callsign, origin: e.origin, speed: e.velocity },
      });
    } else {
      ds.entities.add({
        position: pos,
        point: { pixelSize: 3, color: Cesium.Color.CYAN.withAlpha(0.7) },
        properties: { callsign: e.callsign, origin: e.origin, speed: e.velocity },
      });
    }
  }
}

function renderMilitary(ds, data) {
  if (!data.entities) return;
  for (let i = 0; i < data.entities.length && i < GLOBE.MAX.military; i++) {
    const e = data.entities[i];
    if (!e.lon || !e.lat) continue;
    const alt = (e.alt || 8000) * 0.3048;
    const heading = (e.heading || 0) * Cesium.Math.RADIANS_PER_DEGREE;
    const pos = Cesium.Cartesian3.fromDegrees(e.lon, e.lat, alt);

    ds.entities.add({
      position: pos,
      orientation: Cesium.Transforms.headingPitchRollQuaternion(
        pos, new Cesium.HeadingPitchRoll(heading, 0, 0)
      ),
      box: {
        dimensions: new Cesium.Cartesian3(20, 12, 2),
        material: Cesium.Color.fromCssColorString("#ffaa00").withAlpha(0.9),
        outline: true,
        outlineColor: Cesium.Color.RED.withAlpha(0.5),
      },
      properties: { callsign: e.callsign, type: "military" },
    });
  }
}

function renderVessels(ds, data) {
  if (!data.entities) return;
  const colors = { cargo: "#00ff88", tanker: "#ff6633", container: "#33aaff", bulk: "#aa88ff" };
  for (let i = 0; i < data.entities.length && i < GLOBE.MAX.vessels; i++) {
    const e = data.entities[i];
    if (!e.lon || !e.lat) continue;
    const heading = (e.heading || 0) * Cesium.Math.RADIANS_PER_DEGREE;
    const pos = Cesium.Cartesian3.fromDegrees(e.lon, e.lat, 0);
    const color = colors[e.type] || "#00ff88";

    ds.entities.add({
      position: pos,
      orientation: Cesium.Transforms.headingPitchRollQuaternion(
        pos, new Cesium.HeadingPitchRoll(heading, 0, 0)
      ),
      box: {
        dimensions: new Cesium.Cartesian3(40, 12, 4),
        material: Cesium.Color.fromCssColorString(color).withAlpha(0.9),
        outline: true,
        outlineColor: Cesium.Color.WHITE.withAlpha(0.3),
      },
      properties: { lane: e.lane, type: e.type },
    });
  }
}

function renderSatellites(ds, data) {
  if (!data.entities) return;
  for (const s of data.entities.slice(0, GLOBE.MAX.satellites)) {
    if (!s.tleLine1 || !s.tleLine2) continue;
    try {
      const epoch = s.tleLine1.substring(18, 32).trim();
      const year = parseInt(epoch.substring(0, 2));
      const dayOfYear = parseFloat(epoch.substring(2));
      const epochYear = year < 50 ? 2000 + year : 1900 + year;
      const epochTime = new Date(epochYear, 0, 1).getTime() + (dayOfYear - 1) * 86400000;
      const elapsed = (Date.now() - epochTime) / 1000;
      const meanMotion = parseFloat(s.tleLine2.substring(52, 63).trim());
      if (isNaN(meanMotion)) continue;
      const period = 86400 / meanMotion;
      const phase = (elapsed / period) * 2 * Math.PI;
      const inc = (parseFloat(s.tleLine2.substring(8, 16).trim()) || 53) * Math.PI / 180;
      const lat = Math.asin(Math.sin(inc) * Math.sin(phase)) * 180 / Math.PI;
      const lon = ((Math.atan2(Math.sin(phase) * Math.cos(inc), Math.cos(phase)) * 180 / Math.PI) + (elapsed * 0.004)) % 360;
      ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, 550000),
        point: { pixelSize: 2, color: Cesium.Color.fromCssColorString("#aa66ff").withAlpha(0.4) },
      });
    } catch {}
  }
}

function renderEarthquakes(ds, data) {
  if (!data.entities) return;
  for (const e of data.entities.slice(0, GLOBE.MAX.earthquakes)) {
    if (!e.lon || !e.lat) continue;
    const mag = e.mag || 0;
    const size = Math.max(3, mag * 3);
    const color = mag >= 5 ? "#ff3333" : mag >= 3 ? "#ff8800" : mag >= 1 ? "#ffcc00" : "#66ff66";
    ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(e.lon, e.lat, -e.depth * 1000),
      point: { pixelSize: size, color: Cesium.Color.fromCssColorString(color).withAlpha(0.8), outlineColor: Cesium.Color.fromCssColorString(color), outlineWidth: 1 },
      properties: { place: e.place, mag },
    });
  }
}

function renderTraffic(ds, data) {
  if (!data.roads) return;
  for (const road of data.roads) {
    const positions = road.points.map(p => Cesium.Cartesian3.fromDegrees(p[0], p[1], 0));
    if (positions.length > 1) {
      ds.entities.add({
        polyline: {
          positions, width: 1,
          material: Cesium.Color.fromCssColorString("#00d4ff").withAlpha(0.2),
          clampToGround: true,
        },
      });
    }
  }
  if (!data.entities) return;
  for (const v of data.entities.slice(0, GLOBE.MAX.traffic)) {
    ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(v.lon, v.lat, 10),
      point: { pixelSize: 2, color: Cesium.Color.fromCssColorString("#00ff88").withAlpha(0.5) },
    });
  }
}

function renderCCTV(ds, data) {
  if (!data.entities) return;
  for (const c of data.entities) {
    if (!c.lon || !c.lat) continue;
    ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(c.lon, c.lat, 50),
      point: { pixelSize: 5, color: Cesium.Color.fromCssColorString("#00ffc8").withAlpha(0.7), outlineColor: Cesium.Color.WHITE.withAlpha(0.2), outlineWidth: 1 },
      properties: { name: c.name, region: c.region },
    });
  }
}

function renderRadio(ds, data) {
  if (!data.entities) return;
  for (const r of data.entities.slice(0, GLOBE.MAX.radio)) {
    if (!r.lon || !r.lat) continue;
    ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(r.lon, r.lat, 200),
      point: { pixelSize: 3, color: Cesium.Color.fromCssColorString("#ff0080").withAlpha(0.6) },
    });
  }
}

function renderBikeshare(ds, data) {
  if (!data.entities) return;
  for (const s of data.entities.slice(0, GLOBE.MAX.bikeshare)) {
    if (!s.lon || !s.lat) continue;
    ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(s.lon, s.lat, 5),
      point: { pixelSize: 2, color: Cesium.Color.fromCssColorString("#00ff44").withAlpha(0.6) },
    });
  }
}

function renderFires(ds, data) {
  if (!data.entities) return;
  for (const f of data.entities.slice(0, GLOBE.MAX.fires)) {
    if (!f.lon || !f.lat) continue;
    ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(f.lon, f.lat, 0),
      point: { pixelSize: 4, color: Cesium.Color.fromCssColorString("#ff4400").withAlpha(0.8), outlineColor: Cesium.Color.YELLOW.withAlpha(0.3), outlineWidth: 1 },
    });
  }
}

function renderSpace(ds, data) {
  if (!data.entities) return;
  for (const l of data.entities) {
    if (!l.lon || !l.lat) continue;
    const color = l.status === "Go" ? "#00ff88" : l.status === "TBD" ? "#ffcc00" : "#ff6633";
    ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(l.lon, l.lat, 0),
      point: { pixelSize: 6, color: Cesium.Color.fromCssColorString(color).withAlpha(0.8), outlineColor: Cesium.Color.fromCssColorString(color), outlineWidth: 2 },
      properties: { name: l.name, missions: l.missions?.join(", "), launchSite: l.launchSite },
    });
  }
}

function renderInstallations(ds, data) {
  if (!data.entities) return;
  for (const inst of data.entities) {
    if (!inst.lon || !inst.lat) continue;
    ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(inst.lon, inst.lat, 0),
      point: { pixelSize: 4, color: Cesium.Color.fromCssColorString("#ff6633").withAlpha(0.6), outlineColor: Cesium.Color.fromCssColorString("#ff3300").withAlpha(0.4), outlineWidth: 1 },
      properties: { name: inst.name, type: inst.type },
    });
  }
}

/* ==================== EXPOSE ==================== */
window.initGlobe = initGlobe;
window.GLOBE = GLOBE;
