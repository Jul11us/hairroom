/**
 * Hand-painted hair selection. Hair motion itself lives in hair-physics.js.
 * Coordinates and brush radius are expressed in image pixels.
 */

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function validateShape(width, height) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
    || width <= 0 || height <= 0 || !Number.isSafeInteger(width * height * 4)) {
    throw new RangeError('Image dimensions must be positive safe integers.');
  }
}

function validateMask(mask, width, height) {
  validateShape(width, height);
  if (!(mask instanceof Float32Array) || mask.length !== width * height) {
    throw new RangeError('Hair mask length must match the image dimensions.');
  }
  let hasHair = false;
  for (const value of mask) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError('Hair mask values must be finite and between 0 and 1.');
    }
    if (value > 0) hasHair = true;
  }
  return hasHair;
}

function finiteBrush(brush) {
  if (!brush || !Number.isFinite(brush.x) || !Number.isFinite(brush.y)
    || !Number.isFinite(brush.radius) || brush.radius <= 0
    || (brush.strength !== undefined && !Number.isFinite(brush.strength))) {
    throw new RangeError('Brush position, positive radius, and strength must be finite.');
  }
  return clamp(brush.strength ?? 1, 0, 1);
}

// C1-continuous falloff gives a stationary outer boundary to every brush dab.
function falloff(distance, radius) {
  const t = clamp(1 - distance / radius, 0, 1);
  return t * t * (3 - 2 * t);
}

function brushBounds(width, height, x, y, radius) {
  return {
    left: Math.max(0, Math.ceil(x - radius)),
    right: Math.min(width - 1, Math.floor(x + radius)),
    top: Math.max(0, Math.ceil(y - radius)),
    bottom: Math.min(height - 1, Math.floor(y + radius)),
  };
}

/** Return a soft, clamped copy of a hand-painted hair selection. */
export function paintHairMask(mask, width, height, brush) {
  validateMask(mask, width, height);
  const strength = finiteBrush(brush);
  const { x, y, radius, mode } = brush;
  if (!['add', 'erase'].includes(mode)) throw new RangeError('Unknown mask brush mode.');
  const result = new Float32Array(mask);
  if (strength === 0) return result;

  const bounds = brushBounds(width, height, x, y, radius);
  for (let py = bounds.top; py <= bounds.bottom; py += 1) {
    for (let px = bounds.left; px <= bounds.right; px += 1) {
      const amount = falloff(Math.hypot(px - x, py - y), radius) * strength;
      const index = py * width + px;
      result[index] = clamp(mode === 'add'
        ? mask[index] + (1 - mask[index]) * amount
        : mask[index] * (1 - amount), 0, 1);
    }
  }
  return result;
}
