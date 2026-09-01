/**
 * 位移贴图生成器。对应 PROJECT_SPEC §5.2。
 *
 * 贴图的通道构成（这是整套折射的物理基础）：
 *   R 通道 = 水平方向的线性渐变（黑 → 红）    → 供 feDisplacementMap 采样出 **X 位移**
 *   B 通道 = 垂直方向的线性渐变（黑 → 蓝），以 difference 混合叠加 → **Y 位移**
 *   中心   = 一块模糊的中灰圆角矩形，把中心区域的位移拉回 0
 *            （灰色无彩，R=G=B 都有贡献 → 中心 X/Y 位移同时归零）
 *
 * 于是：边缘位移大（像透镜边缘推挤背景）、中心几乎不失真 —— 这正是 Apple 的观感。
 *
 * ⚠️ 对 PROJECT_SPEC §1.3 的一处更正：
 * SPEC 描述上游 React Bits 的贴图是「水平黑→红 与 垂直黑→**绿**」，
 * 实际源码里第二条渐变是**蓝色**。而上游默认 `yChannel='G'` 采样的绿通道里
 * 几乎没有垂直梯度（只有中心那团灰），纵向位移因此是退化的。
 * 本实现的默认取 `yChannel='B'`。详见 docs/research/optics-web.md §3.5。
 */

export type DisplacementChannel = 'R' | 'G' | 'B' | 'A';

export interface DisplacementMapOptions {
  /** 目标元素的像素宽度 */
  width: number;
  /** 目标元素的像素高度 */
  height: number;
  /** 圆角半径（px） */
  radius: number;
  /**
   * 边缘透镜带的相对宽度，取短边的比例。
   * 越大 → 中心的「零位移区」越小 → 畸变看起来越厚重。
   */
  borderWidth?: number;
  /** 中心归零块的灰度（0–100）。越接近 50 越中性。 */
  brightness?: number;
  /** 中心归零块的不透明度（0–1）。越接近 1，中心越不失真。 */
  opacity?: number;
  /** 中心归零块的模糊半径（px）。决定「透镜边缘」过渡得多柔和。 */
  blur?: number;
  /** 两条渐变的混合模式。difference 让 R/B 两个方向互不污染。 */
  mixBlendMode?: string;
}

export interface ResolvedDisplacementMap {
  /** 可直接喂给 `<feImage href>` 的 data URI */
  href: string;
  /** 贴图的像素尺寸 —— feImage 必须用这个尺寸写**绝对用户单位** */
  width: number;
  height: number;
  /** 缓存键 */
  key: string;
}

/**
 * 默认值来自 Phase 1 的视觉标定（2026-08-31，Chromium 148）。
 * 起点是上游 React Bits 的 props 签名，标定后 borderWidth 从 0.07 提到 0.18、
 * blur 从 11 降到 6 —— 前者让透镜带更厚、边缘推挤更明显，后者让透镜边界更利落。
 * 标定过程见 docs/research/optics-web.md §3.7。
 */
export const DISPLACEMENT_DEFAULTS = {
  borderWidth: 0.18,
  brightness: 50,
  opacity: 0.93,
  blur: 6,
  mixBlendMode: 'screen',
} as const;

/** 缓存键：相同尺寸/圆角/边宽的实例共享同一份贴图与同一个 `<filter>` 定义。 */
export function displacementKey(o: DisplacementMapOptions): string {
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
    bl,
  ].join('x');
}

/**
 * 生成位移贴图。
 *
 * 返回的是 SVG data URI —— Phase 0 实测证明 SVG 与 PNG 图源都能被 feImage 正常接受
 * （feimage-matrix.html 的 V4/V6 对照），SVG 更小且无需 canvas。
 */
export function createDisplacementMap(o: DisplacementMapOptions): ResolvedDisplacementMap {
  const w = Math.max(1, Math.round(o.width));
  const h = Math.max(1, Math.round(o.height));
  const radius = Math.max(0, o.radius);
  const borderWidth = o.borderWidth ?? DISPLACEMENT_DEFAULTS.borderWidth;
  const brightness = o.brightness ?? DISPLACEMENT_DEFAULTS.brightness;
  const opacity = o.opacity ?? DISPLACEMENT_DEFAULTS.opacity;
  const blur = o.blur ?? DISPLACEMENT_DEFAULTS.blur;
  const mixBlendMode = o.mixBlendMode ?? DISPLACEMENT_DEFAULTS.mixBlendMode;

  /**
   * 径向剖面的起始位置：从中心到这里完全不失真，再向外渐强到边缘满值。
   * borderWidth 是「透镜带占短边的比例」，所以起点 = 1 − borderWidth。
   */
  const profileStart = Math.max(0, Math.min(0.95, 1 - borderWidth * 2));

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs>` +
    // R 通道：水平方向的线性斜坡 → X 位移
    `<linearGradient id="x" x1="0%" y1="0%" x2="100%" y2="0%">` +
    `<stop offset="0%" stop-color="#000"/><stop offset="100%" stop-color="red"/>` +
    `</linearGradient>` +
    // B 通道：垂直方向的线性斜坡 → Y 位移
    `<linearGradient id="y" x1="0%" y1="0%" x2="0%" y2="100%">` +
    `<stop offset="0%" stop-color="#000"/><stop offset="100%" stop-color="blue"/>` +
    `</linearGradient>` +
    // 径向剖面：中心 0（露出中性灰 → 零位移）、边缘 1（斜坡满值）
    `<radialGradient id="p" cx="50%" cy="50%" r="50%">` +
    `<stop offset="${profileStart}" stop-color="#000"/>` +
    `<stop offset="100%" stop-color="#fff"/>` +
    `</radialGradient>` +
    `<mask id="m"><rect width="${w}" height="${h}" fill="url(#p)"` +
    (blur > 0 ? ` style="filter:blur(${blur}px)"` : '') +
    `/></mask>` +
    `</defs>` +
    // 中性灰基底 = 零位移。**不能用黑色** —— 黑色在 feDisplacementMap 里
    // 等于最大负位移，会让未被斜坡覆盖的区域整片剧烈偏移。
    `<rect width="${w}" height="${h}" fill="hsl(0 0% ${brightness}%)"/>` +
    `<g mask="url(#m)" opacity="${opacity}">` +
    `<rect width="${w}" height="${h}" fill="url(#x)"/>` +
    // screen 合并两条斜坡：R 与 B 互不干扰（各自另一通道为 0）
    `<rect width="${w}" height="${h}" fill="url(#y)" style="mix-blend-mode:${mixBlendMode}"/>` +
    `</g>` +
    `</svg>`;

  return {
    href: 'data:image/svg+xml,' + encodeURIComponent(svg),
    width: w,
    height: h,
    key: displacementKey(o),
  };
}
