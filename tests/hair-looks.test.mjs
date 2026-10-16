import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_LOOKS, LOOKS, PHOTO_LOOKS, lookImageUrl, pickNext } from '../src/lib/hair-looks.js';

test('every Unsplash photo is credited, unique, and served from the Unsplash CDN', () => {
  assert.equal(PHOTO_LOOKS.length, 52);
  assert.equal(new Set(PHOTO_LOOKS.map((look) => look.id)).size, PHOTO_LOOKS.length);
  assert.equal(new Set(PHOTO_LOOKS.map((look) => look.image)).size, PHOTO_LOOKS.length);
  for (const look of PHOTO_LOOKS) {
    assert.match(look.image, /^photo-\d+-[0-9a-f]+$/);
    assert.ok(look.name && look.englishName && look.tagline, look.id);
    assert.ok(look.credit.photographer, look.id);
    assert.match(look.credit.photographerUrl, /^https:\/\/unsplash\.com\/@[\w.-]+\?utm_source=hairroom&utm_medium=referral$/);
    assert.match(look.credit.photoUrl, /^https:\/\/unsplash\.com\/photos\/[\w-]{11}\?utm_source=hairroom/);
    assert.ok(['f', 'm'].includes(look.gender));
    assert.ok(!look.ai);
    assert.match(lookImageUrl(look, 480), /^https:\/\/images\.unsplash\.com\/photo-[\w-]+\?w=480&h=480&fit=crop&crop=faces/);
  }
  assert.ok(PHOTO_LOOKS.filter((look) => look.gender === 'f').length >= 20);
  assert.ok(PHOTO_LOOKS.filter((look) => look.gender === 'm').length >= 20);
});

test('AI sample looks stay labelled and linked studio styles exist', () => {
  assert.equal(AI_LOOKS.length, 8);
  assert.ok(AI_LOOKS.every((look) => look.ai && look.sheet.startsWith('/images/')));
  for (const look of LOOKS) {
    if (look.style) assert.ok(look.style.id && look.style.salonNotes, look.id);
  }
});

test('the next look avoids what the wall already shows, until nothing else is left', () => {
  const pool = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
  for (let i = 0; i < 50; i += 1) {
    assert.equal(pickNext(pool, new Set(['a', 'b', 'c']), 'a'), 'd');
  }
  const exhausted = pickNext(pool, new Set(['a', 'b', 'c', 'd']), 'a', () => 0);
  assert.notEqual(exhausted, 'a');
  assert.equal(pickNext([{ id: 'a' }], new Set(['a']), 'a'), 'a');
  assert.equal(pickNext(pool, new Set(), null, () => 0.99), 'd');
});
