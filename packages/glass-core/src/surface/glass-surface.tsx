'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useGlassFilter } from '../filter/use-glass-filter.js';
import { useGlassOptional } from '../provider/glass-provider.js';
import { useAdaptiveAlpha } from '../a11y/use-adaptive-alpha.js';
import { punchClipPath, isPunchValid, type GlassPunch } from './punch.js';
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
  /**
   * 在底座上挖一个洞，让洞内的指示器看到**未被底座模糊过**的背景。
   *
   * 只对 `layer="base" | "elevated"` 有意义。坐标相对底座左上角。
   * 传 `null` 或宽高为 0 时不挖。原理与选型见 `surface/punch.ts`。
   */
  punch?: GlassPunch | null;
  /** 底层滤镜参数直通，调试用 */
  overrides?: Partial<RefractionOptions>;
  /**
   * 关掉 **JS 注入的 SVG 折射**，把这块玻璃的表现交还给 CSS 分支。
   *
   * 默认 `true`（跟随 Provider 的 tier 与无障碍偏好）。
   *
   * ⚠️ **这不是「tier 覆写」。** 三档渲染路径是 CSS 的后代选择器
   * （`[data-glass-tier='b'] .lg-surface[...]`），要局部切换得把属性写在**祖先**上。
   * 但光有属性还不够 —— Tier A 的折射是以**内联样式**注入的，优先级高于任何 CSS，
   * 祖先写了 `data-glass-tier="b"` 也盖不住它。所以想在一屏之内同时展示三档，
   * 两件事都要做：祖先加属性 + 这里传 `refraction={false}`。
   *
   * 唯一的真实用例就是文档站的「三档并排」演示。业务代码不需要它 ——
   * tier 由运行时检测决定，顶栏的强制开关走的是 Provider。
   */
  refraction?: boolean;
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
  punch = null,
  overrides,
  refraction = true,
  as: Tag = 'div',
}: GlassSurfaceProps) {
  const glass = useGlassOptional();
  const [selfPressed, setSelfPressed] = useState(false);
  const isPressed = pressed ?? selfPressed;

  // 只有指示器需要折射；底座绝不折射（PROJECT_SPEC §15.2）
  const wantsRefraction = refraction && layer === 'indicator' && (glass?.refractionEnabled ?? false);

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

  /**
   * 想折射但没拿到（超过性能红线 / 滤镜未就绪）→ 借用 Tier B 的处理，
   * 保证降级实例仍是一个完成度正确的设计。
   *
   * ⚠️ `refraction={false}` **不算**这种情况：那是调用方主动交还控制权，
   * 该让祖先的 `data-glass-tier` 说了算，不能再打上 Tier B 的兜底标记。
   */
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

  /**
   * 挖洞需要底座**自身的像素尺寸** —— `clip-path: path()` 只接受绝对数值，
   * 不支持百分比，所以必须实测。
   */
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const punchActive = isPunchValid(punch) && layer !== 'indicator';

  useEffect(() => {
    if (!punchActive) {
      setSize(null);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const apply = (w: number, h: number) =>
      setSize((prev) =>
        prev && Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5 ? prev : { w, h },
      );
    /**
     * ⚠️ **不能用 `getBoundingClientRect()`** —— 它量的是**变换后**的盒子，
     * 而 `clip-path` 的坐标系是**未变换**的布局坐标。
     *
     * 浮层入场时整块面板在做 scale 动画（0.94 → 1）：在那一帧量到的宽高比
     * 真实布局小 5%，外框于是短了一截，面板右下角的模糊被裁掉；
     * 而 ResizeObserver **不会**因为 transform 变化再触发一次，
     * 尺寸就一直错着不会自愈。（Select 打开时 Radix 立刻高亮选中项，
     * 正好撞在动画中间，这才把它暴露出来。）
     *
     * `borderBoxSize` 给的是布局尺寸，与 transform 无关，且是亚像素精度。
     */
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.borderBoxSize?.[0];
      if (box) apply(box.inlineSize, box.blockSize);
      else apply(el.offsetWidth, el.offsetHeight);
    });
    ro.observe(el);
    // RO 的首次回调要等到下一帧，先用整数尺寸兜一帧，免得入场时闪一下没有洞
    apply(el.offsetWidth, el.offsetHeight);
    return () => ro.disconnect();
  }, [punchActive, ref]);

  const clipPath =
    punchActive && size ? punchClipPath(size.w, size.h, punch) : undefined;

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
      data-punched={clipPath ? 'true' : undefined}
      style={mergedStyle}
      onPointerDown={interactive ? onPointerDown : undefined}
    >
      {/*
        挖洞时把模糊从底座本体挪到这一层，再用 clip-path 挖穿。
        必须是独立子层：直接在本体上挖会把**材质底色也一起挖掉**
        （实测见 debug/holepunch-probe.html 的用例 B），
        而 SPEC 要的是底色连续、只有模糊被挖穿。
      */}
      {clipPath ? (
        <span aria-hidden="true" className="lg-punch-layer" style={{ clipPath }} />
      ) : null}
      {children}
    </Tag>
  );
}
