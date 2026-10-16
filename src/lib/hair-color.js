// Recolour the immutable source once per setting/selection change. The normal
// hair mesh can then carry this texture, with no GPU readback during motion.
export const HAIR_COLORS = Object.freeze([
  { id: 'natural', name: '自然色', hex: '#a09582', rgb: null },
  { id: 'soft-black', name: '柔黑', hex: '#302c29', rgb: [48, 44, 41] },
  { id: 'dark-brown', name: '深棕', hex: '#51382c', rgb: [81, 56, 44] },
  { id: 'chestnut', name: '栗色', hex: '#975f3f', rgb: [151, 95, 63] },
  { id: 'cool-tea', name: '冷茶', hex: '#787b65', rgb: [120, 123, 101] },
  { id: 'wine', name: '酒红', hex: '#853b50', rgb: [133, 59, 80] },
]);

export const DEFAULT_HAIR_COLOR = Object.freeze({ id: 'natural', intensity: 0.7 });

export function hairColorName(id) {
  return (HAIR_COLORS.find((entry) => entry.id === id) ?? HAIR_COLORS[0]).name;
}

export function hasHairColor({ id, intensity } = DEFAULT_HAIR_COLOR) {
  return id !== 'natural' && Number.isFinite(intensity) && intensity > 0 && HAIR_COLORS.some((entry) => entry.id === id);
}

/**
 * Keep local light/dark variation and add the chosen shade inside the mask.
 * The mask is source-space, so it follows the same warp as the source photo.
 * Pixels outside it, and every alpha byte, remain exactly unchanged. This is
 * a local colour preview, not a prediction of dye on a particular hair type.
 */
export function colorHair(image, mask, settings = DEFAULT_HAIR_COLOR) {
  const { width, height, data } = image;
  if (data.length !== width * height * 4 || mask.length !== width * height) {
    throw new RangeError('Image and hair mask dimensions must match.');
  }
  const shade = HAIR_COLORS.find((entry) => entry.id === settings.id);
  const amount = Number.isFinite(settings.intensity)
    ? Math.max(0, Math.min(1, settings.intensity)) : 0;
  if (!shade?.rgb || amount === 0) return image;
  const output = new Uint8ClampedArray(data);
  const [red, green, blue] = shade.rgb;
  const targetLight = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  for (let p = 0; p < mask.length; p += 1) {
    const weight = Math.max(0, Math.min(1, mask[p])) * amount;
    if (!(weight > 0)) continue;
    const at = p * 4;
    const light = data[at] * 0.2126 + data[at + 1] * 0.7152 + data[at + 2] * 0.0722;
    // A monotonic lightness mapping keeps strands and specular highlights.
    // Retain most of the original contrast instead of painting a flat block.
    const toneLight = light * 0.7 + targetLight * 0.3;
    const chroma = 1 - (light / 255) * 0.25;
    for (let channel = 0; channel < 3; channel += 1) {
      const tint = Math.max(0, Math.min(255,
        toneLight + (shade.rgb[channel] - targetLight) * chroma));
      output[at + channel] = data[at + channel] + (tint - data[at + channel]) * weight;
    }
  }
  return { width, height, data: output };
}
