import * as THREE from "/vendor/three/build/three.module.js";

const wrap = document.getElementById("holo-wrap");
const canvas = document.getElementById("holo");

const STATE_COLORS = {
  idle:      0x2fd6ff,
  listening: 0x7df4ff,
  thinking:  0xffb347,
  speaking:  0xb0f0ff,
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
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x04060d, 0.04);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
camera.position.set(0, 0.15, 5.2);

const tmpColor = new THREE.Color();

/* ===================== holographic entity ===================== */
const entity = new THREE.Group();
scene.add(entity);

/* ---- core wireframe icosahedrons ---- */
function makeWireframe(radius, detail, color, opacity) {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const mat = new THREE.MeshBasicMaterial({
    color,
    wireframe: true,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Mesh(geo, mat);
}

const coreInner  = makeWireframe(0.38, 2, 0x2fd6ff, 0.45);
const coreMiddle = makeWireframe(0.62, 1, 0x2fd6ff, 0.55);
const coreOuter  = makeWireframe(0.92, 1, 0x2fd6ff, 0.18);
const coreShell  = makeWireframe(1.25, 0, 0x7df4ff, 0.08);

entity.add(coreInner, coreMiddle, coreOuter, coreShell);

/* ---- central glowing orb ---- */
const orbGeo = new THREE.SphereGeometry(0.14, 32, 32);
const orbMat = new THREE.MeshBasicMaterial({
  color: 0x7df4ff,
  transparent: true,
  opacity: 0.7,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const orb = new THREE.Mesh(orbGeo, orbMat);
entity.add(orb);

/* ---- orbiting rings ---- */
function makeRing(radius, color, opacity) {
  const geo = new THREE.TorusGeometry(radius, 0.006, 16, 120);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  return mesh;
}

const ring1 = makeRing(1.35, 0x2fd6ff, 0.35);
ring1.rotation.x = Math.PI * 0.32;
ring1.rotation.z = Math.PI * 0.12;

const ring2 = makeRing(1.65, 0x7df4ff, 0.18);
ring2.rotation.x = -Math.PI * 0.24;
ring2.rotation.y = Math.PI * 0.2;

const ring3 = makeRing(1.95, 0x2fd6ff, 0.10);
ring3.rotation.x = Math.PI * 0.45;
ring3.rotation.y = -Math.PI * 0.15;

entity.add(ring1, ring2, ring3);

/* ---- tick marks on rings ---- */
const tickGeo = new THREE.BoxGeometry(0.04, 0.004, 0.004);
const tickMat = new THREE.MeshBasicMaterial({ color: 0x2fd6ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });

for (let i = 0; i < 24; i++) {
  const a = (i / 24) * Math.PI * 2;
  const tick = new THREE.Mesh(tickGeo, tickMat.clone());
  tick.position.set(Math.cos(a) * 1.35, Math.sin(a) * 1.35, 0);
  tick.rotation.z = a;
  ring1.add(tick);
}

/* ---- floating particles ---- */
const PARTICLE_COUNT = 3000;
const pPositions = new Float32Array(PARTICLE_COUNT * 3);
const pSpeeds    = new Float32Array(PARTICLE_COUNT);
const pRadii     = new Float32Array(PARTICLE_COUNT);
const pPhases    = new Float32Array(PARTICLE_COUNT);

for (let i = 0; i < PARTICLE_COUNT; i++) {
  const r     = 1.0 + Math.random() * 3.0;
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);

  pPositions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
  pPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  pPositions[i * 3 + 2] = r * Math.cos(phi);

  pRadii[i]  = r;
  pSpeeds[i] = 0.2 + Math.random() * 0.8;
  pPhases[i] = Math.random() * Math.PI * 2;
}

const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute("position", new THREE.BufferAttribute(pPositions, 3));

const particleMat = new THREE.PointsMaterial({
  color: 0x2fd6ff,
  size: 0.018,
  transparent: true,
  opacity: 0.55,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  sizeAttenuation: true,
});

const particles = new THREE.Points(particleGeo, particleMat);
entity.add(particles);

/* ---- vertical scan beam ---- */
const beamGeo = new THREE.PlaneGeometry(2.8, 0.015);
const beamMat = new THREE.MeshBasicMaterial({
  color: 0x7df4ff,
  transparent: true,
  opacity: 0.25,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const beam = new THREE.Mesh(beamGeo, beamMat);
entity.add(beam);

/* ===================== portrait overlay ===================== */
const PORTRAIT_URL = "/model.jpg";
let portraitActive = false;

function buildPortrait() {
  const geo = new THREE.PlaneGeometry(1.8, 1.8);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    uniforms: {
      uTex:   { value: null },
      uTime:  { value: 0 },
      uTint:  { value: new THREE.Color(0x2fd6ff) },
      uBoost: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      uniform float uTime;
      uniform vec3 uTint;
      uniform float uBoost;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        vec2 uv = vUv;
        uv = (uv - 0.5) * (1.0 + 0.008 * sin(uTime * 1.1)) + 0.5;

        float ca = 0.0015 + 0.0006 * sin(uTime * 2.0);
        vec3 col;
        col.r = texture2D(uTex, uv + vec2(ca, 0.0)).r;
        col.g = texture2D(uTex, uv).g;
        col.b = texture2D(uTex, uv - vec2(ca, 0.0)).b;

        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, uTint, 0.35);
        col += uTint * lum * 0.2;

        col *= 0.88 + 0.12 * sin(uv.y * 280.0 - uTime * 6.0);
        col += uTint * smoothstep(0.04, 0.0, abs(fract(uv.y - uTime * 0.11) - 0.5)) * 0.3;

        col += (hash(uv * 500.0 + fract(uTime)) - 0.5) * 0.04;

        vec2 d = abs(uv - 0.5) * 2.0;
        float vig = 1.0 - smoothstep(0.85, 1.35, length(d)) * 0.55;
        float alpha = vig * 0.85 * uBoost;

        gl_FragColor = vec4(col * uBoost, alpha);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = -0.05;
  mesh.visible = false;

  new THREE.TextureLoader().load(
    PORTRAIT_URL,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter  = THREE.LinearFilter;
      tex.anisotropy = 4;
      mat.uniforms.uTex.value = tex;
      const img = tex.image;
      if (img && img.width && img.height) mesh.scale.y = img.height / img.width;
      portraitActive = true;
      mesh.visible = true;
    },
    undefined,
    () => console.warn("[scene] portrait failed to load")
  );

  return mesh;
}

const portrait = buildPortrait();
entity.add(portrait);

/* ===================== mouse parallax ===================== */
const pointer = { x: 0, y: 0 };
window.addEventListener("mousemove", (e) => {
  pointer.x = (e.clientX / window.innerWidth  - 0.5) * 2;
  pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
});

/* ===================== animation ===================== */
const cur = { tint: new THREE.Color(0x2fd6ff), boost: 0.9 };

function animate(now) {
  requestAnimationFrame(animate);
  const t = now * 0.001;
  const state = readState();
  const mic = window.__micLevel || 0;
  const boost = 0.85 + mic * 1.8;

  /* state color */
  tmpColor.setHex(STATE_COLORS[state]);
  cur.tint.lerp(tmpColor, 0.05);
  cur.boost += (boost - cur.boost) * 0.07;

  const c = cur.tint;

  /* ---- core rotation ---- */
  coreInner.rotation.x  = t * 0.35;
  coreInner.rotation.y  = t * 0.25;
  coreMiddle.rotation.x = -t * 0.22;
  coreMiddle.rotation.y =  t * 0.3;
  coreOuter.rotation.x  =  t * 0.15;
  coreOuter.rotation.z  = -t * 0.18;
  coreShell.rotation.y  =  t * 0.08;
  coreShell.rotation.z  =  t * 0.06;

  /* ---- orb pulse ---- */
  const orbPulse = 0.7 + 0.3 * Math.sin(t * 2.5) * cur.boost;
  orbMat.opacity = 0.5 + orbPulse * 0.4;
  orbMat.color.copy(c);
  orb.scale.setScalar(0.9 + mic * 0.4 + Math.sin(t * 3.0) * 0.08);

  /* ---- wireframe colors & opacity ---- */
  coreInner.material.color.copy(c);  coreInner.material.opacity  = 0.3 + cur.boost * 0.25;
  coreMiddle.material.color.copy(c); coreMiddle.material.opacity = 0.35 + cur.boost * 0.3;
  coreOuter.material.color.copy(c);  coreOuter.material.opacity  = 0.1 + cur.boost * 0.12;
  coreShell.material.color.copy(c);  coreShell.material.opacity  = 0.05 + cur.boost * 0.06;

  /* ---- rings ---- */
  ring1.rotation.z += 0.003 * cur.boost;
  ring2.rotation.x += 0.002;
  ring2.rotation.z -= 0.0015;
  ring3.rotation.y += 0.001;
  ring3.rotation.x -= 0.0008;

  ring1.material.color.copy(c); ring1.material.opacity = 0.2 + cur.boost * 0.2;
  ring2.material.color.copy(c); ring2.material.opacity = 0.1 + cur.boost * 0.1;
  ring3.material.color.copy(c); ring3.material.opacity = 0.06 + cur.boost * 0.06;

  /* tick marks */
  ring1.children.forEach((tick, i) => {
    tick.material.color.copy(c);
    tick.material.opacity = 0.3 + 0.2 * Math.sin(t * 2 + i * 0.5);
  });

  /* ---- particles ---- */
  particleMat.color.copy(c);
  particleMat.opacity = 0.35 + cur.boost * 0.25;

  const pos = particleGeo.attributes.position.array;
  const breathe = 1.0 + mic * 0.08 + Math.sin(t * 0.5) * 0.02;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const phase = pPhases[i];
    const spd = pSpeeds[i];

    /* orbit + breathe */
    const angle = t * spd * 0.15 + phase;
    const baseR = pRadii[i] * breathe;
    const rNoise = Math.sin(t * 0.3 + phase) * 0.15;

    pos[i3]     += (Math.cos(angle) * (baseR + rNoise) - pos[i3]) * 0.003;
    pos[i3 + 1] += (Math.sin(angle) * (baseR + rNoise) * 0.7 + Math.sin(t * spd + phase) * 0.3 - pos[i3 + 1]) * 0.003;
    pos[i3 + 2] += (Math.sin(angle * 0.7) * (baseR + rNoise) * 0.5 - pos[i3 + 2]) * 0.003;
  }
  particleGeo.attributes.position.needsUpdate = true;

  /* ---- scan beam ---- */
  const beamY = Math.sin(t * 0.8) * 1.4;
  beam.position.y = beamY;
  beam.material.opacity = 0.12 + 0.1 * Math.sin(t * 1.5);
  beam.material.color.copy(c);

  /* ---- portrait ---- */
  if (portraitActive) {
    portrait.material.uniforms.uTime.value  = t;
    portrait.material.uniforms.uTint.value.copy(c);
    portrait.material.uniforms.uBoost.value = cur.boost * 0.85 + 0.25;
    portrait.position.y = Math.sin(t * 0.7) * 0.035;
    portrait.rotation.z = Math.sin(t * 0.35) * 0.015;
  }

  /* ---- group parallax & scale ---- */
  entity.rotation.y += (pointer.x * 0.65 - entity.rotation.y) * 0.025;
  entity.rotation.x += (-pointer.y * 0.35 + Math.sin(t * 0.18) * 0.04 - entity.rotation.x) * 0.025;
  entity.scale.setScalar(1.0 + mic * 0.04 + Math.sin(t * 2.0) * 0.006);

  renderer.render(scene, camera);
}

/* ===================== resize ===================== */
function resize() {
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

new ResizeObserver(resize).observe(wrap);
resize();
requestAnimationFrame(animate);
