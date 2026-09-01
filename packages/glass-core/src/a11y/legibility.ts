/**
 * 可读性地板 —— 让 PROJECT_SPEC §13「档位 0 + 最不利背景下仍满足 WCAG AA」可执行。
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 为什么需要这个模块（结论来自 `scripts/adaptive-probe.mjs` 的实测，
 * 详细记录见 `docs/research/optics-web.md` §6）：
 *
 * 玻璃底座把背景合成成：`C = a·F + (1-a)·B`
 *   a = 材质不透明度，F = 底座填充色，B = 背后内容的亮度
 *
 * 关键性质：**C 的值域宽度是 `(1-a)`，与 B 是什么无关。**
 * 也就是说 —— 能否保证对比度，只由 `a` 决定，不由背景决定。
 *
 * 这直接推翻了两个直觉方案（都已实测证伪，别再试）：
 *
 *   ✗ `mix-blend-mode: difference` 让文字自动反色
 *     difference 保证的是 **RGB 差**，不是**亮度差**。中灰 #808080 上
 *     白字反色成 #7F7F7F，亮度几乎不变 —— 实测 1.04:1，字直接消失。
 *
 *   ✗ 元素级翻转**文字颜色**
 *     一个元素底下可以同时有纯黑和纯白（棋盘格、照片）。单一极性必然
 *     顾此失彼 —— 实测在 checker 背景上比不自适应还差。
 *
 * 正确的自适应对象是**不透明度**，不是文字颜色。这也正是 Apple 的说法：
 * "Liquid Glass appears more opaque in larger elements like sidebars to
 *  preserve legibility over complex backgrounds."
 * ─────────────────────────────────────────────────────────────────────────
 */

/** WCAG 相对亮度 */
export function srgbLuminance([r, g, b]: readonly [number, number, number]): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  const la = srgbLuminance(a);
  const lb = srgbLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** 把 fg 以 alpha 合成到 bg 上（sRGB 编码域，与浏览器的默认合成一致） */
export function compositeOver(
  fg: readonly [number, number, number],
  bg: readonly [number, number, number],
  alpha: number,
): [number, number, number] {
  return [
    alpha * fg[0] + (1 - alpha) * bg[0],
    alpha * fg[1] + (1 - alpha) * bg[1],
    alpha * fg[2] + (1 - alpha) * bg[2],
  ];
}

export interface LegibilityQuery {
  /** 底座填充色（不含 alpha） */
  baseColor: readonly [number, number, number];
  /** 标签颜色（不含 alpha） */
  labelColor: readonly [number, number, number];
  /** 标签自身的 alpha */
  labelAlpha: number;
  /** 目标对比度，默认 WCAG AA 正文 4.5 */
  target?: number | undefined;
  /**
   * 背后内容的亮度范围（0–255 的 sRGB 编码值）。
   * 不传则按**最不利**处理，即 [0, 255]（纯黑到纯白都可能出现）。
   * 传入实测范围可以让地板降下来 —— 这就是「元素级自适应」省下的透明度。
   *
   * 显式带 `| undefined` 是因为本包开了 `exactOptionalPropertyTypes`。
   */
  backdropRange?: readonly [number, number] | undefined;
}

/**
 * 求「要让标签在该底座上达到目标对比度，材质 alpha 至少要多少」。
 *
 * @returns 0–1 的 alpha；若在 alpha=1 时仍达不到目标，返回 `null`
 *          （意味着**这个标签颜色本身就不可能达标**，得改颜色，不是改材质）
 */
export function minBaseAlphaFor(q: LegibilityQuery): number | null {
  const target = q.target ?? 4.5;
  const [lo, hi] = q.backdropRange ?? [0, 255];

  // 只需检查值域两端：C 关于 B 单调，最差对比度必然出现在端点之一
  const extremes: Array<[number, number, number]> = [
    [lo, lo, lo],
    [hi, hi, hi],
  ];

  const worstAt = (alpha: number) => {
    let worst = Infinity;
    for (const B of extremes) {
      const base = compositeOver(q.baseColor, B, alpha);
      const label = compositeOver(q.labelColor, base, q.labelAlpha);
      worst = Math.min(worst, contrastRatio(label, base));
    }
    return worst;
  };

  if (worstAt(1) < target) return null;

  // 二分：worstAt 关于 alpha 单调不减（材质越实，背景影响越小）
  let lo2 = 0;
  let hi2 = 1;
  if (worstAt(0) >= target) return 0;
  for (let i = 0; i < 40; i++) {
    const mid = (lo2 + hi2) / 2;
    if (worstAt(mid) >= target) hi2 = mid;
    else lo2 = mid;
  }
  return hi2;
}

/**
 * 本库 token 的实际取值 —— 与 `tokens/primitive.css` / `tokens/semantic.css` 保持一致。
 * 有单元测试断言两边没有漂移。
 */
export const TOKEN_COLORS = {
  light: {
    base: [255, 255, 255] as const,
    labelPrimary: [0, 0, 0] as const,
    labelTint: [60, 60, 67] as const, // #3C3C43
  },
  dark: {
    base: [20, 20, 24] as const,
    labelPrimary: [255, 255, 255] as const,
    labelTint: [235, 235, 245] as const, // #EBEBF5
  },
} as const;

/**
 * primary 标签在**最不利背景**下达标所需的最小材质 alpha。
 *
 * 这是本库对外承诺的硬地板：只要材质 alpha 不低于它，
 * primary 文本在任何背景上都满足 AA —— 不需要运行时探测，不会失效。
 */
export const AA_FLOOR_PRIMARY: Record<'light' | 'dark', number> = {
  light: minBaseAlphaFor({
    baseColor: TOKEN_COLORS.light.base,
    labelColor: TOKEN_COLORS.light.labelPrimary,
    labelAlpha: 1,
  })!,
  dark: minBaseAlphaFor({
    baseColor: TOKEN_COLORS.dark.base,
    labelColor: TOKEN_COLORS.dark.labelPrimary,
    labelAlpha: 1,
  })!,
};

/**
 * 让 **secondary 标签也达标** 所需的最小材质 alpha —— 前提是同时把
 * secondary 的 alpha 抬到 `SECONDARY_ALPHA_AT_FLOOR`。
 *
 * ⚠️ 这里有一个 PROJECT_SPEC 内部冲突，实现上必须做取舍，理由见文件头：
 *
 *   Apple 原生 secondaryLabel = `#3C3C43 @ 60%`，压在纯白上是 **3.44:1**，
 *   本身就不满足 AA，**任何材质不透明度都救不回来**（alpha=1 时也只有 3.44）。
 *
 *   于是「忠实复刻 Apple 的标签色」与「§13 所有文本过 AA」不能同时成立。
 *   PROJECT_SPEC §13 的标题写的是**「不可协商」**，据此判定 AA 优先，
 *   secondary 的 alpha 允许偏离 Apple 原值。该偏离记录在
 *   `docs/research/STATUS.md` 与 `optics-web.md` §6。
 */
export const SECONDARY_ALPHA_AT_FLOOR = 0.99;

/** Apple 原生 secondaryLabel 的 alpha。仅在 `legibility: 'off'` 时使用。 */
export const APPLE_SECONDARY_ALPHA = 0.6;

export const AA_FLOOR_SECONDARY: Record<'light' | 'dark', number> = {
  light: minBaseAlphaFor({
    baseColor: TOKEN_COLORS.light.base,
    labelColor: TOKEN_COLORS.light.labelTint,
    labelAlpha: SECONDARY_ALPHA_AT_FLOOR,
  })!,
  dark: minBaseAlphaFor({
    baseColor: TOKEN_COLORS.dark.base,
    labelColor: TOKEN_COLORS.dark.labelTint,
    labelAlpha: SECONDARY_ALPHA_AT_FLOOR,
  })!,
};

/**
 * 可读性策略。
 *
 * - `guaranteed`（默认）—— 材质 alpha 永远不低于 AA 地板。
 *   任何背景都保证达标，不依赖运行时探测，**CI 可静态验证**。
 *   代价：最通透档没有名义上那么通透。
 *
 * - `adaptive` —— 先探测元素背后的实际亮度范围，只在需要时抬 alpha。
 *   背景本来就安全时（例如暗色主题压在暗色内容上）保持完全通透。
 *   探测不出来时**回落到 `guaranteed`**，不会静默失去保证。
 *
 * - `off` —— 用原始档位值，由使用者自行担保可读性。
 *   仅在明确知道背景可控时使用（例如固定的品牌色背景）。
 */
export type LegibilityMode = 'guaranteed' | 'adaptive' | 'off';

/**
 * 给定策略与实测背景范围，求实际应当使用的材质 alpha。
 *
 * @param rawAlpha  档位表插值出来的原始 alpha（美学意图）
 * @param backdropRange 实测的背景亮度范围；`null` 表示探测失败
 */
/**
 * 计算地板时用的目标对比度 —— 比 AA 的 4.5 略高。
 *
 * 留这个余量是因为**理论值与渲染值之间有取整误差**：地板按连续数学解出来
 * 恰好等于 4.5，但浏览器把合成结果量化成整数像素后会掉到 4.47。
 * 实测差距约 0.7%，取 4.6（约 2% 余量）足够吸收，且不会明显牺牲通透度。
 */
export const AA_TARGET_WITH_MARGIN = 4.6;

export function resolveLegibleAlpha(
  rawAlpha: number,
  scheme: 'light' | 'dark',
  mode: LegibilityMode,
  backdropRange: readonly [number, number] | null,
): number {
  if (mode === 'off') return rawAlpha;

  // adaptive 且探测成功 → 按实测范围求地板；否则按最不利背景求
  const range = mode === 'adaptive' && backdropRange ? backdropRange : undefined;
  const t = TOKEN_COLORS[scheme];

  /**
   * 地板要同时照顾 primary 与 secondary —— 只按 primary 算的话，
   * 底座达标了但次级文字仍然不达标（实测 2.32:1）。
   * secondary 用的是抬高后的 alpha，理由见 SECONDARY_ALPHA_AT_FLOOR。
   */
  const needPrimary = minBaseAlphaFor({
    baseColor: t.base,
    labelColor: t.labelPrimary,
    labelAlpha: 1,
    target: AA_TARGET_WITH_MARGIN,
    backdropRange: range,
  });
  const needSecondary = minBaseAlphaFor({
    baseColor: t.base,
    labelColor: t.labelTint,
    labelAlpha: SECONDARY_ALPHA_AT_FLOOR,
    target: AA_TARGET_WITH_MARGIN,
    backdropRange: range,
  });

  // 理论上 alpha=1 必定可达，need 不会是 null；
  // 真出现 null 说明 token 被改成了不可达的颜色，此时退回最保守值。
  return Math.max(rawAlpha, needPrimary ?? 1, needSecondary ?? 1);
}
