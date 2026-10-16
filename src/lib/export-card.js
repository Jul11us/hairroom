const PANELS = {
  original: [0, 0],
  "curtain-layers": [1, 0],
  "airy-bob": [0, 1],
  "soft-waves": [1, 1],
  crop: [1, 0],
  "side-part": [0, 1],
  "textured-quiff": [1, 1],
};

export function demoAsset(style) {
  return style?.presentation === "masculine"
    ? "/images/hairstyle-demo-men.png"
    : "/images/hairstyle-demo.png";
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败，请重试。"));
    image.src = src;
  });
}

function paragraph(ctx, text, x, y, maxWidth, lineHeight) {
  let line = "";
  for (const char of text) {
    if (ctx.measureText(line + char).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = char;
    } else line += char;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lineHeight;
}

function drawCover(ctx, img, x, y, w, h, panel) {
  const sw = panel ? img.width / 2 : img.width;
  const sh = panel ? img.height / 2 : img.height;
  const sx = panel ? sw * panel[0] : 0;
  const sy = panel ? sh * panel[1] : 0;
  const cropW = Math.min(sw, (sh * w) / h);
  const cropH = Math.min(sh, (sw * h) / w);
  ctx.drawImage(
    img,
    sx + (sw - cropW) / 2,
    sy + (sh - cropH) / 2,
    cropW,
    cropH,
    x,
    y,
    w,
    h,
  );
}

export async function exportSalonCard({
  style,
  photo,
  generatedImage,
  originalLabel,
  resultLabel,
}) {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1700;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f7f6f2";
  ctx.fillRect(0, 0, 1200, 1700);
  ctx.fillStyle = "#30362d";
  ctx.font = "50px Georgia";
  ctx.fillText("hairroom.", 72, 100);
  ctx.fillStyle = "#74796a";
  ctx.font = "22px sans-serif";
  ctx.fillText("MY NEXT HAIR DAY / 理发沟通卡", 72, 146);
  ctx.strokeStyle = "#d8dccf";
  ctx.beginPath();
  ctx.moveTo(72, 180);
  ctx.lineTo(1128, 180);
  ctx.stroke();
  ctx.fillStyle = "#30362d";
  ctx.font = "bold 48px sans-serif";
  ctx.fillText(style.name, 72, 255);
  ctx.fillStyle = "#74796a";
  ctx.font = "23px sans-serif";
  ctx.fillText(style.englishName || "A new possibility", 74, 297);

  const sampleImage = await loadImage(demoAsset(style));
  const original = photo ? await loadImage(photo) : sampleImage;
  const result = generatedImage
    ? await loadImage(generatedImage)
    : style.demoKey
      ? sampleImage
      : null;
  if (original)
    drawCover(ctx, original, 72, 335, 510, 510, photo ? null : PANELS.original);
  else {
    ctx.fillStyle = "#e8ebdf";
    ctx.fillRect(72, 335, 510, 510);
  }
  if (result)
    drawCover(
      ctx,
      result,
      618,
      335,
      510,
      510,
      generatedImage ? null : PANELS[style.demoKey],
    );
  else {
    ctx.fillStyle = "#e8ebdf";
    ctx.fillRect(618, 335, 510, 510);
    ctx.fillStyle = "#6b7558";
    ctx.font = "28px sans-serif";
    ctx.fillText("暂无此款试戴图", 755, 600);
  }
  ctx.fillStyle = "#626959";
  ctx.font = "24px sans-serif";
  ctx.fillText(
    originalLabel || (photo ? "你的原始照片" : "AI 示例 · 原发型"),
    72,
    887,
  );
  ctx.fillText(
    resultLabel ||
      (generatedImage
        ? "AI 试戴 · 仅供参考"
        : result
          ? "AI 款式示例 · 非你的试戴"
          : "此款为文字方案 · 暂无试戴图"),
    618,
    887,
  );
  ctx.fillStyle = "#30362d";
  ctx.font = "bold 30px sans-serif";
  ctx.fillText("和理发师这样沟通", 72, 973);
  ctx.font = "25px sans-serif";
  let y = 1030;
  for (const [index, note] of (style.salonNotes || []).slice(0, 4).entries()) {
    ctx.fillStyle = "#6b7558";
    ctx.fillText(String(index + 1).padStart(2, "0"), 72, y);
    ctx.fillStyle = "#41473b";
    y = paragraph(ctx, note, 130, y, 990, 40) + 18;
  }
  const caution = [...(style.requirements || []), ...(style.cautions || [])]
    .slice(0, 2)
    .join("；");
  ctx.fillStyle = "#74796a";
  ctx.font = "22px sans-serif";
  y = Math.max(y + 15, 1385);
  paragraph(
    ctx,
    `剪之前请确认：${caution || "请让理发师结合实际发质、发量与生长方向确认可行性。"}`,
    72,
    y,
    1056,
    35,
  );
  ctx.strokeStyle = "#d8dccf";
  ctx.beginPath();
  ctx.moveTo(72, 1570);
  ctx.lineTo(1128, 1570);
  ctx.stroke();
  ctx.font = "20px sans-serif";
  ctx.fillText(
    "这是沟通参考，实际剪发效果取决于发质、长度和造型方式。",
    72,
    1620,
  );
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("沟通卡导出失败，请重试。");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Hairroom-${style.name}-理发沟通卡.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function salonText(style) {
  return `${style.name} / ${style.englishName || ""}\n\n我想这样剪：\n${(style.salonNotes || []).map((n, i) => `${i + 1}. ${n}`).join("\n")}\n\n剪之前请确认：\n${[...(style.requirements || []), ...(style.cautions || [])].join("\n")}\n\nHairroom · 发型沟通参考，实际效果请与理发师确认。`;
}
