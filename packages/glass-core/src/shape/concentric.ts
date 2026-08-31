/**
 * 同心圆角与连续曲率。对应 PROJECT_SPEC §6。
 *
 * Apple 的定义（`ConcentricRectangle` 文档原文）：
 *   "A rounded corner of a rectangle is *concentric* relative to the container shape's
 *    adjacent corner when the corner's radius **shares a common center** with the
 *    containing shape's rounded corner radius."
 *
 * 由此推出的公式就是 `子半径 = 父半径 − 内缩距离`。
 * 但 Apple 的模型比 PROJECT_SPEC 写的多两条，实现时不能省：
 *
 *   1. **逐角解析**，不是整体一个数 —— 四个角到容器角的距离可以不同。
 *   2. **距离容器角太远时半径应当归零**（变方角），而不是继续用 parent − inset
 *      算出一个不该存在的圆角：
 *      > "When your ConcentricRectangle's corners are far away from the containing
 *      >  shape's corners … the corner radius the system calculates may be zero.
 *      >  When that happens, the corner is square."
 *      对应的逃生口是 `concentric(minimum:)` —— 指定一个最小半径。
 *
 * 见 docs/research/apple-liquid-glass.md §12。
 */

export interface ConcentricOptions {
  /**
   * 最小半径，对应 SwiftUI 的 `concentric(minimum:)`。
   * 不传则允许归零（变方角），与 Apple 的默认行为一致。
   */
  minimum?: number;
  /**
   * 超过这个内缩距离就认为「离容器角太远」，半径归零。
   * 默认取父半径本身 —— 内缩超过父半径时，同心圆角在几何上已经不成立。
   */
  falloff?: number;
}

/**
 * 单个角的同心半径。
 *
 * @param parentRadius 容器在该角的圆角半径（px）
 * @param inset        子元素相对容器在该角方向上的内缩距离（px）
 *
 * ```ts
 * // tab bar 外壳 26px 圆角，指示器内缩 7px → 指示器圆角 19px
 * concentricRadius(26, 7); // 19
 * ```
 */
export function concentricRadius(
  parentRadius: number,
  inset: number,
  options: ConcentricOptions = {},
): number {
  const { minimum = 0, falloff = parentRadius } = options;

  if (!Number.isFinite(parentRadius) || !Number.isFinite(inset)) return minimum;
  if (inset < 0) return Math.max(minimum, parentRadius - inset);

  // 离容器角太远 → 归零（除非指定了 minimum）
  if (inset >= falloff) return minimum;

  return Math.max(minimum, parentRadius - inset);
}

export interface CornerInsets {
  topLeft?: number;
  topRight?: number;
  bottomRight?: number;
  bottomLeft?: number;
}

export interface CornerRadii {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

/**
 * 逐角解析。四个角的内缩距离可以不同 ——
 * 例如一个贴着屏幕底边的 sheet：下面两角与设备圆角同心，上面两角是固定半径。
 */
export function concentricCorners(
  parentRadius: number,
  insets: CornerInsets,
  options: ConcentricOptions = {},
): CornerRadii {
  const at = (v: number | undefined) =>
    v === undefined ? parentRadius : concentricRadius(parentRadius, v, options);
  return {
    topLeft: at(insets.topLeft),
    topRight: at(insets.topRight),
    bottomRight: at(insets.bottomRight),
    bottomLeft: at(insets.bottomLeft),
  };
}

/** 转成可直接写进 style 的 `border-radius` 简写。 */
export function cornersToCss(r: CornerRadii): string {
  return `${r.topLeft}px ${r.topRight}px ${r.bottomRight}px ${r.bottomLeft}px`;
}

/**
 * 浏览器是否原生支持连续曲率圆角。
 *
 * Chromium 148+ 支持 CSS `corner-shape`，实测 `getComputedStyle(el).cornerShape`
 * 能读回 `"squircle"`，与普通 `border-radius` 并排对比肉眼差异明显。
 * 不支持时自然回退普通圆角 —— 这是渐进增强。
 *
 * 这取代了 PROJECT_SPEC §6 原本提出的「SVG path 或 paint() worklet」方案，
 * 见 docs/research/STATUS.md 质疑 #3。
 */
export function supportsContinuousCorners(): boolean {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;
  return CSS.supports('corner-shape', 'squircle');
}

/**
 * 给大圆角容器（Sheet / Dialog / Card / Tab Bar）用的样式片段。
 * 小圆角场景差异不可见，不必调用 —— 直接用 `border-radius` 即可。
 */
export function continuousCornerStyle(radius: number): {
  borderRadius: string;
  cornerShape?: string;
} {
  const style: { borderRadius: string; cornerShape?: string } = {
    borderRadius: `${radius}px`,
  };
  if (supportsContinuousCorners()) style.cornerShape = 'squircle';
  return style;
}
