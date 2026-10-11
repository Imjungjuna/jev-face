/*
 * The poses reference ARKit shapes by name. A typo there fails silently at
 * runtime (the weight lands nowhere), so check every name against the glb.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { POSES, EMOTION_ORDER, EMOTION_COLORS, INTENSITY_LABELS } from './src/emotions.js';
import { EMOTIONS, INTENSITY_LEVELS } from './api/evaluate.js';

const glb = readFileSync(new URL('./public/models/facecap.glb', import.meta.url));
const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
const shapes = new Set(json.meshes.flatMap((m) => m.extras?.targetNames ?? []));

assert.equal(shapes.size, 52, 'facecap.glb should expose 52 ARKit blendshapes');

for (const [emotion, pose] of Object.entries(POSES)) {
  for (const [shape, weight] of Object.entries(pose)) {
    assert.ok(shapes.has(shape), `${emotion}: "${shape}" is not a blendshape in facecap.glb`);
    assert.ok(weight > 0 && weight <= 1, `${emotion}.${shape}: weight ${weight} out of (0,1]`);
  }
}

// The panel renders one row per emotion and per intensity level; the question
// schema sent to Jev has to line up with those rows exactly.
assert.deepEqual(EMOTION_ORDER, Object.keys(EMOTIONS));
assert.deepEqual(EMOTION_ORDER, Object.keys(POSES));
assert.deepEqual(EMOTION_ORDER, Object.keys(EMOTION_COLORS));
assert.equal(INTENSITY_LABELS.length, INTENSITY_LEVELS.length);
assert.ok(INTENSITY_LEVELS.length >= 2 && INTENSITY_LEVELS.length <= 10, 'Jev allows 2-10 score levels');

// A full-strength blend of one emotion must stay inside the [0,1] weight range.
for (const [emotion, pose] of Object.entries(POSES)) {
  const peak = Math.max(0, ...Object.values(pose));
  assert.ok(peak <= 1, `${emotion}: blended weight would exceed 1`);
}

console.log(`ok — ${EMOTION_ORDER.length} poses, ${shapes.size} blendshapes, all names resolve`);
