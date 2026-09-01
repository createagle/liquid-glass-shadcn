'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useGlassFilter } from '../filter/use-glass-filter.js';
import { useGlassOptional } from '../provider/glass-provider.js';
import { useAdaptiveAlpha } from '../a11y/use-adaptive-alpha.js';
import type { RefractionOptions } from '../filter/filter-factory.js';

/**
 * `<GlassSurface>` —— PROJECT_SPEC §5 要求的底层原语。
 *
 * 三种材质角色，对应 PROJECT_SPEC §2 的分层系统：
 *
 *   base       Layer B 磨砂底座 —— tab bar 整条胶囊、segmented 凹槽、slider 轨道
 *              首要职责是可读性。**不做折射**。
 *   indicator  Layer I 强玻璃指示器 —— 选中胶囊、knob
 *              透镜畸变 + 色散 + 镜面高光。这里才是真正的 Liquid Glass。
 *   elevated   弹层 / sheet —— 面板类
 *
 * 这是**原语**，不是 UI 组件 —— 它不带任何具体控件语义。
 */

export type GlassLayer = 'base' | 'indicator' | 'elevated';

export interface GlassSurfaceProps {
  layer?: GlassLayer;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** 圆角。数字按 px 处理。 */
  radius?: number;
  /**
   * 大圆角容器（Sheet / Dialog / Card / Tab Bar）用连续曲率。
   * 走原生 `corner-shape: squircle`，不支持时自然回退普通圆角。
   */
  continuous?: boolean;
  /** 折射强度档位，仅 layer="indicator" 有效 */
  intensity?: 1 | 2 | 3;
  /** 色散强度档位，仅 layer="indicator" 有效 */
  dispersion?: 1 | 2 | 3;
  /** 受控的按下态。交互时折射与高光同时上扬。 */
  pressed?: boolean;
  /** 让原语自己监听指针按下，适合简单场景 */
  interactive?: boolean;
  /** 底层滤镜参数直通，调试用 */
  overrides?: Partial<RefractionOptions>;
  as?: 'div' | 'span';
}

export function GlassSurface({
  layer = 'base',
  children,
  className,
  style,
  radius = 16,
  continuous = false,
  intensity = 2,
  dispersion = 2,
  pressed,
  interactive = false,
  overrides,
  as: Tag = 'div',
}: GlassSurfaceProps) {
  const glass = useGlassOptional();
  const [selfPressed, setSelfPressed] = useState(false);
  const isPressed = pressed ?? selfPressed;

  // 只有指示器需要折射；底座绝不折射（PROJECT_SPEC §15.2）
  const wantsRefraction = layer === 'indicator' && (glass?.refractionEnabled ?? false);

  // 按下时折射强度上扬一档
  const activeIntensity = useMemo<1 | 2 | 3>(() => {
    if (!isPressed) return intensity;
    return Math.min(3, intensity + 1) as 1 | 2 | 3;
  }, [intensity, isPressed]);

  const { ref, backdropFilter } = useGlassFilter<HTMLElement>({
    intensity: activeIntensity,
    dispersion,
    radius,
    disabled: !wantsRefraction,
    ...(overrides ? { overrides } : {}),
  });

  /**
   * 逐元素可读性 alpha（PROJECT_SPEC §13）。
   *
   * 只有 `legibility: 'adaptive'` 时才真的去探测。探测得出结果就用它
   * **局部覆盖** `--lg-base-alpha`；探测不出来（背景是图片/渐变/视频等）
   * 就返回 null，自然沿用根节点上 `guaranteed` 的最不利地板 ——
   * 也就是说**探测失败只会更保守，不会更冒险**。
   *
   * indicator 层不参与：它是折射指示器，不承载正文，
   * 且它的可读性由其下方的 base 层负责。
   */
  const { alpha: adaptiveAlpha } = useAdaptiveAlpha<HTMLElement>({
    ref,
    mode: glass?.legibility ?? 'guaranteed',
    scheme: glass?.resolvedTheme ?? 'light',
    rawAlpha: glass?.rawBaseAlpha ?? 0.34,
    disabled: layer === 'indicator',
  });

  /**
   * 完整的 backdrop-filter 以**内联样式**注入，覆盖 CSS 里的兜底规则。
   * 不走 CSS 变量：变量缺省时会展开成 `none brightness(...)` 这种无效值，
   * 整条声明会被浏览器丢弃。
   *
   * 按下时折射、提亮、饱和同时上扬 —— 对应 Apple 的
   * "the knob transforms into Liquid Glass during interaction"。
   */
  const inlineBackdrop = backdropFilter
    ? isPressed
      ? `${backdropFilter} brightness(1.12) saturate(1.4)`
      : `${backdropFilter} brightness(1.06) saturate(1.22)`
    : undefined;

  // 想折射但没拿到（超过性能红线 / 滤镜未就绪）→ 借用 Tier B 的处理，
  // 保证降级实例仍是一个完成度正确的设计。
  const refractionOff = wantsRefraction && !backdropFilter;

  const onPointerDown = useCallback(() => {
    if (interactive) setSelfPressed(true);
  }, [interactive]);

  useEffect(() => {
    if (!interactive || !selfPressed) return;
    const release = () => setSelfPressed(false);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [interactive, selfPressed]);

  const mergedStyle = {
    ...style,
    '--lg-surface-radius': `${radius}px`,
    // 探测成功时局部覆盖底座不透明度；null 时不写，沿用根节点的地板
    ...(adaptiveAlpha !== null ? { '--lg-base-alpha': adaptiveAlpha.toFixed(4) } : {}),
    ...(inlineBackdrop
      ? { backdropFilter: inlineBackdrop, WebkitBackdropFilter: inlineBackdrop }
      : {}),
    // 拖动 / 按下期间提示合成器，避免每帧重排
    ...(isPressed ? { willChange: 'backdrop-filter, transform' } : {}),
  } as CSSProperties;

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement & HTMLSpanElement>}
      className={['lg-surface', className].filter(Boolean).join(' ')}
      data-layer={layer}
      data-continuous={continuous ? 'true' : undefined}
      data-pressed={isPressed ? 'true' : undefined}
      data-refraction={refractionOff ? 'off' : undefined}
      data-legibility={adaptiveAlpha !== null ? 'adaptive' : undefined}
      style={mergedStyle}
      onPointerDown={interactive ? onPointerDown : undefined}
    >
      {children}
    </Tag>
  );
}
