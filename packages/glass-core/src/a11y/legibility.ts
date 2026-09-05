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
   * 背后内容的亮度范围（0–255 的 sRGB 编码值，按灰阶处理）。
   * 不传则按**最不利**处理，即 [0, 255]（纯黑到纯白都可能出现）。
   * 传入实测范围可以让地板降下来 —— 这就是「元素级自适应」省下的透明度。
   *
   * 显式带 `| undefined` 是因为本包开了 `exactOptionalPropertyTypes`。
   */
  backdropRange?: readonly [number, number] | undefined;
  /**
   * 实测到的背景**原色**样本。给了它就忽略 `backdropRange`。
   *
   * 比 `backdropRange` 更准：WCAG 对比度虽然只取决于相对亮度，但**合成**
   * 是逐通道在 sRGB 域做的 —— 把彩色背景先折成等亮度灰再合成，
   * 结果与真实合成有偏差。有原色就直接用原色算。
   */
  backdropSamples?: readonly (readonly [number, number, number])[] | undefined;
}

/**
 * 求「要让标签在该底座上达到目标对比度，材质 alpha 至少要多少」。
 *
 * @returns 0–1 的 alpha；若在 alpha=1 时仍达不到目标，返回 `null`
 *          （意味着**这个标签颜色本身就不可能达标**，得改颜色，不是改材质）
 */
export function minBaseAlphaFor(q: LegibilityQuery): number | null {
  const target = q.target ?? 4.5;

  /**
   * 有原色样本就用原色；否则退回灰阶值域的两个端点。
   * 用端点是因为合成结果 C 关于背景 B 单调，最差对比度必然出现在端点。
   * 给了样本集时则逐个样本检查（样本本身可能不共线，取不到「端点」）。
   */
  let extremes: Array<readonly [number, number, number]>;
  if (q.backdropSamples && q.backdropSamples.length > 0) {
    extremes = [...q.backdropSamples];
  } else {
    const [lo, hi] = q.backdropRange ?? [0, 255];
    extremes = [
      [lo, lo, lo],
      [hi, hi, hi],
    ];
  }

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
 * 计算地板时用的目标对比度。**这个值是实测标定的，不是推导出来的。**
 *
 * 本文件的模型是纯 alpha 合成：`C = a·F + (1-a)·B`。真实渲染比模型乐观，
 * 差距来自模型没有涵盖的两件事：
 *
 *   1. `.lg-surface` 的 inset 描边高光（顶边偏白）会提亮靠近边缘的像素
 *   2. `backdrop-filter: blur()` 的**平台差异** —— 这一条影响最大
 *
 * 第 2 条是在 CI 第一次真跑时暴露的：本机（Windows，有 GPU）最差组合是
 * `tiera/white`，Linux CI（headless，软件光栅）却是 `tierb/checker`，
 * 同一测点从 4.57 掉到 4.01。高频棋盘格在软件光栅下没被 blur 抹平那么多，
 * 于是背景的亮度跨度更大。
 *
 * **CI 那个才是要认的数**：没有 GPU 加速的真实用户会遇到同样的渲染。
 * 实测比值约 0.82（3.78 / 4.6），故取 `4.5 / 0.82 ≈ 5.5`，上浮到 5.6。
 *
 * ⚠️ 改动本文件的模型、描边、或档位表之后，**必须重新标定这个值** ——
 * 办法是让 CI 跑一遍 `contrast-audit.mjs`，看最差测点离 4.5 还差多少。
 * 本机跑出来的数偏乐观，不能作为标定依据。
 */
export const AA_TARGET_WITH_MARGIN = 5.6;

export function resolveLegibleAlpha(
  rawAlpha: number,
  scheme: 'light' | 'dark',
  mode: LegibilityMode,
  /**
   * 实测到的背景。`null` = 没探测到（或未启用探测），此时按最不利背景求地板。
   * 传两元组 = 灰阶值域；传颜色数组 = 原色样本（更准）。
   */
  backdrop: readonly [number, number] | readonly (readonly [number, number, number])[] | null,
): number {
  if (mode === 'off') return rawAlpha;

  // adaptive 且探测成功 → 按实测背景求地板；否则按最不利背景求
  let range: readonly [number, number] | undefined;
  let samples: readonly (readonly [number, number, number])[] | undefined;
  if (mode === 'adaptive' && backdrop) {
    if (Array.isArray(backdrop[0])) {
      samples = backdrop as readonly (readonly [number, number, number])[];
    } else {
      range = backdrop as readonly [number, number];
    }
  }
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
    backdropSamples: samples,
  });
  const needSecondary = minBaseAlphaFor({
    baseColor: t.base,
    labelColor: t.labelTint,
    labelAlpha: SECONDARY_ALPHA_AT_FLOOR,
    target: AA_TARGET_WITH_MARGIN,
    backdropRange: range,
    backdropSamples: samples,
  });

  // 理论上 alpha=1 必定可达，need 不会是 null；
  // 真出现 null 说明 token 被改成了不可达的颜色，此时退回最保守值。
  return Math.max(rawAlpha, needPrimary ?? 1, needSecondary ?? 1);
}

/* ══════════════════════════════════════════════════════════════════════
   着色标签（系统色当文字用）
   ══════════════════════════════════════════════════════════════════════

   系统色是**固定值**，既压不亮也压不暗 —— 材质地板对它无效。
   压在最不利底座上，`--lg-blue` / `--lg-red` 当标签色分别只有
   1.84 / 1.85:1（亮，底座 rgb(187 187 187)）、2.35 / 1.97:1（暗，rgb(91 91 94)）。

   ⚠️ 这里原来写的是「1.50 / 1.51:1」—— 那是更早一版最不利底座下的数，
   早就与脚本对不上了，而**没有任何东西会因此报错**。现在换成
   `scripts/derived-colors.mjs` 原样打印的那一列（「原色 x → y:1」），
   下次谁动了 token 或底座，一跑就能看出注释对不上。

   Apple 自己的指引是把颜色加在**背景**上而不是文字上：

   > "To emphasize primary actions, apply color to the **background** rather
   >  than to symbols or text."
   > —— https://developer.apple.com/design/human-interface-guidelines/color

   但链接、破坏性操作这类**彩色文字**在 iOS 里确实存在，库不能不给答案。
   所以这里保留 `--lg-blue` 等作为**真实系统色（用于填充）**，
   另外派生一套 `--lg-on-glass-*` **仅用于压在玻璃上的文字**。

   派生方式刻意保守：
     亮色主题 → 整体乘以 k（**精确保持色相与饱和度比例**）压暗
     暗色主题 → 向白色插值提亮（色相保持，饱和度会降）
   ────────────────────────────────────────────────────────────────────── */

/**
 * `guaranteed` 地板下，对该主题**最不利**的那个合成底座色。
 *
 * 亮色主题文字是暗的 → 最不利是底座最暗时（压在纯黑上）
 * 暗色主题文字是亮的 → 最不利是底座最亮时（压在纯白上）
 */
export function worstBaseUnderFloor(scheme: 'light' | 'dark'): [number, number, number] {
  const t = TOKEN_COLORS[scheme];
  /**
   * ⚠️ 必须用 `resolveLegibleAlpha` 实际会给出的地板，不能用
   * `AA_FLOOR_PRIMARY` / `AA_FLOOR_SECONDARY` —— 那两个常量是按裸 4.5 解的，
   * 运行时用的却是带 `AA_TARGET_WITH_MARGIN` 的版本，比它们高。
   *
   * 用错会高估最不利底座的亮度，进而把着色标签推导到「怎么调都不够」：
   * 曾经导致暗色主题下 9 个系统色全部塌成纯白，且仍达不到目标。
   */
  const floor = resolveLegibleAlpha(0, scheme, 'guaranteed', null);
  const extreme: readonly [number, number, number] =
    scheme === 'light' ? [0, 0, 0] : [255, 255, 255];
  return compositeOver(t.base, extreme, floor);
}

/**
 * 把一个系统色派生成「压在玻璃上仍达标」的标签色。
 *
 * @returns 达标的颜色；若连纯黑/纯白都不够（理论上不会发生）则返回该极值
 */
export function deriveOnGlassLabel(
  color: readonly [number, number, number],
  scheme: 'light' | 'dark',
  target: number = AA_TARGET_WITH_MARGIN,
): [number, number, number] {
  const base = worstBaseUnderFloor(scheme);

  // t=0 → 原色；t=1 → 完全变成黑（亮色主题）或白（暗色主题）
  const at = (t: number): [number, number, number] =>
    scheme === 'light'
      ? [color[0] * (1 - t), color[1] * (1 - t), color[2] * (1 - t)]
      : [
          color[0] + (255 - color[0]) * t,
          color[1] + (255 - color[1]) * t,
          color[2] + (255 - color[2]) * t,
        ];

  if (contrastRatio(color, base) >= target) return [...color] as [number, number, number];

  // 二分求最小的调整量 —— 保留尽可能多的原色特征
  let lo = 0;
  let hi = 1;
  if (contrastRatio(at(1), base) < target) return at(1);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (contrastRatio(at(mid), base) >= target) hi = mid;
    else lo = mid;
  }
  return at(hi);
}

/**
 * 有色**实心**填充（Apple 的 "prominent" 按钮 / `.tint(_:)`）的目标对比度。
 *
 * 与 `AA_TARGET_WITH_MARGIN`（5.6）不同，这里只留 0.1 的余量，因为两者的
 * 不确定性来源完全不同：
 *
 *   - 玻璃底座：颜色是 `a·F + (1-a)·B` 合成出来的，`blur()` 的平台差异会让
 *     实际渲染偏离模型，所以要留大余量（标定过程见上面那条常量的注释）。
 *   - 实心填充：**背景就是这个色本身，没有合成、没有 blur、没有平台差异**，
 *     模型即实际。0.1 只用来吸收抗锯齿边缘像素的测量误差。
 */
export const AA_TARGET_FILL = 4.6;

/**
 * 把一个有色**实心**填充压到「白字（或指定标签色）过 AA」为止。
 *
 * 与 `deriveOnGlassLabel()` 的方向相反：那边背景固定、调文字；这里文字固定、调背景。
 *
 * ⚠️ **标签色是入参，不是算出来的。** 这一条是踩过才写下的：
 * 如果让函数自己「挑对比度更高的那一极」，强调蓝 `#0088ff` 会被判成
 * **黑字**（5.97:1，白字只有 3.52:1；暗色 `#0d9eff` 更悬殊，7.35 对 2.86）
 * —— 数学上确实更优，但 iOS 的蓝色
 * prominent 按钮明明是白字（见 `screenshots/ios27-prominent-button.png`
 * 的 "Create Note"，以及 `ios27-toolbar-buttons.png` 的蓝色按钮）。
 *
 * 极性属于设计语言，由**有参考图的调用方**决定；这里只负责在给定极性下求解。
 *
 * 为什么必须解：白字压在真实 systemBlue 上只有 **4.02:1**，不过 AA 正文标准。
 * Apple 自己就是这么发货的，但 PROJECT_SPEC §13 写明可读性「不可协商」。
 *
 * @param color   真实系统色
 * @param onColor 标签色（默认白）—— 由调用方按参考图决定
 * @returns 满足 `target` 的最小调整量对应的填充色；原色已达标时**原样返回**
 */
export function deriveProminentFill(
  color: readonly [number, number, number],
  onColor: readonly [number, number, number] = [255, 255, 255],
  target: number = AA_TARGET_FILL,
): [number, number, number] {
  if (contrastRatio(onColor, color) >= target) {
    return [color[0], color[1], color[2]];
  }

  // 白字（亮标签）→ 把底色压暗；黑字（暗标签）→ 把底色提亮
  const toward = srgbLuminance(onColor) > 0.5 ? 0 : 255;
  const at = (t: number): [number, number, number] => [
    color[0] + (toward - color[0]) * t,
    color[1] + (toward - color[1]) * t,
    color[2] + (toward - color[2]) * t,
  ];

  /**
   * 在**取整后**的颜色上判定，不是在浮点上。
   *
   * token 最终以 8 位十六进制落到 CSS 里，取整会掉一点对比度 ——
   * 在浮点上恰好解到 4.60 的值，写成 #0071ec 之后实测是 4.59。
   * 直接按取整结果搜索，报出来的数就是用户真正拿到的数。
   */
  const rounded = (t: number): [number, number, number] => {
    const c = at(t);
    return [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])];
  };

  // 推到极端仍不达标 → 该配色本身无解，返回极端值让调用方看得出来
  if (contrastRatio(onColor, rounded(1)) < target) return rounded(1);

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (contrastRatio(onColor, rounded(mid)) >= target) hi = mid;
    else lo = mid;
  }
  return rounded(hi);
}
