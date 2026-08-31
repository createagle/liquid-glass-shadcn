"use strict";
var GlassOptics = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/debug-entry.ts
  var debug_entry_exports = {};
  __export(debug_entry_exports, {
    DISPLACEMENT_DEFAULTS: () => DISPLACEMENT_DEFAULTS,
    REFRACTION_DEFAULTS: () => REFRACTION_DEFAULTS,
    acquireFilter: () => acquireFilter,
    activeFilterCount: () => activeFilterCount,
    applyTier: () => applyTier,
    createDisplacementMap: () => createDisplacementMap,
    cssApprox: () => cssApprox,
    detectTierSync: () => detectTierSync,
    displacementKey: () => displacementKey,
    getFilterContainer: () => getFilterContainer,
    probeFeImage: () => probeFeImage,
    releaseFilter: () => releaseFilter,
    resetFilters: () => resetFilters,
    springs: () => springs
  });

  // src/filter/displacement-map.ts
  var DISPLACEMENT_DEFAULTS = {
    borderWidth: 0.18,
    brightness: 50,
    opacity: 0.93,
    blur: 6,
    mixBlendMode: "difference"
  };
  function displacementKey(o) {
    const bw = o.borderWidth ?? DISPLACEMENT_DEFAULTS.borderWidth;
    const br = o.brightness ?? DISPLACEMENT_DEFAULTS.brightness;
    const op = o.opacity ?? DISPLACEMENT_DEFAULTS.opacity;
    const bl = o.blur ?? DISPLACEMENT_DEFAULTS.blur;
    return [
      Math.round(o.width),
      Math.round(o.height),
      Math.round(o.radius),
      bw,
      br,
      op,
      bl
    ].join("x");
  }
  function createDisplacementMap(o) {
    const w = Math.max(1, Math.round(o.width));
    const h = Math.max(1, Math.round(o.height));
    const radius = Math.max(0, o.radius);
    const borderWidth = o.borderWidth ?? DISPLACEMENT_DEFAULTS.borderWidth;
    const brightness = o.brightness ?? DISPLACEMENT_DEFAULTS.brightness;
    const opacity = o.opacity ?? DISPLACEMENT_DEFAULTS.opacity;
    const blur = o.blur ?? DISPLACEMENT_DEFAULTS.blur;
    const mixBlendMode = o.mixBlendMode ?? DISPLACEMENT_DEFAULTS.mixBlendMode;
    const edge = Math.min(w, h) * (borderWidth * 0.5);
    const innerW = Math.max(0, w - edge * 2);
    const innerH = Math.max(0, h - edge * 2);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="x" x1="100%" y1="0%" x2="0%" y2="0%"><stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="red"/></linearGradient><linearGradient id="y" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="blue"/></linearGradient></defs><rect width="${w}" height="${h}" fill="black"/><rect width="${w}" height="${h}" rx="${radius}" fill="url(#x)"/><rect width="${w}" height="${h}" rx="${radius}" fill="url(#y)" style="mix-blend-mode:${mixBlendMode}"/><rect x="${edge}" y="${edge}" width="${innerW}" height="${innerH}" rx="${radius}" fill="hsl(0 0% ${brightness}% / ${opacity})" style="filter:blur(${blur}px)"/></svg>`;
    return {
      href: "data:image/svg+xml," + encodeURIComponent(svg),
      width: w,
      height: h,
      key: displacementKey(o)
    };
  }

  // src/filter/filter-factory.ts
  var SVGNS = "http://www.w3.org/2000/svg";
  var CONTAINER_ID = "lg-filter-defs";
  var FILTER_PREFIX = "lg-refract-";
  var REFRACTION_DEFAULTS = {
    distortionScale: -180,
    redOffset: 0,
    greenOffset: 18,
    blueOffset: 38,
    xChannel: "R",
    yChannel: "B",
    postBlur: 0.3
  };
  var cache = /* @__PURE__ */ new Map();
  var container = null;
  function getFilterContainer() {
    if (container?.isConnected) return container;
    const existing = document.getElementById(CONTAINER_ID);
    if (existing instanceof SVGSVGElement) {
      container = existing;
      return container;
    }
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("id", CONTAINER_ID);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", "10");
    svg.setAttribute("height", "10");
    svg.setAttribute("focusable", "false");
    svg.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;pointer-events:none;opacity:0";
    svg.appendChild(document.createElementNS(SVGNS, "defs"));
    document.body.appendChild(svg);
    container = svg;
    return svg;
  }
  function filterKey(o) {
    const r = { ...REFRACTION_DEFAULTS, ...o };
    return [
      displacementKey(o),
      r.distortionScale,
      r.redOffset,
      r.greenOffset,
      r.blueOffset,
      r.xChannel,
      r.yChannel,
      r.postBlur
    ].join("|");
  }
  function el(name, attrs) {
    const node = document.createElementNS(SVGNS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    return node;
  }
  function channelMatrix(channel) {
    const rows = {
      r: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0",
      g: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0",
      b: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
    };
    return rows[channel];
  }
  function buildFilter(id, o) {
    const r = { ...REFRACTION_DEFAULTS, ...o };
    const map = createDisplacementMap(o);
    const filter = document.createElementNS(SVGNS, "filter");
    filter.setAttribute("id", id);
    filter.setAttribute("x", "0%");
    filter.setAttribute("y", "0%");
    filter.setAttribute("width", "100%");
    filter.setAttribute("height", "100%");
    filter.setAttribute("filterUnits", "objectBoundingBox");
    filter.setAttribute("primitiveUnits", "userSpaceOnUse");
    filter.setAttribute("color-interpolation-filters", "sRGB");
    filter.appendChild(
      el("feImage", {
        href: map.href,
        x: 0,
        y: 0,
        width: map.width,
        height: map.height,
        preserveAspectRatio: "none",
        result: "map"
      })
    );
    const channels = [
      { key: "r", offset: r.redOffset },
      { key: "g", offset: r.greenOffset },
      { key: "b", offset: r.blueOffset }
    ];
    for (const { key, offset } of channels) {
      filter.appendChild(
        el("feDisplacementMap", {
          in: "SourceGraphic",
          in2: "map",
          xChannelSelector: r.xChannel,
          yChannelSelector: r.yChannel,
          scale: r.distortionScale + offset,
          result: `disp_${key}`
        })
      );
      filter.appendChild(
        el("feColorMatrix", {
          in: `disp_${key}`,
          type: "matrix",
          values: channelMatrix(key),
          result: key
        })
      );
    }
    filter.appendChild(el("feBlend", { in: "r", in2: "g", mode: "screen", result: "rg" }));
    filter.appendChild(el("feBlend", { in: "rg", in2: "b", mode: "screen", result: "rgb" }));
    filter.appendChild(el("feGaussianBlur", { in: "rgb", stdDeviation: r.postBlur }));
    return filter;
  }
  function acquireFilter(o) {
    const key = filterKey(o);
    const hit = cache.get(key);
    if (hit) {
      hit.refCount += 1;
      return hit.id;
    }
    const id = FILTER_PREFIX + cache.size.toString(36) + "-" + Math.random().toString(36).slice(2, 7);
    const filter = buildFilter(id, o);
    getFilterContainer().querySelector("defs")?.appendChild(filter);
    cache.set(key, { id, filter, refCount: 1 });
    return id;
  }
  function releaseFilter(o) {
    const key = filterKey(o);
    const hit = cache.get(key);
    if (!hit) return;
    hit.refCount -= 1;
    if (hit.refCount <= 0) {
      hit.filter.remove();
      cache.delete(key);
    }
  }
  function activeFilterCount() {
    let n = 0;
    for (const entry of cache.values()) n += entry.refCount;
    return n;
  }
  function resetFilters() {
    for (const entry of cache.values()) entry.filter.remove();
    cache.clear();
  }

  // src/tiers/detect.ts
  var GLASS_TIER_ATTR = "data-glass-tier";
  var PROBE_KEY = "lg:feimage-probe";
  function detectTierSync() {
    if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
      return detectTierByUA();
    }
    const blur = CSS.supports("backdrop-filter", "blur(10px)");
    const url = CSS.supports("backdrop-filter", "url(#x)");
    if (blur && url) return "a";
    if (blur) return "b";
    if (CSS.supports("-webkit-backdrop-filter", "blur(10px)")) return "b";
    return "c";
  }
  function detectTierByUA() {
    if (typeof navigator === "undefined") return "c";
    const ua = navigator.userAgent;
    if (/Chrome|Chromium|Edg\//.test(ua) && !/OPR\//.test(ua)) return "a";
    if (/Safari/.test(ua)) return "b";
    return "c";
  }
  async function probeFeImage() {
    if (typeof document === "undefined") return false;
    try {
      const cached = sessionStorage.getItem(PROBE_KEY);
      if (cached !== null) return cached === "1";
    } catch {
    }
    const ok = await runFeImageProbe();
    try {
      sessionStorage.setItem(PROBE_KEY, ok ? "1" : "0");
    } catch {
    }
    return ok;
  }
  function runFeImageProbe() {
    return new Promise((resolve) => {
      const src = document.createElement("canvas");
      src.width = 4;
      src.height = 4;
      const sctx = src.getContext("2d");
      if (!sctx) return resolve(false);
      sctx.fillStyle = "#ff00c8";
      sctx.fillRect(0, 0, 4, 4);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><defs><filter id="p" x="0" y="0" width="4" height="4" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feImage href="${src.toDataURL("image/png")}" x="0" y="0" width="4" height="4" preserveAspectRatio="none"/></filter></defs><rect width="4" height="4" fill="#000" filter="url(#p)"/></svg>`;
      const img = new Image();
      let settled = false;
      const done = (v) => {
        if (!settled) {
          settled = true;
          resolve(v);
        }
      };
      img.onload = () => {
        try {
          const out = document.createElement("canvas");
          out.width = 4;
          out.height = 4;
          const octx = out.getContext("2d", { willReadFrequently: true });
          if (!octx) return done(false);
          octx.drawImage(img, 0, 0);
          const [r, g, b] = octx.getImageData(2, 2, 1, 1).data;
          done((r ?? 0) > 200 && (g ?? 255) < 80 && (b ?? 0) > 150);
        } catch {
          done(false);
        }
      };
      img.onerror = () => done(false);
      setTimeout(() => done(false), 1500);
      img.src = "data:image/svg+xml," + encodeURIComponent(svg);
    });
  }
  function applyTier(tier, root) {
    const el2 = root ?? (typeof document !== "undefined" ? document.documentElement : null);
    el2?.setAttribute(GLASS_TIER_ATTR, tier);
  }

  // src/motion/springs.ts
  var springs = {
    smooth: { type: "spring", duration: 0.5, bounce: 0 },
    snappy: { type: "spring", duration: 0.5, bounce: 0.15 },
    bouncy: { type: "spring", duration: 0.5, bounce: 0.3 }
  };
  var cssApprox = {
    smooth: "cubic-bezier(0.32, 0.72, 0, 1) 500ms",
    snappy: "cubic-bezier(0.32, 0.86, 0.2, 1.02) 500ms",
    bouncy: "cubic-bezier(0.3, 1.2, 0.35, 1) 500ms"
  };
  return __toCommonJS(debug_entry_exports);
})();
