import test from 'node:test';
import assert from 'node:assert/strict';
import { paintHairMask } from '../src/lib/hair-warp.js';

test('painting selection respects image bounds, falloff, clamping, and immutability', () => {
  const blank = new Float32Array(25);
  const added = paintHairMask(blank, 5, 5, { x: 0, y: 0, radius: 3, strength: 10, mode: 'add' });
  assert.equal(added[0], 1);
  assert.ok(added[1] > added[2]);
  assert.equal(added[3], 0);
  assert.equal(added[24], 0);
  assert.deepEqual(blank, new Float32Array(25));
  const erased = paintHairMask(added, 5, 5, { x: 0, y: 0, radius: 2, strength: 1, mode: 'erase' });
  assert.equal(erased[0], 0);
  assert.equal(added[0], 1);
  assert.ok([...erased].every(value => value >= 0 && value <= 1));
  assert.deepEqual(paintHairMask(added, 5, 5, { x: -20, y: -20, radius: 2, mode: 'erase' }), added);
});

test('invalid selection masks and brushes are rejected', () => {
  const mask = new Float32Array(25);
  const brush = { x: 2, y: 2, radius: 2, mode: 'add' };
  assert.throws(() => paintHairMask(mask, -1, 5, brush), /dimensions/);
  assert.throws(() => paintHairMask(new Float32Array(3), 5, 5, brush), /length/);
  const invalid = new Float32Array(mask);
  invalid[0] = NaN;
  assert.throws(() => paintHairMask(invalid, 5, 5, brush), /values/);
  assert.throws(() => paintHairMask(mask, 5, 5, { ...brush, radius: 0 }), /radius/);
  assert.throws(() => paintHairMask(mask, 5, 5, { ...brush, mode: 'magic' }), /mode/);
});
