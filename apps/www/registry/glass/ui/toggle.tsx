'use client';

// APPLE REFERENCE: 带选中态的按钮（SwiftUI `Toggle` 的 `.button` 样式 /
// UIButton 的 `isSelected`）
//
// ⚠️ **本组件没有独立的 Apple 参考图。**
//
// 在 iOS 27 设计资源里找过 —— Edit Menu（节点 12740:24157）是 Cut/Copy/Paste，
// 不是格式化开关；文件里也没有单独的 Toggle 组件页。**不编造尺寸**，
// 所以这里的几何**全部继承自 Button**（那边是两处独立节点实测出来的）：
//
//   高 48 / 44 / 56、胶囊、水平内边距 = 高 × 0.25、标签 17pt
//   —— 出处见 ui/button.tsx 顶部的 APPLE REFERENCE 注释
//
// 选中态的材质沿用 **Tabs 指示器**的处理（Layer I 强玻璃），那条路径有参考图
// 与实测支撑，见 ui/tabs.tsx。
//
// 换句话说：每个数字都有来源，只是**来源是本库的另外两个组件**，
// 而不是一张属于 Toggle 自己的 Apple 参考图。fidelity 说明里也如实标注。
//
// ── 一个必须照抄的教训 ────────────────────────────────────────────────
//
// 选中态用 Layer I，而 `.lg-surface[data-layer='indicator']` 的 background-color
// 是 transparent，即材质不透明度 α = 0。**Toggle 是带标签的**，α 归零会让
// a11y/legibility.ts 的地板保证直接失效 —— Button 上实测过，6px 条纹背景下
// 标签对比度从 15.46 掉到 1.92:1。选中态必须把材质补回来。
// scripts/press-legibility.mjs 里有对应测点，别删。
//
// ── 为什么不用 @radix-ui/react-toggle ─────────────────────────────────
//
// 按下要做 spring 缩放，就得让 motion 拥有这个 button 元素；而把 Radix 的
// Root 换成 motion 元素只能靠 `asChild`，那个在本库是禁用的
// （shadcn 会在 base-* style 的工程里把它改写成 Base UI 的 render prop，
//   与 @radix-ui/react-* 不兼容 —— Switch 上踩过，见 STATUS §0.3）。
//
// 而 Radix Toggle 提供的东西正好是可以照抄的一小段：`aria-pressed`、
// `data-state="on|off"`、点击翻转、受控/非受控两条路径。**所以直接实现**，
// 并保持与 Radix 完全一致的 props 名（pressed / defaultPressed / onPressedChange），
// 迁移过来的用户不用改调用处。
//
// 这是本库里唯一一个没有走 Radix 的交互组件，理由如上，不要推广到别处 ——
// 焦点管理、弹层定位那类东西自己写是要出事的。

import * as React from 'react';
import { motion, type MotionStyle } from 'motion/react';
import { GlassSurface, transitionFor, useGlassOptional } from '@glass/core';
import { cn } from '@/lib/utils';

/** 几何 —— 与 Button 同一套，出处见该文件。 */
const GEOMETRY = {
  /** 高度阶梯。[实测] / [官方] / `[推定]` —— 三档的出处**完全继承 Button**，见 ui/button.tsx */
  height: { sm: 44, default: 48, lg: 56 } as const,
  /** 水平内边距 / 高度。[实测] —— 继承 Button */
  paddingRatio: 0.25,
  /** 标签字号（px）。[实测] —— 继承 Button */
  labelSize: 17,
  /** 按下时的缩放。`[推定]`，与 Button 取同值以保持手感一致。 */
  pressScale: 0.97,
} as const;

export type GlassToggleSize = 'sm' | 'default' | 'lg' | 'icon';

/**
 * motion 的拖拽 / 动画事件与 React 同名原生事件签名冲突，
 * 在 exactOptionalPropertyTypes 下无法共存。Toggle 用不到，排掉。
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

export interface GlassToggleProps extends NativeButtonProps {
  /** `icon` 是正方形，边长取 default 高度 */
  size?: GlassToggleSize;
  /** 受控选中态。与 @radix-ui/react-toggle 同名同义。 */
  pressed?: boolean;
  /** 非受控初值。 */
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
}

function Toggle({
  className,
  size = 'default',
  style,
  pressed: pressedProp,
  defaultPressed,
  onPressedChange,
  onClick,
  children,
  ...props
}: GlassToggleProps) {
  const height = GEOMETRY.height[size === 'icon' ? 'default' : size];
  const paddingX = size === 'icon' ? 0 : Math.round(height * GEOMETRY.paddingRatio);
  const radius = height / 2;

  /**
   * 初值从 props 推，不从 false 起步再由 effect 纠正 ——
   * 那样 defaultPressed 的实例首屏会播一段本不该有的入场动画（Switch 上踩过）。
   */
  const [uncontrolled, setUncontrolled] = React.useState(defaultPressed ?? false);
  const controlled = pressedProp !== undefined;
  const on = controlled ? pressedProp : uncontrolled;

  const [active, setActive] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);

  React.useEffect(() => {
    if (!active) return;
    const release = () => setActive(false);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [active]);

  const reducedMotion = useGlassOptional()?.preferences.reducedMotion ?? false;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    const next = !on;
    if (!controlled) setUncontrolled(next);
    onPressedChange?.(next);
  };

  return (
    <motion.button
      type="button"
      data-slot="toggle"
      data-size={size}
      // 与 @radix-ui/react-toggle 的输出保持一致，样式与测试都能照搬
      data-state={on ? 'on' : 'off'}
      aria-pressed={on}
      {...(props.disabled ? { 'data-disabled': '' } : {})}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center gap-2',
        'whitespace-nowrap outline-none select-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--lg-ring)] focus-visible:ring-offset-2',
        'focus-visible:ring-offset-transparent',
        'disabled:pointer-events-none disabled:opacity-40',
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
        className,
      )}
      style={
        {
          height,
          ...(size === 'icon' ? { minWidth: height } : {}),
          paddingInline: paddingX,
          borderRadius: radius,
          fontSize: GEOMETRY.labelSize,
          // 选中转主要标签色，未选中用次级 —— 与 Tabs 的处理一致
          color: on ? 'var(--lg-label-primary)' : 'var(--lg-label-secondary)',
          ...style,
        } as MotionStyle
      }
      initial={false}
      animate={{ scale: active ? GEOMETRY.pressScale : 1 }}
      transition={transitionFor('snappy', reducedMotion)}
      onClick={handleClick}
      onPointerDown={() => setActive(true)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        setActive(false);
      }}
      {...props}
    >
      {on ? (
        <GlassSurface
          layer="indicator"
          radius={radius}
          pressed={active}
          // 定位走内联样式：`.lg-surface` 自带 position: relative，
          // 工具类能否覆盖取决于 CSS 的 @layer 顺序。
          style={{ position: 'absolute', inset: 0 }}
        >
          {/*
            补回材质 —— **这一层是可读性的命根子**，理由见文件头。
            不用 --lg-material-base：那个 token 在 :root 声明，
            拿不到 GlassSurface 可能写在自己身上的局部 --lg-base-alpha 覆盖。
          */}
          <span
            aria-hidden="true"
            data-slot="toggle-legibility-fill"
            className="absolute inset-0 rounded-[inherit]"
            style={{ background: 'rgb(var(--lg-base-color) / var(--lg-base-alpha))' }}
          />
        </GlassSurface>
      ) : (
        /* 未选中：只有 hover / 按下时给一层极淡的填充 */
        <motion.span
          aria-hidden="true"
          data-slot="toggle-highlight"
          className="absolute inset-0 rounded-[inherit]"
          style={{ background: 'var(--lg-fill-quaternary)' }}
          initial={false}
          animate={{ opacity: active ? 1 : hovered ? 0.6 : 0 }}
          transition={transitionFor('smooth', reducedMotion)}
        />
      )}

      {/* 标签必须是定位元素才会画在绝对定位的材质层之上 */}
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </motion.button>
  );
}

export { Toggle };
