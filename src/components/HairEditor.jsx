import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronDown,
  Eraser,
  Eye,
  Expand,
  Hand,
  LoaderCircle,
  Minimize2,
  Move,
  Palette,
  Paintbrush,
  Redo2,
  RotateCcw,
  ShieldCheck,
  Undo2,
  Sparkles,
  Waves,
  Wind,
} from "lucide-react";
import { segmentHair } from "../lib/hair-segmentation.js";
import { paintHairMask } from "../lib/hair-warp.js";
import {
  HAIR_STEP_SECONDS,
  aimHair,
  combHair,
  createHairMesh,
  blurImage,
  createHairRig,
  softenMask,
  grabHair,
  hairField,
  inpaintHair,
  pushVolume,
  renderHair,
  restChanged,
  setRest,
  settleHair,
  stepHair,
  transferRest,
} from "../lib/hair-physics.js";
import { createHairRenderer } from "../lib/hair-renderer.js";
import {
  colorHair,
  DEFAULT_HAIR_COLOR,
  HAIR_COLORS,
  hairColorName,
  hasHairColor,
} from "../lib/hair-color.js";
import { readHairEditorState, sameHairEditorState } from "../lib/hair-editor-state.js";
import "./hair-editor.css";

const TOOLS = [
  {
    id: "comb",
    name: "梳理造型",
    short: "抓住一缕头发拖动，松手后保持新造型",
    icon: Move,
  },
  {
    id: "flick",
    name: "拨一拨",
    short: "拖动后松手，头发会弹回并自然摆动",
    icon: Waves,
  },
  {
    id: "inflate",
    name: "局部蓬松",
    short: "在发根或轮廓上拖动，让头发离开头皮一点",
    icon: Expand,
  },
  {
    id: "deflate",
    name: "收拢轮廓",
    short: "在蓬起的位置拖动，让头发贴近一点",
    icon: Minimize2,
  },
];
// Breeze amplitude at the tips, in pixels for a 720 px photo.
const BREEZE = 14;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("照片读取失败，请关闭后重试。"));
    image.src = src;
  });
}

// Pixels where the guessed fill still shows; below this they are left alone.
const FILL_THRESHOLD = 0.08;

function pixelsToDataUrl(pixels, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").putImageData(new ImageData(pixels, width, height), 0, 0);
  return canvas.toDataURL("image/png");
}

// Keep a flicked lock within reach of its roots: the pull eases off smoothly.
function soften(dx, dy, reach) {
  const length = Math.hypot(dx, dy);
  if (!length) return [0, 0];
  const eased = reach * Math.tanh(length / reach);
  return [(dx / length) * eased, (dy / length) * eased];
}

export default function HairEditor({
  imageSrc,
  sourcePanel,
  sourceLabel,
  initialState,
  onSave,
  onDirtyChange,
}) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const cursorRef = useRef(null);
  const stageRef = useRef(null);
  const originalRef = useRef(null);
  const colorRef = useRef({ ...DEFAULT_HAIR_COLOR });
  const colorImageRef = useRef(null);
  const colorUnderRef = useRef(null);
  const uploadedImageRef = useRef(null);
  const colorGestureRef = useRef(null);
  const baselineRef = useRef(null);
  const maskRef = useRef(null);
  const rigRef = useRef(null);
  const plateRef = useRef(null);
  const fieldRef = useRef(null);
  const meshRef = useRef(null);
  const fillCanvasRef = useRef(null);
  // AI fill: `key` names the hairstyle a patch belongs to; any change of the
  // styled shape or the selection bumps it and the old patch no longer fits.
  const fillRef = useRef({ key: 0, patch: null, shown: false, timer: 0, abort: null });
  const fillEnabledRef = useRef(false);
  const softRef = useRef(null);
  const underRef = useRef(null);
  const rendererRef = useRef(null);
  const context2dRef = useRef(null);
  const undoRef = useRef([]);
  const redoRef = useRef([]);
  const strokeRef = useRef(null);
  const frameRef = useRef(0);
  const lastTickRef = useRef(0);
  const clockRef = useRef(0);
  const windRef = useRef(false);
  const comparingRef = useRef(false);
  const disposedRef = useRef(false);
  const segmentationSeqRef = useRef(0);
  const [tool, setTool] = useState("comb");
  const [brushSize, setBrushSize] = useState(76);
  const [strength, setStrength] = useState(50);
  const [wind, setWind] = useState(false);
  const [fillAvailable, setFillAvailable] = useState(false);
  const [aiFill, setAiFill] = useState(true);
  const [fillState, setFillState] = useState("idle");
  const [maskVisible, setMaskVisible] = useState(false);
  const [maskExpanded, setMaskExpanded] = useState(false);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("正在读取照片…");
  const [revision, setRevision] = useState(0);
  const [comparing, setComparing] = useState(false);
  const [coverage, setCoverage] = useState(0);
  const [changed, setChanged] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [color, setColor] = useState({ ...DEFAULT_HAIR_COLOR });
  const paintMode = tool === "add" || tool === "erase";
  const ready = !!originalRef.current && status !== "loading";
  comparingRef.current = comparing;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // Draw the current frame: GPU when available, otherwise the CPU reference.
  const paint = useCallback(() => {
    const original = originalRef.current;
    if (!original) return;
    const rig = rigRef.current;
    const showOriginal = comparingRef.current || !rig;
    const field = rig ? hairField(rig, fieldRef.current) : null;
    const edited = colorImageRef.current ?? original;
    if (rendererRef.current) {
      const texture = showOriginal ? original : edited;
      if (uploadedImageRef.current !== texture) {
        rendererRef.current.setImage(texture, showOriginal ? underRef.current : colorUnderRef.current);
        uploadedImageRef.current = texture;
      }
      rendererRef.current.render(field, showOriginal);
      return;
    }
    const pixels = showOriginal
      ? original.data
      : renderHair({
          image: edited,
          mask: maskRef.current,
          plate: plateRef.current,
          field,
          rig,
          mesh: meshRef.current,
          soft: softRef.current,
          under: colorUnderRef.current,
        });
    context2dRef.current?.putImageData(
      new ImageData(pixels, original.width, original.height),
      0,
      0,
    );
  }, []);

  const drawOverlay = useCallback(() => {
    const overlay = overlayRef.current,
      original = originalRef.current,
      mask = maskRef.current;
    if (!overlay || !original || !mask) return;
    const { width, height } = original;
    const context = overlay.getContext("2d");
    context.clearRect(0, 0, width, height);
    if ((maskVisible || paintMode) && !comparing) {
      const pixels = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < mask.length; i++) {
        pixels[i * 4] = 176;
        pixels[i * 4 + 1] = 208;
        pixels[i * 4 + 2] = 103;
        pixels[i * 4 + 3] = Math.round(mask[i] * 120);
      }
      context.putImageData(new ImageData(pixels, width, height), 0, 0);
    }
  }, [comparing, maskVisible, paintMode]);
  const drawOverlayRef = useRef(drawOverlay);
  drawOverlayRef.current = drawOverlay;

  // The simulation runs only while something moves, then sleeps.
  const tick = useCallback(
    (now) => {
      frameRef.current = 0;
      const rig = rigRef.current;
      if (!rig || disposedRef.current) return;
      const elapsed = lastTickRef.current
        ? Math.min(0.05, (now - lastTickRef.current) / 1000)
        : 1 / 60;
      lastTickRef.current = now;
      const stroke = strokeRef.current;
      const breeze = windRef.current
        ? (BREEZE * Math.max(rig.width, rig.height)) / 720
        : 0;
      let motion = 0;
      for (
        let step = 0;
        step < Math.max(1, Math.round(elapsed / HAIR_STEP_SECONDS));
        step++
      ) {
        clockRef.current += HAIR_STEP_SECONDS;
        motion = stepHair(rig, {
          time: clockRef.current,
          wind: breeze,
          hold: stroke?.mode === "comb" ? stroke.grab : null,
          pull: stroke?.mode === "flick" ? stroke.grab : null,
        });
      }
      const moving = breeze > 0 || !!stroke || motion > 0.02;
      if (!moving) settleHair(rig);
      paint();
      if (moving) hideFillRef.current();
      else settledRef.current();
      if (moving)
        frameRef.current = requestAnimationFrame((t) => tickRef.current(t));
      else lastTickRef.current = 0;
    },
    [paint],
  );
  const tickRef = useRef(tick);
  tickRef.current = tick;
  const animate = useCallback(() => {
    if (frameRef.current || disposedRef.current) return;
    lastTickRef.current = 0;
    frameRef.current = requestAnimationFrame((t) => tickRef.current(t));
  }, []);

  function showFill(visible) {
    const fill = fillRef.current;
    fill.shown = visible;
    fillCanvasRef.current?.classList.toggle("is-shown", visible);
  }
  const hideFillRef = useRef(() => {});
  hideFillRef.current = () => {
    if (fillRef.current.shown) showFill(false);
  };
  // The styled shape changed: the current patch no longer fits.
  function invalidateFill() {
    const fill = fillRef.current;
    fill.key++;
    fill.patch = null;
    clearTimeout(fill.timer);
    fill.abort?.abort();
    showFill(false);
    setFillState("idle");
  }
  const invalidateFillRef = useRef(invalidateFill);
  invalidateFillRef.current = invalidateFill;

  async function requestFill() {
    const fill = fillRef.current;
    const rig = rigRef.current,
      original = originalRef.current;
    if (!fillEnabledRef.current || !rig || !original || !restChanged(rig)) return;
    const key = fill.key;
    const { width, height } = original;
    const reveal = new Float32Array(width * height);
    const pixels = renderHair({
      image: colorImageRef.current ?? original,
      mask: maskRef.current,
      plate: plateRef.current,
      field: hairField(rig, undefined, { dynamic: false }),
      rig,
      soft: softRef.current,
      under: colorUnderRef.current,
      reveal,
    });
    const hole = new Uint8ClampedArray(width * height * 4);
    const keep = new Uint8ClampedArray(width * height * 4);
    let count = 0;
    for (let p = 0; p < reveal.length; p++) {
      const inside = reveal[p] > FILL_THRESHOLD;
      if (inside) count++;
      const v = inside ? 255 : 0;
      hole[p * 4] = hole[p * 4 + 1] = hole[p * 4 + 2] = v;
      hole[p * 4 + 3] = 255;
      // Soft edge for laying the fill over the live view.
      keep[p * 4 + 3] = Math.min(255, Math.max(0, (reveal[p] - 0.03) / 0.17) * 255);
    }
    if (count < 24) {
      fill.patch = { key, canvas: null };
      return;
    }
    const controller = new AbortController();
    fill.abort = controller;
    setFillState("working");
    try {
      const response = await fetch("/api/fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: pixelsToDataUrl(pixels, width, height),
          mask: pixelsToDataUrl(hole, width, height),
        }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!fillEnabledRef.current || controller.signal.aborted || key !== fill.key || disposedRef.current) return;
      if (!response.ok) throw new Error(data.error || "补图失败");
      const filled = await loadImage(data.image);
      if (!fillEnabledRef.current || controller.signal.aborted || key !== fill.key || disposedRef.current) return;
      const patch = document.createElement("canvas");
      patch.width = width;
      patch.height = height;
      const context = patch.getContext("2d");
      context.drawImage(filled, 0, 0, width, height);
      const alpha = document.createElement("canvas");
      alpha.width = width;
      alpha.height = height;
      alpha.getContext("2d").putImageData(new ImageData(keep, width, height), 0, 0);
      context.globalCompositeOperation = "destination-in";
      context.filter = "blur(1px)";
      context.drawImage(alpha, 0, 0);
      fill.patch = { key, canvas: patch };
      const overlay = fillCanvasRef.current;
      if (overlay) {
        overlay.width = width;
        overlay.height = height;
        const overlayContext = overlay.getContext("2d");
        overlayContext.clearRect(0, 0, width, height);
        overlayContext.drawImage(patch, 0, 0);
      }
      if (fillEnabledRef.current && !frameRef.current && !comparingRef.current) showFill(true);
      setFillState("shown");
    } catch (e) {
      if (e.name === "AbortError" || !fillEnabledRef.current || controller.signal.aborted || key !== fill.key || disposedRef.current) return;
      setFillState("error");
      setMessage("本机 AI 补全暂时不可用：" + e.message);
    } finally {
      if (fill.abort === controller) fill.abort = null;
    }
  }
  // Called whenever the hair comes to rest.
  const settledRef = useRef(() => {});
  settledRef.current = () => {
    const fill = fillRef.current;
    if (!fillEnabledRef.current || comparingRef.current) return;
    if (fill.patch?.key === fill.key) {
      if (fill.patch.canvas) showFill(true);
      return;
    }
    clearTimeout(fill.timer);
    if (!fill.abort) fill.timer = setTimeout(requestFill, 250);
  };

  // Only settings/selection changes recolour the source. Animation samples the
  // cached texture, so colours follow the mesh without a full-frame readback.
  const refreshColor = useCallback(() => {
    const original = originalRef.current;
    if (!original || !maskRef.current) return;
    const image = colorHair(original, maskRef.current, colorRef.current);
    colorImageRef.current = image;
    colorUnderRef.current = image === original ? underRef.current : blurImage(image);
    uploadedImageRef.current = null;
    setChanged((rigRef.current && restChanged(rigRef.current)) || hasHairColor(colorRef.current));
  }, []);

  const rebuildRig = useCallback((keepStyle, preparedRig = null) => {
    const original = originalRef.current,
      mask = maskRef.current;
    const rig = preparedRig ?? createHairRig(original, mask);
    invalidateFillRef.current();
    if (keepStyle && rigRef.current) transferRest(rigRef.current, rig);
    rigRef.current = rig;
    fieldRef.current = new Float32Array(rig.n * 2);
    meshRef.current = createHairMesh(rig, mask);
    softRef.current = softenMask(mask, original.width, original.height);
    plateRef.current = inpaintHair(original, mask);
    const renderer = rendererRef.current;
    if (renderer) {
      renderer.setMask(mask, softRef.current);
      renderer.setPlate(plateRef.current);
      renderer.setMesh(rig, meshRef.current);
    }
    refreshColor();
  }, [refreshColor]);

  const updateCoverage = useCallback(() => {
    const mask = maskRef.current;
    if (!mask) return;
    let total = 0;
    for (let i = 0; i < mask.length; i++) total += mask[i];
    setCoverage(total / mask.length);
  }, []);

  // Masks are replaced, never mutated, so history can share them.
  const snapshot = useCallback(
    () => ({
      width: originalRef.current?.width,
      height: originalRef.current?.height,
      mask: maskRef.current,
      rest: rigRef.current ? new Float32Array(rigRef.current.R) : null,
      color: { ...colorRef.current },
    }),
    [],
  );
  useEffect(() => {
    setDirty(Boolean(baselineRef.current && !sameHairEditorState(snapshot(), baselineRef.current)));
  }, [revision, color, changed, snapshot]);
  const pushHistory = useCallback((entry) => {
    undoRef.current.push(entry);
    if (undoRef.current.length > 16) undoRef.current.shift();
    redoRef.current = [];
  }, []);

  const detect = useCallback(
    async (recordHistory = false) => {
      const original = originalRef.current;
      if (!original) return;
      const seq = ++segmentationSeqRef.current;
      setStatus("segmenting");
      setMessage("正在本机识别头发区域，首次加载需要几秒…");
      try {
        // Segment the untouched photo; the original stays in browser memory.
        const input = document.createElement("canvas");
        input.width = original.width;
        input.height = original.height;
        input
          .getContext("2d")
          .putImageData(
            new ImageData(
              new Uint8ClampedArray(original.data),
              original.width,
              original.height,
            ),
            0,
            0,
          );
        const result = await segmentHair(input);
        if (disposedRef.current || seq !== segmentationSeqRef.current) return;
        if (recordHistory) pushHistory(snapshot());
        // Remove low-confidence background values; keep a soft edge around hair.
        maskRef.current = result.mask.map((value) =>
          Math.max(0, Math.min(1, (value - 0.3) / 0.45)),
        );
        rebuildRig(recordHistory);
        setCoverage(result.coverage);
        setStatus("ready");
        if (result.coverage < 0.005) {
          setMessage(
            "这张照片没有识别出足够的头发，请用「涂选」圈出想整理的位置。",
          );
          setMaskExpanded(true);
          setTool("add");
          setMaskVisible(true);
        } else
          setMessage(
            "抓住一缕头发拖动：发根稳住，发梢跟着甩动。绿色区域可以随时手动修正。",
          );
        setRevision((v) => v + 1);
        paint();
      } catch (e) {
        if (disposedRef.current || seq !== segmentationSeqRef.current) return;
        setStatus("manual");
        setMessage(
          "自动识别暂不可用。用「涂选」刷出头发区域后，就能继续整理。",
        );
        setTool("add");
        setMaskExpanded(true);
        setMaskVisible(true);
        setRevision((v) => v + 1);
      }
    },
    [paint, pushHistory, rebuildRig, snapshot],
  );

  useEffect(() => {
    disposedRef.current = false;
    baselineRef.current = null;
    setDirty(false);
    let cancelled = false;
    async function initialize() {
      try {
        const image = await loadImage(imageSrc);
        if (cancelled) return;
        const panelWidth = sourcePanel ? image.width / 2 : image.width;
        const panelHeight = sourcePanel ? image.height / 2 : image.height;
        const scale = Math.min(1, 720 / Math.max(panelWidth, panelHeight));
        const width = Math.round(panelWidth * scale),
          height = Math.round(panelHeight * scale);
        const scratch = document.createElement("canvas");
        scratch.width = width;
        scratch.height = height;
        const context = scratch.getContext("2d", { willReadFrequently: true });
        context.drawImage(
          image,
          sourcePanel ? sourcePanel[0] * panelWidth : 0,
          sourcePanel ? sourcePanel[1] * panelHeight : 0,
          panelWidth,
          panelHeight,
          0,
          0,
          width,
          height,
        );
        const pixels = context.getImageData(0, 0, width, height);
        originalRef.current = {
          width,
          height,
          data: new Uint8ClampedArray(pixels.data),
        };
        colorRef.current = { ...DEFAULT_HAIR_COLOR };
        setColor(colorRef.current);
        colorGestureRef.current = null;
        maskRef.current = new Float32Array(width * height);
        underRef.current = blurImage(originalRef.current);
        const canvas = canvasRef.current;
        canvas.width = width;
        canvas.height = height;
        overlayRef.current.width = width;
        overlayRef.current.height = height;
        if (!rendererRef.current && !context2dRef.current) {
          rendererRef.current = createHairRenderer(canvas);
          if (!rendererRef.current)
            context2dRef.current = canvas.getContext("2d");
        }
        rendererRef.current?.setImage(originalRef.current, underRef.current);
        uploadedImageRef.current = originalRef.current;
        rigRef.current = null;
        undoRef.current = [];
        redoRef.current = [];
        // Reopen from the untouched source plus settings, never the flattened
        // tinted result. This keeps colour changes reversible across sessions.
        const saved = readHairEditorState(initialState, width, height);
        if (saved) {
          const restoredRig = createHairRig(originalRef.current, saved.mask);
          if (saved.rest.length === restoredRig.R.length) {
            maskRef.current = saved.mask;
            rebuildRig(false, restoredRig);
            restore(saved, false);
            baselineRef.current = snapshot();
            setStatus("ready");
            setMessage("已恢复上次保存的造型和发色，可以继续修改。按住「看原图」可对照最初的照片。");
            setRevision((value) => value + 1);
            paint();
            settledRef.current();
            return;
          }
        }
        rebuildRig(false);
        setRevision((v) => v + 1);
        paint();
        await detect();
        if (cancelled) return;
        baselineRef.current = snapshot();
        setRevision((value) => value + 1);
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setMessage(e.message || "照片读取失败，请重试。");
        }
      }
    }
    initialize();
    return () => {
      cancelled = true;
      disposedRef.current = true;
      segmentationSeqRef.current++;
      const fill = fillRef.current;
      fill.key++;
      fill.patch = null;
      clearTimeout(fill.timer);
      fill.abort?.abort();
      fill.abort = null;
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
  }, [imageSrc, sourcePanel?.[0], sourcePanel?.[1], initialState, detect, paint, rebuildRig, snapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    // A lost GPU context is restored by the browser; re-upload everything.
    function lost(e) {
      e.preventDefault();
    }
    function restored() {
      const original = originalRef.current,
        rig = rigRef.current;
      rendererRef.current = createHairRenderer(canvas);
      uploadedImageRef.current = null;
      if (!rendererRef.current || !original) return;
      rendererRef.current.setImage(original, underRef.current);
      if (rig) {
        rendererRef.current.setMask(maskRef.current, softRef.current);
        rendererRef.current.setPlate(plateRef.current);
        rendererRef.current.setMesh(rig, meshRef.current);
      }
      paint();
    }
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, [paint]);

  useEffect(() => {
    paint();
    drawOverlay();
  }, [paint, drawOverlay, revision, comparing]);

  useEffect(() => {
    windRef.current = wind;
    if (wind) animate();
  }, [wind, animate]);

  // Is the local AI fill service (inpaint-service) running on this PC?
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/config", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : {}))
      .then((config) => setFillAvailable(Boolean(config.fillAvailable)))
      .catch(() => {});
    return () => {
      controller.abort();
      clearTimeout(fillRef.current.timer);
      fillRef.current.abort?.abort();
    };
  }, []);

  useEffect(() => {
    fillEnabledRef.current = fillAvailable && aiFill;
    if (fillEnabledRef.current) settledRef.current();
    else {
      clearTimeout(fillRef.current.timer);
      // Disable synchronously and invalidate the request's generation. Even a
      // fetch implementation that resolves after abort cannot restore a patch.
      fillRef.current.abort?.abort();
      fillRef.current.abort = null;
      fillRef.current.key++;
      fillRef.current.patch = null;
      showFill(false);
      setFillState("idle");
    }
  }, [fillAvailable, aiFill]);

  useEffect(() => {
    if (comparing) showFill(false);
    else if (!frameRef.current) settledRef.current();
  }, [comparing]);

  function restore(entry, animateRest = true) {
    colorGestureRef.current = null;
    colorRef.current = { ...(entry.color ?? DEFAULT_HAIR_COLOR) };
    setColor(colorRef.current);
    if (entry.mask !== maskRef.current) {
      maskRef.current = entry.mask;
      rebuildRig(false);
      if (entry.rest) setRest(rigRef.current, entry.rest, false);
    } else if (entry.rest && rigRef.current) {
      setRest(rigRef.current, entry.rest, animateRest);
      invalidateFill();
    }
    updateCoverage();
    refreshColor();
    setRevision((v) => v + 1);
    if (animateRest) animate();
  }
  function undo() {
    if (!undoRef.current.length || strokeRef.current || status === "segmenting")
      return;
    redoRef.current.push(snapshot());
    restore(undoRef.current.pop());
  }
  function redo() {
    if (!redoRef.current.length || strokeRef.current || status === "segmenting")
      return;
    undoRef.current.push(snapshot());
    restore(redoRef.current.pop());
  }
  const undoCallback = useRef(undo);
  undoCallback.current = undo;
  const redoCallback = useRef(redo);
  redoCallback.current = redo;
  useEffect(() => {
    function keys(e) {
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        (e.shiftKey ? redoCallback : undoCallback).current();
      }
    }
    document.addEventListener("keydown", keys);
    return () => document.removeEventListener("keydown", keys);
  }, []);

  function position(e) {
    const canvas = canvasRef.current,
      rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(
          canvas.width - 1,
          ((e.clientX - rect.left) * canvas.width) / rect.width,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          canvas.height - 1,
          ((e.clientY - rect.top) * canvas.height) / rect.height,
        ),
      ),
    };
  }
  function moveCursor(e) {
    const cursor = cursorRef.current,
      stage = stageRef.current,
      canvas = canvasRef.current;
    if (!cursor || !stage || !canvas) return;
    const rect = stage.getBoundingClientRect(),
      imageRect = canvas.getBoundingClientRect();
    const size = (brushSize * imageRect.width) / canvas.width;
    cursor.style.width = `${size}px`;
    cursor.style.height = `${size}px`;
    cursor.style.left = `${e.clientX - rect.left}px`;
    cursor.style.top = `${e.clientY - rect.top}px`;
    cursor.style.opacity = comparing ? "0" : "1";
  }
  function paintMask(previous, next) {
    const original = originalRef.current;
    const radius = brushSize / 2;
    const distance = Math.hypot(next.x - previous.x, next.y - previous.y);
    const steps = Math.min(
      24,
      Math.max(1, Math.ceil(distance / Math.max(3, radius * 0.22))),
    );
    let didChange = false;
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const before = maskRef.current;
      maskRef.current = paintHairMask(before, original.width, original.height, {
        x: previous.x + (next.x - previous.x) * t,
        y: previous.y + (next.y - previous.y) * t,
        radius,
        mode: tool,
        strength: 1,
      });
      if (!didChange) {
        for (let i = 0; i < before.length; i++) {
          if (before[i] !== maskRef.current[i]) {
            didChange = true;
            break;
          }
        }
      }
    }
    return didChange;
  }
  // Volume per brush move, scaled to the photo size.
  function volume(distance) {
    const sign = tool === "inflate" ? 1 : -1;
    const scale = originalRef.current.width / 720;
    return sign * (strength / 100) * Math.max(0.6, distance * 0.35) * scale;
  }
  function pointerDown(e) {
    if (
      e.button !== 0 ||
      !ready ||
      comparing ||
      status === "segmenting" ||
      strokeRef.current
    )
      return;
    const rig = rigRef.current;
    if (!paintMode && (!rig || !rig.activeList.length || coverage < 0.001)) {
      setMessage("请先用「涂选」刷出想整理的头发区域。");
      setMaskExpanded(true);
      setTool("add");
      return;
    }
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    const point = position(e);
    const radius = brushSize / 2;
    const stroke = {
      pointerId: e.pointerId,
      mode: tool,
      start: point,
      last: point,
      before: snapshot(),
      changed: false,
    };
    strokeRef.current = stroke;
    if (paintMode) {
      stroke.changed = paintMask(point, point);
      drawOverlay();
    } else if (tool === "comb" || tool === "flick") {
      stroke.grab = grabHair(rig, point.x, point.y, radius);
    } else {
      stroke.changed = pushVolume(
        rig,
        point.x,
        point.y,
        radius,
        volume(10) * 1.5,
      );
    }
    moveCursor(e);
    animate();
  }
  function pointerMove(e) {
    moveCursor(e);
    const stroke = strokeRef.current;
    if (!stroke || e.pointerId !== stroke.pointerId) return;
    e.preventDefault();
    const point = position(e);
    const step = Math.hypot(point.x - stroke.last.x, point.y - stroke.last.y);
    if (step < 1) return;
    const rig = rigRef.current;
    const dx = point.x - stroke.start.x,
      dy = point.y - stroke.start.y;
    if (stroke.mode === "add" || stroke.mode === "erase") {
      stroke.changed = paintMask(stroke.last, point) || stroke.changed;
      drawOverlay();
    } else if (stroke.mode === "comb") {
      // Hair is tied to the head: long drags meet growing resistance.
      const [sx, sy] = soften(
        dx,
        dy,
        brushSize * (0.6 + strength / 100),
      );
      stroke.changed =
        combHair(rig, stroke.grab, sx, sy, strength / 100) || stroke.changed;
    } else if (stroke.mode === "flick") {
      const [sx, sy] = soften(dx, dy, brushSize * 0.9);
      aimHair(stroke.grab, sx, sy);
    } else {
      stroke.changed =
        pushVolume(rig, point.x, point.y, brushSize / 2, volume(step)) ||
        stroke.changed;
    }
    stroke.last = point;
    animate();
  }
  function endStroke(e) {
    const stroke = strokeRef.current;
    if (!stroke || e.pointerId !== stroke.pointerId) return;
    strokeRef.current = null;
    if (canvasRef.current.hasPointerCapture(e.pointerId))
      canvasRef.current.releasePointerCapture(e.pointerId);
    if (stroke.changed) {
      pushHistory(stroke.before);
      if (stroke.mode === "add" || stroke.mode === "erase") {
        rebuildRig(true);
        updateCoverage();
      } else {
        invalidateFill();
        setChanged(restChanged(rigRef.current) || hasHairColor(colorRef.current));
      }
    }
    setRevision((v) => v + 1);
    animate();
  }
  function reset() {
    const rig = rigRef.current;
    if (!rig || status === "segmenting") return;
    pushHistory(snapshot());
    setRest(rig, new Float32Array(rig.R0), true);
    colorRef.current = { ...DEFAULT_HAIR_COLOR };
    setColor(colorRef.current);
    colorGestureRef.current = null;
    refreshColor();
    invalidateFill();
    setChanged(false);
    setRevision((v) => v + 1);
    animate();
    setMessage("已恢复原来的发型和自然发色。选区保留，可以继续整理或试色。");
  }
  function clearMask() {
    const original = originalRef.current;
    if (!original) return;
    pushHistory(snapshot());
    maskRef.current = new Float32Array(original.width * original.height);
    rebuildRig(false);
    setCoverage(0);
    setTool("add");
    setMaskVisible(true);
    setRevision((v) => v + 1);
    setMessage("选区已清空。用「涂选」刷过头发，避开脸和衣服。");
  }
  function beginColorGesture() {
    if (!colorGestureRef.current) colorGestureRef.current = snapshot();
  }
  function endColorGesture() {
    const before = colorGestureRef.current;
    colorGestureRef.current = null;
    if (before && (before.color.id !== colorRef.current.id || before.color.intensity !== colorRef.current.intensity)) {
      pushHistory(before);
      setRevision((value) => value + 1);
    }
  }
  function changeColor(next, recordHistory = true) {
    if (next.id === colorRef.current.id && next.intensity === colorRef.current.intensity) return;
    if (recordHistory) {
      endColorGesture();
      pushHistory(snapshot());
    } else beginColorGesture();
    colorRef.current = { ...next };
    setColor(colorRef.current);
    refreshColor();
    invalidateFill();
    paint();
    if (!frameRef.current) settledRef.current();
    setRevision((value) => value + 1);
  }
  function toggleAiFill(enabled) {
    fillEnabledRef.current = fillAvailable && enabled;
    if (!fillEnabledRef.current) invalidateFill();
    setAiFill(enabled);
  }
  // Exports use the settled style: no breeze, no swing in progress.
  function outputCanvas(useOriginal = false) {
    const original = originalRef.current,
      rig = rigRef.current;
    const pixels =
      useOriginal || !rig
        ? new Uint8ClampedArray(original.data)
        : renderHair({
            image: colorImageRef.current ?? original,
            mask: maskRef.current,
            plate: plateRef.current,
            field: hairField(rig, undefined, { dynamic: false }),
            rig,
            soft: softRef.current,
            under: colorUnderRef.current,
          });
    const canvas = document.createElement("canvas");
    canvas.width = original.width;
    canvas.height = original.height;
    const context = canvas.getContext("2d");
    context.putImageData(new ImageData(pixels, original.width, original.height), 0, 0);
    // Include the AI fill when it belongs to this exact hairstyle.
    const fill = fillRef.current;
    if (!useOriginal && fillEnabledRef.current && fill.patch?.key === fill.key && fill.patch.canvas)
      context.drawImage(fill.patch.canvas, 0, 0);
    return canvas;
  }
  function outputImage(useOriginal = false) {
    return outputCanvas(useOriginal).toDataURL("image/png");
  }
  function savePreview() {
    const editorState = snapshot();
    baselineRef.current = editorState;
    setDirty(false);
    onDirtyChange?.(false);
    onSave({
      image: outputImage(),
      original: outputImage(true),
      colorName: hasHairColor(colorRef.current) ? hairColorName(colorRef.current.id) : "自然色",
      color: { ...colorRef.current },
      editorState,
    });
  }
  async function download() {
    const blob = await new Promise((resolve) =>
      outputCanvas().toBlob(resolve, "image/png"),
    );
    if (!blob) {
      setMessage("图片导出失败，请重试。");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Hairroom-发型发色预览.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  return (
    <div className="hair-editor">
      <div className="hair-editor-main">
        <div className="hair-editor-toolbar">
          <span className="hair-source-label">{sourceLabel}</span>
          <div>
            <button
              className="icon-button"
              title="撤销 Ctrl+Z"
              aria-label="撤销整理"
              disabled={!undoRef.current.length || status === "segmenting"}
              onClick={undo}
            >
              <Undo2 size={17} />
            </button>
            <button
              className="icon-button"
              title="重做 Ctrl+Shift+Z"
              aria-label="重做整理"
              disabled={!redoRef.current.length || status === "segmenting"}
              onClick={redo}
            >
              <Redo2 size={17} />
            </button>
            <button
              className="icon-button"
              title="恢复照片"
              aria-label="恢复整理前照片"
              disabled={!changed || status === "segmenting"}
              onClick={reset}
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
        <div
          className={`hair-stage ${paintMode ? "painting-mask" : ""}`}
          ref={stageRef}
          style={{
            "--hair-ratio": originalRef.current
              ? originalRef.current.width / originalRef.current.height
              : 1,
          }}
        >
          <canvas
            ref={canvasRef}
            className="hair-canvas"
            aria-label="头发整理画布，在头发区域按住鼠标拖动"
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onLostPointerCapture={endStroke}
            onPointerLeave={() => {
              if (cursorRef.current) cursorRef.current.style.opacity = "0";
            }}
          />
          <canvas
            ref={fillCanvasRef}
            className="hair-fill-overlay"
            aria-hidden="true"
          />
          <canvas
            ref={overlayRef}
            className="hair-mask-overlay"
            aria-hidden="true"
          />
          <div
            ref={cursorRef}
            className={`hair-brush-cursor ${paintMode ? "mask-cursor" : ""}`}
            aria-hidden="true"
          >
            <span />
          </div>
          {(status === "loading" || status === "segmenting") && (
            <div className="hair-loading">
              <LoaderCircle className="spin" size={25} />
              <strong>
                {status === "loading" ? "准备你的照片" : "识别头发区域"}
              </strong>
              <span>在本机完成，照片不会上传</span>
            </div>
          )}
          <span className="hair-stage-badge">
            {comparing
              ? "原图"
              : fillState === "working"
                ? "AI 补全中…"
                : hasHairColor(color)
                  ? `本机试色 · ${hairColorName(color.id)}`
                : fillState === "shown" && aiFill && fillAvailable
                  ? "发丝模拟 · 本机 AI 补全"
                  : "发丝模拟 · 二维预览"}
          </span>
        </div>
        <div className="hair-editor-under">
          <span>
            <ShieldCheck size={13} />
            本机识别与编辑
          </span>
          <button
            className="hair-compare"
            disabled={!ready || status === "segmenting"}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              setComparing(true);
            }}
            onPointerUp={() => setComparing(false)}
            onPointerCancel={() => setComparing(false)}
            onLostPointerCapture={() => setComparing(false)}
            onKeyDown={(e) => {
              if (e.key === " ") {
                e.preventDefault();
                setComparing(true);
              }
            }}
            onKeyUp={(e) => {
              if (e.key === " ") setComparing(false);
            }}
            onBlur={() => setComparing(false)}
          >
            <Eye size={14} />
            按住看原图
          </button>
        </div>
        <p
          className={`hair-status ${status === "manual" || status === "error" ? "hair-status-notice" : ""}`}
          role="status"
        >
          {message}
        </p>
      </div>

      <aside className="hair-controls">
        <div className="hair-control-title">
          <Hand size={18} strokeWidth={1.4} />
          <div>
            <h3>由你来，整理一点点</h3>
            <p>发根稳、发梢随动，像真的头发一样。</p>
          </div>
        </div>
        <div className="hair-tools" aria-label="整理工具">
          {TOOLS.map(({ id, name, short, icon: Icon }) => (
            <button
              key={id}
              className={tool === id ? "selected" : ""}
              aria-pressed={tool === id}
              onClick={() => setTool(id)}
              disabled={!ready}
            >
              <Icon size={18} strokeWidth={1.5} />
              <span>
                <strong>{name}</strong>
                <small>{short}</small>
              </span>
              {tool === id && <Check size={13} />}
            </button>
          ))}
        </div>
        <section className="hair-color-controls" aria-labelledby="hair-color-heading">
          <div className="hair-color-heading">
            <span><Palette size={15} /><strong id="hair-color-heading">试一试发色</strong></span>
            <button
              type="button"
              disabled={!hasHairColor(color) || !ready || status === "segmenting"}
              onClick={() => changeColor({ ...color, id: "natural" })}
            >还原自然色</button>
          </div>
          <div className="hair-color-swatches" aria-label="发色色板">
            {HAIR_COLORS.map((shade) => (
              <button
                key={shade.id}
                type="button"
                className={color.id === shade.id ? "selected" : ""}
                aria-pressed={color.id === shade.id}
                aria-label={`发色：${shade.name}`}
                disabled={!ready || status === "segmenting"}
                onClick={() => changeColor({ ...color, id: shade.id })}
              >
                <span
                  className={`hair-color-chip ${shade.id === "natural" ? "natural" : ""}`}
                  style={{ "--swatch": shade.hex }}
                  aria-hidden="true"
                >{color.id === shade.id && <Check size={12} />}</span>
                {shade.name}
              </button>
            ))}
          </div>
          <label className="hair-range hair-color-intensity">
            <span>发色强度<output>{Math.round(color.intensity * 100)}%</output></span>
            <input
              type="range"
              aria-label="发色强度"
              min="0"
              max="100"
              step="5"
              value={Math.round(color.intensity * 100)}
              disabled={!ready || status === "segmenting" || color.id === "natural"}
              onPointerDown={beginColorGesture}
              onPointerUp={endColorGesture}
              onPointerCancel={endColorGesture}
              onLostPointerCapture={endColorGesture}
              onBlur={endColorGesture}
              onKeyUp={endColorGesture}
              onChange={(event) => changeColor({ ...color, intensity: Number(event.target.value) / 100 }, false)}
            />
            <div><small>保留原发色</small><small>更明显</small></div>
          </label>
          <p>只在头发选区内试色，保留明暗与发丝纹理。可修正绿色选区来避开皮肤；实际染发会受发质和底色影响。</p>
        </section>
        {fillAvailable && (
          <label className="hair-breeze">
            <input
              type="checkbox"
              checked={aiFill}
              onChange={(e) => toggleAiFill(e.target.checked)}
            />
            <Sparkles size={15} strokeWidth={1.5} />
            <span>
              <strong>AI 补全露出的地方</strong>
              <small>头发挪开后，用本机显卡画出后面的样子，照片不离开这台电脑</small>
            </span>
          </label>
        )}
        <label className="hair-breeze">
          <input
            type="checkbox"
            checked={wind}
            disabled={!ready}
            onChange={(e) => setWind(e.target.checked)}
          />
          <Wind size={15} strokeWidth={1.5} />
          <span>
            <strong>微风吹动</strong>
            <small>看看头发自然飘起来的样子，不影响保存</small>
          </span>
        </label>
        <label className="hair-range">
          <span>
            笔刷大小<output>{brushSize} px</output>
          </span>
          <input
            type="range"
            aria-label="笔刷大小"
            min="24"
            max="180"
            step="2"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
          />
          <div>
            <small>精细一点</small>
            <small>范围大一点</small>
          </div>
        </label>
        <label className="hair-range">
          <span>
            调整力度<output>{strength}%</output>
          </span>
          <input
            type="range"
            aria-label="调整力度"
            min="10"
            max="80"
            step="5"
            value={strength}
            onChange={(e) => setStrength(Number(e.target.value))}
            disabled={paintMode}
          />
          <div>
            <small>轻轻整理</small>
            <small>明显调整</small>
          </div>
        </label>
        <div className="hair-mask-controls">
          <button
            className="hair-mask-heading"
            onClick={() => setMaskExpanded((v) => !v)}
            aria-expanded={maskExpanded}
          >
            <span>
              <Paintbrush size={15} />
              修正可整理区域
            </span>
            <ChevronDown size={15} className={maskExpanded ? "open" : ""} />
          </button>
          {maskExpanded && (
            <div className="hair-mask-details">
              <p>
                绿色表示可整理区域。识别不准时，自己涂上或擦掉；尽量避开五官。
              </p>
              <div className="hair-mask-tool-row">
                <button
                  className={tool === "add" ? "selected" : ""}
                  disabled={!ready || status === "segmenting"}
                  onClick={() => {
                    setTool("add");
                    setMaskVisible(true);
                  }}
                >
                  <Paintbrush size={14} />
                  涂选
                </button>
                <button
                  className={tool === "erase" ? "selected" : ""}
                  disabled={!ready || status === "segmenting"}
                  onClick={() => {
                    setTool("erase");
                    setMaskVisible(true);
                  }}
                >
                  <Eraser size={14} />
                  擦除
                </button>
              </div>
              <div className="hair-mask-options">
                <button
                  onClick={() => detect(true)}
                  disabled={!ready || status === "segmenting"}
                >
                  重新识别
                </button>
                <button
                  onClick={clearMask}
                  disabled={!ready || status === "segmenting"}
                >
                  清空选区
                </button>
              </div>
            </div>
          )}
          <label className="hair-mask-toggle">
            <input
              type="checkbox"
              checked={maskVisible}
              onChange={(e) => setMaskVisible(e.target.checked)}
            />
            显示绿色选区
            <span>{coverage > 0.005 ? "已识别区域" : "等待涂选"}</span>
          </label>
        </div>
        <div className="hair-editor-actions">
          <button
            className="primary-button"
            disabled={!dirty || status === "segmenting"}
            onClick={savePreview}
          >
            保存编辑预览
            <ArrowRight size={15} />
          </button>
          <button
            className="secondary-button"
            disabled={!(changed || dirty) || status === "segmenting"}
            onClick={download}
          >
            <ArrowDownToLine size={15} />
            下载图片
          </button>
        </div>
        <p className="hair-limits">
          按发根到发梢模拟摆动，每一帧都从原照片取像素，越拖也不会越糊。仍是二维照片模拟：大幅剪短、露出原本被遮住的额头，需要生成模型补全。
        </p>
      </aside>
    </div>
  );
}
