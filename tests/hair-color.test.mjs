import test from 'node:test';
import assert from 'node:assert/strict';
import { colorHair, hasHairColor } from '../src/lib/hair-color.js';
import { createHairRig, hairField, inpaintHair, renderHair, setRest } from '../src/lib/hair-physics.js';

function imageOf(pixels) {
  return { width: pixels.length, height: 1, data: Uint8ClampedArray.from(pixels.flat()) };
}

test('natural colour and zero intensity preserve every source byte', () => {
  const image = imageOf([[18, 25, 30, 255], [215, 182, 160, 140]]);
  const mask = Float32Array.of(1, 1);
  assert.equal(colorHair(image, mask, { id: 'natural', intensity: 1 }), image);
  assert.equal(colorHair(image, mask, { id: 'wine', intensity: 0 }), image);
  assert.equal(hasHairColor({ id: 'wine', intensity: 0 }), false);
  assert.equal(hasHairColor({ id: 'natural', intensity: 1 }), false);
});

test('mask exterior and alpha remain exact, and the immutable source is not polluted', () => {
  const image = imageOf([[45, 34, 22, 255], [190, 150, 120, 255], [30, 20, 15, 111]]);
  const before = new Uint8ClampedArray(image.data);
  const mask = Float32Array.of(1, 0, 0.5);
  const colored = colorHair(image, mask, { id: 'wine', intensity: 0.8 });
  assert.notDeepEqual(colored.data.slice(0, 3), image.data.slice(0, 3));
  assert.deepEqual(colored.data.slice(4, 8), image.data.slice(4, 8));
  assert.equal(colored.data[11], 111);
  assert.deepEqual(image.data, before);
  colorHair(image, mask, { id: 'cool-tea', intensity: 1 });
  assert.deepEqual(colorHair(image, mask, { id: 'wine', intensity: 0.8 }).data, colored.data);
});

test('soft mask edges blend proportionally with strength instead of hard painting', () => {
  const pixel = [45, 35, 25, 255];
  const image = imageOf([pixel, pixel, pixel]);
  const colored = colorHair(image, Float32Array.of(1, 0.5, 0), { id: 'chestnut', intensity: 1 });
  const halfStrength = colorHair(image, Float32Array.of(1, 1, 1), { id: 'chestnut', intensity: 0.5 });
  assert.deepEqual(colored.data.slice(4, 8), halfStrength.data.slice(4, 8));
  for (let channel = 0; channel < 3; channel += 1) {
    assert.ok(Math.abs(colored.data[4 + channel] - (colored.data[channel] + pixel[channel]) / 2) <= 1);
  }
  assert.deepEqual(colored.data.slice(8, 12), Uint8ClampedArray.from(pixel));
});

test('hair highlights remain lighter than adjacent darker strands', () => {
  const image = imageOf([[20, 20, 20, 255], [75, 75, 75, 255], [180, 180, 180, 255]]);
  const colored = colorHair(image, Float32Array.of(1, 1, 1), { id: 'dark-brown', intensity: 1 });
  const luminance = (at) => colored.data[at] * 0.2126 + colored.data[at + 1] * 0.7152 + colored.data[at + 2] * 0.0722;
  assert.ok(luminance(0) < luminance(4));
  assert.ok(luminance(4) < luminance(8));
  assert.ok(luminance(8) - luminance(0) > 75);
});

test('colour-only rendering uses the edited source, and colour travels with displaced hair', () => {
  const width = 120, height = 160;
  const image = { width, height, data: new Uint8ClampedArray(width * height * 4) };
  const mask = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = y * width + x;
      const hair = x >= 40 && x < 80 && y >= 6 && y < 150;
      image.data.set(hair ? [55, 40, 25, 255] : [210, 205, 190, 255], at * 4);
      mask[at] = hair ? 1 : 0;
    }
  }
  const colored = colorHair(image, mask, { id: 'wine', intensity: 1 });
  const rig = createHairRig(image, mask, { cell: 8 });
  const plate = inpaintHair(image, mask);
  const still = renderHair({ image: colored, mask, rig, plate, field: hairField(rig) });
  assert.deepEqual(still, colored.data);
  const rest = new Float32Array(rig.R0);
  for (const node of rig.activeList) rest[node * 2] += 16;
  setRest(rig, rest, false);
  const field = hairField(rig, undefined, { dynamic: false });
  const moved = renderHair({ image: colored, mask, rig, plate, field });
  const natural = renderHair({ image, mask, rig, plate, field });
  let carried = 0;
  for (let y = 50; y < 130; y += 1) {
    for (let x = 82; x < 92; x += 1) {
      const at = (y * width + x) * 4;
      if (Math.abs(moved[at] - natural[at]) > 5 || Math.abs(moved[at + 2] - natural[at + 2]) > 5) carried += 1;
    }
  }
  assert.ok(carried > 200, 'the recoloured texture should move into the destination of the hair mesh');
});

test('mismatched mask dimensions fail before colouring an image', () => {
  assert.throws(() => colorHair(imageOf([[1, 2, 3, 255]]), new Float32Array(2)), /dimensions/);
});
