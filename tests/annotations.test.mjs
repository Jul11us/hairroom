import test from "node:test";
import assert from "node:assert/strict";
import { annotationNotes, cleanAnnotationNote, drawAnnotationMarks, normalizeAnnotationMark, normalizeAnnotationMarks, normalizedAnnotationPoint } from "../src/lib/annotations.js";
import { salonCardLayout, salonText } from "../src/lib/export-card.js";

test("annotation coordinates normalize to the displayed image and stay inside it", () => {
  const rectangle = { left: 100, top: 50, width: 400, height: 600 };
  assert.deepEqual(normalizedAnnotationPoint(300, 350, rectangle), { x: 0.5, y: 0.5 });
  assert.deepEqual(normalizedAnnotationPoint(20, 900, rectangle), { x: 0, y: 1 });
  assert.equal(normalizedAnnotationPoint(10, 20, { ...rectangle, width: 0 }), null);
  assert.equal(normalizedAnnotationPoint(NaN, 20, rectangle), null);
});

test("gestures reject taps, collapsed ellipses, missing notes and invalid points", () => {
  assert.equal(normalizeAnnotationMark({ type: "pen", points: [{ x: 0.5, y: 0.5 }, { x: 0.501, y: 0.5 }] }), null);
  assert.equal(normalizeAnnotationMark({ type: "line", points: [{ x: 0.5, y: 0.5 }] }), null);
  assert.equal(normalizeAnnotationMark({ type: "ellipse", points: [{ x: 0.5, y: 0.5 }, { x: 0.8, y: 0.5 }] }), null);
  assert.equal(normalizeAnnotationMark({ type: "note", points: [{ x: 0.5, y: 0.5 }], text: "  " }), null);
  assert.deepEqual(normalizeAnnotationMarks([{ type: "unknown", points: [] }, { type: "pen", points: [{ x: NaN, y: 1 }] }]), []);
});

test("saved annotations constrain points and widths and keep only serializable fields", () => {
  assert.deepEqual(normalizeAnnotationMark({ id: "line-1", type: "line", width: 30, unexpected: true, points: [{ x: -1, y: 0.2 }, { x: 0.2, y: 0.2 }, { x: 2, y: 0.8 }] }), {
    id: "line-1", type: "line", width: 0.025, points: [{ x: 0, y: 0.2 }, { x: 1, y: 0.8 }],
  });
});

test("notes are trimmed, limited to 100 characters, and follow marker order", () => {
  assert.equal(cleanAnnotationNote("  刘海\n到这里\u0000  "), "刘海 到这里");
  assert.equal(Array.from(cleanAnnotationNote("发".repeat(110))).length, 100);
  assert.equal(Array.from(cleanAnnotationNote("😀".repeat(110))).length, 100);
  assert.deepEqual(annotationNotes([
    { type: "note", points: [{ x: 0.2, y: 0.1 }], text: " 刘海到这里 " },
    { type: "line", points: [{ x: 0.2, y: 0.4 }, { x: 0.4, y: 0.4 }] },
    { type: "note", points: [{ x: 0.8, y: 0.4 }], text: "两侧不要剪薄" },
  ]), ["刘海到这里", "两侧不要剪薄"]);
});

test("drawing uses the output dimensions for geometry and stroke width", () => {
  const calls = [];
  const ctx = new Proxy({}, {
    set(target, property, value) { calls.push([property, value]); target[property] = value; return true; },
    get(target, property) { if (!(property in target)) return (...args) => calls.push([property, ...args]); return target[property]; },
  });
  drawAnnotationMarks(ctx, [{ type: "line", width: 0.006, points: [{ x: 0.25, y: 0.2 }, { x: 0.75, y: 0.8 }] }], 1000, 1500);
  assert.ok(calls.some((call) => call[0] === "moveTo" && call[1] === 250 && call[2] === 300));
  assert.ok(calls.some((call) => call[0] === "lineTo" && call[1] === 750 && call[2] === 1200));
  assert.ok(calls.some((call) => call[0] === "lineWidth" && call[1] === 6));
});

test("numbered notes render at an edge with the whole marker kept in the image", () => {
  const arcs = [];
  const numbers = [];
  const ctx = new Proxy({}, {
    get(target, property) {
      if (property === "arc") return (...args) => arcs.push(args);
      if (property === "fillText") return (...args) => numbers.push(args);
      return property in target ? target[property] : () => {};
    },
  });
  drawAnnotationMarks(ctx, [{ type: "note", points: [{ x: 0, y: 1 }], text: "保留这里" }], 1000, 1500);
  assert.equal(numbers[0][0], "1");
  assert.ok(arcs[0][0] >= arcs[0][2]);
  assert.ok(arcs[0][1] + arcs[0][2] <= 1500);
});

test("long personal notes expand the salon card and keep the footer below all content", () => {
  const context = { measureText: (text) => ({ width: Array.from(text).length * 24 }) };
  const style = { name: "轻盈短发", salonNotes: ["保留一点长度"], requirements: ["请结合发量确认"] };
  const ordinary = salonCardLayout(context, style);
  assert.equal(ordinary.height, 1700);
  const full = salonCardLayout(context, style, Array.from({ length: 20 }, () => "不要剪薄".repeat(25)));
  assert.ok(full.height > 1700);
  assert.equal(full.personal.length, 20);
  const last = full.personal.at(-1);
  assert.ok(last.y + last.lines.length * 38 < full.cautionY);
  assert.ok(full.cautionY + full.cautionLines.length * 35 < full.footerY);
  assert.ok(full.footerY + 50 < full.height);
});

test("copied salon text includes the numbered personal notes and remains compatible without them", () => {
  const style = { name: "轻盈短发", salonNotes: ["两侧保留长度"] };
  assert.ok(!salonText(style).includes("我在照片上的备注"));
  assert.ok(salonText(style, ["刘海到这里", "  两侧不要剪薄  "]).includes("我在照片上的备注：\n1. 刘海到这里\n2. 两侧不要剪薄"));
});
