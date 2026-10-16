/**
 * Strand-aware hair motion for one still photo, computed on this device.
 *
 * A coarse node grid covers the hair. Every node has a styled rest position
 * (where combing left it) and a dynamic offset (inertia, swing, breeze). Roots
 * near the crown are stiff and tips are loose, and nodes along a strand keep
 * their original spacing, so a dragged lock swings around its root instead of
 * smearing. Rendering is a mesh warp of the untouched original photo, like a
 * puppet warp: each cell carries its piece of hair to where its corners went.
 * Pixels outside the hair never move, and areas the hair uncovers show darker
 * hair underneath, then an inpainted plate. Coordinates are image pixels,
 * x = 0 at the first column.
 */

export const HAIR_STEP_SECONDS = 1 / 120;
// Hair has depth: moving the outer lock uncovers inner hair, which stays close
// to the scalp, sits in shadow and is a little out of focus, rather than skin.
export const UNDER_LAYER = { follow: 0.1, opacity: 0.95, shade: 0.74, spread: 1.8 };
// Hair lying somewhere new casts a soft shadow (down and to the right, as from
// a key light above) and its edge softens a little, as strands do on skin.
export const CONTACT = { shadow: 0.32, offset: 0.006, soften: 0.35 };
// Flyaway strands sit just outside the detected hair. When hair moves they
// must go with it, so lifting and inpainting reach this far past the mask.
export const HALO = 2.5;

const DAMPING = 0.965;
const COUPLING = 0.2;
const NEIGHBOURS = [[1, 0], [0, 1], [1, 1], [-1, 1]];

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function falloff(distance, radius) {
  const t = clamp(1 - distance / radius, 0, 1);
  return t * t * (3 - 2 * t);
}

function validateImage(image) {
  if (!image) throw new TypeError('An RGBA image is required.');
  const { width, height, data } = image;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError('Image dimensions must be positive safe integers.');
  }
  if (!(data instanceof Uint8ClampedArray) || data.length !== width * height * 4) {
    throw new RangeError('RGBA image data length must match the image dimensions.');
  }
}

function validateMask(mask, width, height) {
  if (!(mask instanceof Float32Array) || mask.length !== width * height) {
    throw new RangeError('Hair mask length must match the image dimensions.');
  }
  for (const value of mask) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError('Hair mask values must be finite and between 0 and 1.');
    }
  }
}

// Shortest path through the hair from its roots: a stand-in for "how far
// along the strand" each node is, since a front photo does not show roots.
// Only `through` nodes are crossed; pass `state` to continue earlier results.
function strandDistance(rig, seeds, through, state = null) {
  const { n, gw, gh, cell } = rig;
  const dist = state?.dist ?? new Float32Array(n).fill(Infinity);
  const root = state?.root ?? new Int32Array(n).fill(-1);
  const parent = state?.parent ?? new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const heap = [];
  const swap = (a, b) => { const t = heap[a]; heap[a] = heap[b]; heap[b] = t; };
  const push = (i) => {
    heap.push(i);
    for (let k = heap.length - 1; k > 0;) {
      const parent = (k - 1) >> 1;
      if (dist[heap[parent]] <= dist[heap[k]]) break;
      swap(parent, k);
      k = parent;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let k = 0; ;) {
        const left = 2 * k + 1;
        let best = k;
        if (left < heap.length && dist[heap[left]] < dist[heap[best]]) best = left;
        if (left + 1 < heap.length && dist[heap[left + 1]] < dist[heap[best]]) best = left + 1;
        if (best === k) break;
        swap(best, k);
        k = best;
      }
    }
    return top;
  };
  for (const i of seeds) {
    dist[i] = 0;
    root[i] = i;
    push(i);
  }
  while (heap.length) {
    const i = pop();
    if (done[i]) continue;
    done[i] = 1;
    const gx = i % gw;
    const gy = (i - gx) / gw;
    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        const nx = gx + ox;
        const ny = gy + oy;
        if ((!ox && !oy) || nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const j = ny * gw + nx;
        if (!through[j] || done[j]) continue;
        const d = dist[i] + cell * (ox && oy ? Math.SQRT2 : 1);
        if (d < dist[j]) {
          dist[j] = d;
          root[j] = root[i];
          parent[j] = i;
          push(j);
        }
      }
    }
  }
  return { dist, root, parent };
}

/**
 * Build the motion rig for an image and its hair mask (0..1 per pixel).
 * The returned object is mutable state for the functions below.
 */
export function createHairRig(image, mask, options = {}) {
  validateImage(image);
  const { width, height, data } = image;
  validateMask(mask, width, height);
  const cell = options.cell ?? Math.max(4, Math.round(Math.max(width, height) / 72));
  const gw = Math.ceil((width - 1) / cell) + 1;
  const gh = Math.ceil((height - 1) / cell) + 1;
  const n = gw * gh;
  const nodeOf = (x, y) => Math.round(y / cell) * gw + Math.round(x / cell);

  // Strongest hair value near each node, so thin locks still get a node.
  const coverage = new Float32Array(n);
  // Structure tensor: strands run across the strongest brightness gradient.
  const jxx = new Float32Array(n);
  const jxy = new Float32Array(n);
  const jyy = new Float32Array(n);
  const luminance = (p) => data[p * 4] * 0.299 + data[p * 4 + 1] * 0.587 + data[p * 4 + 2] * 0.114;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      const value = mask[p];
      if (value <= 0) continue;
      const i = nodeOf(x, y);
      if (value > coverage[i]) coverage[i] = value;
      if (value < 0.2 || x === 0 || y === 0 || x === width - 1 || y === height - 1) continue;
      const gx = luminance(p + 1) - luminance(p - 1);
      const gy = luminance(p + width) - luminance(p - width);
      jxx[i] += gx * gx;
      jxy[i] += gx * gy;
      jyy[i] += gy * gy;
    }
  }

  const core = new Uint8Array(n);
  const active = new Uint8Array(n);
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (let i = 0; i < n; i += 1) {
    if (coverage[i] < 0.35) continue;
    core[i] = 1;
    const gx = i % gw;
    const gy = (i - gx) / gw;
    left = Math.min(left, gx * cell);
    right = Math.max(right, gx * cell);
    top = Math.min(top, gy * cell);
    bottom = Math.max(bottom, gy * cell);
    // One ring of extra nodes lets the very edge of the hair move fully.
    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        const nx = gx + ox;
        const ny = gy + oy;
        if (nx >= 0 && ny >= 0 && nx < gw && ny < gh) active[ny * gw + nx] = 1;
      }
    }
  }

  const R0 = new Float32Array(n * 2);
  for (let i = 0; i < n; i += 1) {
    R0[i * 2] = (i % gw) * cell;
    R0[i * 2 + 1] = Math.floor(i / gw) * cell;
  }
  const activeList = Int32Array.from({ length: n }, (_, i) => i).filter((i) => active[i]);
  const rig = {
    width, height, cell, gw, gh, n, active, activeList,
    R0, R: new Float32Array(R0), o: new Float32Array(n * 2), oPrev: new Float32Array(n * 2),
    core, s: new Float32Array(n), depth: new Float32Array(n), root: new Int32Array(n).fill(-1),
    parent: new Int32Array(n).fill(-1), parentRest: new Float32Array(n), strandOrder: new Int32Array(0),
    anchor: new Float32Array(n), follow: new Float32Array(n), crown: 0,
    edges: new Int32Array(0), edgeRest: new Float32Array(0), edgeStiff: new Float32Array(0),
    edgeDir: new Float32Array(0),
    center: { x: width / 2, y: height / 2 },
  };
  if (!activeList.length) return rig;

  // Crown seeds: the top band of the hair. Strand length is scaled by the hair
  // width, so short hair stays springy and long hair swings from lower down.
  const band = top + (bottom - top) * 0.12 + cell * 0.5;
  const seeds = [];
  for (let i = 0; i < n; i += 1) {
    if (core[i] && R0[i * 2 + 1] <= band) seeds.push(i);
  }
  const strands = strandDistance(rig, seeds, core);
  const { dist, root, parent } = strands;
  // Hair cut off from the main mass by skin (a sideburn, a lock behind the
  // ear) grows from its own roots: seed each such island at its top.
  for (let pass = 0; pass < 8; pass += 1) {
    const islandSeeds = [];
    for (let i = 0; i < n; i += 1) {
      if (!core[i] || Number.isFinite(dist[i])) continue;
      const gx = i % gw;
      const gy = (i - gx) / gw;
      let above = false;
      for (let ox = -1; ox <= 1 && gy > 0; ox += 1) {
        const j = (gy - 1) * gw + gx + ox;
        if (gx + ox >= 0 && gx + ox < gw && core[j] && !Number.isFinite(dist[j])) above = true;
      }
      if (!above) islandSeeds.push(i);
    }
    if (!islandSeeds.length) break;
    strandDistance(rig, islandSeeds, core, strands);
  }
  // The ring just outside the hair follows the hair node beside it.
  for (const i of activeList) {
    if (core[i]) continue;
    const gx = i % gw;
    const gy = (i - gx) / gw;
    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        const nx = gx + ox;
        const ny = gy + oy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const j = ny * gw + nx;
        if (!core[j] || !Number.isFinite(dist[j])) continue;
        const d = dist[j] + cell * Math.hypot(ox, oy);
        if (d < dist[i]) {
          dist[i] = d;
          root[i] = root[j];
          parent[i] = j;
        }
      }
    }
  }
  const scale = 1.15 * (right - left + cell);
  rig.crown = top;
  for (const i of activeList) {
    const d = Number.isFinite(dist[i]) ? dist[i] : Math.max(0, R0[i * 2 + 1] - top);
    const s = clamp(d / scale, 0, 1);
    rig.depth[i] = d;
    rig.root[i] = root[i];
    rig.parent[i] = parent[i];
    if (parent[i] >= 0) {
      rig.parentRest[i] = Math.hypot(R0[i * 2] - R0[parent[i] * 2], R0[i * 2 + 1] - R0[parent[i] * 2 + 1]);
    }
    rig.s[i] = s;
    rig.anchor[i] = 0.85 * (1 - smoothstep(0.02, 0.25, s));
    rig.follow[i] = 0.3 * (1 - s) ** 2.2 + 0.006;
  }
  rig.center = { x: (left + right) / 2, y: top + 0.45 * (right - left) };
  // Roots first, so each node is corrected after the node it hangs from.
  rig.strandOrder = Int32Array.from(activeList).sort((a, b) => rig.depth[a] - rig.depth[b]);

  // Smooth the tensors over neighbouring nodes before reading a direction.
  const tangent = new Float32Array(n * 2);
  const coherence = new Float32Array(n);
  for (const i of activeList) {
    const gx = i % gw;
    const gy = (i - gx) / gw;
    let xx = 0, xy = 0, yy = 0;
    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        const nx = gx + ox;
        const ny = gy + oy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const j = ny * gw + nx;
        xx += jxx[j];
        xy += jxy[j];
        yy += jyy[j];
      }
    }
    const trace = xx + yy;
    const gradientAngle = 0.5 * Math.atan2(2 * xy, xx - yy);
    tangent[i * 2] = -Math.sin(gradientAngle);
    tangent[i * 2 + 1] = Math.cos(gradientAngle);
    coherence[i] = trace > 1e-6 ? Math.hypot(xx - yy, 2 * xy) / trace : 0;
  }

  const edges = [];
  const rest = [];
  const stiff = [];
  const direction = [];
  for (const i of activeList) {
    const gx = i % gw;
    const gy = (i - gx) / gw;
    for (const [ox, oy] of NEIGHBOURS) {
      const nx = gx + ox;
      const ny = gy + oy;
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      const j = ny * gw + nx;
      if (!active[j]) continue;
      const length = Math.hypot(ox, oy) * cell;
      const ex = ox * cell / length;
      const ey = oy * cell / length;
      const flip = tangent[i * 2] * tangent[j * 2] + tangent[i * 2 + 1] * tangent[j * 2 + 1] < 0 ? -1 : 1;
      let tx = tangent[i * 2] + flip * tangent[j * 2];
      let ty = tangent[i * 2 + 1] + flip * tangent[j * 2 + 1];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const c = (coherence[i] + coherence[j]) / 2;
      // Along a strand the hair is stiff; across strands locks can slide apart.
      // Where the texture is unclear, assume hair falls downward.
      const along = (ex * tx + ey * ty) ** 2;
      const preference = c * along + (1 - c) * ey * ey;
      edges.push(i, j);
      rest.push(length);
      stiff.push(0.3 + 0.7 * preference);
      direction.push(ex, ey);
    }
  }
  rig.edges = Int32Array.from(edges);
  rig.edgeRest = Float32Array.from(rest);
  rig.edgeStiff = Float32Array.from(stiff);
  rig.edgeDir = Float32Array.from(direction);
  return rig;
}

/**
 * Hair does not stretch. Follow-the-leader (Müller et al. 2012, "Fast
 * Simulation of Inextensible Hair and Fur"): from the roots outward, pull each
 * node back to within its original distance of the node it hangs from.
 * `points` holds positions (2 per node); `offset` is added to read them.
 */
function keepLength(rig, points, offset = null, slack = 1.04) {
  const { strandOrder, parent, parentRest } = rig;
  for (const i of strandOrder) {
    const p = parent[i];
    if (p < 0) continue;
    const px = points[p * 2] + (offset ? offset[p * 2] : 0);
    const py = points[p * 2 + 1] + (offset ? offset[p * 2 + 1] : 0);
    const ix = points[i * 2] + (offset ? offset[i * 2] : 0);
    const iy = points[i * 2 + 1] + (offset ? offset[i * 2 + 1] : 0);
    const dx = ix - px;
    const dy = iy - py;
    const length = Math.hypot(dx, dy);
    const longest = parentRest[i] * slack;
    if (length <= longest || length < 1e-6) continue;
    const k = longest / length;
    points[i * 2] = px + dx * k - (offset ? offset[i * 2] : 0);
    points[i * 2 + 1] = py + dy * k - (offset ? offset[i * 2 + 1] : 0);
  }
}

function solveEdges(rig, scale) {
  const { edges, edgeRest, edgeStiff, edgeDir, anchor, R } = rig;
  for (let e = 0; e < edgeRest.length; e += 1) {
    const i = edges[e * 2];
    const j = edges[e * 2 + 1];
    const dx = R[j * 2] - R[i * 2];
    const dy = R[j * 2 + 1] - R[i * 2 + 1];
    const length = Math.hypot(dx, dy);
    if (length < 1e-6) continue;
    const wi = 1 - anchor[i] * 0.9;
    const wj = 1 - anchor[j] * 0.9;
    // Locks may drift apart, but hair pushed sideways shoves its neighbours
    // along instead of passing through them.
    const stiffness = length < edgeRest[e] ? Math.max(edgeStiff[e], 0.9) : edgeStiff[e];
    const correction = stiffness * scale * (length - edgeRest[e]) / length / (wi + wj);
    R[i * 2] += dx * correction * wi;
    R[i * 2 + 1] += dy * correction * wi;
    R[j * 2] -= dx * correction * wj;
    R[j * 2 + 1] -= dy * correction * wj;
    // A plain length check cannot tell a squeezed pair from one that swapped
    // sides; measure along the original direction to catch both.
    const ex = edgeDir[e * 2];
    const ey = edgeDir[e * 2 + 1];
    const along = (R[j * 2] - R[i * 2]) * ex + (R[j * 2 + 1] - R[i * 2 + 1]) * ey;
    const minimum = edgeRest[e] * 0.35;
    if (along < minimum) {
      const push = (minimum - along) * 0.9 * scale / (wi + wj);
      R[i * 2] -= ex * push * wi;
      R[i * 2 + 1] -= ey * push * wi;
      R[j * 2] += ex * push * wj;
      R[j * 2 + 1] += ey * push * wj;
    }
  }
}

function solveAnchors(rig, amount) {
  const { activeList, anchor, R, R0 } = rig;
  for (const i of activeList) {
    const k = anchor[i] * amount;
    R[i * 2] += (R0[i * 2] - R[i * 2]) * k;
    R[i * 2 + 1] += (R0[i * 2 + 1] - R[i * 2 + 1]) * k;
  }
}

// Keep the visible hair where it is when the rest shape jumps; the dynamics
// then carry it to the new shape with inertia.
function shiftOffsets(rig, before) {
  const { activeList, R, o, oPrev } = rig;
  let moved = 0;
  for (const i of activeList) {
    for (let c = i * 2; c <= i * 2 + 1; c += 1) {
      const delta = R[c] - before[c];
      o[c] -= delta;
      oPrev[c] -= delta;
      moved = Math.max(moved, Math.abs(delta));
    }
  }
  return moved > 0.01;
}

// Follow a strand from node i toward its tip (toward = 1) or its root (-1).
function nextAlongStrand(rig, i, toward = 1) {
  const { gw, gh, core, depth } = rig;
  const gx = i % gw;
  const gy = (i - gx) / gw;
  let best = -1;
  let bestRate = 1e-6;
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const nx = gx + ox;
      const ny = gy + oy;
      if ((!ox && !oy) || nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      const j = ny * gw + nx;
      // Stay on the hair: a lock does not reach across skin to other hair.
      if (!core[j]) continue;
      const rate = toward * (depth[j] - depth[i]) / Math.hypot(ox, oy);
      if (rate > bestRate) {
        bestRate = rate;
        best = j;
      }
    }
  }
  return best;
}

/**
 * Pick the hair under a brush, by where it is currently shown. Hair below the
 * brush hangs from it, so the grab carries on down each strand to the tips;
 * hair between the root and the brush takes a growing share of the drag, so
 * the whole strand turns together instead of kinking at the brush.
 */
export function grabHair(rig, x, y, radius) {
  if (![x, y, radius].every(Number.isFinite) || radius <= 0) {
    throw new RangeError('Brush position and positive radius must be finite.');
  }
  const { n, activeList, R, o } = rig;
  const { depth } = rig;
  const direct = new Float32Array(n);
  const carried = new Float32Array(n);
  const share = new Float32Array(n).fill(1);
  for (const i of activeList) {
    const weight = falloff(Math.hypot(R[i * 2] + o[i * 2] - x, R[i * 2 + 1] + o[i * 2 + 1] - y), radius);
    if (weight > 0.01) direct[i] = carried[i] = weight;
  }
  for (const i of activeList) {
    let weight = direct[i];
    for (let j = weight ? nextAlongStrand(rig, i) : -1; j >= 0; j = nextAlongStrand(rig, j)) {
      weight *= 0.97;
      if (weight <= carried[j] || weight < 0.01) break;
      carried[j] = weight;
    }
  }
  for (const i of activeList) {
    if (!direct[i] || depth[i] <= 0) continue;
    const weight = direct[i] * 0.6;
    for (let j = nextAlongStrand(rig, i, -1); j >= 0; j = nextAlongStrand(rig, j, -1)) {
      if (weight > carried[j]) {
        carried[j] = weight;
        share[j] = depth[j] / depth[i];
      }
    }
  }
  const indices = activeList.filter((i) => carried[i] > 0);
  // The lock bends from the root of the strand under the brush centre.
  let centre = -1;
  for (const i of indices) if (centre < 0 || direct[i] > direct[centre]) centre = i;
  const rootNode = centre >= 0 ? rig.root[centre] : -1;
  const pivot = rootNode >= 0
    ? { x: R[rootNode * 2], y: R[rootNode * 2 + 1] }
    : { x, y: Math.min(y, rig.crown) };
  const grab = {
    indices,
    weights: Float32Array.from(indices, (i) => carried[i]),
    direct: Float32Array.from(indices, (i) => direct[i]),
    share: Float32Array.from(indices, (i) => share[i]),
    startR: new Float32Array(indices.length * 2),
    startP: new Float32Array(indices.length * 2),
    goal: new Float32Array(indices.length * 2),
    origin: { x, y },
    pivot,
    center: rig.center,
    minRadius: rig.cell * 2,
  };
  indices.forEach((i, k) => {
    for (let c = 0; c < 2; c += 1) {
      grab.startR[k * 2 + c] = R[i * 2 + c];
      grab.startP[k * 2 + c] = R[i * 2 + c] + o[i * 2 + c];
      grab.goal[k * 2 + c] = grab.startP[k * 2 + c];
    }
  });
  return grab;
}

/**
 * Where the grabbed hair goes when the hand moves by (dx, dy), the way a held
 * lock behaves: below the hand it hangs and follows the hand; between the
 * root and the hand the strand bends in a smooth curve. Hair cannot stretch,
 * and pushing it toward its root makes it bunch up and bow away from the
 * head instead of sliding into itself.
 */
function follow(grab, start, dx, dy, out) {
  const { pivot, origin, center } = grab;
  let tx = origin.x - pivot.x;
  let ty = origin.y - pivot.y;
  const length = Math.hypot(tx, ty);
  if (length < grab.minRadius) {
    grab.indices.forEach((_, k) => {
      out[k * 2] = start[k * 2] + dx * grab.share[k];
      out[k * 2 + 1] = start[k * 2 + 1] + dy * grab.share[k];
    });
    return;
  }
  tx /= length;
  ty /= length;
  const along = dx * tx + dy * ty;
  // A lock can only swing out about as far as it is long: short hair moves a
  // little, long hair a lot.
  const sideways = Math.hypot(dx - along * tx, dy - along * ty);
  const reach = length * 0.45;
  const swing = sideways > 1e-6 ? (reach * Math.tanh(sideways / reach)) / sideways : 0;
  const acrossX = (dx - along * tx) * swing;
  const acrossY = (dy - along * ty) * swing;
  const pushed = clamp(-along, 0, length * 0.5);
  const alongMove = clamp(along, 0, length * 0.03) - pushed;
  // Bow outward, away from the head, keeping the strand's length about the
  // same: a half-sine bump of this height adds back what the push took.
  let nx = -ty;
  let ny = tx;
  if ((origin.x - center.x) * nx + (origin.y - center.y) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const bow = (2 / Math.PI) * Math.sqrt(length * pushed);
  grab.indices.forEach((_, k) => {
    // Sideways, the strand curves away from its root (eased); along it, the
    // push spreads evenly so no stretch of the strand is crushed.
    const share = grab.share[k];
    const ease = share < 1 ? share ** 1.6 : 1;
    const lift = share < 1 ? bow * Math.sin(Math.PI * share) : 0;
    out[k * 2] = start[k * 2] + acrossX * ease + alongMove * tx * share + nx * lift;
    out[k * 2 + 1] = start[k * 2 + 1] + acrossY * ease + alongMove * ty * share + ny * lift;
  });
}

/** Flick: aim the shown hair (not its styled rest) for a hand moved by (dx, dy). */
export function aimHair(grab, dx, dy) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) throw new RangeError('Drag must be finite.');
  follow(grab, grab.startP, dx, dy, grab.goal);
}

/**
 * Comb: move a grabbed lock by the total drag (dx, dy) since grabHair. Strand
 * spacing is preserved and the crown stays put, so the lock bends from its
 * roots and hangs from the hand. Returns whether the styled rest shape changed.
 */
export function combHair(rig, grab, dx, dy, strength = 0.5) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) throw new RangeError('Drag must be finite.');
  if (!grab.indices.length) return false;
  const pull = 0.35 + 0.65 * clamp(strength, 0, 1);
  const before = new Float32Array(rig.R);
  const { R } = rig;
  const target = new Float32Array(grab.indices.length * 2);
  follow(grab, grab.startR, dx, dy, target);
  for (let iteration = 0; iteration < 16; iteration += 1) {
    grab.indices.forEach((i, k) => {
      const w = Math.min(1, grab.weights[k] * pull) * 0.7;
      R[i * 2] += (target[k * 2] - R[i * 2]) * w;
      R[i * 2 + 1] += (target[k * 2 + 1] - R[i * 2 + 1]) * w;
    });
    solveEdges(rig, 1);
    solveAnchors(rig, 0.6);
  }
  keepLength(rig, rig.R);
  return shiftOffsets(rig, before);
}

/** Lift hair away from (amount > 0) or toward (amount < 0) the head. */
export function pushVolume(rig, x, y, radius, amount) {
  if (![x, y, radius, amount].every(Number.isFinite) || radius <= 0) {
    throw new RangeError('Brush position, positive radius, and amount must be finite.');
  }
  const { activeList, R, o, center } = rig;
  const before = new Float32Array(R);
  let touched = false;
  for (const i of activeList) {
    const weight = falloff(Math.hypot(R[i * 2] + o[i * 2] - x, R[i * 2 + 1] + o[i * 2 + 1] - y), radius);
    if (!weight) continue;
    // Volume is mostly width: favour sideways over up and down.
    const ox = R[i * 2] - center.x;
    const oy = (R[i * 2 + 1] - center.y) * 0.5;
    const length = Math.hypot(ox, oy);
    if (length < 1) continue;
    R[i * 2] += (ox / length) * amount * weight;
    R[i * 2 + 1] += (oy / length) * amount * weight;
    touched = true;
  }
  if (!touched) return false;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    solveEdges(rig, 0.3);
    solveAnchors(rig, 0.25);
  }
  keepLength(rig, rig.R);
  return shiftOffsets(rig, before);
}

/**
 * Advance the motion by HAIR_STEP_SECONDS. `hold` (a grab) keeps combed hair
 * under the pointer; `pull` (a grab aimed with aimHair) drags hair without
 * restyling it; `wind` is the breeze amplitude in pixels at the tips.
 * Returns the largest remaining movement, in pixels.
 */
export function stepHair(rig, { time = 0, wind = 0, hold = null, pull = null } = {}) {
  const { activeList, o, oPrev, follow, s, R, R0, edges, edgeStiff } = rig;
  const limit = Math.max(rig.width, rig.height) * 0.25;
  for (const i of activeList) {
    const x = i * 2;
    const y = x + 1;
    const vx = (o[x] - oPrev[x]) * DAMPING;
    const vy = (o[y] - oPrev[y]) * DAMPING;
    oPrev[x] = o[x];
    oPrev[y] = o[y];
    o[x] += vx;
    o[y] += vy;
    let tx = 0, ty = 0;
    if (wind) {
      // Gusts travel down the strands; tips sway most.
      const sway = wind * s[i] ** 1.5;
      tx = sway * (0.65 * Math.sin(time * 1.7 - R0[y] * 0.011) + 0.35 * Math.sin(time * 2.9 + R0[x] * 0.013 - R0[y] * 0.019));
      ty = sway * 0.18 * Math.sin(time * 2.3 + R0[x] * 0.017);
    }
    o[x] += (tx - o[x]) * follow[i];
    o[y] += (ty - o[y]) * follow[i];
  }
  // Neighbouring nodes move together, most strongly along a strand.
  for (let e = 0; e < edgeStiff.length; e += 1) {
    const i = edges[e * 2] * 2;
    const j = edges[e * 2 + 1] * 2;
    const c = edgeStiff[e] * COUPLING;
    const dx = (o[j] - o[i]) * c;
    const dy = (o[j + 1] - o[i + 1]) * c;
    o[i] += dx;
    o[i + 1] += dy;
    o[j] -= dx;
    o[j + 1] -= dy;
  }
  if (hold) {
    hold.indices.forEach((i, k) => {
      // Only hair under the hand is held; the rest trails behind and swings.
      const keep = 1 - Math.min(1, hold.direct[k] * 0.85);
      o[i * 2] *= keep;
      o[i * 2 + 1] *= keep;
    });
  }
  if (pull) {
    pull.indices.forEach((i, k) => {
      const w = Math.min(1, pull.weights[k]) * 0.6;
      o[i * 2] += (pull.goal[k * 2] - R[i * 2] - o[i * 2]) * w;
      o[i * 2 + 1] += (pull.goal[k * 2 + 1] - R[i * 2 + 1] - o[i * 2 + 1]) * w;
    });
  }
  keepLength(rig, o, R);
  let motion = 0;
  for (const i of activeList) {
    const x = i * 2;
    const length = Math.hypot(o[x], o[x + 1]);
    if (length > limit) {
      o[x] *= limit / length;
      o[x + 1] *= limit / length;
    }
    motion = Math.max(motion, Math.abs(o[x] - oPrev[x]) + Math.abs(o[x + 1] - oPrev[x + 1]));
    if (!wind) motion = Math.max(motion, Math.abs(o[x]) + Math.abs(o[x + 1]));
  }
  return motion;
}

/** Stop all motion so the hair sits exactly on its styled rest shape. */
export function settleHair(rig) {
  rig.o.fill(0);
  rig.oPrev.fill(0);
}

/** Displacement per node from the original photo: shown position minus grid. */
export function hairField(rig, out = new Float32Array(rig.n * 2), { dynamic = true } = {}) {
  out.fill(0);
  for (const i of rig.activeList) {
    for (let c = i * 2; c <= i * 2 + 1; c += 1) {
      out[c] = rig.R[c] - rig.R0[c] + (dynamic ? rig.o[c] : 0);
    }
  }
  return out;
}

export function restChanged(rig, tolerance = 0.5) {
  for (const i of rig.activeList) {
    if (Math.abs(rig.R[i * 2] - rig.R0[i * 2]) > tolerance
      || Math.abs(rig.R[i * 2 + 1] - rig.R0[i * 2 + 1]) > tolerance) return true;
  }
  return false;
}

/** Replace the styled rest shape; with `animate`, hair swings to it. */
export function setRest(rig, rest, animate = true) {
  if (!(rest instanceof Float32Array) || rest.length !== rig.R.length) {
    throw new RangeError('Rest shape length must match the rig.');
  }
  const before = new Float32Array(rig.R);
  for (const i of rig.activeList) {
    rig.R[i * 2] = rest[i * 2];
    rig.R[i * 2 + 1] = rest[i * 2 + 1];
  }
  if (animate) shiftOffsets(rig, before);
  else settleHair(rig);
}

/** Carry styling and motion over to a rig rebuilt from an edited mask. */
export function transferRest(from, to) {
  if (from.gw !== to.gw || from.gh !== to.gh || from.cell !== to.cell) return;
  for (const i of to.activeList) {
    if (!from.active[i]) continue;
    for (let c = i * 2; c <= i * 2 + 1; c += 1) {
      to.R[c] = from.R[c];
      to.o[c] = from.o[c];
      to.oPrev[c] = from.oPrev[c];
    }
  }
}

/**
 * Estimate what is behind the hair by filling it in from the surrounding
 * pixels (push-pull). Shown only where hair moves away from its original spot.
 */
export function inpaintHair(image, mask) {
  validateImage(image);
  validateMask(mask, image.width, image.height);
  const { width, height, data } = image;
  const soft = softenMask(mask, width, height);
  const levels = [];
  let w = width, h = height;
  let color = new Float32Array(w * h * 3);
  let weight = new Float32Array(w * h);
  for (let p = 0; p < w * h; p += 1) {
    weight[p] = 1 - smoothstep(0.05, 0.3, Math.max(mask[p], Math.min(1, soft[p] * HALO)));
    color[p * 3] = data[p * 4];
    color[p * 3 + 1] = data[p * 4 + 1];
    color[p * 3 + 2] = data[p * 4 + 2];
  }
  levels.push({ w, h, color, weight });
  while (w > 1 || h > 1) {
    const nw = Math.ceil(w / 2);
    const nh = Math.ceil(h / 2);
    const nextColor = new Float32Array(nw * nh * 3);
    const nextWeight = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y += 1) {
      for (let x = 0; x < nw; x += 1) {
        let total = 0, r = 0, g = 0, b = 0;
        for (let oy = 0; oy < 2; oy += 1) {
          for (let ox = 0; ox < 2; ox += 1) {
            const fx = x * 2 + ox;
            const fy = y * 2 + oy;
            if (fx >= w || fy >= h) continue;
            const f = fy * w + fx;
            const k = weight[f];
            total += k;
            r += color[f * 3] * k;
            g += color[f * 3 + 1] * k;
            b += color[f * 3 + 2] * k;
          }
        }
        const q = y * nw + x;
        nextWeight[q] = Math.min(1, total);
        if (total > 0) {
          nextColor[q * 3] = r / total;
          nextColor[q * 3 + 1] = g / total;
          nextColor[q * 3 + 2] = b / total;
        }
      }
    }
    w = nw;
    h = nh;
    color = nextColor;
    weight = nextWeight;
    levels.push({ w, h, color, weight });
  }
  for (let level = levels.length - 2; level >= 0; level -= 1) {
    const fine = levels[level];
    const coarse = levels[level + 1];
    for (let y = 0; y < fine.h; y += 1) {
      const cy = clamp((y + 0.5) / 2 - 0.5, 0, coarse.h - 1);
      const y0 = Math.floor(cy);
      const y1 = Math.min(y0 + 1, coarse.h - 1);
      const ty = cy - y0;
      for (let x = 0; x < fine.w; x += 1) {
        const cx = clamp((x + 0.5) / 2 - 0.5, 0, coarse.w - 1);
        const x0 = Math.floor(cx);
        const x1 = Math.min(x0 + 1, coarse.w - 1);
        const tx = cx - x0;
        const f = y * fine.w + x;
        const known = fine.weight[f];
        for (let c = 0; c < 3; c += 1) {
          const up = (coarse.color[(y0 * coarse.w + x0) * 3 + c] * (1 - tx) + coarse.color[(y0 * coarse.w + x1) * 3 + c] * tx) * (1 - ty)
            + (coarse.color[(y1 * coarse.w + x0) * 3 + c] * (1 - tx) + coarse.color[(y1 * coarse.w + x1) * 3 + c] * tx) * ty;
          fine.color[f * 3 + c] = fine.color[f * 3 + c] * known + up * (1 - known);
        }
      }
    }
  }
  const plate = new Uint8ClampedArray(width * height * 4);
  const filled = levels[0].color;
  for (let p = 0; p < width * height; p += 1) {
    plate[p * 4] = filled[p * 3];
    plate[p * 4 + 1] = filled[p * 3 + 1];
    plate[p * 4 + 2] = filled[p * 3 + 2];
    plate[p * 4 + 3] = data[p * 4 + 3];
  }
  return plate;
}

function sampleField(field, rig, x, y, out) {
  const { gw, gh, cell } = rig;
  const fx = clamp(x / cell, 0, gw - 1);
  const fy = clamp(y / cell, 0, gh - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, gw - 1);
  const y1 = Math.min(y0 + 1, gh - 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const a = (y0 * gw + x0) * 2, b = (y0 * gw + x1) * 2, c = (y1 * gw + x0) * 2, d = (y1 * gw + x1) * 2;
  out[0] = (field[a] * (1 - tx) + field[b] * tx) * (1 - ty) + (field[c] * (1 - tx) + field[d] * tx) * ty;
  out[1] = (field[a + 1] * (1 - tx) + field[b + 1] * tx) * (1 - ty) + (field[c + 1] * (1 - tx) + field[d + 1] * tx) * ty;
}

// Movement below a quarter pixel leaves the photo untouched.
const movedAmount = (shift) => smoothstep(0.25, 1, shift);

/** Cells of extra mesh around the photo, where cut-off hair continues. */
export const MESH_MARGIN = 10;

/**
 * Mesh over the rig grid plus a margin. Where hair is cut off by the photo
 * edge it continues beyond it as a mirror image, so it can be pulled into
 * view instead of smearing the edge pixels. Where no hair reaches the edge,
 * the margin stays empty.
 */
export function createHairMesh(rig, mask) {
  const { gw, gh, cell, width, height } = rig;
  const mw = gw + MESH_MARGIN * 2;
  const mh = gh + MESH_MARGIN * 2;
  const count = mw * mh;
  const mirror = (v, max) => {
    const m = Math.abs(v);
    return m > max ? Math.max(0, 2 * max - m) : m;
  };
  const mesh = {
    mw, mh, count,
    node: new Int32Array(count),
    rest: new Float32Array(count * 2),
    uv: new Float32Array(count * 2),
    position: new Float32Array(count * 2),
    moved: new Float32Array(count),
    shift: new Float32Array(count),
    keep: new Float32Array(count),
    indices: new Uint32Array((mw - 1) * (mh - 1) * 6),
  };
  for (let my = 0; my < mh; my += 1) {
    for (let mx = 0; mx < mw; mx += 1) {
      const v = my * mw + mx;
      const gx = mx - MESH_MARGIN;
      const gy = my - MESH_MARGIN;
      mesh.node[v] = clamp(gy, 0, gh - 1) * gw + clamp(gx, 0, gw - 1);
      mesh.rest[v * 2] = gx * cell;
      mesh.rest[v * 2 + 1] = gy * cell;
      mesh.uv[v * 2] = mirror(gx * cell, width - 1);
      mesh.uv[v * 2 + 1] = mirror(gy * cell, height - 1);
      const inside = gx * cell <= width - 1 && gy * cell <= height - 1 && gx >= 0 && gy >= 0;
      if (inside) {
        mesh.keep[v] = 1;
        continue;
      }
      // Outside the photo: only as much hair as touches the nearest edge.
      const ex = clamp(gx * cell, 0, width - 1);
      const ey = clamp(gy * cell, 0, height - 1);
      let edge = 0;
      for (let o = -cell; o <= cell; o += 1) {
        const sx = clamp(Math.round(ex + (ey === 0 || ey === height - 1 ? o : 0)), 0, width - 1);
        const sy = clamp(Math.round(ey + (ex === 0 || ex === width - 1 ? o : 0)), 0, height - 1);
        edge = Math.max(edge, mask[sy * width + sx]);
      }
      mesh.keep[v] = edge;
    }
  }
  return mesh;
}

/**
 * Place the mesh for a field, moved `share` of the way (the under layer moves
 * less). Returns triangle indices for the cells that moved, least moved
 * first, so a lifted lock is drawn over the hair it passes.
 */
export function updateHairMesh(mesh, field, share = 1) {
  const { mw, mh, node, rest, position, moved, shift, indices } = mesh;
  for (let v = 0; v < mesh.count; v += 1) {
    const dx = field[node[v] * 2];
    const dy = field[node[v] * 2 + 1];
    position[v * 2] = rest[v * 2] + dx * share;
    position[v * 2 + 1] = rest[v * 2 + 1] + dy * share;
    shift[v] = Math.hypot(dx, dy);
    moved[v] = movedAmount(shift[v]);
  }
  const cells = [];
  const keys = [];
  for (let cy = 0; cy < mh - 1; cy += 1) {
    for (let cx = 0; cx < mw - 1; cx += 1) {
      const v = cy * mw + cx;
      const key = Math.max(shift[v], shift[v + 1], shift[v + mw], shift[v + mw + 1]);
      if (key < 0.25) continue;
      keys[cells.length] = key;
      cells.push(v);
    }
  }
  const order = cells.map((_, k) => k).sort((a, b) => keys[a] - keys[b]);
  let k = 0;
  for (const c of order) {
    const v = cells[c];
    indices[k++] = v; indices[k++] = v + 1; indices[k++] = v + mw + 1;
    indices[k++] = v; indices[k++] = v + mw + 1; indices[k++] = v + mw;
  }
  return indices.subarray(0, k);
}

/** A softened copy of the photo, for the inner hair layer. */
export function blurImage(image, radius = Math.max(1, Math.round(Math.max(image.width, image.height) / 240))) {
  validateImage(image);
  const { width, height, data } = image;
  const channel = new Float32Array(width * height);
  const out = new Uint8ClampedArray(data);
  for (let c = 0; c < 3; c += 1) {
    for (let p = 0; p < channel.length; p += 1) channel[p] = data[p * 4 + c] / 255;
    const soft = softenMask(channel, width, height, radius);
    for (let p = 0; p < channel.length; p += 1) out[p * 4 + c] = soft[p] * 255;
  }
  return out;
}

/** A blurred copy of the hair mask, for soft edges and contact shadows. */
export function softenMask(mask, width, height, radius = Math.max(1, Math.round(Math.max(width, height) / 180))) {
  validateMask(mask, width, height);
  const blur = (source, along) => {
    const result = new Float32Array(source.length);
    const lines = along === 'x' ? height : width;
    const length = along === 'x' ? width : height;
    const at = (line, i) => (along === 'x' ? line * width + i : i * width + line);
    for (let line = 0; line < lines; line += 1) {
      let sum = 0;
      for (let i = -radius; i <= radius; i += 1) sum += source[at(line, clamp(i, 0, length - 1))];
      for (let i = 0; i < length; i += 1) {
        result[at(line, i)] = sum / (radius * 2 + 1);
        sum += source[at(line, Math.min(i + radius + 1, length - 1))] - source[at(line, Math.max(i - radius, 0))];
      }
    }
    return result;
  };
  let soft = mask;
  for (let pass = 0; pass < 2; pass += 1) soft = blur(blur(soft, 'x'), 'y');
  return soft;
}

// Rasterise mesh triangles over `out`, sampling the photo at each vertex's uv.
// `soften` blends toward the blurred mask where hair moved; `shift` offsets
// the whole layer (for the shadow).
function drawMesh(out, image, mask, soft, mesh, triangles, {
  shade = 1, opacity = 1, fade = false, soften = 0, shift = [0, 0], source = image.data, spread = 0, reveal = null,
}) {
  const { width, height } = image;
  const data = source;
  const { position: P, uv: U, moved, keep } = mesh;
  for (let t = 0; t < triangles.length; t += 3) {
    const a = triangles[t], b = triangles[t + 1], c = triangles[t + 2];
    const ax = P[a * 2] + shift[0], ay = P[a * 2 + 1] + shift[1];
    const bx = P[b * 2] + shift[0], by = P[b * 2 + 1] + shift[1];
    const cx = P[c * 2] + shift[0], cy = P[c * 2 + 1] + shift[1];
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-6) continue;
    const startX = Math.max(0, Math.ceil(Math.min(ax, bx, cx)));
    const endX = Math.min(width - 1, Math.floor(Math.max(ax, bx, cx)));
    const startY = Math.max(0, Math.ceil(Math.min(ay, by, cy)));
    const endY = Math.min(height - 1, Math.floor(Math.max(ay, by, cy)));
    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        // A tiny fixed offset puts pixel centres that sit exactly on a shared
        // edge into one triangle only, so no pixel is blended twice.
        const px = x + 1.3e-4, py = y + 2.9e-4;
        const wa = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area;
        const wb = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area;
        const wc = 1 - wa - wb;
        if (wa < 0 || wb < 0 || wc < 0) continue;
        const u = clamp(U[a * 2] * wa + U[b * 2] * wb + U[c * 2] * wc, 0, width - 1);
        const v = clamp(U[a * 2 + 1] * wa + U[b * 2 + 1] * wb + U[c * 2 + 1] * wc, 0, height - 1);
        const x0 = Math.floor(u), y0 = Math.floor(v);
        const x1 = Math.min(x0 + 1, width - 1), y1 = Math.min(y0 + 1, height - 1);
        const tx = u - x0, ty = v - y0;
        const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
        const p00 = y0 * width + x0, p10 = y0 * width + x1, p01 = y1 * width + x0, p11 = y1 * width + x1;
        const movedHere = moved[a] * wa + moved[b] * wb + moved[c] * wc;
        const sharp = mask[p00] * w00 + mask[p10] * w10 + mask[p01] * w01 + mask[p11] * w11;
        const blurred = soft[p00] * w00 + soft[p10] * w10 + soft[p01] * w01 + soft[p11] * w11;
        // `spread` widens the layer a little past the hair (inner hair is fuller).
        const edge = spread ? Math.min(1, blurred * spread) : sharp + (blurred - sharp) * soften * movedHere;
        let alpha = edge * opacity
          * (keep[a] * wa + keep[b] * wb + keep[c] * wc);
        if (fade) alpha *= movedHere;
        if (alpha <= 0) continue;
        if (reveal) reveal[y * width + x] *= 1 - Math.min(1, alpha);
        const p = (y * width + x) * 4;
        for (let ch = 0; ch < 3; ch += 1) {
          const colour = (data[p00 * 4 + ch] * w00 + data[p10 * 4 + ch] * w10 + data[p01 * 4 + ch] * w01 + data[p11 * 4 + ch] * w11) * shade;
          out[p + ch] = out[p + ch] + (colour - out[p + ch]) * alpha;
        }
      }
    }
  }
}

/**
 * Render the photo with hair displaced by `field` (from hairField). This is the
 * reference for the WebGL renderer and is used for export and as a fallback.
 * Layers: the photo with moved hair lifted off (inpainted plate), a shaded
 * under layer that moves part of the way, the moved hair's contact shadow,
 * then the hair itself. Pass `reveal` (one float per pixel) to learn where the
 * moved hair left a stand-in (plate or inner layer) showing, for a real fill.
 */
export function renderHair({ image, mask, plate, field, rig, mesh = null, soft = null, under = null, reveal = null }) {
  validateImage(image);
  const { width, height, data } = image;
  const out = new Uint8ClampedArray(data);
  reveal?.fill(0);
  if (!rig || !rig.activeList.length) return out;
  const { cell, gw } = rig;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const i of rig.activeList) {
    if (Math.hypot(field[i * 2], field[i * 2 + 1]) < 0.25) continue;
    minX = Math.min(minX, (i % gw) * cell);
    maxX = Math.max(maxX, (i % gw) * cell);
    minY = Math.min(minY, Math.floor(i / gw) * cell);
    maxY = Math.max(maxY, Math.floor(i / gw) * cell);
  }
  if (maxX < 0) return out;
  const blurred = soft ?? softenMask(mask, width, height);
  const d = [0, 0];
  for (let y = Math.max(0, minY - cell); y <= Math.min(height - 1, maxY + cell); y += 1) {
    for (let x = Math.max(0, minX - cell); x <= Math.min(width - 1, maxX + cell); x += 1) {
      sampleField(field, rig, x, y, d);
      const p0 = y * width + x;
      const lifted = Math.max(mask[p0], Math.min(1, blurred[p0] * HALO)) * movedAmount(Math.hypot(d[0], d[1]));
      if (!lifted) continue;
      if (reveal) reveal[p0] = lifted;
      const p = (y * width + x) * 4;
      for (let c = 0; c < 3; c += 1) out[p + c] = data[p + c] + (plate[p + c] - data[p + c]) * lifted;
    }
  }
  const grid = mesh ?? createHairMesh(rig, mask);
  drawMesh(out, image, mask, blurred, grid, updateHairMesh(grid, field, UNDER_LAYER.follow), {
    shade: UNDER_LAYER.shade,
    opacity: UNDER_LAYER.opacity,
    fade: true,
    spread: UNDER_LAYER.spread,
    source: under ?? blurImage(image),
  });
  const top = updateHairMesh(grid, field, 1);
  const offset = Math.max(width, height) * CONTACT.offset;
  drawMesh(out, image, mask, blurred, grid, top, {
    shade: 0,
    opacity: CONTACT.shadow,
    fade: true,
    soften: 1,
    shift: [offset, offset * 1.4],
  });
  drawMesh(out, image, mask, blurred, grid, top, { soften: CONTACT.soften, reveal });
  return out;
}
