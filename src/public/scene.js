import * as THREE from "three";

const wrap = document.querySelector(".hologram-container");
const canvas = document.getElementById("hologram-canvas");
if (!wrap || !canvas) throw new Error("hologram elements missing");

const STATE_COLORS = {
  idle:      0x4488dd,
  listening: 0x44aaff,
  thinking:  0x55aaff,
  speaking:  0x66ccff,
};

const STATE_LINE_COLORS = {
  idle:      0x3366aa,
  listening: 0x3388cc,
  thinking:  0x4499dd,
  speaking:  0x55aadd,
};

function readState() {
  const c = document.body.className;
  if (c.includes("thinking"))  return "thinking";
  if (c.includes("speaking"))  return "speaking";
  if (c.includes("listening")) return "listening";
  return "idle";
}

/* ===================== renderer ===================== */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020408, 0.035);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0, 0, 7);

const tmpColor = new THREE.Color();
const tmpColor2 = new THREE.Color();

/* ===================== lights ===================== */
scene.add(new THREE.AmbientLight(0x4488dd, 0.25));
const light1 = new THREE.PointLight(0x4488dd, 3.0, 14); light1.position.set(3, 4, 5); scene.add(light1);
const light2 = new THREE.PointLight(0x66bbff, 2.0, 12); light2.position.set(-4, -2, 4); scene.add(light2);

/* ===================== entity ===================== */
const entity = new THREE.Group();
scene.add(entity);

/* ===================== MATRIX GLYPH TEXTURES ===================== */
function makeGlyphTexture(char, color) {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = color;
  ctx.font = "bold 44px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(char, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

const GLYPHS = ["0","1","2","7","9","A","B","C","E","K","M","S","W","X","Z","ア","イ","ウ","@","#","$","%","+","="];
const glyphTextures = GLYPHS.map(ch => makeGlyphTexture(ch, "#55aaff"));

/* ===================== MATRIX RAIN PARTICLES ===================== */
const COLUMNS = 30;
const PER_COLUMN = 20;
const TOTAL = COLUMNS * PER_COLUMN;

const positions = new Float32Array(TOTAL * 3);
const speeds = new Float32Array(TOTAL);
const phases = new Float32Array(TOTAL);
const offsets = new Float32Array(TOTAL);
const glyphIdx = new Float32Array(TOTAL);
const basePos = new Float32Array(TOTAL * 3);

const CYL_R = 1.8;
const CYL_H = 3.0;
let idx = 0;
for (let ci = 0; ci < COLUMNS; ci++) {
  const angle = (ci / COLUMNS) * Math.PI * 2;
  const cx = Math.cos(angle) * CYL_R;
  const cz = Math.sin(angle) * CYL_R;
  for (let pi = 0; pi < PER_COLUMN; pi++) {
    const y = (pi / (PER_COLUMN - 1)) * CYL_H - CYL_H / 2;
    const i3 = idx * 3;
    positions[i3] = cx + (Math.random() - 0.5) * 0.15;
    positions[i3 + 1] = y;
    positions[i3 + 2] = cz + (Math.random() - 0.5) * 0.15;
    basePos[i3] = positions[i3];
    basePos[i3 + 1] = positions[i3 + 1];
    basePos[i3 + 2] = positions[i3 + 2];
    speeds[idx] = 0.6 + Math.random() * 1.4;
    phases[idx] = Math.random() * Math.PI * 2;
    offsets[idx] = Math.random() * 100;
    glyphIdx[idx] = Math.floor(Math.random() * glyphTextures.length);
    idx++;
  }
}

const sharedGeo = new THREE.BufferGeometry();
sharedGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
const sharedTex = makeGlyphTexture("1", "#55aaff");
const sharedMat = new THREE.PointsMaterial({
  map: sharedTex, size: 0.12, transparent: true, opacity: 0.85,
  blending: THREE.AdditiveBlending, depthWrite: false,
  sizeAttenuation: true, color: 0x55aaff,
});
const matrixRain = new THREE.Points(sharedGeo, sharedMat);
entity.add(matrixRain);

matrixRain.userData.basePos = basePos;
matrixRain.userData.speeds = speeds;
matrixRain.userData.phases = phases;
matrixRain.userData.offsets = offsets;
matrixRain.userData.glyphs = glyphTextures;
matrixRain.userData.columnCount = COLUMNS;
matrixRain.userData.perColumn = PER_COLUMN;
matrixRain.userData.cylR = CYL_R;
matrixRain.userData.cylH = CYL_H;

/* ===================== CONNECTING LINES ===================== */
const LINE_MAX = 180;
const LINE_DIST = 1.6;
const linePositions = new Float32Array(LINE_MAX * 6);
const lineColors = new Float32Array(LINE_MAX * 6);
const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
lineGeo.setAttribute("color", new THREE.BufferAttribute(lineColors, 3));
const lineMat = new THREE.LineBasicMaterial({
  vertexColors: true, transparent: true, opacity: 0.6,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
const linesMesh = new THREE.LineSegments(lineGeo, lineMat);
entity.add(linesMesh);

/* ===================== CENTRAL GLOW CORE ===================== */
const coreGeo = new THREE.SphereGeometry(0.06, 16, 16);
const coreMat = new THREE.MeshBasicMaterial({
  color: 0x55aaff, transparent: true, opacity: 0.7,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
const coreMesh = new THREE.Mesh(coreGeo, coreMat);
entity.add(coreMesh);

const coreGeo2 = new THREE.SphereGeometry(0.12, 16, 16);
const coreMat2 = new THREE.MeshBasicMaterial({
  color: 0x3388dd, transparent: true, opacity: 0.35,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
const coreMesh2 = new THREE.Mesh(coreGeo2, coreMat2);
entity.add(coreMesh2);

/* ===================== SCAN RINGS ===================== */
const ringMats = [];
for (let ri = 0; ri < 4; ri++) {
  const rr = 1.5 + ri * 0.4;
  const g = new THREE.RingGeometry(rr - 0.005, rr + 0.003, 80);
  const m = new THREE.MeshBasicMaterial({
    color: 0x3388cc, transparent: true, opacity: 0.20 - ri * 0.03,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(g, m);
  ring.rotation.x = Math.PI / 2;
  entity.add(ring);
  ringMats.push({ mesh: ring, mat: m, baseR: rr });
}

/* ===================== ORBITING DOTS ===================== */
const dotGeo = new THREE.SphereGeometry(0.018, 8, 8);
const dots = [];
for (let di = 0; di < 9; di++) {
  const mat = new THREE.MeshBasicMaterial({
    color: 0x55aaff, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const dot = new THREE.Mesh(dotGeo, mat);
  entity.add(dot);
  dots.push(dot);
}

/* ===================== FLOATING ORBS ===================== */
const orbs = [];
for (let oi = 0; oi < 5; oi++) {
  const geo = new THREE.SphereGeometry(0.025 + Math.random() * 0.02, 8, 8);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x55aaff, transparent: true, opacity: 0.5 + Math.random() * 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const orb = new THREE.Mesh(geo, mat);
  orb.userData.phase = Math.random() * Math.PI * 2;
  orb.userData.radius = 2.0 + Math.random() * 1.0;
  orb.userData.speed = 0.15 + Math.random() * 0.25;
  orb.userData.yOffset = (Math.random() - 0.5) * 2.5;
  entity.add(orb);
  orbs.push(orb);
}

/* ===================== MOUSE PARALLAX ===================== */
const pointer = { x: 0, y: 0 };
window.addEventListener("mousemove", (e) => {
  pointer.x = (e.clientX / window.innerWidth  - 0.5) * 2;
  pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
});

/* ===================== ANIMATION ===================== */
const cur = { tint: new THREE.Color(0x1a3a6a), lineTint: new THREE.Color(0x0d1f3d), boost: 0.9 };

function animate(now) {
  requestAnimationFrame(animate);
  const t = now * 0.001;
  const state = readState();
  const mic = window.__micLevel || 0;
  const boost = 0.6 + mic * 3.0;

  tmpColor.setHex(STATE_COLORS[state]);
  tmpColor2.setHex(STATE_LINE_COLORS[state]);
  cur.tint.lerp(tmpColor, 0.04);
  cur.lineTint.lerp(tmpColor2, 0.04);
  cur.boost += (boost - cur.boost) * 0.06;
  const c = cur.tint;
  const cl = cur.lineTint;

  /* ---- matrix rain ---- */
  const pos = matrixRain.geometry.attributes.position.array;
  const ud = matrixRain.userData;
  const base = ud.basePos;
  const spread = mic * 0.5;
  const fallSpeed = 0.7 + mic * 2.0;
  const cylH = ud.cylH;

  for (let i = 0; i < TOTAL; i++) {
    const i3 = i * 3;
    const col = Math.floor(i / ud.perColumn);
    const angle = (col / ud.columnCount) * Math.PI * 2;

    let y = base[i3 + 1] - (t * fallSpeed * ud.speeds[i]) % cylH;
    if (y < -cylH / 2) y += cylH;

    const r = ud.cylR + spread + Math.sin(t * 1.2 + ud.phases[i]) * 0.15;
    const swirlAngle = angle + t * 0.2 + mic * 0.4;

    pos[i3]     = Math.cos(swirlAngle) * r + Math.sin(t * 1.8 + ud.offsets[i]) * 0.08;
    pos[i3 + 1] = y;
    pos[i3 + 2] = Math.sin(swirlAngle) * r + Math.cos(t * 1.8 + ud.offsets[i]) * 0.08;
  }
  matrixRain.geometry.attributes.position.needsUpdate = true;

  /* ---- connecting lines ---- */
  const lPos = linesMesh.geometry.attributes.position.array;
  const lCol = linesMesh.geometry.attributes.color.array;
  let lineIdx = 0;

  for (let i = 0; i < TOTAL && lineIdx < LINE_MAX; i++) {
    const i3 = i * 3;
    const ax = pos[i3], ay = pos[i3 + 1], az = pos[i3 + 2];
    for (let j = i + 1; j < TOTAL && lineIdx < LINE_MAX; j++) {
      const j3 = j * 3;
      const dx = ax - pos[j3];
      const dy = ay - pos[j3 + 1];
      const dz = az - pos[j3 + 2];
      const dist = dx * dx + dy * dy + dz * dz;
      if (dist < LINE_DIST * LINE_DIST) {
        const li = lineIdx * 6;
        lPos[li]     = ax; lPos[li + 1] = ay; lPos[li + 2] = az;
        lPos[li + 3] = pos[j3]; lPos[li + 4] = pos[j3 + 1]; lPos[li + 5] = pos[j3 + 2];
        const fade = 1.0 - Math.sqrt(dist) / LINE_DIST;
        const alpha = fade * (0.3 + cur.boost * 0.4);
        lCol[li]     = cl.r * alpha; lCol[li + 1] = cl.g * alpha; lCol[li + 2] = cl.b * alpha;
        lCol[li + 3] = cl.r * alpha; lCol[li + 4] = cl.g * alpha; lCol[li + 5] = cl.b * alpha;
        lineIdx++;
      }
    }
  }
  /* clear remaining */
  for (let k = lineIdx * 6; k < LINE_MAX * 6; k++) { lPos[k] = 0; lCol[k] = 0; }
  linesMesh.geometry.attributes.position.needsUpdate = true;
  linesMesh.geometry.attributes.color.needsUpdate = true;
  linesMesh.geometry.setDrawRange(0, lineIdx * 2);

  /* ---- entity rotation ---- */
  entity.rotation.y += 0.0015 + mic * 0.006;
  entity.rotation.x += (-pointer.y * 0.25 + Math.sin(t * 0.12) * 0.04 - entity.rotation.x) * 0.025;
  entity.rotation.y += (pointer.x * 0.35 - entity.rotation.y) * 0.015;
  entity.scale.setScalar(1.0 + mic * 0.12);

  /* ---- material tint ---- */
  sharedMat.color.copy(c);
  sharedMat.size = 0.10 + mic * 0.06;
  sharedMat.opacity = 0.7 + cur.boost * 0.25;

  lineMat.opacity = 0.4 + cur.boost * 0.25;
  lineMat.color.copy(cl);

  /* ---- core ---- */
  coreMat.color.copy(c);
  coreMat.opacity = 0.5 + Math.sin(t * 2.0) * 0.15 + mic * 0.3;
  coreMesh.scale.setScalar(1 + mic * 0.8 + Math.sin(t * 2.5) * 0.08);
  coreMat2.color.copy(c);
  coreMat2.opacity = 0.2 + Math.sin(t * 1.5) * 0.08 + mic * 0.15;
  coreMesh2.scale.setScalar(1.5 + mic * 0.5);

  /* ---- rings ---- */
  ringMats.forEach(({ mesh, mat, baseR }, i) => {
    mesh.rotation.z = t * (0.2 + i * 0.12) * (1 + mic * 0.5);
    mesh.rotation.y = Math.sin(t * 0.3 + i) * 0.08;
    mat.opacity = (0.18 - i * 0.03) * (0.8 + cur.boost * 0.35);
    mat.color.copy(c);
    const pulse = 1 + mic * 0.15 + Math.sin(t * 1.8 + i) * 0.03;
    mesh.scale.setScalar(pulse);
  });

  /* ---- orbiting dots ---- */
  dots.forEach((dot, i) => {
    const a = t * (0.35 + i * 0.1) + (i / dots.length) * Math.PI * 2;
    const rr = 1.6 + i * 0.12 + mic * 0.25;
    dot.position.set(Math.cos(a) * rr, Math.sin(a) * rr * 0.4 + Math.sin(t + i) * 0.15, 0.15);
    dot.material.color.copy(c);
    dot.material.opacity = 0.5 + 0.3 * Math.sin(t * 2.5 + i) + mic * 0.2;
  });

  /* ---- floating orbs ---- */
  orbs.forEach((orb) => {
    const ud = orb.userData;
    const a = t * ud.speed + ud.phase;
    orb.position.set(
      Math.cos(a) * ud.radius,
      ud.yOffset + Math.sin(t * 0.8 + ud.phase) * 0.4,
      Math.sin(a) * ud.radius
    );
    orb.material.color.copy(c);
    orb.material.opacity = 0.4 + Math.sin(t * 1.5 + ud.phase) * 0.2 + mic * 0.25;
    orb.scale.setScalar(1 + Math.sin(t * 2.0 + ud.phase) * 0.2 + mic * 0.3);
  });

  renderer.render(scene, camera);
}

/* ===================== RESIZE ===================== */
function resize() {
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  if (w === 0 || h === 0) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

new ResizeObserver(resize).observe(wrap);
resize();
setTimeout(resize, 100);
setTimeout(resize, 500);
requestAnimationFrame(animate);
