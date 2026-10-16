import { DEFAULT_HAIR_COLOR, HAIR_COLORS } from './hair-color.js';

/** Saved editor state lives only in the page, alongside the untouched source. */
export function readHairEditorState(value, width, height) {
  if (!value || value.width !== width || value.height !== height
    || !(value.mask instanceof Float32Array) || value.mask.length !== width * height
    || !(value.rest instanceof Float32Array) || !value.rest.length
    || value.rest.length % 2 !== 0) return null;
  for (const pixel of value.mask) {
    if (!Number.isFinite(pixel) || pixel < 0 || pixel > 1) return null;
  }
  for (const coordinate of value.rest) {
    if (!Number.isFinite(coordinate)) return null;
  }
  const color = value.color ?? DEFAULT_HAIR_COLOR;
  if (!HAIR_COLORS.some((shade) => shade.id === color.id)
    || !Number.isFinite(color.intensity) || color.intensity < 0 || color.intensity > 1) return null;
  return {
    width, height,
    mask: new Float32Array(value.mask),
    rest: new Float32Array(value.rest),
    color: { ...color },
  };
}

function sameArray(a, b, tolerance = 0) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (Math.abs(a[i] - b[i]) > tolerance) return false;
  }
  return true;
}

/** Compare saved settings, never animated offsets, to the opening baseline. */
export function sameHairEditorState(a, b) {
  return Boolean(a && b && a.width === b.width && a.height === b.height
    && a.color.id === b.color.id && a.color.intensity === b.color.intensity
    && sameArray(a.mask, b.mask) && sameArray(a.rest, b.rest, 0.0001));
}
