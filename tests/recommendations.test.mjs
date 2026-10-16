import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PREFERENCES, STYLES, explainStyle, recommendStyles } from '../src/lib/recommendations.js';
import { salonText } from '../src/lib/export-card.js';

test('default preferences produce the three illustrated feminine directions', () => {
  const results = recommendStyles();
  assert.equal(results.length, 3);
  assert.deepEqual(new Set(results.map((style) => style.demoKey)), new Set(['curtain-layers', 'airy-bob', 'soft-waves']));
  for (const style of results) {
    assert.ok(style.reasons.length >= 2);
    assert.ok(style.requirements.length >= 1);
    assert.equal('score' in style, false);
  }
});

test('low daily maintenance prioritizes low-maintenance cuts', () => {
  const results = recommendStyles({ ...DEFAULT_PREFERENCES, maintenance: 'low' });
  assert.ok(results.every((style) => style.maintenance === 'low'));
  assert.ok(results.every((style) => style.reasons.some((reason) => reason.includes('造型步骤较少'))));
});

test('length changes clearly explain growing out and cutting shorter', () => {
  const grow = recommendStyles({ ...DEFAULT_PREFERENCES, currentLength: 'short', desiredLength: 'long' });
  assert.ok(grow.every((style) => style.requirements.some((note) => note.includes('需要先留长'))));
  const cut = recommendStyles({ ...DEFAULT_PREFERENCES, currentLength: 'long', desiredLength: 'short' });
  assert.ok(cut.every((style) => style.requirements.some((note) => note.includes('需要剪短'))));
});

test('changing length and maintenance preferences changes the suggestions', () => {
  const original = recommendStyles().map((style) => style.id);
  const alternate = recommendStyles({ ...DEFAULT_PREFERENCES, desiredLength: 'short', maintenance: 'low', goal: 'fresh' }).map((style) => style.id);
  assert.notDeepEqual(original, alternate);
  assert.equal(alternate[0], 'soft-pixie');
});

test('presentation is filtered without inferring identity from a photo', () => {
  assert.ok(recommendStyles({ presentation: 'feminine' }).every((style) => style.presentation === 'feminine'));
  assert.ok(recommendStyles({ presentation: 'masculine' }).every((style) => style.presentation === 'masculine'));
  assert.equal(recommendStyles({ presentation: 'any' }).length, 3);
});

test('straight hair receives a clear styling requirement for waves', () => {
  const waves = recommendStyles().find((style) => style.id === 'soft-waves');
  assert.ok(waves);
  assert.ok(waves.requirements.some((note) => note.includes('单靠剪发无法获得')));
});

test('fine hair suggestions acknowledge volume limitations', () => {
  const results = recommendStyles({ density: 'fine' });
  assert.ok(results.every((style) => style.requirements.some((note) => note.includes('发量'))));
});

test('invalid or partial preferences have safe defaults and deterministic output', () => {
  const original = JSON.stringify(DEFAULT_PREFERENCES);
  assert.deepEqual(recommendStyles(null), recommendStyles());
  assert.deepEqual(recommendStyles({ texture: 'unknown', desiredLength: null }), recommendStyles());
  assert.deepEqual(recommendStyles({ presentation: 'any' }), recommendStyles({ presentation: 'any' }));
  assert.equal(JSON.stringify(DEFAULT_PREFERENCES), original);
});

test('reopening a saved catalogue id preserves growing-out advice in details and export text', () => {
  const preferences = { currentLength: 'short', desiredLength: 'long' };
  const recommended = recommendStyles(preferences)[0];
  // Bookmarks store only the id; reopening must rebuild advice from current preferences.
  const savedStyle = STYLES.find((style) => style.id === recommended.id);
  const reopened = explainStyle(savedStyle, preferences);
  assert.deepEqual(reopened.requirements, recommended.requirements);
  assert.ok(salonText(reopened).includes('需要先留长到长发范围'));
  assert.equal('requirements' in savedStyle, false);
});

test('a gallery style outside the top three still explains maintenance and volume limitations', () => {
  const preferences = { presentation: 'masculine', maintenance: 'low', density: 'fine', currentLength: 'short' };
  const quiff = STYLES.find((style) => style.id === 'textured-quiff');
  assert.ok(!recommendStyles(preferences).some((style) => style.id === quiff.id));
  const detail = explainStyle(quiff, preferences);
  assert.ok(detail.requirements.some((note) => note.includes('打理投入更多')));
  assert.ok(detail.requirements.some((note) => note.includes('饱满度可能受限')));
  assert.ok(salonText(detail).includes('饱满度可能受限'));
});

test('single-style explanations normalize input and refresh saved advice without mutating it', () => {
  const style = STYLES.find((candidate) => candidate.id === 'long-blunt');
  assert.deepEqual(explainStyle(style, null), explainStyle(style));
  assert.deepEqual(explainStyle(style, { texture: 'unknown' }), explainStyle(style));
  const saved = explainStyle(style, { currentLength: 'short', desiredLength: 'long' });
  const refreshed = explainStyle(saved, { currentLength: 'long', desiredLength: 'long' });
  assert.ok(saved.requirements.some((note) => note.includes('需要先留长')));
  assert.ok(!refreshed.requirements.some((note) => note.includes('需要先留长')));
  assert.ok(refreshed.requirements.some((note) => note.includes('当前长度类别大致合适')));
  assert.notEqual(refreshed.requirements, saved.requirements);
});

test('catalogue contains complete, unique, explainable styles', () => {
  assert.ok(STYLES.length >= 9 && STYLES.length <= 12);
  assert.equal(new Set(STYLES.map((style) => style.id)).size, STYLES.length);
  for (const style of STYLES) {
    for (const field of ['id', 'name', 'englishName', 'tagline', 'description', 'presentation', 'maintenance']) {
      assert.equal(typeof style[field], 'string', `${style.id}: ${field}`);
    }
    assert.ok([null, 'curtain-layers', 'airy-bob', 'soft-waves', 'crop', 'side-part', 'textured-quiff'].includes(style.demoKey));
    assert.ok(style.lengths.length);
    assert.ok(style.textures.length);
    assert.ok(style.salonNotes.length);
    assert.ok(style.cautions.length);
  }
});
