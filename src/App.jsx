import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  Heart,
  ImagePlus,
  Images,
  LayoutGrid,
  Leaf,
  LoaderCircle,
  LockKeyhole,
  Maximize2,
  MousePointer2,
  Plus,
  RotateCcw,
  Scissors,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  DEFAULT_PREFERENCES,
  explainStyle,
  recommendStyles,
  STYLES,
} from "./lib/recommendations.js";
import { demoAsset, exportSalonCard, salonText } from "./lib/export-card.js";
import HairEditor from "./components/HairEditor.jsx";
import HomeShowcase from "./components/HomeShowcase.jsx";

const PANELS = {
  original: [0, 0],
  "curtain-layers": [1, 0],
  "airy-bob": [0, 1],
  "soft-waves": [1, 1],
  crop: [1, 0],
  "side-part": [0, 1],
  "textured-quiff": [1, 1],
};
const OPTIONS = {
  presentation: [
    ["feminine", "偏女性发型"],
    ["masculine", "偏男性发型"],
    ["any", "都想看看"],
  ],
  texture: [
    ["straight", "直发"],
    ["wavy", "自然微卷"],
    ["curly", "明显卷发"],
  ],
  density: [
    ["fine", "偏细软 / 发量少"],
    ["medium", "发量适中"],
    ["thick", "发量偏多"],
  ],
  currentLength: [
    ["short", "短发 · 耳际附近"],
    ["medium", "中发 · 下巴至锁骨"],
    ["long", "长发 · 锁骨以下"],
  ],
  desiredLength: [
    ["short", "想试试短发"],
    ["medium", "保持中等长度"],
    ["long", "想保留长发"],
  ],
  maintenance: [
    ["low", "简单就好 · 5 分钟内"],
    ["medium", "愿意打理 · 5–15 分钟"],
    ["high", "喜欢造型 · 15 分钟以上"],
  ],
  goal: [
    ["soften", "线条柔和一点"],
    ["volume", "看起来更蓬松"],
    ["fresh", "想要明显改变"],
  ],
};
const LABELS = {
  presentation: "想看的发型",
  texture: "你的自然发质",
  density: "发丝与发量",
  currentLength: "现在的头发长度",
  desiredLength: "想要的长度",
  maintenance: "每天愿意花多久打理",
  goal: "这次更希望",
};

function Portrait({
  style,
  original = false,
  source,
  altLabel,
  className = "",
  children,
}) {
  const key = original ? "original" : style?.demoKey;
  const position = PANELS[key];
  return (
    <div
      className={`portrait ${className} ${!source && !position ? "portrait-placeholder" : ""}`}
    >
      {source ? (
        <img
          src={source}
          alt={
            altLabel ||
            (original ? "上传的原始照片" : `${style.name}的 AI 试戴结果`)
          }
        />
      ) : !position ? (
        <>
          <Scissors size={38} strokeWidth={1} />
          <span>{style?.name}</span>
          <small>查看款式说明</small>
        </>
      ) : (
        <svg
          className="portrait-sheet"
          viewBox={`${position[0] * 627} ${position[1] * 627} 627 627`}
          preserveAspectRatio="xMidYMid slice"
          role="img"
          aria-label={
            original ? "虚构模特原发型示例" : `${style.name} · AI 款式示例`
          }
        >
          <image href={demoAsset(style)} width="1254" height="1254" />
        </svg>
      )}
      {children}
    </div>
  );
}

function Dialog({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
  className = "",
}) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const before = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    function onKey(e) {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const focusables = [
          ...ref.current.querySelectorAll(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]",
          ),
        ];
        const first = focusables[0],
          last = focusables.at(-1);
        if (!first) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKey);
      before?.focus();
    };
  }, []);
  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        className={`dialog ${wide ? "dialog-wide" : ""} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="dialog-header">
          <div>
            <span className="eyebrow">YOUR HAIR, YOUR WAY</span>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="关闭弹窗"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function PreferenceSelect({ name, value, onChange }) {
  return (
    <label className="field">
      <span>{LABELS[name]}</span>
      <div className="select-wrap">
        <select
          name={name}
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
        >
          {OPTIONS[name].map(([key, label]) => (
            <option value={key} key={key}>
              {label}
            </option>
          ))}
        </select>
        <ChevronDown size={14} />
      </div>
    </label>
  );
}

async function preparePhoto(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("请选择 JPG、PNG 或 WebP 格式的照片。");
  if (file.size > 8 * 1024 * 1024)
    throw new Error("照片需要小于 8 MB，请先压缩后上传。");
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  }).catch(() => {
    throw new Error("无法读取这张照片，请更换文件。");
  });
  if (bitmap.width < 160 || bitmap.height < 160) {
    bitmap.close();
    throw new Error("照片太小了，请选择宽和高都至少 160 像素的照片。");
  }
  const factor = Math.min(1, 1536 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * factor);
  canvas.height = Math.round(bitmap.height * factor);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.92);
}

export default function App() {
  const [home, setHome] = useState(true);
  const [tab, setTab] = useState("studio");
  const [draft, setDraft] = useState({ ...DEFAULT_PREFERENCES });
  const [preferences, setPreferences] = useState({ ...DEFAULT_PREFERENCES });
  const [photo, setPhoto] = useState(null);
  const [photoName, setPhotoName] = useState("");
  const [sampleChosen, setSampleChosen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [help, setHelp] = useState(false);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState({});
  const [hairEdits, setHairEdits] = useState({});
  const [editorTarget, setEditorTarget] = useState(null);
  const [generation, setGeneration] = useState(null);
  const [consent, setConsent] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [config, setConfig] = useState({ tryOnAvailable: false });
  const [inspirationFilter, setInspirationFilter] = useState("any");
  const [savedIds, setSavedIds] = useState(() => {
    try {
      const ids = JSON.parse(localStorage.getItem("hairroom-saved") || "[]");
      return Array.isArray(ids)
        ? ids.filter((id) => STYLES.some((s) => s.id === id))
        : [];
    } catch {
      return [];
    }
  });
  const fileRef = useRef(null);
  const uploadSeqRef = useRef(0);
  const currentPhotoRef = useRef(photo);
  currentPhotoRef.current = photo;
  const abortRef = useRef(null);
  const recommendations = useMemo(
    () => recommendStyles(preferences),
    [preferences],
  );
  const isDirty = JSON.stringify(draft) !== JSON.stringify(preferences);
  const activeGenderStyle = { presentation: draft.presentation };
  const displayStyles =
    tab === "saved"
      ? STYLES.filter((s) => savedIds.includes(s.id)).map((s) =>
          explainStyle(s, preferences),
        )
      : tab === "inspiration"
        ? STYLES.filter(
            (s) =>
              inspirationFilter === "any" ||
              s.presentation === inspirationFilter ||
              s.presentation === "any",
          ).map((s) => explainStyle(s, preferences))
        : recommendations;

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/config", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setConfig)
      .catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("hairroom-saved", JSON.stringify(savedIds));
    } catch {}
  }, [savedIds]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3600);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => () => abortRef.current?.abort(), []);

  function updateDraft(name, value) {
    setDraft((v) => ({ ...v, [name]: value }));
  }
  function notify(message) {
    setToast(message);
  }
  function toggleSave(style) {
    setSavedIds((ids) =>
      ids.includes(style.id)
        ? ids.filter((id) => id !== style.id)
        : [...ids, style.id],
    );
    notify(
      savedIds.includes(style.id) ? "已移出我的方案" : "已收藏到「我的方案」",
    );
  }
  function applyPreferences() {
    setPreferences({ ...draft });
    setShowPreferences(false);
    setTab("studio");
    notify("已根据你的偏好更新三款建议");
  }
  async function handleFile(file) {
    if (!file) return;
    const uploadSeq = ++uploadSeqRef.current;
    setPhotoBusy(true);
    setError("");
    try {
      const result = await preparePhoto(file);
      if (uploadSeq !== uploadSeqRef.current) return;
      abortRef.current?.abort();
      currentPhotoRef.current = result;
      setGeneration(null);
      setGenerated({});
      setHairEdits({});
      setPhoto(result);
      setPhotoName(file.name);
      setSampleChosen(false);
      setConsent(false);
      notify("照片已准备好，仅保留在当前页面");
    } catch (e) {
      if (uploadSeq === uploadSeqRef.current) setError(e.message);
    } finally {
      if (uploadSeq === uploadSeqRef.current) {
        setPhotoBusy(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    }
  }
  function clearPhoto() {
    ++uploadSeqRef.current;
    setPhotoBusy(false);
    abortRef.current?.abort();
    currentPhotoRef.current = null;
    setPhoto(null);
    setPhotoName("");
    setGenerated({});
    setHairEdits({});
    setGeneration(null);
    setConsent(false);
    setSampleChosen(false);
  }
  function chooseSample() {
    clearPhoto();
    setSampleChosen(true);
    notify("正在体验 AI 示例，未分析你的脸型");
  }
  async function tryOn(style) {
    if (!photo || !consent || !config.tryOnAvailable || generation) return;
    const inputPhoto = photo;
    const controller = new AbortController();
    abortRef.current = controller;
    setGeneration(style.id);
    setError("");
    try {
      const r = await fetch("/api/try-on", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo,
          style: {
            id: style.id,
            name: style.name,
            salonNotes: style.salonNotes,
          },
        }),
        signal: controller.signal,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "试戴生成失败，请稍后重试。");
      if (currentPhotoRef.current === inputPhoto) {
        setGenerated((v) => ({ ...v, [style.id]: data.image }));
        setHairEdits((v) => {
          const next = { ...v };
          delete next[style.id];
          return next;
        });
        notify("试戴已生成，请核对五官与发量是否符合实际");
      }
    } catch (e) {
      if (e.name !== "AbortError")
        setError(e.message || "连接失败，请稍后重试。");
    } finally {
      if (abortRef.current === controller) setGeneration(null);
    }
  }
  async function download(style) {
    setExporting(true);
    try {
      await exportSalonCard({
        style,
        photo: hairEdits[style.id]?.original || photo,
        generatedImage: hairEdits[style.id]?.image || generated[style.id],
        originalLabel: hairEdits[style.id]
          ? hairEdits[style.id].demo
            ? "AI 示例 · 整理前"
            : "整理前照片"
          : undefined,
        resultLabel: hairEdits[style.id]
          ? hairEdits[style.id].demo
            ? "AI 示例 · 手动整理"
            : "手动整理 · 二维预览"
          : undefined,
      });
      notify("理发沟通卡已导出");
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  }
  async function copy(style) {
    try {
      await navigator.clipboard.writeText(salonText(style));
      notify("理发沟通要点已复制");
    } catch {
      setError("浏览器未允许复制，请使用「保存沟通卡」。");
    }
  }

  function previewLabel(style) {
    const edit = hairEdits[style.id];
    if (edit) return edit.demo ? "AI 示例 · 手动整理" : "手动整理 · 二维预览";
    return generated[style.id]
      ? "你的 AI 试戴"
      : style.demoKey
        ? "AI 款式示例"
        : "发型方案";
  }

  function openHairEditor(style = null) {
    const key = style?.id || "original";
    const previous = hairEdits[key];
    let imageSrc = previous?.image || (style ? generated[style.id] : photo);
    let sourcePanel = null;
    let demo = previous?.demo || false;
    if (!imageSrc && style?.demoKey) {
      imageSrc = demoAsset(style);
      sourcePanel = PANELS[style.demoKey];
      demo = true;
    } else if (!imageSrc && photo) imageSrc = photo;
    else if (!imageSrc) {
      imageSrc = demoAsset(style || activeGenderStyle);
      sourcePanel = PANELS.original;
      demo = true;
    }
    setEditorTarget({
      key,
      imageSrc,
      sourcePanel,
      demo,
      sourceLabel: demo
        ? `AI 示例${style ? ` · ${style.name}` : " · 原发型"}`
        : style && generated[style.id]
          ? "个人 AI 试戴照片"
          : "你的照片 · 本机编辑",
    });
  }

  function saveHairEdit(result) {
    setHairEdits((v) => ({
      ...v,
      [editorTarget.key]: {
        ...result,
        demo: editorTarget.demo,
        sourceLabel: editorTarget.sourceLabel,
      },
    }));
    setEditorTarget(null);
    notify("已保存手动整理预览，照片仅保留在当前页面");
  }

  if (home)
    return (
      <HomeShowcase
        onEnter={(style) => {
          setHome(false);
          setError("");
          if (style) setSelected(explainStyle(style, preferences));
        }}
      />
    );

  return (
    <div className="app-shell">
      <input
        ref={fileRef}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="上传自拍照片"
        onChange={(e) => handleFile(e.target.files[0])}
      />
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("studio");
            setHome(true);
          }}
          aria-label="Hairroom 首页"
        >
          <span className="brand-mark">
            <Scissors size={21} strokeWidth={1.5} />
          </span>
          <span>
            hairroom<span className="brand-period">.</span>
          </span>
        </a>
        <div className="sidebar-caption">A LITTLE CHANGE. A NEW YOU.</div>
        <nav aria-label="主导航">
          <button
            aria-label="发型工作室"
            className={`nav-item ${tab === "studio" ? "active" : ""}`}
            onClick={() => setTab("studio")}
          >
            <LayoutGrid size={18} />
            <span>发型工作室</span>
            <span className="active-dot" />
          </button>
          <button
            aria-label="我的方案"
            className={`nav-item ${tab === "saved" ? "active" : ""}`}
            onClick={() => setTab("saved")}
          >
            <Bookmark size={18} />
            <span>我的方案</span>
            {savedIds.length > 0 && (
              <span className="nav-count">{savedIds.length}</span>
            )}
          </button>
          <button
            aria-label="发型灵感"
            className={`nav-item ${tab === "inspiration" ? "active" : ""}`}
            onClick={() => setTab("inspiration")}
          >
            <Images size={18} />
            <span>发型灵感</span>
            <ArrowUpRight className="nav-arrow" size={14} />
          </button>
        </nav>
        <div className="sidebar-note">
          <div className="note-sparkle">
            <Sparkles size={21} strokeWidth={1.2} />
          </div>
          <p>
            不用急着改变，
            <br />
            先看看新的可能。
          </p>
          <span>MAKE ROOM FOR A NEW LOOK</span>
        </div>
        <div className="sidebar-bottom">
          <button onClick={() => setHelp(true)}>
            <CircleHelp size={17} />
            使用说明
            <ArrowUpRight size={13} />
          </button>
          <div className="sidebar-signature">
            <span className="tiny-dot" />
            你的下一次 good hair day
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            我的空间 <ChevronRight size={12} />
            <span>
              {tab === "studio"
                ? "发型工作室"
                : tab === "saved"
                  ? "我的方案"
                  : "发型灵感"}
            </span>
          </div>
          <div className="topbar-right">
            <span className="private-note">
              <LockKeyhole size={13} />
              照片由你掌控
            </span>
            <button
              className="avatar"
              aria-label="查看使用说明"
              onClick={() => setHelp(true)}
            >
              H
            </button>
          </div>
        </header>
        <main>
          <section className="intro">
            <div>
              <div className="intro-eyebrow">
                <span className="short-line" /> FIND YOUR NEXT LOOK
              </div>
              <h1>
                {tab === "studio" ? (
                  <>
                    好发型，从<span className="headline-accent">适合你</span>
                    开始<span className="serif-dot">。</span>
                  </>
                ) : tab === "saved" ? (
                  <>
                    留住心动的<span className="headline-accent">那一款</span>。
                  </>
                ) : (
                  <>
                    给下一次改变，
                    <span className="headline-accent">一点灵感</span>。
                  </>
                )}
              </h1>
              <p>
                {tab === "studio"
                  ? "少一点「剪完才知道」，多一点刚刚好的自己。"
                  : tab === "saved"
                    ? "收藏喜欢的方案，把想法带到理发师面前。"
                    : "从喜欢的轮廓开始，慢慢找到自己的风格。"}
              </p>
            </div>
            <div className="intro-decoration" aria-hidden="true">
              <span className="decor-circle">
                <Scissors size={38} strokeWidth={0.9} />
              </span>
              <span className="handwriting">a fresh perspective</span>
              <svg width="73" height="21" viewBox="0 0 73 21" fill="none">
                <path
                  d="M2 10c15-8 40-7 58-2m-8-6 13 7-12 9"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </section>

          {tab === "studio" && (
            <div className="workflow-strip">
              <span className="workflow-step active">
                <span>01</span>上传照片
              </span>
              <div />
              <span className="workflow-step">
                <span>02</span>告诉我们你的偏好
              </span>
              <div />
              <span className="workflow-step">
                <span>03</span>找到心动方案
              </span>
              <span className="workflow-note">
                <Leaf size={14} />
                按你的节奏来
              </span>
            </div>
          )}

          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="关闭错误提示"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div
            className={`workspace ${tab !== "studio" ? "workspace-gallery" : ""}`}
          >
            {tab === "studio" && (
              <aside className="input-column">
                <section className="photo-panel">
                  <div className="panel-heading">
                    <h2>你的照片</h2>
                    <span>THE STARTING POINT</span>
                  </div>
                  <div
                    className={`photo-drop ${dragging ? "dragging" : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      handleFile(e.dataTransfer.files[0]);
                    }}
                  >
                    <Portrait original style={activeGenderStyle} source={photo}>
                      <span className="image-badge">
                        {photo ? "你的原始照片" : "AI 示例模特"}
                      </span>
                      {photo && (
                        <button
                          className="photo-remove"
                          aria-label="删除上传照片"
                          onClick={clearPhoto}
                        >
                          <X size={15} />
                        </button>
                      )}
                      {!photo && (
                        <div className="photo-fade">
                          <button
                            className="upload-on-image"
                            onClick={() => fileRef.current?.click()}
                            disabled={photoBusy}
                          >
                            {photoBusy ? (
                              <LoaderCircle size={17} className="spin" />
                            ) : (
                              <ImagePlus size={17} />
                            )}
                            上传我的照片
                            <ArrowUpRight size={15} />
                          </button>
                        </div>
                      )}
                      {photo && (
                        <button
                          className="replace-photo"
                          onClick={() => fileRef.current?.click()}
                        >
                          <RotateCcw size={13} />
                          更换照片
                        </button>
                      )}
                    </Portrait>
                  </div>
                  {photo ? (
                    <p className="file-name" title={photoName}>
                      <Check size={13} />
                      {photoName}
                    </p>
                  ) : (
                    <button
                      className={`sample-button ${sampleChosen ? "sample-selected" : ""}`}
                      onClick={chooseSample}
                    >
                      {sampleChosen ? (
                        <Check size={13} />
                      ) : (
                        <Sparkles size={13} />
                      )}
                      {sampleChosen ? "正在体验示例照片" : "先用示例照片体验"}
                      <ChevronRight size={13} />
                    </button>
                  )}
                  <div className="photo-guidance">
                    <span>正面清晰 · 自然光线 · 不遮挡头发</span>
                    <small>支持 JPG、PNG、WebP，最大 8 MB</small>
                  </div>
                  <div className="privacy-line">
                    <ShieldCheck size={13} />
                    <span>上传照片仅留在本页，试戴前会征求同意</span>
                  </div>
                  <button
                    className="hair-edit-entry"
                    onClick={() => openHairEditor()}
                    disabled={photoBusy || !!generation}
                  >
                    <span>
                      <MousePointer2 size={15} />
                      {photo ? "用鼠标整理我的头发" : "用鼠标整理一下"}
                    </span>
                    <ArrowUpRight size={14} />
                  </button>
                  <span className="hair-entry-note">
                    拖动方向 · 局部蓬松 · 可随时撤销
                  </span>
                  {hairEdits.original && (
                    <div className="hair-edited-summary">
                      <img
                        src={hairEdits.original.image}
                        alt="已保存的手动整理预览"
                      />
                      <div>
                        <strong>刚刚整理的轮廓</strong>
                        <small>
                          {hairEdits.original.demo
                            ? "AI 示例 · 手动整理"
                            : "你的照片 · 二维预览"}
                        </small>
                      </div>
                      <button onClick={() => openHairEditor()}>继续整理</button>
                    </div>
                  )}
                </section>

                <section className="preferences-panel">
                  <div className="panel-heading">
                    <h2>一点小偏好</h2>
                    <button
                      className="text-link"
                      onClick={() => setShowPreferences(true)}
                    >
                      完整设置
                      <SlidersHorizontal size={12} />
                    </button>
                  </div>
                  <PreferenceSelect
                    name="presentation"
                    value={draft.presentation}
                    onChange={updateDraft}
                  />
                  <div className="length-field">
                    <span>这次想要的长度</span>
                    <div className="segment-control">
                      {[
                        ["short", "短一点"],
                        ["medium", "中等"],
                        ["long", "留长发"],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          className={
                            draft.desiredLength === key ? "selected" : ""
                          }
                          aria-pressed={draft.desiredLength === key}
                          onClick={() => updateDraft("desiredLength", key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <PreferenceSelect
                    name="texture"
                    value={draft.texture}
                    onChange={updateDraft}
                  />
                  <PreferenceSelect
                    name="maintenance"
                    value={draft.maintenance}
                    onChange={updateDraft}
                  />
                  <button
                    className="primary-button generate-button"
                    onClick={applyPreferences}
                  >
                    <Sparkles size={16} />
                    {isDirty ? "更新我的发型建议" : "生成我的发型建议"}
                    <ArrowRight size={16} />
                  </button>
                  <span className="preference-disclaimer">
                    根据填写的条件推荐，不进行脸型检测
                  </span>
                </section>
              </aside>
            )}

            <section className="results-column">
              <div className="results-heading">
                <div>
                  <div className="section-kicker">
                    {tab === "studio"
                      ? "A FEW POSSIBILITIES, JUST FOR YOU"
                      : tab === "saved"
                        ? "YOUR PERSONAL LOOKBOOK"
                        : "THE HAIR EDIT"}
                  </div>
                  <h2>
                    {tab === "studio"
                      ? "三种风格，三种新的可能"
                      : tab === "saved"
                        ? "我的心动方案"
                        : "从一种喜欢开始"}
                    {tab !== "studio" && (
                      <span className="result-count">
                        {displayStyles.length}
                      </span>
                    )}
                  </h2>
                </div>
                {tab === "studio" && (
                  <span className="sample-label">
                    <span />
                    {photo ? "款式参考 · 未试戴的图片为示例" : "AI 示例预览"}
                  </span>
                )}
              </div>
              {tab === "studio" ? (
                <div className="results-description">
                  <span>
                    {isDirty
                      ? "偏好已修改，点击左侧按钮更新建议。"
                      : "根据你的发质、长度与打理习惯，挑出值得聊一聊的方向。"}
                  </span>
                  <button
                    onClick={() => setShowPreferences(true)}
                    aria-label="调整发型偏好"
                  >
                    <SlidersHorizontal size={15} />
                  </button>
                </div>
              ) : tab === "inspiration" ? (
                <div className="gallery-filters">
                  {[
                    ["any", "全部风格"],
                    ["feminine", "女性发型"],
                    ["masculine", "男性发型"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={inspirationFilter === value ? "selected" : ""}
                      onClick={() => setInspirationFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="saved-description">
                  收藏只保存款式，不保存你的照片。你可以随时下载理发沟通卡。
                </p>
              )}

              {displayStyles.length === 0 ? (
                <div className="empty-state">
                  <Bookmark size={36} strokeWidth={1} />
                  <h3>心动的发型，值得留个位置</h3>
                  <p>点击款式卡片上的爱心，就能在这里找到它。</p>
                  <button
                    className="primary-button"
                    onClick={() => setTab("inspiration")}
                  >
                    去发现喜欢的发型
                    <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <div className="style-grid">
                  {displayStyles.map((style, index) => (
                    <article className="style-card" key={style.id}>
                      <div className="style-image-wrap">
                        <button
                          className="image-open"
                          onClick={() => {
                            setSelected(style);
                            setError("");
                          }}
                          aria-label={`查看${style.name}的方案`}
                        >
                          <Portrait
                            style={style}
                            source={
                              hairEdits[style.id]?.image || generated[style.id]
                            }
                            altLabel={`${style.name} · ${previewLabel(style)}`}
                          />
                          <span className="image-open-hint">
                            <Maximize2 size={15} />
                            查看方案
                          </span>
                        </button>
                        <span className="card-number">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <button
                          className={`save-button ${savedIds.includes(style.id) ? "is-saved" : ""}`}
                          aria-label={`${savedIds.includes(style.id) ? "取消收藏" : "收藏"}${style.name}`}
                          aria-pressed={savedIds.includes(style.id)}
                          onClick={() => toggleSave(style)}
                        >
                          <Heart
                            size={17}
                            fill={
                              savedIds.includes(style.id)
                                ? "currentColor"
                                : "none"
                            }
                          />
                        </button>
                        <span className="image-caption">
                          {previewLabel(style)}
                        </span>
                      </div>
                      <div className="style-card-content">
                        <div className="style-english">{style.englishName}</div>
                        <div className="style-title-row">
                          <h3>{style.name}</h3>
                          <span className="mini-sparkle">
                            <Sparkles size={15} strokeWidth={1.3} />
                          </span>
                        </div>
                        <p className="style-tagline">
                          {style.tagline || style.description}
                        </p>
                        <div className="style-tags">
                          <span>
                            {style.maintenance === "low"
                              ? "轻松打理"
                              : style.maintenance === "high"
                                ? "造型感更强"
                                : "适度打理"}
                          </span>
                          <span>
                            {style.presentation === "masculine"
                              ? "利落轮廓"
                              : index % 2 === 0
                                ? "自然氛围"
                                : "清爽轮廓"}
                          </span>
                        </div>
                        <div className="style-reason">
                          <span className="reason-mark" />
                          <p>{style.reasons?.[0] || style.description}</p>
                        </div>
                        <button
                          className="card-action"
                          onClick={() => {
                            setSelected(style);
                            setError("");
                          }}
                        >
                          看看这款方案
                          <ArrowUpRight size={17} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {tab === "studio" && (
                <>
                  <div className="consultation-note">
                    <div className="consultation-icon">
                      <Scissors size={22} strokeWidth={1.2} />
                    </div>
                    <div>
                      <h3>喜欢的样子，也要剪得出来。</h3>
                      <p>
                        每款都附有长度、打理建议与沟通要点，带着参考去和理发师聊聊。
                      </p>
                    </div>
                    <span className="note-script">made for real life.</span>
                  </div>
                  <div className="studio-footer">
                    <span>
                      <ShieldCheck size={13} />
                      保持你的五官，是试戴的第一原则
                    </span>
                    <span>示例与试戴效果仅作剪发沟通参考</span>
                  </div>
                </>
              )}
            </section>
          </div>
          <footer className="page-footer">
            <span>HAIRROOM © {new Date().getFullYear()}</span>
            <span>好的改变，是更像自己。</span>
            <button onClick={() => setHelp(true)}>
              关于试戴与照片
              <ArrowUpRight size={11} />
            </button>
          </footer>
        </main>
      </div>

      {showPreferences && (
        <Dialog
          title="从你的真实情况开始"
          subtitle="发质、长度和日常习惯，比一个脸型标签更有用。"
          onClose={() => setShowPreferences(false)}
        >
          <div className="preferences-form">
            {Object.keys(OPTIONS).map((name) => (
              <PreferenceSelect
                key={name}
                name={name}
                value={draft[name]}
                onChange={updateDraft}
              />
            ))}
          </div>
          <div className="dialog-footer">
            <button
              className="secondary-button"
              onClick={() => {
                setDraft({ ...preferences });
                setShowPreferences(false);
              }}
            >
              取消修改
            </button>
            <button className="primary-button" onClick={applyPreferences}>
              更新三款建议
              <ArrowRight size={16} />
            </button>
          </div>
        </Dialog>
      )}

      {editorTarget && (
        <Dialog
          wide
          className="hairroom-editor-dialog"
          title="亲手整理，找到喜欢的轮廓"
          subtitle="在头发上按住鼠标拖动。也可以用手指；松开后，再看看整理前后的区别。"
          onClose={() => setEditorTarget(null)}
        >
          <HairEditor
            key={editorTarget.key}
            imageSrc={editorTarget.imageSrc}
            sourcePanel={editorTarget.sourcePanel}
            sourceLabel={editorTarget.sourceLabel}
            onSave={saveHairEdit}
          />
        </Dialog>
      )}

      {selected && !editorTarget && (
        <Dialog
          wide
          title={selected.name}
          subtitle={selected.englishName}
          onClose={() => setSelected(null)}
        >
          <div className="detail-layout">
            <div className="detail-visual">
              <div className="comparison-grid">
                <div>
                  <Portrait
                    original
                    style={selected}
                    source={hairEdits[selected.id]?.original || photo}
                    altLabel={
                      hairEdits[selected.id] ? "手动整理前的照片" : undefined
                    }
                  />
                  <span>
                    {hairEdits[selected.id]
                      ? hairEdits[selected.id].demo
                        ? "AI 示例 · 整理前"
                        : "整理前照片"
                      : photo
                        ? "你的原始照片"
                        : "AI 示例 · 原发型"}
                  </span>
                </div>
                <div>
                  <Portrait
                    style={selected}
                    source={
                      hairEdits[selected.id]?.image || generated[selected.id]
                    }
                    altLabel={`${selected.name} · ${previewLabel(selected)}`}
                  />
                  <span>
                    {hairEdits[selected.id]
                      ? previewLabel(selected)
                      : generated[selected.id]
                        ? "你的 AI 试戴 · 请核对效果"
                        : "AI 款式示例 · 非你的试戴"}
                  </span>
                </div>
              </div>
              <div className="hair-detail-edit">
                <button
                  className="secondary-button"
                  disabled={!!generation}
                  onClick={() => openHairEditor(selected)}
                >
                  <MousePointer2 size={15} />
                  {hairEdits[selected.id]
                    ? "继续用鼠标整理"
                    : generated[selected.id]
                      ? "用鼠标调整这款试戴"
                      : selected.demoKey
                        ? "亲手整理这款示例"
                        : "用鼠标整理原照"}
                  <ArrowUpRight size={14} />
                </button>
                <p>
                  调整刘海方向和局部轮廓，改到喜欢再保存。示例编辑会一直标注为示例。
                </p>
              </div>
              <div className="tryon-box">
                {photo ? (
                  <>
                    <p>
                      {config.tryOnAvailable
                        ? "用这张自拍生成试戴，五官和肤质尽量保持原样。"
                        : "真实自拍试戴暂未开放。当前可查看款式参考、保存沟通卡。"}
                    </p>
                    {config.tryOnAvailable && (
                      <label className="consent-check">
                        <input
                          type="checkbox"
                          checked={consent}
                          onChange={(e) => setConsent(e.target.checked)}
                        />
                        我同意将这张照片发送至图像服务处理
                      </label>
                    )}
                    <button
                      className="primary-button"
                      disabled={
                        !config.tryOnAvailable || !consent || !!generation
                      }
                      onClick={() => tryOn(selected)}
                    >
                      {generation === selected.id ? (
                        <>
                          <LoaderCircle size={16} className="spin" />
                          正在生成，请稍候…
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          {config.tryOnAvailable
                            ? generated[selected.id]
                              ? "重新生成我的试戴"
                              : "生成我的试戴"
                            : "真人试戴暂未开放"}
                        </>
                      )}
                    </button>
                    {generation === selected.id && (
                      <button
                        className="text-link cancel-generation"
                        onClick={() => {
                          abortRef.current?.abort();
                          setGeneration(null);
                        }}
                      >
                        取消等待
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p>
                      现在看到的是同一位虚构模特的发型示例。上传自己的照片后，可在服务开放时生成个人试戴。
                    </p>
                    <button
                      className="secondary-button"
                      onClick={() => fileRef.current?.click()}
                      disabled={tab !== "studio"}
                    >
                      <Upload size={15} />
                      {tab === "studio" ? "上传我的照片" : "回到工作室上传照片"}
                    </button>
                    {tab !== "studio" && (
                      <button
                        className="text-link"
                        onClick={() => {
                          setTab("studio");
                          setSelected(null);
                        }}
                      >
                        返回工作室
                        <ArrowRight size={13} />
                      </button>
                    )}
                  </>
                )}
              </div>
              {error && (
                <p role="alert" className="detail-error">
                  {error}
                </p>
              )}
            </div>
            <div className="detail-copy">
              <span className="eyebrow">A LOOK THAT FITS YOUR LIFE</span>
              <h3>{selected.tagline || "给改变一个具体的方向"}</h3>
              <p>{selected.description}</p>
              {selected.reasons?.length > 0 && (
                <div className="detail-reasons">
                  {selected.reasons.map((reason, i) => (
                    <div key={i}>
                      <Check size={15} />
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="salon-notes">
                <div>
                  <Scissors size={16} />
                  <h4>和理发师这样说</h4>
                  <button
                    className="icon-button"
                    aria-label="复制理发沟通要点"
                    onClick={() => copy(selected)}
                  >
                    <Copy size={14} />
                  </button>
                </div>
                <ol>
                  {selected.salonNotes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ol>
              </div>
              <div className="requirements">
                <Leaf size={15} />
                <p>
                  {[
                    ...(selected.requirements || []),
                    ...(selected.cautions || []),
                  ]
                    .slice(0, 3)
                    .join("；") ||
                    "请让理发师结合你的实际发质、发量和生长方向确认可行性。"}
                </p>
              </div>
              <div className="detail-actions">
                <button
                  className="primary-button"
                  disabled={exporting}
                  onClick={() => download(selected)}
                >
                  {exporting ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <ArrowDownToLine size={16} />
                  )}
                  保存理发沟通卡
                </button>
                <button
                  className={`secondary-button ${savedIds.includes(selected.id) ? "saved" : ""}`}
                  onClick={() => toggleSave(selected)}
                >
                  <Heart
                    size={16}
                    fill={
                      savedIds.includes(selected.id) ? "currentColor" : "none"
                    }
                  />
                  {savedIds.includes(selected.id) ? "已收藏" : "收藏"}
                </button>
              </div>
            </div>
          </div>
          <div className="detail-disclaimer">
            AI
            图像可能改变发量或细节，请核对五官、发际线与头发质感。实际剪发效果需要与理发师确认。
          </div>
        </Dialog>
      )}

      {help && (
        <Dialog
          title="先看见，再决定"
          subtitle="Hairroom 是一个剪发前的沟通工作室。"
          onClose={() => setHelp(false)}
        >
          <div className="help-content">
            <div>
              <span>01</span>
              <section>
                <h3>建议来自你填写的条件</h3>
                <p>
                  我们按发质、长度、发量和打理习惯筛选款式。目前不检测脸型，也不给主观审美编造匹配分数。
                </p>
              </section>
            </div>
            <div>
              <span>02</span>
              <section>
                <h3>示例和个人试戴有明确区别</h3>
                <p>
                  带「AI
                  款式示例」的照片都是虚构模特。真实试戴服务可用时，你可以主动提交自拍；生成结果仍需要核对。
                </p>
              </section>
            </div>
            <div>
              <span>03</span>
              <section>
                <h3>照片由你掌控</h3>
                <p>
                  上传照片仅保留在当前页面，刷新即清除。只有同意并点击生成个人试戴时，照片才会发送至服务端和图像服务处理。收藏仅保存款式编号，不保存照片。
                </p>
              </section>
            </div>
            <div>
              <span>04</span>
              <section>
                <h3>把心动带到理发店</h3>
                <p>
                  在款式详情中，保存带参考图与剪发要点的沟通卡。是否需要烫发、留长或调整层次，请让理发师结合实际情况确认。
                </p>
              </section>
            </div>
          </div>
          <div className="dialog-footer">
            <button className="primary-button" onClick={() => setHelp(false)}>
              开始看看
              <ArrowRight size={16} />
            </button>
          </div>
        </Dialog>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCheck size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}
