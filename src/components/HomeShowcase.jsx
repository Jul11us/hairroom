import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Scissors,
  X,
} from "lucide-react";
import { LOOKS, lookImageUrl, pickNext } from "../lib/hair-looks.js";
import "./home-showcase.css";

const BY_ID = new Map(LOOKS.map((look) => [look.id, look]));
const POOLS = {
  f: LOOKS.filter((look) => look.gender === "f"),
  m: LOOKS.filter((look) => look.gender === "m"),
};

// Women and men alternate, offset on the second row of six.
const TILE_COUNT = 12;
const TILES = Array.from({ length: TILE_COUNT }, (_, i) => ({
  id: i,
  gender: (i + Math.floor(i / 6)) % 2 ? "m" : "f",
}));

const reduceMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function flip(from, to) {
  return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})`;
}

// One look as an image layer: a hotlinked Unsplash photo, or a panel of the
// local AI contact sheet. onReady fires once it can be shown.
function LookImage({ look, size, className, onReady, onFail, ...props }) {
  useEffect(() => {
    if (look.sheet) onReady?.();
  }, [look]);
  if (look.sheet) {
    return (
      <div
        className={className}
        style={{
          backgroundImage: `url(${look.sheet})`,
          backgroundPosition: look.position,
          backgroundSize: "200% 200%",
        }}
        {...props}
      />
    );
  }
  return (
    <img
      className={className}
      src={lookImageUrl(look, size)}
      alt=""
      draggable="false"
      onLoad={onReady}
      onError={onFail}
      {...props}
    />
  );
}

// A tile cross-fades to its next look only once that image has loaded.
function WallTile({ tile, look, lifted, onOpen, onFail, tileRef }) {
  const [layers, setLayers] = useState([{ key: 0, look, ready: false }]);
  const nextKey = useRef(1);
  useEffect(() => {
    setLayers((current) =>
      current.at(-1).look.id === look.id
        ? current
        : [...current.slice(-1), { key: nextKey.current++, look, ready: false }],
    );
  }, [look]);
  const update = (key, change) =>
    setLayers((current) =>
      current.map((layer) => (layer.key === key ? { ...layer, ...change } : layer)),
    );
  return (
    <button
      ref={tileRef}
      className={`wall-tile ${lifted ? "is-lifted" : ""}`}
      aria-label={`${look.name}${look.ai ? "（AI 示例）" : ""}，点击放大`}
      onClick={onOpen}
    >
      {layers.map((layer, index) => (
        <LookImage
          key={layer.key}
          look={layer.look}
          size={480}
          className={`wall-layer ${layer.ready ? "is-active" : ""}`}
          onReady={() => {
            update(layer.key, { ready: true });
            // Without a fade there is no transitionend to drop the old layer.
            if (reduceMotion())
              setLayers((current) => current.filter((l) => l.key >= layer.key));
          }}
          onFail={() => {
            setLayers((current) =>
              current.length > 1 ? current.filter((l) => l.key !== layer.key) : current,
            );
            onFail(tile.id, layer.look.id);
          }}
          onTransitionEnd={() => {
            if (index === layers.length - 1 && layer.ready)
              setLayers((current) => current.filter((l) => l.key >= layer.key));
          }}
        />
      ))}
    </button>
  );
}

function initialLooks() {
  const taken = new Set();
  return TILES.map((tile) => {
    const id = pickNext(POOLS[tile.gender], taken, null);
    taken.add(id);
    return id;
  });
}

export default function HomeShowcase({ onEnter }) {
  const [shown, setShown] = useState(initialLooks);
  const [paused, setPaused] = useState(false);
  const [focus, setFocus] = useState(null);
  const [closing, setClosing] = useState(false);
  const [largeReady, setLargeReady] = useState(false);
  const brokenRef = useRef(new Set());
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const tileRefs = useRef([]);
  const cardRef = useRef(null);
  const closeRef = useRef(null);
  const keyRef = useRef(null);
  const returnFocusRef = useRef(null);

  const usable = (gender) =>
    POOLS[gender].filter((look) => !brokenRef.current.has(look.id));

  function advance(tileId, prev) {
    const tile = TILES[tileId];
    const next = [...prev];
    next[tileId] = pickNext(usable(tile.gender), new Set(prev), prev[tileId]);
    return next;
  }

  useEffect(() => {
    if (paused) return;
    const stops = TILES.map((tile) => {
      let timer;
      const tick = (delay) => {
        timer = setTimeout(() => {
          if (focusRef.current?.tile !== tile.id)
            setShown((prev) => advance(tile.id, prev));
          tick(3000 + Math.random() * 2600);
        }, delay);
      };
      tick(600 + Math.random() * 3000);
      return () => clearTimeout(timer);
    });
    return () => stops.forEach((stop) => stop());
  }, [paused]);

  // A photo that cannot load (offline, removed) leaves the pool for good.
  function lookFailed(tileId, lookId) {
    brokenRef.current.add(lookId);
    setShown((prev) => (prev[tileId] === lookId ? advance(tileId, prev) : prev));
  }

  useLayoutEffect(() => {
    if (!focus) return;
    closeRef.current?.focus({ preventScroll: true });
    if (reduceMotion()) return;
    const card = cardRef.current;
    card.animate(
      [
        { transform: flip(focus.from, card.getBoundingClientRect()) },
        { transform: "none" },
      ],
      { duration: 560, easing: "cubic-bezier(0.2, 0.75, 0.15, 1)" },
    );
  }, [focus]);

  useEffect(() => {
    if (focus || !returnFocusRef.current) return;
    returnFocusRef.current.focus({ preventScroll: true });
    returnFocusRef.current = null;
  }, [focus]);

  useEffect(() => {
    if (!focus) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => keyRef.current(e);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [focus]);

  function open(i) {
    setClosing(false);
    setLargeReady(false);
    setFocus({
      tile: i,
      from: tileRefs.current[i].getBoundingClientRect(),
    });
  }

  function close() {
    if (!focus || closing) return;
    const card = cardRef.current;
    const tileEl = tileRefs.current[focus.tile];
    setClosing(true);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      returnFocusRef.current = tileEl;
      setFocus(null);
      setClosing(false);
    };
    if (reduceMotion() || !card || !tileEl) return finish();
    card.getAnimations().forEach((a) => a.cancel());
    const anim = card.animate(
      [
        { transform: "none" },
        {
          transform: flip(
            tileEl.getBoundingClientRect(),
            card.getBoundingClientRect(),
          ),
        },
      ],
      {
        duration: 420,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        fill: "forwards",
      },
    );
    anim.onfinish = finish;
    // Animations pause in background tabs; make sure the view still closes.
    setTimeout(finish, 520);
  }

  // Browse the same gender's looks in the enlarged view, skipping looks that
  // other tiles are showing so the wall never repeats a photo.
  function step(delta) {
    if (!focus) return;
    const tile = TILES[focus.tile];
    setLargeReady(false);
    setShown((prev) => {
      const pool = usable(tile.gender);
      const others = new Set(prev.filter((_, i) => i !== tile.id));
      let index = pool.findIndex((look) => look.id === prev[tile.id]);
      for (let tries = 0; tries < pool.length; tries++) {
        index = (index + delta + pool.length) % pool.length;
        if (!others.has(pool[index].id)) break;
      }
      const next = [...prev];
      next[tile.id] = pool[index].id;
      return next;
    });
  }

  keyRef.current = (e) => {
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
  };

  const focusLook = focus && BY_ID.get(shown[focus.tile]);
  const pool = focus && usable(TILES[focus.tile].gender);
  const position = focus ? pool.findIndex((l) => l.id === focusLook.id) + 1 : 0;

  return (
    <div className="home-wall">
      <div className="wall-page" inert={focus ? true : undefined}>
        <header className="home-top">
          <span className="home-brand">
            <Scissors size={17} strokeWidth={1.5} />
            <span>
              hairroom<span className="brand-period">.</span>
            </span>
          </span>
          <span className="home-sample-badge">发型参考图</span>
        </header>

        <main className="wall-stage">
          <p className="wall-hint">
            <span>FIND YOUR NEXT LOOK</span>
            点一下任意一位，看清这款发型
          </p>
          <div className="wall-grid">
            {TILES.map((tile) => (
              <WallTile
                key={tile.id}
                tile={tile}
                look={BY_ID.get(shown[tile.id])}
                lifted={focus?.tile === tile.id}
                onOpen={() => open(tile.id)}
                onFail={lookFailed}
                tileRef={(el) => (tileRefs.current[tile.id] = el)}
              />
            ))}
          </div>
        </main>

        <footer className="home-bottom">
          <div className="home-actions">
            <button
              className="home-pause"
              aria-label={paused ? "继续切换发型" : "暂停切换发型"}
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? <Play size={13} /> : <Pause size={13} />}
            </button>
            <button className="home-enter" onClick={() => onEnter()}>
              进入发型工作室
              <ArrowRight size={15} />
            </button>
          </div>
          <p className="home-credits">
            真人照片由{" "}
            <a
              href="https://unsplash.com/?utm_source=hairroom&utm_medium=referral"
              target="_blank"
              rel="noopener noreferrer"
            >
              Unsplash
            </a>{" "}
            的摄影师拍摄，点开可查看署名；标注「AI 示例」的是虚构模特。
          </p>
        </footer>
      </div>

      {focus && (
        <div
          className={`wall-focus ${closing ? "is-closing" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label={focusLook.name}
          onClick={(e) => {
            if (
              !e.target.closest(
                ".wall-focus-card, .wall-focus-info, .wall-focus-close",
              )
            )
              close();
          }}
        >
          <button
            ref={closeRef}
            className="wall-focus-close"
            aria-label="关闭放大"
            onClick={close}
          >
            <X size={20} />
          </button>
          <div className="wall-focus-body">
            <div ref={cardRef} className="wall-focus-card">
              <LookImage
                key={`${focusLook.id}-small`}
                look={focusLook}
                size={480}
                className="wall-layer is-active"
              />
              {!focusLook.sheet && (
                <LookImage
                  key={`${focusLook.id}-large`}
                  look={focusLook}
                  size={1000}
                  className={`wall-layer ${largeReady ? "is-active" : ""}`}
                  onReady={() => setLargeReady(true)}
                />
              )}
              {focusLook.ai && <span className="wall-focus-badge">AI 示例</span>}
            </div>
            <div className="wall-focus-info">
              <span className="wall-focus-en" key={`en-${focusLook.id}`}>
                {focusLook.englishName}
              </span>
              <h2 key={`zh-${focusLook.id}`}>{focusLook.name}</h2>
              <p key={`tag-${focusLook.id}`}>{focusLook.tagline}</p>
              <p className="wall-focus-credit" key={`credit-${focusLook.id}`}>
                {focusLook.ai ? (
                  "AI 生成的虚构模特，用于演示发型"
                ) : (
                  <>
                    摄影：
                    <a
                      href={focusLook.credit.photographerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {focusLook.credit.photographer}
                    </a>
                    {" · "}
                    <a
                      href={focusLook.credit.photoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Unsplash 原图
                    </a>
                  </>
                )}
              </p>
              <div className="wall-focus-nav">
                <button aria-label="上一款发型" onClick={() => step(-1)}>
                  <ChevronLeft size={18} />
                </button>
                <span>
                  {position} / {pool.length}
                </span>
                <button aria-label="下一款发型" onClick={() => step(1)}>
                  <ChevronRight size={18} />
                </button>
              </div>
              {focusLook.style && (
                <button
                  className="home-enter"
                  onClick={() => onEnter(focusLook.style)}
                >
                  看看这款方案
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
