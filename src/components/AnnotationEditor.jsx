import React, { useEffect, useRef, useState } from "react";
import { Check, Circle, Download, LoaderCircle, MapPin, Pencil, Redo2, Slash, Trash2, Undo2, X } from "lucide-react";
import { annotationNotes, cleanAnnotationNote, drawAnnotationMarks, MAX_ANNOTATION_MARKS, MAX_ANNOTATION_NOTES, normalizeAnnotationMark, normalizeAnnotationMarks, normalizedAnnotationPoint } from "../lib/annotations.js";
import "./annotation-editor.css";

const TOOLS = [
  { id: "pen", label: "自由画笔", icon: Pencil, hint: "在照片上画线，指出想保留或剪短的位置。" },
  { id: "line", label: "画直线", icon: Slash, hint: "按住并拖动，标出刘海或发尾的目标长度。" },
  { id: "ellipse", label: "圈选区域", icon: Circle, hint: "按住并拖动，圈出需要调整的区域。" },
  { id: "note", label: "编号备注", icon: MapPin, hint: "先点照片上的位置，再写下给理发师的备注。" },
];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片读取失败，请关闭后重试。"));
    if (!src.startsWith("data:") && !src.startsWith("blob:")) image.crossOrigin = "anonymous";
    image.src = src;
  });
}

function wrapNote(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const char of text) {
    if (line && ctx.measureText(line + char).width > maxWidth) {
      lines.push(line);
      line = char;
    } else line += char;
  }
  if (line) lines.push(line);
  return lines;
}

export default function AnnotationEditor({ imageSrc, sourcePanel, sourceLabel, initialValue, onSave, onDirtyChange }) {
  const canvasRef = useRef(null);
  const originalRef = useRef(null);
  const draftRef = useRef(null);
  const pointerRef = useRef(null);
  const historyRef = useRef({ past: [], present: normalizeAnnotationMarks(initialValue?.marks), future: [] });
  const initialRef = useRef(initialValue);
  const baselineRef = useRef(JSON.stringify(normalizeAnnotationMarks(initialValue?.marks)));
  const dirtyCallbackRef = useRef(onDirtyChange);
  dirtyCallbackRef.current = onDirtyChange;
  initialRef.current = initialValue;
  const [history, setHistory] = useState(historyRef.current);
  const [dimensions, setDimensions] = useState(null);
  const [tool, setTool] = useState("pen");
  const [lineWidth, setLineWidth] = useState(0.006);
  const [pendingNote, setPendingNote] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const noteInputRef = useRef(null);
  const idRef = useRef(0);
  const marks = history.present;
  const notes = annotationNotes(marks);

  const redraw = () => {
    const canvas = canvasRef.current;
    const original = originalRef.current;
    if (!canvas || !original) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(original, 0, 0);
    drawAnnotationMarks(ctx, historyRef.current.present, canvas.width, canvas.height);
    if (draftRef.current) drawAnnotationMarks(ctx, [draftRef.current], canvas.width, canvas.height, { draft: true });
    if (pendingNote) drawAnnotationMarks(ctx, [{ type: "note", points: [pendingNote] }], canvas.width, canvas.height, { draft: true, initialNoteIndex: annotationNotes(historyRef.current.present).length });
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setDimensions(null);
    setPendingNote(null);
    setNoteText("");
    originalRef.current = null;
    draftRef.current = null;
    pointerRef.current = null;
    const nextHistory = { past: [], present: normalizeAnnotationMarks(initialRef.current?.marks), future: [] };
    baselineRef.current = JSON.stringify(nextHistory.present);
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    loadImage(imageSrc).then((image) => {
      if (!active) return;
      const panel = Array.isArray(sourcePanel) && sourcePanel.length === 2 && sourcePanel.every((value) => value === 0 || value === 1) ? sourcePanel : null;
      const sw = image.naturalWidth / (panel ? 2 : 1);
      const sh = image.naturalHeight / (panel ? 2 : 1);
      const ratio = Math.min(1, 1800 / Math.max(sw, sh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sw * ratio));
      canvas.height = Math.max(1, Math.round(sh * ratio));
      canvas.getContext("2d").drawImage(image, panel ? sw * panel[0] : 0, panel ? sh * panel[1] : 0, sw, sh, 0, 0, canvas.width, canvas.height);
      // Check exportability now, so a remote image failure is visible before drawing.
      canvas.toDataURL("image/png");
      originalRef.current = canvas;
      setDimensions({ width: canvas.width, height: canvas.height });
      setLoading(false);
    }).catch((failure) => {
      if (!active) return;
      setLoading(false);
      setError(failure?.name === "SecurityError" ? "这张图片不允许本机编辑，请先下载再上传。" : failure.message);
    });
    return () => { active = false; };
  }, [imageSrc, sourcePanel?.[0], sourcePanel?.[1]]);

  useEffect(() => { redraw(); }, [history, dimensions, pendingNote]);
  useEffect(() => { if (pendingNote) noteInputRef.current?.focus(); }, [pendingNote]);
  useEffect(() => {
    dirtyCallbackRef.current?.(Boolean(pendingNote) || JSON.stringify(history.present) !== baselineRef.current);
  }, [history, pendingNote]);

  function setNextHistory(next) {
    historyRef.current = next;
    setHistory(next);
    setStatus("");
  }

  function commit(nextMarks) {
    const current = historyRef.current;
    setNextHistory({ past: [...current.past.slice(-39), current.present], present: nextMarks, future: [] });
  }

  function cancelGesture() {
    draftRef.current = null;
    pointerRef.current = null;
    dirtyCallbackRef.current?.(Boolean(pendingNote) || JSON.stringify(historyRef.current.present) !== baselineRef.current);
    redraw();
  }

  function switchTool(nextTool) {
    cancelGesture();
    setTool(nextTool);
  }

  function pointFor(event) {
    return normalizedAnnotationPoint(event.clientX, event.clientY, canvasRef.current.getBoundingClientRect());
  }

  function pointerDown(event) {
    if (loading || busy || !originalRef.current || (event.pointerType === "mouse" && event.button !== 0) || pointerRef.current !== null || !event.isPrimary) return;
    event.preventDefault();
    if (marks.length >= MAX_ANNOTATION_MARKS) { setError("这一张的标记已达到 120 个，请先撤销或清空部分标记。"); return; }
    setError("");
    const point = pointFor(event);
    if (!point) return;
    if (tool === "note") {
      if (notes.length >= MAX_ANNOTATION_NOTES) { setError("最多可添加 20 条备注，请先撤销或清空一些备注。"); return; }
      setPendingNote(point);
      return;
    }
    pointerRef.current = event.pointerId;
    canvasRef.current.setPointerCapture(event.pointerId);
    draftRef.current = { id: `mark-${Date.now()}-${++idRef.current}`, type: tool, points: [point, point], width: lineWidth };
    dirtyCallbackRef.current?.(true);
    redraw();
  }

  function pointerMove(event) {
    if (event.pointerId !== pointerRef.current || !draftRef.current) return;
    event.preventDefault();
    const point = pointFor(event);
    if (!point) return;
    const draft = draftRef.current;
    if (draft.type === "pen") {
      const last = draft.points[draft.points.length - 1];
      if (Math.hypot(last.x - point.x, last.y - point.y) > 0.0008 && draft.points.length < 3000) draft.points.push(point);
    } else draft.points[1] = point;
    redraw();
  }

  function pointerUp(event) {
    if (event.pointerId !== pointerRef.current || !draftRef.current) return;
    pointerMove(event);
    const nextMark = normalizeAnnotationMark(draftRef.current);
    draftRef.current = null;
    pointerRef.current = null;
    if (canvasRef.current.hasPointerCapture(event.pointerId)) canvasRef.current.releasePointerCapture(event.pointerId);
    if (nextMark) commit([...historyRef.current.present, nextMark]);
    else { redraw(); dirtyCallbackRef.current?.(JSON.stringify(historyRef.current.present) !== baselineRef.current); }
  }

  function addNote(event) {
    event.preventDefault();
    const text = cleanAnnotationNote(noteText);
    if (!pendingNote || !text || marks.length >= MAX_ANNOTATION_MARKS || notes.length >= MAX_ANNOTATION_NOTES) return;
    commit([...historyRef.current.present, { id: `note-${Date.now()}-${++idRef.current}`, type: "note", points: [pendingNote], width: lineWidth, text }]);
    setPendingNote(null);
    setNoteText("");
  }

  function undo() {
    cancelGesture();
    setPendingNote(null);
    setNoteText("");
    const current = historyRef.current;
    if (!current.past.length) return;
    setNextHistory({ past: current.past.slice(0, -1), present: current.past[current.past.length - 1], future: [current.present, ...current.future] });
  }

  function redo() {
    cancelGesture();
    setPendingNote(null);
    setNoteText("");
    const current = historyRef.current;
    if (!current.future.length) return;
    setNextHistory({ past: [...current.past, current.present], present: current.future[0], future: current.future.slice(1) });
  }

  async function buildResult() {
    if (pendingNote) throw new Error("请先添加或取消正在填写的备注，再保存图片。");
    if (!originalRef.current) throw new Error("图片尚未准备好，请稍后重试。");
    await document.fonts.ready;
    const original = originalRef.current;
    const image = document.createElement("canvas");
    image.width = original.width;
    image.height = original.height;
    image.getContext("2d").drawImage(original, 0, 0);
    const savedMarks = normalizeAnnotationMarks(historyRef.current.present);
    drawAnnotationMarks(image.getContext("2d"), savedMarks, image.width, image.height);
    return { image: image.toDataURL("image/png"), original: original.toDataURL("image/png"), marks: savedMarks, notes: annotationNotes(savedMarks), canvas: image };
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const { canvas, ...result } = await buildResult();
      await onSave?.(result);
      baselineRef.current = JSON.stringify(result.marks);
      dirtyCallbackRef.current?.(false);
      setStatus("标注已保存到当前方案。");
    } catch (failure) { setError(failure.message || "标注保存失败，请重试。"); }
    finally { setBusy(false); }
  }

  async function download() {
    setBusy(true);
    setError("");
    try {
      const result = await buildResult();
      let canvas = result.canvas;
      if (result.notes.length) {
        const scale = canvas.width / 720;
        const fontSize = 20 * scale;
        const lineHeight = 32 * scale;
        const padding = 32 * scale;
        const ctx = canvas.getContext("2d");
        ctx.font = `${fontSize}px sans-serif`;
        const noteLines = result.notes.map((note) => wrapNote(ctx, note, canvas.width - padding * 2 - 38 * scale));
        const footer = document.createElement("canvas");
        footer.width = canvas.width;
        footer.height = canvas.height + Math.ceil(padding * 3 + 28 * scale + noteLines.reduce((sum, lines) => sum + lines.length * lineHeight + 12 * scale, 0));
        const footerCtx = footer.getContext("2d");
        footerCtx.fillStyle = "#f7f6f2";
        footerCtx.fillRect(0, 0, footer.width, footer.height);
        footerCtx.drawImage(canvas, 0, 0);
        let y = canvas.height + padding + fontSize;
        footerCtx.fillStyle = "#30362d";
        footerCtx.font = `600 ${fontSize}px sans-serif`;
        footerCtx.fillText("给理发师的备注", padding, y);
        y += 44 * scale;
        footerCtx.font = `${fontSize}px sans-serif`;
        noteLines.forEach((lines, index) => {
          footerCtx.fillStyle = "#a94f3d";
          footerCtx.fillText(String(index + 1).padStart(2, "0"), padding, y);
          footerCtx.fillStyle = "#41473b";
          for (const line of lines) { footerCtx.fillText(line, padding + 38 * scale, y); y += lineHeight; }
          y += 12 * scale;
        });
        canvas = footer;
      }
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("图片导出失败，请重试。");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Hairroom-给理发师的标注.png";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setStatus("标注图片已下载，编号对应的备注也在图片下方。");
    } catch (failure) { setError(failure.message || "图片导出失败，请重试。"); }
    finally { setBusy(false); }
  }

  return (
    <div className="annotation-editor" onKeyDown={(event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !["TEXTAREA", "INPUT"].includes(event.target.tagName)) {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
      }
    }}>
      <div className="annotation-main">
        <div className="annotation-topline">
          <span>{sourceLabel || "当前方案"}</span>
          <div>
            <button type="button" aria-label="撤销上一步标注" title="撤销" disabled={!history.past.length || busy} onClick={undo}><Undo2 size={16} /></button>
            <button type="button" aria-label="重做上一步标注" title="重做" disabled={!history.future.length || busy} onClick={redo}><Redo2 size={16} /></button>
            <button type="button" aria-label="清空全部标注" title="清空标注，可撤销" disabled={!marks.length || busy} onClick={() => { cancelGesture(); setPendingNote(null); setNoteText(""); commit([]); }}><Trash2 size={16} /></button>
          </div>
        </div>
        <div className="annotation-stage" style={{ "--annotation-ratio": dimensions ? dimensions.width / dimensions.height : 1 }}>
          {dimensions && <canvas ref={canvasRef} width={dimensions.width} height={dimensions.height}
            aria-label={`发型标注画布，当前工具：${TOOLS.find((item) => item.id === tool).label}。在照片上按住拖动绘图，编号备注请点击位置后输入文字。`}
            onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
            onPointerCancel={(event) => { if (event.pointerId === pointerRef.current) cancelGesture(); }}
            onLostPointerCapture={(event) => { if (event.pointerId === pointerRef.current) cancelGesture(); }} />}
          {loading && <div className="annotation-loading" role="status"><LoaderCircle className="spin" size={25} /><span>正在准备照片…</span></div>}
          {!loading && !dimensions && <div className="annotation-loading"><span>暂时无法显示照片</span></div>}
        </div>
        <p className="annotation-hint">{TOOLS.find((item) => item.id === tool).hint}</p>
        {error && <p className="annotation-error" role="alert">{error}</p>}
        <p className="annotation-status" role="status">{status}</p>
      </div>
      <aside className="annotation-controls" aria-label="标注工具">
        <div className="annotation-intro"><span>MAKE IT CLEAR</span><h3>把想法画在照片上</h3><p>标出长度、圈出区域，再补上一句你的想法。</p></div>
        <div className="annotation-tools" role="group" aria-label="选择标注工具">
          {TOOLS.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={tool === id ? "active" : ""} aria-pressed={tool === id} disabled={busy} onClick={() => switchTool(id)}><Icon size={17} /><span>{label}</span></button>)}
        </div>
        <fieldset className="annotation-widths" disabled={busy}><legend>线条粗细</legend>
          {[{ value: 0.003, label: "细" }, { value: 0.006, label: "中" }, { value: 0.01, label: "粗" }].map(({ value, label }) => <button type="button" key={value} aria-pressed={lineWidth === value} className={lineWidth === value ? "active" : ""} onClick={() => setLineWidth(value)}>{label}</button>)}
        </fieldset>
        {pendingNote && <form className="annotation-note-form" onSubmit={addNote}>
          <label htmlFor="annotation-note-text">给这个位置加一句话</label>
          <textarea ref={noteInputRef} id="annotation-note-text" value={noteText} maxLength={100} rows={3} placeholder="例如：刘海到这里，两侧不要剪太薄" onChange={(event) => setNoteText(event.target.value)} />
          <div><span>{Array.from(noteText).length}/100</span><button type="button" onClick={() => { setPendingNote(null); setNoteText(""); }}><X size={14} />取消</button><button type="submit" disabled={!cleanAnnotationNote(noteText)}><Check size={14} />添加备注</button></div>
        </form>}
        {notes.length > 0 && <div className="annotation-notes"><h4>给理发师的备注</h4><ol>{notes.map((note, index) => <li key={`${index}-${note}`}><span>{index + 1}</span><p>{note}</p></li>)}</ol></div>}
        <div className="annotation-actions">
          <button type="button" className="primary-button" onClick={save} disabled={loading || busy || !dimensions || Boolean(pendingNote)}>{busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}保存标注到方案</button>
          <button type="button" className="secondary-button" onClick={download} disabled={loading || busy || !dimensions || Boolean(pendingNote)}><Download size={16} />下载标注图片</button>
          <p>照片与标注仅在本机处理。下载图会附上完整备注。</p>
        </div>
      </aside>
    </div>
  );
}
