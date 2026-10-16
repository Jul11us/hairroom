import test from 'node:test';
import assert from 'node:assert/strict';
import { colorHair } from '../src/lib/hair-color.js';
import { readHairEditorState, sameHairEditorState } from '../src/lib/hair-editor-state.js';
import { createHairRig, hairField, inpaintHair, renderHair, setRest } from '../src/lib/hair-physics.js';

function setup() {
  const width = 72, height = 96;
  const image = { width, height, data: new Uint8ClampedArray(width * height * 4) };
  const mask = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = y * width + x;
      const hair = x >= 24 && x < 48 && y >= 4 && y < 88;
      image.data.set(hair ? [50 + (x % 3) * 10, 35, 25, 255] : [215, 205, 190, 255], at * 4);
      mask[at] = hair ? 1 : 0;
    }
  }
  const rig = createHairRig(image, mask);
  const state = { width, height, mask, rest: new Float32Array(rig.R), color: { id: 'chestnut', intensity: 0.7 } };
  return { image, state, rig };
}

test('saved settings are restored with independent arrays and the original colour choice', () => {
  const { image, state } = setup();
  const restored = readHairEditorState(state, image.width, image.height);
  assert.ok(restored);
  assert.ok(sameHairEditorState(restored, state));
  assert.notEqual(restored.mask, state.mask);
  assert.notEqual(restored.rest, state.rest);
  assert.notEqual(restored.color, state.color);
  restored.mask[0] = 1;
  assert.equal(state.mask[0], 0);
});

test('mismatched source dimensions and invalid mask, rest, or colour are rejected', () => {
  const { image, state } = setup();
  assert.equal(readHairEditorState(state, image.height, image.width), null);
  assert.equal(readHairEditorState({ ...state, mask: new Float32Array(1) }, image.width, image.height), null);
  const badMask = new Float32Array(state.mask);
  badMask[5] = Number.NaN;
  assert.equal(readHairEditorState({ ...state, mask: badMask }, image.width, image.height), null);
  const badRest = new Float32Array(state.rest);
  badRest[0] = Infinity;
  assert.equal(readHairEditorState({ ...state, rest: badRest }, image.width, image.height), null);
  assert.equal(readHairEditorState({ ...state, color: { id: 'wine', intensity: 2 } }, image.width, image.height), null);
});

test('reopening a saved shade from its untouched source does not accumulate dye', () => {
  const { image, state, rig } = setup();
  for (const node of rig.activeList) state.rest[node * 2] += 5;
  setRest(rig, state.rest, false);
  const plate = inpaintHair(image, state.mask);
  const render = (source, currentRig, mask) => renderHair({
    image: source, mask, rig: currentRig, plate,
    field: hairField(currentRig, undefined, { dynamic: false }),
  });
  const beforeClose = render(colorHair(image, state.mask, state.color), rig, state.mask);
  const restored = readHairEditorState(state, image.width, image.height);
  const reopenedRig = createHairRig(image, restored.mask);
  assert.equal(reopenedRig.R.length, restored.rest.length);
  setRest(reopenedRig, restored.rest, false);
  const afterReopen = render(colorHair(image, restored.mask, restored.color), reopenedRig, restored.mask);
  assert.deepEqual(afterReopen, beforeClose);
  assert.ok(sameHairEditorState(restored, state), 'opening a saved style is clean');
});

test('returning to natural remains an unsaved change relative to a coloured opening baseline', () => {
  const { image, state } = setup();
  const baseline = readHairEditorState(state, image.width, image.height);
  const natural = { ...baseline, color: { ...baseline.color, id: 'natural' } };
  assert.equal(sameHairEditorState(natural, baseline), false, 'natural must remain saveable over a saved dye');
  assert.equal(colorHair(image, natural.mask, natural.color), image);
  assert.ok(sameHairEditorState({ ...natural, color: { ...baseline.color } }, baseline), 'undo back to the opening state is clean again');
});

test('selection and rest changes participate in the dirty baseline', () => {
  const { image, state } = setup();
  const baseline = readHairEditorState(state, image.width, image.height);
  const mask = new Float32Array(baseline.mask);
  mask[0] = 1;
  assert.equal(sameHairEditorState({ ...baseline, mask }, baseline), false);
  const rest = new Float32Array(baseline.rest);
  rest[0] += 1;
  assert.equal(sameHairEditorState({ ...baseline, rest }, baseline), false);
});
