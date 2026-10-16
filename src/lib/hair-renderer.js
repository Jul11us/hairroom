// Draws the photo with moved hair on the GPU, 60 frames a second. The layers
// mirror renderHair() in hair-physics.js, which stays the reference and the
// fallback when WebGL2 is unavailable:
//   1. the photo, with hair that moved away replaced by the inpainted plate;
//   2. a shaded under layer of hair that follows part of the way;
//   3. the moved hair's soft contact shadow;
//   4. the hair itself, as a mesh warp of the original photo.
import { CONTACT, HALO, UNDER_LAYER, updateHairMesh } from './hair-physics.js';

const BASE_VERTEX = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = vec2(aPosition.x * 0.5 + 0.5, 0.5 - aPosition.y * 0.5);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const BASE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uImage;
uniform sampler2D uPlate;
uniform sampler2D uMask;
uniform sampler2D uSoft;
uniform sampler2D uField;
uniform vec2 uSize;
uniform vec2 uGrid;
uniform float uCell;
uniform bool uOriginal;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 original = texture(uImage, vUv);
  if (uOriginal) {
    outColor = original;
    return;
  }
  vec2 g = clamp((vUv * uSize - 0.5) / uCell, vec2(0.0), uGrid - 1.0);
  float shift = length(texture(uField, (g + 0.5) / uGrid).xy);
  float reach = max(texture(uMask, vUv).r, min(1.0, texture(uSoft, vUv).r * ${HALO.toFixed(2)}));
  float lifted = reach * smoothstep(0.25, 1.0, shift);
  outColor = mix(original, texture(uPlate, vUv), lifted);
}`;

const MESH_VERTEX = `#version 300 es
in vec2 aPosition;
in vec2 aUv;
in float aMoved;
in float aKeep;
uniform vec2 uSize;
uniform vec2 uShift;
out vec2 vUv;
out float vMoved;
out float vKeep;
void main() {
  vec2 clip = (aPosition + uShift + 0.5) / uSize * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vUv = (aUv + 0.5) / uSize;
  vMoved = aMoved;
  vKeep = aKeep;
}`;

const MESH_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uImage;
uniform sampler2D uUnder;
uniform sampler2D uMask;
uniform sampler2D uSoft;
uniform bool uUseUnder;
uniform float uShade;
uniform float uOpacity;
uniform float uSoften;
uniform float uSpread;
uniform bool uFade;
in vec2 vUv;
in float vMoved;
in float vKeep;
out vec4 outColor;
void main() {
  float edge = uSpread > 0.0
    ? min(1.0, texture(uSoft, vUv).r * uSpread)
    : mix(texture(uMask, vUv).r, texture(uSoft, vUv).r, uSoften * vMoved);
  float alpha = edge * uOpacity * vKeep * (uFade ? vMoved : 1.0);
  vec3 colour = uUseUnder ? texture(uUnder, vUv).rgb : texture(uImage, vUv).rgb;
  outColor = vec4(colour * uShade, alpha);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

function link(gl, vertexSource, fragmentSource) {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  gl.deleteProgram(program);
  return null;
}

function uniformsOf(gl, program, names) {
  return Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)]));
}

/** Returns null when WebGL2 is unavailable, so the caller can fall back. */
export function createHairRenderer(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
  });
  if (!gl || gl.isContextLost()) return null;
  const baseProgram = link(gl, BASE_VERTEX, BASE_FRAGMENT);
  const meshProgram = link(gl, MESH_VERTEX, MESH_FRAGMENT);
  if (!baseProgram || !meshProgram) return null;
  const base = uniformsOf(gl, baseProgram, ['uImage', 'uPlate', 'uMask', 'uSoft', 'uField', 'uSize', 'uGrid', 'uCell', 'uOriginal']);
  const meshUniforms = uniformsOf(gl, meshProgram, ['uImage', 'uUnder', 'uUseUnder', 'uMask', 'uSoft', 'uSize', 'uShift', 'uShade', 'uOpacity', 'uSoften', 'uSpread', 'uFade']);

  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const quadVao = gl.createVertexArray();
  gl.bindVertexArray(quadVao);
  const quadPosition = gl.getAttribLocation(baseProgram, 'aPosition');
  gl.enableVertexAttribArray(quadPosition);
  gl.vertexAttribPointer(quadPosition, 2, gl.FLOAT, false, 0, 0);

  const meshVao = gl.createVertexArray();
  const buffers = {
    position: gl.createBuffer(),
    uv: gl.createBuffer(),
    moved: gl.createBuffer(),
    keep: gl.createBuffer(),
    index: gl.createBuffer(),
  };
  gl.bindVertexArray(meshVao);
  [['aPosition', buffers.position, 2], ['aUv', buffers.uv, 2], ['aMoved', buffers.moved, 1], ['aKeep', buffers.keep, 1]]
    .forEach(([name, buffer, size]) => {
      const location = gl.getAttribLocation(meshProgram, name);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    });
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index);
  gl.bindVertexArray(null);

  const textures = {
    image: gl.createTexture(),
    plate: gl.createTexture(),
    mask: gl.createTexture(),
    field: gl.createTexture(),
    soft: gl.createTexture(),
    under: gl.createTexture(),
  };
  const state = { width: 0, height: 0, gw: 0, gh: 0, cell: 1, mesh: null };

  function upload(texture, unit, internalFormat, width, height, format, type, pixels) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, pixels);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  function bindTextures() {
    [textures.image, textures.plate, textures.mask, textures.field, textures.soft, textures.under].forEach((texture, unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
    });
  }

  function drawLayer(field, share, { shade = 1, opacity = 1, fade = false, soften = 0, shift = [0, 0], reuse = false, under = false, spread = 0 }) {
    const mesh = state.mesh;
    const triangles = reuse ? state.triangles : updateHairMesh(mesh, field, share);
    state.triangles = triangles;
    if (!triangles.length) return;
    gl.bindVertexArray(meshVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.position);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.moved);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.moved);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, triangles, gl.DYNAMIC_DRAW);
    gl.uniform1f(meshUniforms.uShade, shade);
    gl.uniform1f(meshUniforms.uOpacity, opacity);
    gl.uniform1f(meshUniforms.uSoften, soften);
    gl.uniform2f(meshUniforms.uShift, shift[0], shift[1]);
    gl.uniform1i(meshUniforms.uFade, fade ? 1 : 0);
    gl.uniform1i(meshUniforms.uUseUnder, under ? 1 : 0);
    gl.uniform1f(meshUniforms.uSpread, spread);
    gl.drawElements(gl.TRIANGLES, triangles.length, gl.UNSIGNED_INT, 0);
  }

  return {
    /** The photo and its softened copy (blurImage) for the inner hair layer. */
    setImage({ width, height, data }, under) {
      state.width = width;
      state.height = height;
      upload(textures.image, 0, gl.RGBA8, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
      upload(textures.under, 5, gl.RGBA8, width, height, gl.RGBA, gl.UNSIGNED_BYTE, under);
    },
    setPlate(plate) {
      upload(textures.plate, 1, gl.RGBA8, state.width, state.height, gl.RGBA, gl.UNSIGNED_BYTE, plate);
    },
    /** The hair mask and its blurred copy (softenMask). */
    setMask(mask, soft) {
      const bytes = (values) => Uint8Array.from(values, (v) => Math.round(v * 255));
      upload(textures.mask, 2, gl.R8, state.width, state.height, gl.RED, gl.UNSIGNED_BYTE, bytes(mask));
      upload(textures.soft, 4, gl.R8, state.width, state.height, gl.RED, gl.UNSIGNED_BYTE, bytes(soft));
    },
    /** Use a mesh from createHairMesh(rig, mask) for the rig being drawn. */
    setMesh(rig, mesh) {
      Object.assign(state, { gw: rig.gw, gh: rig.gh, cell: rig.cell, mesh });
      upload(textures.field, 3, gl.RG16F, rig.gw, rig.gh, gl.RG, gl.FLOAT, new Float32Array(rig.gw * rig.gh * 2));
      gl.bindVertexArray(meshVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.position.byteLength, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.moved);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.moved.byteLength, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.uv);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.uv, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.keep);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.keep, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
    },
    render(field, original = false) {
      if (gl.isContextLost() || !state.width) return;
      const showOriginal = original || !field || !state.mesh;
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.disable(gl.BLEND);
      if (!showOriginal) {
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, textures.field);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, state.gw, state.gh, gl.RG, gl.FLOAT, field);
      }
      bindTextures();
      gl.useProgram(baseProgram);
      gl.bindVertexArray(quadVao);
      gl.uniform1i(base.uImage, 0);
      gl.uniform1i(base.uPlate, 1);
      gl.uniform1i(base.uMask, 2);
      gl.uniform1i(base.uField, 3);
      gl.uniform1i(base.uSoft, 4);
      gl.uniform2f(base.uSize, state.width, state.height);
      gl.uniform2f(base.uGrid, Math.max(1, state.gw), Math.max(1, state.gh));
      gl.uniform1f(base.uCell, state.cell);
      gl.uniform1i(base.uOriginal, showOriginal ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (showOriginal) return;

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(meshProgram);
      gl.uniform1i(meshUniforms.uImage, 0);
      gl.uniform1i(meshUniforms.uMask, 2);
      gl.uniform1i(meshUniforms.uSoft, 4);
      gl.uniform1i(meshUniforms.uUnder, 5);
      gl.uniform2f(meshUniforms.uSize, state.width, state.height);
      drawLayer(field, UNDER_LAYER.follow, {
        shade: UNDER_LAYER.shade,
        opacity: UNDER_LAYER.opacity,
        fade: true,
        under: true,
        spread: UNDER_LAYER.spread,
      });
      const offset = Math.max(state.width, state.height) * CONTACT.offset;
      drawLayer(field, 1, { shade: 0, opacity: CONTACT.shadow, fade: true, soften: 1, shift: [offset, offset * 1.4] });
      drawLayer(field, 1, { soften: CONTACT.soften, reuse: true });
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    },
    // The context is kept (not lost) so a remount can reuse the same canvas.
    dispose() {
      Object.values(textures).forEach((texture) => gl.deleteTexture(texture));
      Object.values(buffers).forEach((buffer) => gl.deleteBuffer(buffer));
      gl.deleteBuffer(quadBuffer);
      gl.deleteVertexArray(quadVao);
      gl.deleteVertexArray(meshVao);
      gl.deleteProgram(baseProgram);
      gl.deleteProgram(meshProgram);
    },
  };
}
