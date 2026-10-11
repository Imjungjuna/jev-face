import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { EMOTION_ORDER, POSES } from './emotions.js';
import { render, setStatus, countRequest, countFailure } from './panel.js';

const SMOOTHING = 7.5; // higher snaps faster to the new expression
const DEBOUNCE_MS = 250;

/* Tuned against the reel, where the visible head spans 53.7% of the frame
 * width with the crown at 7.7% from the top. The ratio runs against the model
 * bounding box, which is wider than the face because it takes in the neck, so
 * the number here is larger than the one measured on screen. */
const HEAD_WIDTH_RATIO = 0.679;
const HEAD_CENTER = { x: 0.323, y: 0.364 };

let head = null;
let influences = null;
let poseVectors = null;
let target = null;
let headBox = null;

/* ---------------- scene ---------------- */

const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x212429);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minAzimuthAngle = -Math.PI / 2;
controls.maxAzimuthAngle = Math.PI / 2;
controls.maxPolarAngle = Math.PI / 1.8;

new GLTFLoader()
  .setKTX2Loader(new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer))
  .setMeshoptDecoder(MeshoptDecoder)
  .load('/models/facecap.glb', (gltf) => {
    const root = gltf.scene.children[0];
    scene.add(root);

    /* The clips in the file are a baked take; playing them would fight the
     * weights we drive, so the mixer from the three.js example is dropped. */
    root.traverse((o) => {
      const count = Object.keys(o.morphTargetDictionary ?? {}).length;
      if (count > Object.keys(head?.morphTargetDictionary ?? {}).length) head = o;
    });

    influences = head.morphTargetInfluences;
    target = new Float32Array(influences.length);
    poseVectors = buildPoseVectors(head.morphTargetDictionary, influences.length);

    root.updateMatrixWorld(true);
    headBox = new THREE.Box3().setFromObject(root);
    frameHead();
  });

function frameHead() {
  if (!headBox) return;

  const size = headBox.getSize(new THREE.Vector3());
  const center = headBox.getCenter(new THREE.Vector3());
  const halfFov = THREE.MathUtils.degToRad(camera.fov) / 2;

  // View width at distance d is 2*d*tan(halfFov)*aspect; solve for the ratio.
  const distance = size.x / (HEAD_WIDTH_RATIO * 2 * Math.tan(halfFov) * camera.aspect);
  const viewHeight = 2 * distance * Math.tan(halfFov);
  const viewWidth = viewHeight * camera.aspect;

  // Aiming beside the head is what pushes it off-centre on screen.
  const x = center.x + (0.5 - HEAD_CENTER.x) * viewWidth;
  const y = center.y - (0.5 - HEAD_CENTER.y) * viewHeight;

  controls.target.set(x, y, center.z);
  camera.position.set(x, y, center.z + distance);
  controls.minDistance = distance * 0.5;
  controls.maxDistance = distance * 2;
  controls.update();
}

/* Pose maps are keyed by bare ARKit names; the file has shipped them with a
 * "blendShape1." prefix in the past, so both spellings are accepted. */
function buildPoseVectors(dictionary, size) {
  const index = new Map();
  for (const [key, value] of Object.entries(dictionary)) {
    index.set(key.replace('blendShape1.', ''), value);
  }

  const missing = new Set();
  const vectors = {};
  for (const name of EMOTION_ORDER) {
    const vector = new Float32Array(size);
    for (const [shape, weight] of Object.entries(POSES[name])) {
      const slot = index.get(shape);
      if (slot === undefined) missing.add(shape);
      else vector[slot] = weight;
    }
    vectors[name] = vector;
  }
  if (missing.size) console.warn('unknown blendshapes:', [...missing]);
  return vectors;
}

/* ---------------- expression state ---------------- */

const current = { probabilities: null, score: 0 };

function applyAnswer(emotion, score) {
  const raw = EMOTION_ORDER.map((k) => emotion.probabilities?.[k] ?? 0);
  const sum = raw.reduce((a, b) => a + b, 0);

  // A choice answer may arrive without a distribution; fall back to one-hot.
  current.probabilities =
    sum > 0
      ? raw.map((p) => p / sum)
      : EMOTION_ORDER.map((k) => (k === emotion.choice ? 1 : 0));
  current.score = score;
}

function updateTarget() {
  if (!target || !current.probabilities) return;

  target.fill(0);
  // Low intensity still shows a trace of the emotion rather than a dead face.
  const strength = 0.35 + 0.65 * (current.score / 4);

  current.probabilities.forEach((p, i) => {
    if (p < 0.01) return;
    const vector = poseVectors[EMOTION_ORDER[i]];
    const scale = p * strength;
    for (let k = 0; k < target.length; k++) target[k] += vector[k] * scale;
  });
}

/* ---------------- blink ---------------- */

const blinkSlots = [];
let nextBlink = 2;
let blinkPhase = -1;

function blink(delta, elapsed) {
  if (!blinkSlots.length) {
    for (const [key, value] of Object.entries(head.morphTargetDictionary)) {
      if (key.replace('blendShape1.', '').startsWith('eyeBlink')) blinkSlots.push(value);
    }
  }

  if (blinkPhase < 0 && elapsed > nextBlink) blinkPhase = 0;
  if (blinkPhase < 0) return;

  blinkPhase += delta / 0.16;
  if (blinkPhase >= 1) {
    blinkPhase = -1;
    nextBlink = elapsed + 2.5 + Math.random() * 3.5;
    return;
  }

  const amount = Math.sin(blinkPhase * Math.PI);
  for (const slot of blinkSlots) {
    influences[slot] = Math.max(influences[slot], amount);
  }
}

/* ---------------- loop ---------------- */

const clock = new THREE.Clock();

function resize() {
  const { clientWidth: w, clientHeight: h } = canvas;
  if (!w || !h) return;

  const size = renderer.getSize(new THREE.Vector2());
  if (size.x === w && size.y === h) return;

  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  frameHead();
}

renderer.setAnimationLoop(() => {
  resize();
  const delta = Math.min(clock.getDelta(), 0.1);

  if (influences) {
    const k = 1 - Math.exp(-SMOOTHING * delta);
    for (let i = 0; i < influences.length; i++) {
      influences[i] += (target[i] - influences[i]) * k;
    }
    blink(delta, clock.elapsedTime);
  }

  controls.update();
  renderer.render(scene, camera);
});

window.addEventListener('resize', resize);

/* ---------------- typing -> Jev ---------------- */

const input = document.getElementById('input');
let debounce;
let inFlight = false;
let queued = null;

async function evaluate(text) {
  if (inFlight) {
    queued = text;
    return;
  }

  inFlight = true;
  setStatus('pending', 'Jev is deciding…');
  countRequest();

  try {
    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? res.statusText);

    const { emotion, score } = render(body);
    applyAnswer(emotion, score);
    updateTarget();
    setStatus('done', `responded ${body.latencyMs}ms`);
  } catch (error) {
    countFailure(String(error.message));
    setStatus('error', 'request failed');
  } finally {
    inFlight = false;
    const next = queued;
    queued = null;
    if (next) evaluate(next);
  }
}

input.addEventListener('input', () => {
  clearTimeout(debounce);
  const text = input.value.trim();

  if (!text) {
    current.probabilities = null;
    if (target) target.fill(0);
    setStatus('', 'waiting for input');
    return;
  }

  setStatus('pending', 'Jev is deciding…');
  debounce = setTimeout(() => evaluate(text), DEBOUNCE_MS);
});

input.focus();
