'use client';

// APPLE REFERENCE: UIButton / SwiftUI `Button` + `.buttonStyle(.glass / .glassProminent)`
//
// 尺寸来源：Apple Design Resources《iOS and iPadOS 27》Figma 文件
// （fileKey ojEQo0rKaQ5ioARo0CO0pf）。参考图：
//   screenshots/ios27-toolbar-buttons.png   工具栏里的玻璃按钮 + 蓝色实心按钮
//   screenshots/ios27-prominent-button.png  整宽的 "Create Note" 实心按钮、圆形图标按钮
//
//   按钮高            48 pt        [实测] —— 工具栏（12740:24071 的两个 Button 实例，
//                                  79×48 与 168×48）与 Alert（apple-metrics §7.6）
//                                  两处**独立节点**给出同一个值
//   水平内边距        12 pt        [实测] —— 79 宽的按钮里字形 55 宽且居中：(79−55)/2 = 12
//   标签              17 pt        [实测] —— 字形框高 20，对应 SF body 17
//   形状              胶囊         [官方] —— "SwiftUI uses the regular variant by default
//                                  along with a Capsule shape."
//   最小触控目标      44 × 44 pt   [官方] —— HIG buttons
//
// ⚠️ 可信度说明：标 [实测] 而非 [官方]，因为 (a) 文件是 iOS 27 而 PROJECT_SPEC
//    的基准是 iOS 26；(b) 文件标题带 "(Community)"，发布者未经验证。
//
// ── 本组件最重要的一条行为 ────────────────────────────────────────────
//
// PROJECT_SPEC §2 的分层速查表对 Button 的规定与其他控件都不同：
//
//   | Button | 静止：底座；按下：升级为 Layer I | 按下态 |
//
// 也就是说按钮**静止时是磨砂底座（不折射）**，按下的一瞬间才变成真玻璃。
// 这正是 Apple 那句 "the knob transforms into Liquid Glass during interaction"
// 在按钮上的对应物。`glass` 变体实现了这个切换（见 layer 的计算）。
//
// ── 一处刻意偏离 Apple ────────────────────────────────────────────────
//
// **实心填充按钮的底色不是真实系统色。** 白字压在真正的强调蓝 #0088ff 上
// 只有 3.52:1，不过 WCAG AA 正文标准（红色 3.55 也不过）。Apple 自己就是这么
// 发货的，但 PROJECT_SPEC §13 写明可读性「不可协商」，所以填充走
// --lg-accent-fill / --lg-destructive-fill（由 deriveProminentFill() 解出，
// CI 钉住漂移）。调整量：#0088ff → #0075da（亮）、#0d9eff → #0a79c4（暗）。
//
// ⚠️ 这个偏离**比原来大**。`--lg-blue` 从上一代的 #007aff 换成 Liquid Glass
//    一代的 #0088ff 之后，白字的起点从 4.02 掉到 3.52，暗色更是从 3.65
//    掉到 2.86 —— 得拉得更狠才够 AA。蓝越亮，白字越吃亏。
//
// 顺带一条实测结论：**实心填充必须完全不透明。** 试过让它半透明以透出玻璃，
// 但即使只有 8% 透明度，压在纯白背景上时白标签也会掉到 4.08:1 —— 低于 4.5。
// 所以 prominent / destructive 不做玻璃透出，按下的反馈改用压暗层 + 缩放
// （压暗只会让白标签的对比度升高，任何状态下都安全）。

import * as React from 'react';
import { motion, type MotionStyle } from 'motion/react';
import { GlassSurface, transitionFor, useGlassOptional } from '@createagle/glass-core';
import { cn } from '@/lib/utils';

const GEOMETRY = {
  /**
   * 高度阶梯。
   *   default 48 —— iOS 27 实测，两处独立印证
   *   sm      44 —— HIG 的最小触控目标 [官方]，再小就不合规，所以下限就取它
   *   lg      56 —— `[推定]`，只为排版层级提供一档，没有 Apple 依据
   */
  height: { sm: 44, default: 48, lg: 56 } as const,
  /** 水平内边距 / 高度。[实测] —— 79 宽的按钮里字形 55 宽且居中，(79−55)/2 = 12；12 ÷ 48 = 0.25 */
  paddingRatio: 0.25,
  /** 标签字号（px）。[实测] —— 17pt = SF body，字形框高 20 */
  labelSize: 17,
  /**
   * 按下时的缩放。`[推定]` —— 没有 iOS 参考视频可逐帧量。
   *
   * 注意方向与 Slider / Switch 的 knob **相反**：knob 在手指下会**变大**，
   * 按钮则是被「按进去」。两者是不同的操作隐喻，不是不一致。
   */
  pressScale: 0.97,
} as const;

export type GlassButtonVariant = 'glass' | 'prominent' | 'destructive' | 'plain';
export type GlassButtonSize = 'sm' | 'default' | 'lg' | 'icon';

/**
 * motion 的拖拽 / 动画事件与 React 同名的原生事件签名不同
 * （`onDrag` 在 motion 里是手势回调，在 React 里是 DragEvent），
 * 在 `exactOptionalPropertyTypes` 下两者无法共存。
 *
 * 按钮用不到这几个，直接从公开 API 里排掉 —— 比在调用处到处 as any 干净。
 */
type NativeButtonProps = Omit<
  React.ComponentProps<'button'>,
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onAnimationIteration'
>;

export interface GlassButtonProps extends NativeButtonProps {
  /**
   * `glass`       默认。磨砂胶囊，按下升级为 Layer I 真玻璃（PROJECT_SPEC §2）
   * `prominent`   实心强调色，白标签。对应 SwiftUI 的 `.glassProminent`
   * `destructive` 实心红色，白标签
   * `plain`       无背景，只有标签。对应 iOS 的 borderless 按钮
   *
   * ⚠️ **`plain` 不提供可读性地板。** 它按定义就没有材质，压在任意背景上时
   * 与一段裸文字没有区别 —— `a11y/legibility.ts` 的地板保证依赖材质的
   * 不透明度 α，α 不存在则无从保证。实测在本库的渐变验证背景上只有 2.71:1
   * （scripts/press-legibility.mjs 会照常量出来并打印，但不判定它）。
   * **把 `plain` 放在对比度可控的背景上是调用方的责任**，iOS 的 borderless
   * 按钮同理。需要保证时改用 `glass`。
   */
  variant?: GlassButtonVariant;
  /** `icon` 是正方形，边长取 default 高度 */
  size?: GlassButtonSize;
}

/** 各变体的标签色。一律走 token，不写裸色值（PROJECT_SPEC §15.4）。 */
const LABEL_COLOR: Record<GlassButtonVariant, string> = {
  glass: 'var(--lg-label-primary)',
  prominent: 'var(--lg-on-accent)',
  destructive: 'var(--lg-on-destructive)',
  // plain 是「有色文字压在未知背景上」，必须用 AA 安全的那一套，
  // 不能用 --lg-blue（压在最不利底座上只有 1.84:1，远不过标）。
  // 推导见 a11y/legibility.ts。
  plain: 'var(--lg-on-glass-blue)',
};

/**
 * 标签字重。**按设计语言取，不按视觉凑。**
 *
 * 依据两张参考图：工具栏里的玻璃按钮标签是 body（regular），
 * 而 "Create Note" 那种实心 CTA 明显更重，取 semibold。
 * 对应 apple-metrics §6 的 `body 17` 与 `headline 17 semibold`。
 *
 * ⚠️ 不要为了让回退字体（Segoe UI 等）看起来「像」SF Pro 而调这个值 ——
 * 那样在装了 SF 的 macOS / iOS 上反而会错。字体差异属于已知差异，
 * 写在 fidelity 对照图的说明里，不在这里补偿。
 */
const LABEL_WEIGHT: Record<GlassButtonVariant, number> = {
  glass: 400,
  plain: 400,
  prominent: 600,
  destructive: 600,
};

const FILL_COLOR: Partial<Record<GlassButtonVariant, string>> = {
  prominent: 'var(--lg-accent-fill)',
  destructive: 'var(--lg-destructive-fill)',
};

function Button({
  className,
  variant = 'glass',
  size = 'default',
  style,
  disabled,
  children,
  ...props
}: GlassButtonProps) {
  const height = GEOMETRY.height[size === 'icon' ? 'default' : size];
  const paddingX = size === 'icon' ? 0 : Math.round(height * GEOMETRY.paddingRatio);
  const radius = height / 2;

  const [pressed, setPressed] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);

  const filled = variant === 'prominent' || variant === 'destructive';
  const reducedMotion = useGlassOptional()?.preferences.reducedMotion ?? false;

  /**
   * PROJECT_SPEC §2：按钮静止是底座，**按下才升级为 Layer I**。
   *
   * 只有 `glass` 变体能真正体现这个切换 —— filled 变体的底色是不透明的，
   * 折射发生在它背后，看不见（理由见文件头）。
   */
  const layer = variant === 'glass' && pressed ? 'indicator' : 'base';

  /** 指针可能在别的元素上松开，按下态必须在 window 上收尾 */
  React.useEffect(() => {
    if (!pressed) return;
    const release = () => setPressed(false);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [pressed]);

  const surfaceStyle: React.CSSProperties = { position: 'absolute', inset: 0 };

  return (
    <motion.button
      type="button"
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-pressed={pressed ? 'true' : undefined}
      disabled={disabled}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center gap-2',
        'whitespace-nowrap outline-none select-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--lg-ring)] focus-visible:ring-offset-2',
        'focus-visible:ring-offset-transparent',
        'disabled:pointer-events-none disabled:opacity-40',
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
        className,
      )}
      /**
       * 断言成 MotionStyle：`style` 来自 ComponentProps<'button'>，是
       * `CSSProperties`，其中 `x` / `y` 等属性允许 undefined，而 MotionStyle
       * 要求它们非空。在 exactOptionalPropertyTypes 下两者不兼容 ——
       * 这纯粹是类型形状的问题，运行时值是一样的。
       */
      style={
        {
          height,
          ...(size === 'icon' ? { minWidth: height } : {}),
          paddingInline: paddingX,
          borderRadius: radius,
          fontSize: GEOMETRY.labelSize,
          fontWeight: LABEL_WEIGHT[variant],
          color: LABEL_COLOR[variant],
          ...style,
        } as MotionStyle
      }
      initial={false}
      animate={{ scale: pressed ? GEOMETRY.pressScale : 1 }}
      transition={transitionFor('snappy', reducedMotion)}
      onPointerDown={() => setPressed(true)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      {...props}
    >
      {variant === 'plain' ? (
        /* 无背景变体：只有 hover / 按下时给一层极淡的填充 */
        <motion.span
          aria-hidden="true"
          data-slot="button-highlight"
          className="absolute inset-0 rounded-[inherit]"
          style={{ background: 'var(--lg-fill-quaternary)' }}
          initial={false}
          animate={{ opacity: pressed ? 1 : hovered ? 0.6 : 0 }}
          transition={transitionFor('smooth', reducedMotion)}
        />
      ) : (
        <GlassSurface
          layer={layer}
          radius={radius}
          pressed={pressed}
          // 定位走内联样式：`.lg-surface` 自带 position: relative，
          // Tailwind 的 absolute 能否盖住它取决于 CSS 的 @layer 顺序。
          style={surfaceStyle}
        >
          {filled ? (
            <span
              aria-hidden="true"
              data-slot="button-fill"
              className="absolute inset-0 rounded-[inherit]"
              // **不透明**。半透明会让白标签掉出 AA，实测见文件头。
              style={{ background: FILL_COLOR[variant] }}
            />
          ) : null}

          {/*
            升级到 Layer I 时补回底座材质 —— **这一层是可读性的命根子。**

            `.lg-surface[data-layer='indicator']` 的 background-color 是
            transparent，也就是 α = 0。而 a11y/legibility.ts 的整套地板保证
            建立在 `C = a·F + (1−a)·B` 上：**α 归零，保证就没了**。

            实测（scripts/button-legibility.mjs）：6px 黑白条纹背景上，
            标签对比度从静止的 15.46:1 掉到按下的 **1.92:1** —— 字直接看不见。
            换成平滑渐变背景则是 15.46 → 13.03，完全正常；也就是说
            **只在高频背景上翻车**，光看普通截图发现不了。

            补回材质之后，折射仍然在这一层背后跑（背景不再被底座模糊、
            镜面高光变强、亮度与饱和上扬），"变成玻璃" 的观感还在，
            但 α 回到地板值，AA 保证跟着回来。

            不用 --lg-material-base：那个 token 在 :root 上声明，var() 在声明处
            求值，拿不到 GlassSurface 可能写在自己身上的局部 --lg-base-alpha
            覆盖（元素级自适应）。就地组合才能吃到局部值。
          */}
          {layer === 'indicator' ? (
            <span
              aria-hidden="true"
              data-slot="button-legibility-fill"
              className="absolute inset-0 rounded-[inherit]"
              style={{ background: 'rgb(var(--lg-base-color) / var(--lg-base-alpha))' }}
            />
          ) : null}

          {/* 按下的压暗层。压暗只会让白标签的对比度升高，任何状态下都安全。 */}
          <motion.span
            aria-hidden="true"
            data-slot="button-dim"
            className="absolute inset-0 rounded-[inherit]"
            style={{ background: 'var(--lg-press-dim)' }}
            initial={false}
            animate={{ opacity: pressed ? 1 : hovered && filled ? 0.4 : 0 }}
            transition={transitionFor('smooth', reducedMotion)}
          />
        </GlassSurface>
      )}

      {/*
        标签必须是**定位元素**才会画在绝对定位的材质层之上 ——
        否则普通流内容会被后者盖住。这与 Tabs 里的处理一致。
      */}
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </motion.button>
  );
}

export { Button };
