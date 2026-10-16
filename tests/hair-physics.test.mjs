import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aimHair,
  combHair,
  createHairRig,
  grabHair,
  hairField,
  inpaintHair,
  pushVolume,
  renderHair,
  restChanged,
  setRest,
  settleHair,
  stepHair,
} from '../src/lib/hair-physics.js';

// A 120x160 portrait: a lightly textured grey background with a band of
// vertically striped hair hanging from the crown (y = 6) to y = 150.
function portrait() {
  const width = 120;
  const height = 160;
  const data = new Uint8ClampedArray(width * height * 4);
  const mask = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const hair = x >= 40 && x < 80 && y >= 6 && y < 150;
      const strand = x % 4 < 2 ? 40 : 80;
      data.set(hair ? [strand, strand * 0.7, 30, 255] : [180 + (x % 3), 175, 170 - (y % 2), 255], i * 4);
      mask[i] = hair ? 1 : 0;
    }
  }
  return { image: { width, height, data }, mask };
}

const node = (rig, x, y) => Math.round(y / rig.cell) * rig.gw + Math.round(x / rig.cell);
const pixel = (image, x, y) => [...image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)];

function setup() {
  const { image, mask } = portrait();
  const rig = createHairRig(image, mask, { cell: 8 });
  return { image, mask, rig, plate: inpaintHair(image, mask) };
}

test('strand length grows from the crown to the tips, and strands run vertically', () => {
  const { rig } = setup();
  assert.equal(rig.s[node(rig, 64, 8)], 0);
  let previous = -1;
  for (let y = 32; y <= 144; y += 8) {
    const s = rig.s[node(rig, 64, y)];
    assert.ok(s >= previous, `s should not decrease at y=${y}`);
    previous = s;
  }
  assert.ok(rig.s[node(rig, 64, 144)] > 0.9);
  assert.ok(rig.anchor[node(rig, 64, 8)] > rig.anchor[node(rig, 64, 96)]);
  assert.equal(rig.active[node(rig, 8, 80)], 0);
  let vertical = 0, horizontal = 0, v = 0, h = 0;
  for (let e = 0; e < rig.edgeStiff.length; e += 1) {
    const step = rig.edges[e * 2 + 1] - rig.edges[e * 2];
    if (step === rig.gw) { vertical += rig.edgeStiff[e]; v += 1; }
    if (step === 1) { horizontal += rig.edgeStiff[e]; h += 1; }
  }
  assert.ok(vertical / v > horizontal / h + 0.3);
});

test('an untouched rig renders the original photo byte for byte', () => {
  const { image, mask, rig, plate } = setup();
  const out = renderHair({ image, mask, plate, field: hairField(rig), rig });
  assert.deepEqual(out, image.data);
});

test('combing pivots a lock around its roots instead of stretching it', () => {
  const { image, mask, rig, plate } = setup();
  const grab = grabHair(rig, 60, 120, 20);
  assert.equal(combHair(rig, grab, 24, 0, 0.8), true);
  const moved = (x, y) => rig.R[node(rig, x, y) * 2] - rig.R0[node(rig, x, y) * 2];
  assert.ok(moved(64, 120) > 12, `lock should follow the comb, moved ${moved(64, 120)}`);
  assert.ok(Math.abs(moved(64, 16)) < 1.5, 'the crown stays put');
  assert.ok(moved(64, 144) > 8, 'tips below the grab come along');
  for (let y = 16; y < 144; y += 8) {
    const a = node(rig, 64, y) * 2;
    const b = node(rig, 64, y + 8) * 2;
    const length = Math.hypot(rig.R[b] - rig.R[a], rig.R[b + 1] - rig.R[a + 1]);
    assert.ok(Math.abs(length - 8) / 8 < 0.25, `strand segment at y=${y} stretched to ${length}`);
  }
  assert.equal(restChanged(rig), true);

  settleHair(rig);
  const out = { ...image, data: renderHair({ image, mask, plate, field: hairField(rig, undefined, { dynamic: false }), rig }) };
  assert.deepEqual(pixel(out, 5, 5), pixel(image, 5, 5));
  assert.deepEqual(pixel(out, 115, 155), pixel(image, 115, 155));
  assert.deepEqual(pixel(out, 60, 12), pixel(image, 60, 12));
  assert.ok(pixel(out, 90, 126)[0] < 120, 'hair now covers what was background');
  // Where the lock left, the inner hair (darker, softened) shows, not skin.
  const inner = pixel(out, 46, 126)[0];
  assert.ok(inner < 80, `the uncovered area shows inner hair, got ${inner}`);
});

test('released hair swings past its rest, then settles exactly', () => {
  const { image, mask, rig, plate } = setup();
  const pull = grabHair(rig, 60, 130, 20);
  aimHair(pull, 20, 0);
  for (let i = 0; i < 60; i += 1) stepHair(rig, { pull });
  const tip = node(rig, 64, 144) * 2;
  assert.ok(rig.o[tip] > 8, 'tips are pulled along');
  let overshoot = 0;
  let steps = 0;
  for (let motion = Infinity; motion > 0.02 && steps < 2400; steps += 1) {
    motion = stepHair(rig);
    overshoot = Math.min(overshoot, rig.o[tip]);
  }
  assert.ok(overshoot < -0.3, `tips should swing back past rest, reached ${overshoot}`);
  assert.ok(steps < 2400, 'motion dies down');
  settleHair(rig);
  assert.equal(restChanged(rig), false);
  assert.deepEqual(renderHair({ image, mask, plate, field: hairField(rig), rig }), image.data);
});

test('pushing hair upward bends it without folding, and leaves no copies behind', () => {
  const { image, mask, rig, plate } = setup();
  combHair(rig, grabHair(rig, 60, 130, 20), 0, -60, 0.8);
  for (let y = 16; y < 144; y += 8) {
    const a = node(rig, 64, y) * 2 + 1;
    const b = node(rig, 64, y + 8) * 2 + 1;
    assert.ok(rig.R[b] - rig.R[a] > 0, `strand folded over itself at y=${y}`);
  }
  settleHair(rig);
  const out = { ...image, data: renderHair({ image, mask, plate, field: hairField(rig), rig }) };
  for (const [x, y] of [[60, 156], [20, 100], [100, 100], [10, 150]]) {
    assert.deepEqual(pixel(out, x, y), pixel(image, x, y), `background at ${x},${y} changed`);
  }
});

test('hair cut off by the bottom of the frame continues when lifted', () => {
  const width = 80, height = 100;
  const data = new Uint8ClampedArray(width * height * 4);
  const mask = new Float32Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const x = i % width, y = Math.floor(i / width);
    const hair = x >= 20 && x < 60 && y >= 4;
    const strand = x % 4 < 2 ? 40 : 90;
    data.set(hair ? [strand, strand, strand, 255] : [200, 200, 200, 255], i * 4);
    mask[i] = hair ? 1 : 0;
  }
  const image = { width, height, data };
  const rig = createHairRig(image, mask, { cell: 8 });
  for (const i of rig.activeList) rig.R[i * 2 + 1] -= 16;
  const out = renderHair({ image, mask, plate: inpaintHair(image, mask), field: hairField(rig), rig });
  const at = (x, y) => out[(y * width + x) * 4];
  // Strands alternate dark (x % 4 < 2) and light; the lifted bottom keeps them.
  assert.ok(at(40, 97) < 80, `dark strand expected, got ${at(40, 97)}`);
  assert.ok(at(42, 97) > at(40, 97) + 20 && at(42, 97) < 130, `light strand expected, got ${at(42, 97)}`);
  assert.equal(at(5, 97), 200, 'background beside the hair is untouched');
});

test('no drag can make hair longer than it is, combed or flicked', () => {
  const stretched = (rig, offset = null) => {
    let worst = 0;
    for (const i of rig.activeList) {
      const p = rig.parent[i];
      if (p < 0) continue;
      const at = (k, c) => rig.R[k * 2 + c] + (offset ? offset[k * 2 + c] : 0);
      const length = Math.hypot(at(i, 0) - at(p, 0), at(i, 1) - at(p, 1));
      worst = Math.max(worst, length / rig.parentRest[i]);
    }
    return worst;
  };
  for (const [dx, dy] of [[0, 90], [160, 0], [-120, 60]]) {
    const { rig } = setup();
    combHair(rig, grabHair(rig, 60, 140, 20), dx, dy, 1);
    assert.ok(stretched(rig) <= 1.05, `comb (${dx}, ${dy}) stretched a strand ${stretched(rig)}x`);
  }
  const { rig } = setup();
  const pull = grabHair(rig, 60, 140, 20);
  aimHair(pull, 200, 80);
  for (let i = 0; i < 120; i += 1) stepHair(rig, { pull });
  assert.ok(stretched(rig, rig.o) <= 1.05, `flick stretched a strand ${stretched(rig, rig.o)}x`);
});

test('hair separated by skin keeps its own roots and is not dragged along', () => {
  // Main lock from the crown down to y = 96, then skin, then a sideburn-like
  // patch from y = 124 to 150.
  const width = 120, height = 160;
  const data = new Uint8ClampedArray(width * height * 4);
  const mask = new Float32Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const x = i % width, y = Math.floor(i / width);
    const hair = x >= 40 && x < 80 && ((y >= 6 && y < 96) || (y >= 124 && y < 150));
    data.set(hair ? [40, 30, 30, 255] : [200, 170, 150, 255], i * 4);
    mask[i] = hair ? 1 : 0;
  }
  const rig = createHairRig({ width, height, data }, mask, { cell: 8 });
  const island = node(rig, 64, 136);
  assert.equal(rig.s[node(rig, 64, 128)], 0, 'the patch is rooted at its own top');
  combHair(rig, grabHair(rig, 60, 80, 20), 30, 0, 1);
  assert.ok(rig.R[node(rig, 64, 80) * 2] - rig.R0[node(rig, 64, 80) * 2] > 10, 'the main lock moves');
  assert.ok(Math.abs(rig.R[island * 2] - rig.R0[island * 2]) < 2, 'the separate patch stays put');
});

test('hair below the hand hangs straight down when the lock is moved sideways', () => {
  const { rig } = setup();
  combHair(rig, grabHair(rig, 60, 96, 20), 30, 0, 0.8);
  const shift = (y) => rig.R[node(rig, 64, y) * 2] - rig.R0[node(rig, 64, y) * 2];
  assert.ok(shift(104) > 15, `the held lock follows the hand, moved ${shift(104)}`);
  for (const y of [112, 128, 144]) {
    assert.ok(Math.abs(shift(y) - shift(104)) < 4, `hair at y=${y} should hang under the hand (${shift(y)} vs ${shift(104)})`);
  }
  assert.ok(shift(48) > 1 && shift(48) < shift(104) * 0.7, 'above the hand the strand bends gradually');
});

test('pushing a lock toward its root makes it bow away from the head', () => {
  const { rig } = setup();
  combHair(rig, grabHair(rig, 76, 120, 18), 0, -40, 0.8);
  const at = (x, y) => node(rig, x, y) * 2;
  assert.ok(rig.R0[at(80, 120) + 1] - rig.R[at(80, 120) + 1] > 12, 'the held part rises');
  assert.ok(rig.R[at(80, 64)] - rig.R0[at(80, 64)] > 3, 'the middle bows outward');
});

test('moved hair casts a soft contact shadow just past its new edge, nowhere else', () => {
  const { image, mask, rig, plate } = setup();
  for (const i of rig.activeList) rig.R[i * 2] += 20;
  const out = { ...image, data: renderHair({ image, mask, plate, field: hairField(rig), rig }) };
  // The band now spans x 60..100; the shadow falls just right of it.
  const shaded = pixel(out, 101, 100)[0];
  assert.ok(shaded < pixel(image, 101, 100)[0] - 8, `expected a shadow, got ${shaded}`);
  assert.ok(shaded > 110, 'a shadow, not hair');
  assert.deepEqual(pixel(out, 112, 100), pixel(image, 112, 100));
  assert.deepEqual(pixel(out, 10, 100), pixel(image, 10, 100));
});

test('the uncovered area that still needs a real fill is reported', () => {
  const { image, mask, rig, plate } = setup();
  const reveal = new Float32Array(image.width * image.height);
  renderHair({ image, mask, plate, field: hairField(rig), rig, reveal });
  assert.ok(reveal.every((v) => v === 0), 'nothing to fill when nothing moved');
  for (const i of rig.activeList) rig.R[i * 2] += 30;
  renderHair({ image, mask, plate, field: hairField(rig), rig, reveal });
  const at = (x, y) => reveal[y * image.width + x];
  assert.ok(at(41, 100) > 0.5, 'the trailing edge the hair left is uncovered');
  assert.ok(at(75, 100) < 0.05, 'where the moved hair now lies, nothing is uncovered');
  assert.equal(at(10, 100), 0, 'background that never had hair is not filled');
});

test('a breeze sways the tips far more than the roots', () => {
  const { rig } = setup();
  let root = 0, tip = 0;
  for (let i = 0; i < 480; i += 1) {
    stepHair(rig, { time: i / 120, wind: 6 });
    root = Math.max(root, Math.abs(rig.o[node(rig, 64, 16) * 2]));
    tip = Math.max(tip, Math.abs(rig.o[node(rig, 64, 144) * 2]));
  }
  assert.ok(tip > 1.5, `tips should sway, reached ${tip}`);
  assert.ok(tip > root * 4);
});

test('volume lifts hair away from the head, and gathering pulls it in', () => {
  const outward = setup().rig;
  const inward = setup().rig;
  const i = node(outward, 80, 64) * 2;
  assert.equal(pushVolume(outward, 78, 64, 16, 6), true);
  assert.equal(pushVolume(inward, 78, 64, 16, -6), true);
  assert.ok(outward.R[i] > outward.R0[i] + 1.5, `outward moved ${outward.R[i] - outward.R0[i]}`);
  assert.ok(inward.R[i] < inward.R0[i] - 1.5, `inward moved ${inward.R[i] - inward.R0[i]}`);
});

test('restoring a rest shape animates the hair back', () => {
  const { rig } = setup();
  combHair(rig, grabHair(rig, 60, 120, 20), 20, 0, 0.8);
  settleHair(rig);
  setRest(rig, new Float32Array(rig.R0));
  assert.equal(restChanged(rig), false);
  assert.ok(Math.abs(rig.o[node(rig, 64, 120) * 2]) > 5, 'shown hair starts where it was');
});

test('inpainting fills the hair area from the surrounding colours', () => {
  const width = 40, height = 40;
  const data = new Uint8ClampedArray(width * height * 4);
  const mask = new Float32Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const x = i % width, y = Math.floor(i / width);
    const hair = x >= 12 && x < 28 && y >= 12 && y < 28;
    data.set(hair ? [20, 20, 20, 255] : [200, 150, 100, 255], i * 4);
    mask[i] = hair ? 1 : 0;
  }
  const plate = inpaintHair({ width, height, data }, mask);
  const centre = (20 * width + 20) * 4;
  assert.ok(Math.abs(plate[centre] - 200) <= 2);
  assert.ok(Math.abs(plate[centre + 1] - 150) <= 2);
  assert.ok(Math.abs(plate[centre + 2] - 100) <= 2);
});

test('invalid images, masks, and brushes are rejected', () => {
  const { image, mask, rig } = setup();
  assert.throws(() => createHairRig({ ...image, width: -1 }, mask), /dimensions/);
  assert.throws(() => createHairRig({ ...image, data: new Uint8ClampedArray(4) }, mask), /length/);
  assert.throws(() => createHairRig(image, new Float32Array(3)), /length/);
  const invalid = new Float32Array(mask);
  invalid[0] = NaN;
  assert.throws(() => createHairRig(image, invalid), /values/);
  assert.throws(() => grabHair(rig, 10, 10, 0), /radius/);
  assert.throws(() => combHair(rig, grabHair(rig, 60, 60, 10), Infinity, 0), /finite/);
  assert.throws(() => pushVolume(rig, 60, 60, 10, NaN), /finite/);
  assert.throws(() => setRest(rig, new Float32Array(2)), /length/);
});

test('a photo without hair yields an empty rig that changes nothing', () => {
  const { image } = portrait();
  const empty = new Float32Array(image.width * image.height);
  const rig = createHairRig(image, empty);
  assert.equal(rig.activeList.length, 0);
  assert.equal(combHair(rig, grabHair(rig, 60, 60, 20), 10, 0), false);
  assert.deepEqual(renderHair({ image, mask: empty, plate: image.data, field: hairField(rig), rig }), image.data);
});
