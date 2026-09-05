'use client';

// APPLE REFERENCE: UIProgressView
//
// ⚠️⚠️ **资源里没有 Progress 自己的参考图。**
//
//   翻过 iOS 27 设计资源，那三条水平轨道是 **Slider**（节点 `12740:33899`，
//   渲染图 `screenshots/ios27-sliders.png`）—— 每条都带 knob，是可拖的滑杆，
//   不是进度条。UIProgressView 一个样例都没有。
//
//   所以本组件的轨道几何与两个颜色是**从 Slider 借来的**：
//   对 Slider 而言它们是 `[实测]`，对 Progress 而言只能算 `[推定 · 借自实测]`。
//   两者在 iOS 上确实长得像（同样的胶囊轨道 + 蓝色填充段），
//   但**这是推断，不是从图上量到的**。下面逐条标注，不含糊。
//
//   借来的值（Slider 那边的实测，见 apple-metrics.md §7.4）：
//     轨道         250 × 6 pt        [实测 · Slider]
//     未填充色      rgb(228 228 228)  [实测 · Slider]
//     已填充色      rgb(0 136 255)    [实测 · Slider]
//
// ✅ 颜色告警已解除（原样承自 §7.4）：`rgb(0 136 255)` 当时被怀疑是
//    Display P3 → sRGB 的色彩管理差异，所以**没有据此改 token**。
//    后来累计到四份互相独立的实测都是这个值，`--lg-blue` 已改成 `#0088ff`。
//    填充照旧走 `--lg-blue` —— 这行代码一个字没动，值自己对上了。
//
// 分层：轨道是 **Layer B**（与本库 Slider 的轨道同一个决定），填充段是实色。
// 说清楚依据：这是**为了和自家 Slider 一致**，不是因为参考图证明了轨道是玻璃 ——
// 参考图里轨道压在白色列表上，那个尺寸下磨砂与浅灰实色看不出区别。

import * as React from 'react';
import { GlassSurface, cssApprox, useGlassOptional } from '@createagle/glass-core';
import { cn } from '@/lib/utils';

const GEOMETRY = {
  /** 轨道高度（px）。`[推定]` —— 借自 Slider 的实测值，不是量 Progress 得来的。见文件头 */
  trackHeight: 6,
  /** 不定态斜条纹的周期（px）。`[推定]` —— 无参考 */
  stripe: 12,
  /** 不定态条纹走完一个周期的时长（ms）。`[推定]` */
  marchDuration: 900,
} as const;

export interface GlassProgressProps extends Omit<React.ComponentProps<'div'>, 'role'> {
  /**
   * 当前进度。传 `null`（或不传）就是**不定态** —— 不知道还要多久。
   *
   * 不定态下**不会**写 `aria-valuenow`：辅助技术正是靠「有 role=progressbar
   * 但没有 valuenow」来播报「进行中，进度未知」的。给它填一个假数字
   * （比如 0）会让屏幕阅读器念出「0%」，比不说更糟。
   */
  value?: number | null;
  /** 上限。默认 100。 */
  max?: number;
  /** 轨道高度（px）。默认 6。 */
  height?: number;
}

function Progress({
  className,
  value = null,
  max = 100,
  height = GEOMETRY.trackHeight,
  style,
  ...props
}: GlassProgressProps) {
  const indeterminate = value == null;
  const clamped = indeterminate ? 0 : Math.min(max, Math.max(0, value));
  const pct = max > 0 ? (clamped / max) * 100 : 0;

  const reducedMotion = useGlassOptional()?.preferences.reducedMotion ?? false;

  /**
   * 不定态的 aria：**只有 role，没有 valuenow**。
   * 单独拆出来是因为 JSX 里没法条件地「不写」一个属性 ——
   * 写 `aria-valuenow={undefined}` 在 React 里等价于不写，但读代码的人看不出这是有意的。
   */
  const valueAria = indeterminate
    ? {}
    : { 'aria-valuenow': clamped, 'aria-valuetext': `${Math.round(pct)}%` };

  const stripes = `repeating-linear-gradient(-45deg, var(--lg-progress-fill, var(--lg-blue)) 0 ${
    GEOMETRY.stripe / 2
  }px, transparent ${GEOMETRY.stripe / 2}px ${GEOMETRY.stripe}px)`;

  return (
    <GlassSurface
      layer="base"
      radius={height / 2}
      className={cn('w-full overflow-hidden', className)}
      /*
       * 高度走内联样式，不用工具类 —— `.lg-surface` 自己声明了 position / border-radius，
       * 工具类能不能盖住它取决于消费方的 CSS 层顺序（registry 安装时在
       * @layer components 里，直接 <link> 引 theme.css 时无层）。内联样式两种情况下都对。
       * 这条坑的完整记录见 STATUS §0.63 的更正。
       */
      style={{ height, ...style }}
    >
      <div
        role="progressbar"
        data-slot="progress"
        data-state={indeterminate ? 'indeterminate' : 'determinate'}
        aria-valuemin={0}
        aria-valuemax={max}
        {...valueAria}
        className="h-full w-full"
        {...props}
      >
        {indeterminate ? (
          <div
            data-slot="progress-indeterminate"
            className="h-full w-full"
            style={
              {
                backgroundImage: stripes,
                backgroundSize: `${GEOMETRY.stripe * 2}px 100%`,
                '--lg-progress-stripe': `${GEOMETRY.stripe * 2}px`,
                /*
                 * `prefers-reduced-motion` 下**完全不动** —— §13 要求移除形变动画，
                 * 而横向滚动的斜条纹正是最容易引发不适的那一类。
                 *
                 * 但「不动」不能退化成「什么都不说」：静止时仍然保留条纹，
                 * 因为它既不像空轨道（还没开始）也不像满轨道（已完成），
                 * 视觉上仍读得出「在进行、但不知道到哪了」。
                 * 真正承载语义的是上面那个「有 role 没有 valuenow」。
                 */
                opacity: reducedMotion ? 0.5 : 0.8,
                /*
                 * ⚠️ 用 CSS 关键帧而不是 motion，有两条理由，第二条是硬的：
                 *
                 *   1. 一条永不停止的装饰性循环不该每帧过一次 React/motion；
                 *   2. **motion 会让视觉回归做不了。** Playwright 截图前会
                 *      disable CSS animations，但它停不了 rAF 往内联样式上写值 ——
                 *      元素永远达不到「连续两帧一样」，toHaveScreenshot 直接超时。
                 *      这一批 10 张 Progress 快照第一次跑就是全挂在这儿。
                 *
                 * 循环平移必须匀速：用 spring 会让条纹一顿一顿的。
                 * §15.6 禁的是**状态过渡**硬编码曲线，匀速循环不是状态过渡。
                 */
                ...(reducedMotion
                  ? {}
                  : {
                      animation: `lg-progress-march ${GEOMETRY.marchDuration}ms linear infinite`,
                    }),
              } as React.CSSProperties
            }
          />
        ) : (
          <div
            data-slot="progress-fill"
            className="h-full"
            style={{
              width: `${pct}%`,
              // 填充是背景不是文字，用系统色本身而不是 on-glass 变体 ——
              // Apple: "apply color to the background rather than to symbols or text."
              background: 'var(--lg-progress-fill, var(--lg-blue))',
              // 曲线取自 springs 的 CSS 近似表，不是我随手写的（§15.6）
              transition: reducedMotion ? 'width 120ms linear' : `width ${cssApprox.smooth}`,
            }}
          />
        )}
      </div>
    </GlassSurface>
  );
}

export { Progress, GEOMETRY as PROGRESS_GEOMETRY };
