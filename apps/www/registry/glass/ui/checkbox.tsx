'use client';

// APPLE REFERENCE: macOS NSButton checkbox（Liquid Glass 一代）
//
// 尺寸与配色来源：Apple Design Resources《macOS 27》Figma 文件
// （fileKey dRTOe4ObAK8UGqW9CBoJPM，节点 497:3757「Toggles - Checkboxes」）。
// 36 个变体（Active × State × Selection）全部导出，记录见
// docs/research/apple-metrics.md §10.2 / §10.3。
//
// ⚠️⚠️ **这个组件里没有玻璃，而且这是照着 Apple 做的。**
//
//   清单原来把 Checkbox 标成 `B + I(瞬时)`，那是在**没有 macOS 参考**时推的。
//   现在有了：36 个变体里**一个都没有**模糊、折射、色散或高光描边。
//   未选中就是一块 `#000000 @ 0.10` 的 16×16 squircle，选中就是一块实心蓝。
//
//   这不是「资源没画」—— 同一份文件里的 Tooltip 确确实实带着
//   BACKGROUND_BLUR 20+60 和半透明填充。同一个 kit，该有玻璃的地方有，这里没有。
//
//   除了「按 Apple 的样子来」，还有一条独立的理由：复选框最常见的用法是
//   **一组十几个**，若每个都是一个折射实例，一屏就撞穿 PROJECT_SPEC §5.2 的
//   8 个预算。Apple 的选择与那条红线是自洽的。
//
//   需要玻璃质感的多选场景，iOS 的答案是 `Card` + 行尾对勾 —— 本库已经有了。
//   清单第 18 行的修订记在 component-inventory.md「修订三」。
//
// ── 实测值 ────────────────────────────────────────────────────────────
//
//   方框          16 × 16                       [实测]
//   圆角          5.5，cornerSmoothing 0.6      [实测]（**squircle**）
//   方框↔标签     3                             [实测]
//   对勾          9.31 × 8.93 @ (3.34, 3.53)    [实测]（矢量路径逐点取自资源）
//   横杠(mixed)   6.5 × 2 @ (4.75, 7)，全圆角   [实测]
//   标签          SF Pro **Medium** 13 / 行高 16 [实测]
//
// ── 四处刻意的偏离，都写在这里 ────────────────────────────────────────
//
//  1. **强调色用 `--lg-accent-fill`，不是实测的 `#0088ff`。**
//     `#0088ff` 配白对勾是 3.52:1，过得了「非文字 3:1」，本可以直接用。
//     但本库所有强调面（Button / Toggle / Tabs 指示器）都走 `--lg-accent-fill`
//     （#0071eb，为白**文字** AA 解出来的）。让复选框单独差半档蓝，
//     比对齐那半档更难看。**一致性优先。**
//
//  2. **命中区撑到 44×44，视觉尺寸不动。**
//     16pt 是 macOS 的指针尺寸，触屏上够不到 HIG 的 44×44pt。
//     与 Switch / InputGroupAddon 同一个做法：伪元素往外扩。
//
//  3. **按下态明暗不对称。** 实测是「亮色每通道减 25、暗色每通道加 20」，
//     即都朝**离背景更远**的方向走。CSS 没有 LINEAR_BURN / LINEAR_DODGE，
//     这里只用 `--lg-press-dim` 叠一层黑，近似的是亮色那一侧；
//     暗色一侧应当变亮而实际变暗。**这是已知的不还原，不是疏忽。**
//
//  4. **squircle 只是近似。** 实测 cornerSmoothing 0.6，而 CSS 没有
//     `corner-shape`（Chrome 139+ 才有，不能依赖）。这里沿用本库既有的做法：
//     把半径乘一个 >1 的系数，视觉上更饱满。真正的超椭圆需要自绘路径。
//
// ⚠️ 可信度：上表标 `[实测]` 而非 `[官方]`，与 §7 同样的两条前提 ——
//   (a) 版本是 27，PROJECT_SPEC 的基准是 26；
//   (b) 文件标题带 "(Community)"，发布者是否为 Apple 未经验证。

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { cn } from '@/lib/utils';

/** 几何 —— macOS 27 实测值，按方框边长成比例缩放。 */
const GEOMETRY = {
  /** 方框边长（px）。[实测] 16 */
  size: 16,
  /** 圆角 / 边长之比。[实测] 5.5 / 16 */
  radiusRatio: 5.5 / 16,
  /** 圆角平滑度。[实测] 0.6 —— 见文件头第 4 条，CSS 里只能近似 */
  cornerSmoothing: 0.6,
  /** 方框与标签的间距（px）。[实测] 3 */
  gap: 3,
  /** 标签字号（px）。[实测] 13 */
  labelSize: 13,
  /** 标签行高（px）。[实测] 16 —— 与方框等高，两者因此天然对齐 */
  labelLineHeight: 16,
  /** 最小触控目标（px）。HIG 44×44pt，[官方] */
  minTouch: 44,
  /** 焦点环：形状内的实边宽（px）。[实测] macOS INNER_SHADOW spread 1 */
  focusInner: 1,
  /** 焦点环：形状外的实边宽（px）。[实测] macOS DROP_SHADOW spread 3.5 */
  focusOuter: 3.5,
} as const;

/**
 * 对勾字形。**路径逐点取自 macOS 27 资源**（节点 4348:8149）。
 * 8 个变体（明/暗 × 聚焦 × 启用）导出来逐字相同，所以只留一份。
 *
 * 原始坐标系 9.31 × 8.93，在 16×16 方框里偏移 (3.345, 3.535)。
 * 保留 3 位小数 —— 再多的位数在 16px 上无法分辨。
 */
const CHECKMARK_PATH =
  'M 3.676 8.93 C 4.046 8.93 4.325 8.79 4.515 8.5 L 9.11 1.462 ' +
  'C 9.25 1.241 9.31 1.051 9.31 0.861 C 9.31 0.36 8.93 0 8.411 0 ' +
  'C 8.061 0 7.852 0.13 7.632 0.461 L 3.646 6.778 L 1.608 4.225 ' +
  'C 1.408 3.984 1.199 3.874 0.899 3.874 C 0.38 3.874 0 4.245 0 4.755 ' +
  'C 0 4.976 0.07 5.176 0.26 5.396 L 2.837 8.54 ' +
  'C 3.057 8.81 3.316 8.93 3.666 8.93 L 3.676 8.93 Z';

/** 对勾在 16×16 方框里的偏移 */
const CHECKMARK = {
  /** 左偏移（px）。[实测] 3.345 */
  x: 3.345,
  /** 上偏移（px）。[实测] 3.535 */
  y: 3.535,
} as const;

/** 横杠（indeterminate 那一态的字形） */
const DASH = {
  /** 左偏移（px）。[实测] 4.75 */
  x: 4.75,
  /** 上偏移（px）。[实测] 7 —— 正好在 16 的正中（7 + 2/2 = 8） */
  y: 7,
  /** 宽（px）。[实测] 6.5 */
  w: 6.5,
  /** 高（px）。[实测] 2，两端全圆角 */
  h: 2,
} as const;

export interface GlassCheckboxProps
  extends Omit<React.ComponentProps<typeof CheckboxPrimitive.Root>, 'children'> {
  /** 方框边长（px）。默认 16。 */
  size?: number;
  /**
   * 标签。传了就把方框包进 `<label>` —— 点标签也能切换。
   *
   * ⚠️ 不传标签时**必须**自己给 `aria-label` 或 `aria-labelledby`：
   * Radix 的根节点是个没有文字内容的 `<button role="checkbox">`，
   * 不给名字的话屏幕阅读器只会读出「复选框」。
   */
  children?: React.ReactNode;
}

/**
 * 复选框。三态：`true` / `false` / `'indeterminate'`。
 *
 * ```tsx
 * <Checkbox defaultChecked>接收通知</Checkbox>
 * <Checkbox checked="indeterminate">全选</Checkbox>
 * ```
 */
function Checkbox({ className, size = GEOMETRY.size, children, ...props }: GlassCheckboxProps) {
  const k = size / GEOMETRY.size;
  const radius = size * GEOMETRY.radiusRatio * (1 + GEOMETRY.cornerSmoothing * 0.18);
  const hit = Math.max(GEOMETRY.minTouch, size);
  const disabled = props.disabled === true;

  /*
   * ⚠️ `<button>` 从**内容**取无障碍名，不从包着它的 `<label>` 取
   * （那条规则只对 input / select / textarea 成立）。
   * 而这个 button 里只有一个 aria-hidden 的 svg —— 不显式关联的话名字是空的。
   * 所以有标签时一律补 aria-labelledby，指向标签那段文字。
   */
  const labelId = React.useId();
  const hasOwnName =
    props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined;
  const nameProps =
    children !== undefined && !hasOwnName ? { 'aria-labelledby': labelId } : {};

  const box = (
    <CheckboxPrimitive.Root
      className={cn(
        // group：指示器靠 group-data-[state=…] 读根节点的状态
        'group relative inline-flex shrink-0 items-center justify-center outline-none',
        'transition-[background-color,box-shadow] duration-150',
        // ── 未选中的三档底色，全部走 token（见 semantic.css）──
        'bg-[var(--lg-toggle-fill)]',
        'data-[state=unchecked]:active:not-disabled:bg-[var(--lg-toggle-fill-pressed)]',
        'data-[state=unchecked]:disabled:bg-[var(--lg-toggle-fill-disabled)]',
        // ── 选中 / 半选：实心强调色 ──
        'data-[state=checked]:bg-[var(--lg-accent-fill)]',
        'data-[state=indeterminate]:bg-[var(--lg-accent-fill)]',
        // 按下时压暗（只近似了亮色一侧，见文件头第 3 条）
        'data-[state=checked]:active:not-disabled:bg-[color-mix(in_srgb,var(--lg-accent-fill),black_18%)]',
        'data-[state=indeterminate]:active:not-disabled:bg-[color-mix(in_srgb,var(--lg-accent-fill),black_18%)]',
        /*
         * 禁用：**只有选中态整体降到 45%**。
         * 未选中的禁用是换底色（0.10 → 0.05），不是降不透明度 ——
         * 两个一起上会把 0.05 再乘 0.45，压成看不见。[实测] 两者是分开的。
         */
        'data-[state=checked]:disabled:opacity-45',
        'data-[state=indeterminate]:disabled:opacity-45',
        'disabled:cursor-default',
        // 焦点环：[实测] 形状内 1px + 形状外 3.5px，两条都是硬边（§10.4）
        'focus-visible:[box-shadow:var(--lg-checkbox-ring)]',
        // 命中区撑到 44×44，视觉尺寸不变
        'before:absolute before:top-1/2 before:left-1/2 before:size-(--lg-hit)',
        'before:-translate-x-1/2 before:-translate-y-1/2 before:content-[""]',
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        ['--lg-hit' as string]: `${hit}px`,
        ['--lg-checkbox-ring' as string]:
          `inset 0 0 0 ${GEOMETRY.focusInner}px var(--lg-ring), 0 0 0 ${GEOMETRY.focusOuter}px var(--lg-ring)`,
      }}
      {...props}
      {...nameProps}
      /*
       * ⚠️ `data-slot` 写在 `{...props}` **之后**。
       * 本仓库在这上面踩过四次 —— 写在前面的话，调用方顺手传一个 data-slot
       * 就把组件自己的标记冲掉，靠 [data-slot=…] 选中它的测试与样式会一起静默失效。
       */
      data-slot="checkbox"
    >
      {/*
       * forceMount：对勾与横杠常驻，只切换不透明度。
       * 让 Radix 只挂载一次，状态切换时不重排，也不会有入场闪烁。
       */}
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        forceMount
        className="flex items-center justify-center text-[var(--lg-on-accent)]"
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${GEOMETRY.size} ${GEOMETRY.size}`}
          fill="none"
          aria-hidden="true"
          className="block"
        >
          <path
            d={CHECKMARK_PATH}
            fill="currentColor"
            transform={`translate(${CHECKMARK.x} ${CHECKMARK.y})`}
            className="opacity-0 transition-opacity duration-100 group-data-[state=checked]:opacity-100"
          />
          <rect
            x={DASH.x}
            y={DASH.y}
            width={DASH.w}
            height={DASH.h}
            rx={DASH.h / 2}
            fill="currentColor"
            className="opacity-0 transition-opacity duration-100 group-data-[state=indeterminate]:opacity-100"
          />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (children === undefined) return box;

  return (
    <label
      data-slot="checkbox-label"
      data-disabled={disabled ? 'true' : undefined}
      className={cn('inline-flex items-start', disabled ? 'cursor-default' : 'cursor-pointer')}
      style={{ gap: GEOMETRY.gap * k }}
    >
      {box}
      <span
        id={labelId}
        className={cn(
          'select-none',
          // [实测] 禁用标签是 #000000@0.25；token 阶梯上最近的是 tertiary（0.3）
          disabled ? 'text-[var(--lg-label-tertiary)]' : 'text-[var(--lg-label-primary)]',
        )}
        style={{
          fontSize: GEOMETRY.labelSize * k,
          lineHeight: `${GEOMETRY.labelLineHeight * k}px`,
        }}
      >
        {children}
      </span>
    </label>
  );
}

export { Checkbox, GEOMETRY as CHECKBOX_GEOMETRY };
