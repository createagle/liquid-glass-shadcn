/**
 * 三级能力检测。对应 PROJECT_SPEC §5.1。
 *
 * 分级判据（特性检测优先，UA 仅作兜底）：
 *   Tier A —— 支持 `backdrop-filter: url(#x)`（Chromium 系）：完整折射 + 三通道色散
 *   Tier B —— 支持 `backdrop-filter: blur()` 但不支持 url()（Safari 系）：无真折射，多层 inset 阴影模拟
 *   Tier C —— 不支持 backdrop-filter：半透明纯色 + 描边 + 渐变高光
 *
 * 关于 Firefox：PROJECT_SPEC §5.1 的 Tier C 行括号里写了「含 Firefox 默认配置」，
 * 但 Firefox 自 103 起已默认支持 `backdrop-filter: blur()`。
 * 本实现严格执行 SPEC 给出的**判据**（而不是那句括注），因此 Firefox 会落到 Tier B。
 * 详见 docs/research/STATUS.md 质疑 #4。
 */

export type GlassTier = 'a' | 'b' | 'c';

export const GLASS_TIER_ATTR = 'data-glass-tier';

/** sessionStorage key：缓存异步探针结果，避免每次启动都重跑一次光栅化 */
const PROBE_KEY = 'lg:feimage-probe';

/**
 * 同步判据。首帧就能拿到，用于避免 SSR 水合后的闪烁。
 *
 * 注意：**不要**用 `-webkit-backdrop-filter` 做检测 key。
 * 实测 Chromium 148 对带前缀写法的 `CSS.supports()` 返回 false，尽管无前缀完全可用。
 * 带前缀的写法只在**输出 CSS** 时作为 Safari 兼容补充。
 */
export function detectTierSync(): GlassTier {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') {
    return detectTierByUA();
  }
  const blur = CSS.supports('backdrop-filter', 'blur(10px)');
  const url = CSS.supports('backdrop-filter', 'url(#x)');
  if (blur && url) return 'a';
  if (blur) return 'b';

  // Safari 只认带前缀的写法时，这里仍应判为 B 而不是 C
  if (CSS.supports('-webkit-backdrop-filter', 'blur(10px)')) return 'b';
  return 'c';
}

/** UA 兜底。仅在 `CSS.supports` 不可用（极老浏览器 / 非常规环境）时才会走到。 */
function detectTierByUA(): GlassTier {
  if (typeof navigator === 'undefined') return 'c';
  const ua = navigator.userAgent;
  if (/Chrome|Chromium|Edg\//.test(ua) && !/OPR\//.test(ua)) return 'a';
  if (/Safari/.test(ua)) return 'b';
  return 'c';
}

/**
 * 运行时探针：`CSS.supports` 说 true 不代表滤镜真的产出内容。
 *
 * 这是 Phase 0 最直接的教训 —— 当时 `CSS.supports('backdrop-filter','url(#x)')` 返回 true，
 * 但因为承载滤镜的 `<svg>` 尺寸属性为 0，`feImage` 静默输出为空，
 * 整条折射链失效却不报任何错。见 docs/research/optics-web.md §3.6。
 *
 * 探针把一个「只有 feImage」的滤镜作用在 SVG 内的矩形上，光栅化到 canvas 后读回像素。
 *
 * ⚠️ 已知局限：本探针验证的是 **SVG 光栅化路径**下的 feImage，
 * 与 `backdrop-filter` 的合成路径并不完全等价（后者无法从 JS 读回像素）。
 * 它能挡住「feImage 完全没实现」这类情况，但挡不住只在 backdrop 路径上失效的情况。
 * 真正的护栏是**按正确写法构造滤镜**（见 filter-factory.ts）。
 */
export async function probeFeImage(): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  try {
    const cached = sessionStorage.getItem(PROBE_KEY);
    if (cached !== null) return cached === '1';
  } catch {
    // 隐私模式 / 禁用站点数据：忽略，直接跑探针
  }

  const ok = await runFeImageProbe();
  try {
    sessionStorage.setItem(PROBE_KEY, ok ? '1' : '0');
  } catch {
    // 同上，写不进去不影响功能
  }
  return ok;
}

function runFeImageProbe(): Promise<boolean> {
  return new Promise((resolve) => {
    // 4×4 纯洋红 PNG，作为 feImage 的图源
    const src = document.createElement('canvas');
    src.width = 4;
    src.height = 4;
    const sctx = src.getContext('2d');
    if (!sctx) return resolve(false);
    sctx.fillStyle = '#ff00c8';
    sctx.fillRect(0, 0, 4, 4);

    // 注意宿主 svg 的 width/height **属性**必须非零，否则 feImage 不产出任何内容
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4">` +
      `<defs><filter id="p" x="0" y="0" width="4" height="4" ` +
      `filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" ` +
      `color-interpolation-filters="sRGB">` +
      `<feImage href="${src.toDataURL('image/png')}" x="0" y="0" width="4" height="4" ` +
      `preserveAspectRatio="none"/></filter></defs>` +
      `<rect width="4" height="4" fill="#000" filter="url(#p)"/></svg>`;

    const img = new Image();
    let settled = false;
    const done = (v: boolean) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };

    img.onload = () => {
      try {
        const out = document.createElement('canvas');
        out.width = 4;
        out.height = 4;
        const octx = out.getContext('2d', { willReadFrequently: true });
        if (!octx) return done(false);
        octx.drawImage(img, 0, 0);
        const [r, g, b] = octx.getImageData(2, 2, 1, 1).data;
        // 期望洋红 (255, 0, 200)；失败时会是黑色或透明
        done((r ?? 0) > 200 && (g ?? 255) < 80 && (b ?? 0) > 150);
      } catch {
        done(false);
      }
    };
    img.onerror = () => done(false);
    // 兜底：某些实现下 feImage 加载失败既不 load 也不 error
    setTimeout(() => done(false), 1500);
    img.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
  });
}

/** 把 tier 写到 `<html data-glass-tier>`，所有 CSS 用属性选择器分支。 */
export function applyTier(tier: GlassTier, root?: HTMLElement): void {
  const el = root ?? (typeof document !== 'undefined' ? document.documentElement : null);
  el?.setAttribute(GLASS_TIER_ATTR, tier);
}

/**
 * 完整流程：先同步定档并写上属性（避免闪烁），
 * 再异步跑探针；探针失败则把 Tier A 降到 Tier B。
 */
export async function resolveTier(override?: GlassTier): Promise<GlassTier> {
  if (override) {
    applyTier(override);
    return override;
  }
  const sync = detectTierSync();
  applyTier(sync);
  if (sync !== 'a') return sync;

  const feImageWorks = await probeFeImage();
  const final: GlassTier = feImageWorks ? 'a' : 'b';
  if (final !== sync) applyTier(final);
  return final;
}
