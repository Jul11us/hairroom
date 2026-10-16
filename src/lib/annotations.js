export const ANNOTATION_COLOR = "#a94f3d";
export const MAX_ANNOTATION_MARKS = 120;
export const MAX_ANNOTATION_NOTES = 20;
export const MAX_ANNOTATION_NOTE_LENGTH = 100;

const TYPES = new Set(["pen", "line", "ellipse", "note"]);
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function cleanAnnotationNote(value) {
  if (typeof value !== "string") return "";
  return Array.from(value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim())
    .slice(0, MAX_ANNOTATION_NOTE_LENGTH)
    .join("");
}

export function normalizedAnnotationPoint(clientX, clientY, rectangle) {
  if (!rectangle || rectangle.width <= 0 || rectangle.height <= 0) return null;
  if (![clientX, clientY, rectangle.left, rectangle.top].every(Number.isFinite)) return null;
  return {
    x: clamp((clientX - rectangle.left) / rectangle.width, 0, 1),
    y: clamp((clientY - rectangle.top) / rectangle.height, 0, 1),
  };
}

export function normalizeAnnotationMark(mark) {
  if (!mark || !TYPES.has(mark.type) || !Array.isArray(mark.points)) return null;
  const points = mark.points.slice(0, 3000)
    .filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({ x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1) }));
  if (!points.length) return null;
  const text = cleanAnnotationNote(mark.text);
  if (mark.type === "note" && !text) return null;
  if (mark.type !== "note") {
    if (points.length < 2) return null;
    // A tap, a cancelled gesture, or a collapsed ellipse must not leave a mark.
    const first = points[0];
    if (mark.type === "ellipse") {
      const last = points[points.length - 1];
      if (Math.abs(last.x - first.x) < 0.004 || Math.abs(last.y - first.y) < 0.004) return null;
    } else if (!points.some((point) => Math.hypot(point.x - first.x, point.y - first.y) >= 0.004)) {
      return null;
    }
  }
  return {
    id: typeof mark.id === "string" ? mark.id.slice(0, 100) : "",
    type: mark.type,
    width: Number.isFinite(mark.width) ? clamp(mark.width, 0.002, 0.025) : 0.006,
    points: mark.type === "pen" ? points : mark.type === "note" ? points.slice(0, 1) : [points[0], points[points.length - 1]],
    ...(mark.type === "note" ? { text } : {}),
  };
}

export function normalizeAnnotationMarks(marks) {
  if (!Array.isArray(marks)) return [];
  let notes = 0;
  return marks.slice(0, MAX_ANNOTATION_MARKS).map(normalizeAnnotationMark).filter((mark) => {
    if (!mark) return false;
    if (mark.type === "note") { notes += 1; return notes <= MAX_ANNOTATION_NOTES; }
    return true;
  });
}

export function annotationNotes(marks) {
  return normalizeAnnotationMarks(marks).filter((mark) => mark.type === "note").map((mark) => mark.text);
}

export function drawAnnotationMarks(ctx, marks, width, height, { draft = false, initialNoteIndex = 0 } = {}) {
  const scale = Math.min(width, height);
  let noteIndex = initialNoteIndex;
  for (const mark of marks) {
    if (!mark?.points?.length) continue;
    const points = mark.points.map((point) => ({ x: point.x * width, y: point.y * height }));
    const first = points[0];
    const last = points[points.length - 1];
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = draft ? 0.78 : 1;
    if (mark.type === "note") {
      noteIndex += 1;
      const radius = Math.max(11, scale * 0.023);
      const x = clamp(first.x, radius + 2, width - radius - 2);
      const y = clamp(first.y, radius + 2, height - radius - 2);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = ANNOTATION_COLOR;
      ctx.fill();
      ctx.strokeStyle = "#fffdf8";
      ctx.lineWidth = Math.max(2, scale * 0.003);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = `600 ${Math.max(12, scale * 0.027)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(noteIndex), x, y + scale * 0.001);
    } else {
      ctx.beginPath();
      if (mark.type === "ellipse") {
        ctx.ellipse((first.x + last.x) / 2, (first.y + last.y) / 2, Math.abs(last.x - first.x) / 2, Math.abs(last.y - first.y) / 2, 0, 0, Math.PI * 2);
      } else {
        ctx.moveTo(first.x, first.y);
        for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
      }
      // A fine ivory halo keeps the same mark readable on dark and light hair.
      ctx.strokeStyle = "#fffdf8";
      ctx.lineWidth = scale * (mark.width || 0.006) + Math.max(2, scale * 0.003);
      ctx.stroke();
      ctx.strokeStyle = ANNOTATION_COLOR;
      ctx.lineWidth = scale * (mark.width || 0.006);
      ctx.stroke();
    }
    ctx.restore();
  }
}
