'use client';

// APPLE REFERENCE: scroll edge effect / `scrollEdgeEffectStyle(_:for:)`
//
// > "Optimize for legibility when content scrolls beneath controls. Scroll views offer a
// >  scroll edge effect that helps maintain sufficient legibility and contrast for controls
// >  by **obscuring content that scrolls beneath them**. System bars like toolbars adopt
// >  this behavior by default."
//   — developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass
//
// > "Scroll edge effects further enhance legibility by **blurring and reducing the opacity
// >  of background content**."
//   — developer.apple.com/design/human-interface-guidelines/materials
//
// ⚠️ **方向与 PROJECT_SPEC §13 的字面写法相反，这里按 Apple 走。**
//    SPEC 写的是「栏底自动增加不透明度」—— 作用在**栏自身**上；
//    Apple 说的是模糊并降低**背后内容**的不透明度 —— 作用在**内容**上。
//    视觉结果相近，但实现完全不同：前者会把栏本身变浑，玻璃感随之丢失；
//    后者栏一点不变，只是它底下那条内容被压暗压糊。
//    （分歧记录见 docs/research/apple-liquid-glass.md §11 与 STATUS 的第 10 条。）
//
// 参数可信度：Apple 只给了 `.soft` / `.hard` 两个**名字**，没有给任何数值 ——
// 下面的高度、模糊半径、雾的浓度**全部是 `[推定]`**，是照着系统截图的观感调的。
// 不要在文档里把它们写成 Apple 的建议值。

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
  type RefObject,
} from 'react';
import { useGlassOptional } from '../provider/glass-provider.js';

export type ScrollEdgeSide = 'top' | 'bottom';

/**
 * 对应 `ScrollEdgeEffectStyle`：
 *
 *   soft  渐隐 —— 模糊与雾从边缘向内平滑衰减到 0，看不出边界。默认。
 *   hard  硬切 —— 整条带子等强度，只在内侧留一小段收口，能看出一条界线。
 *         Apple 文档的示例代码用的就是 `.hard`。
 */
export type ScrollEdgeVariant = 'soft' | 'hard';

export interface GlassScrollEdgeProps {
  /** 贴哪条边。默认 `top`。 */
  edge?: ScrollEdgeSide;
  /** 见 {@link ScrollEdgeVariant}。默认 `soft`。 */
  variant?: ScrollEdgeVariant;
  /** 带子的高度（px）。默认 `soft` 72 / `hard` 52，均 `[推定]`。 */
  height?: number;
  /** 边缘处的模糊半径（px）。默认 12，`[推定]`。 */
  blur?: number;
  /**
   * 雾的最大浓度（0–1）。默认 0.72，`[推定]`。
   *
   * 雾色取 `--lg-scroll-edge-color`，缺省是材质底色 `--lg-base-color` ——
   * 也就是说亮色下压白、暗色下压黑，方向自动跟着主题走。
   * 压在照片/壁纸上时可以覆盖它，让雾色贴近那张图的基调。
   */
  opacity?: number;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

/**
 * 一条**只负责遮蔽**的带子，自身不可点击、不进无障碍树。
 *
 * 它的强度由 CSS 变量 `--lg-edge-progress`（0–1）驱动，
 * 由 {@link useScrollEdge} 在滚动时直接写进 style —— 不走 React state，
 * 见那边的注释。单独用时手动写死也可以。
 */
export function GlassScrollEdge({
  edge = 'top',
  variant = 'soft',
  height,
  blur = 12,
  opacity = 0.72,
  className,
  style,
  ref,
}: GlassScrollEdgeProps) {
  const h = height ?? (variant === 'soft' ? 72 : 52);
  // 渐变方向：带子贴顶时向下衰减，贴底时向上衰减
  const away = edge === 'top' ? 'bottom' : 'top';

  const glass = useGlassOptional();
  /**
   * Tier C 与 `prefers-reduced-transparency` 下没有 backdrop-filter 可用。
   *
   * 但这条效果的**职责就是可读性**（§13 把它列在无障碍那一节，不是装饰那一节），
   * 不能跟着一起消失 —— 模糊没了，就把雾加浓来补上被拿掉的那部分遮蔽。
   * 1.28 是让「雾 + 模糊」与「纯雾」在系统截图上观感相当的倍数，`[推定]`。
   */
  const solid = (glass?.tier ?? 'a') === 'c' || (glass?.preferences.reducedTransparency ?? false);
  const wash = solid ? Math.min(1, opacity * 1.28) : opacity;

  /**
   * mask 同时管住模糊和雾。
   *
   * `backdrop-filter` 的结果会被元素自己的 mask 一起裁掉，所以一层带 mask 的
   * div 就能做出「越靠边越糊」的衰减 —— 不需要叠一摞不同半径的模糊层。
   * （代价是衰减曲线是 alpha 的线性插值，不是真正的半径渐变。够用。）
   */
  const mask =
    variant === 'soft'
      ? `linear-gradient(to ${away}, rgb(0 0 0 / 1) 0%, rgb(0 0 0 / 0.72) 38%, rgb(0 0 0 / 0) 100%)`
      : `linear-gradient(to ${away}, rgb(0 0 0 / 1) 0%, rgb(0 0 0 / 1) 76%, rgb(0 0 0 / 0) 100%)`;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-glass-scroll-edge={edge}
      data-variant={variant}
      data-solid={solid ? 'true' : undefined}
      className={className}
      style={{
        position: 'absolute',
        insetInline: 0,
        [edge]: 0,
        height: h,
        pointerEvents: 'none',
        // 进度为 0 时整条带子彻底消失 —— 内容没滚下去就不该有任何遮蔽
        opacity: 'var(--lg-edge-progress, 0)',
        // ⚠️ 前缀写在标准属性**之前**。Lightning CSS 会把手写的一对折成后面那条，
        //    顺序反了就只剩 -webkit-，标准属性没了。（真的上线过，见 optics.css 文件头。）
        ...(solid
          ? {}
          : { WebkitBackdropFilter: `blur(${blur}px)`, backdropFilter: `blur(${blur}px)` }),
        background: `linear-gradient(to ${away}, rgb(var(--lg-scroll-edge-color, var(--lg-base-color)) / ${wash}), rgb(var(--lg-scroll-edge-color, var(--lg-base-color)) / 0))`,
        WebkitMaskImage: mask,
        maskImage: mask,
        ...style,
      }}
    />
  );
}

export interface UseScrollEdgeOptions {
  /**
   * 滚过多少 px，效果从 0 涨满到 1。默认 24，`[推定]`。
   *
   * 不是 0/1 硬切：内容刚离开边缘就砸下一整条雾会很突兀，
   * 而这段距离里手指还在触发惯性，眼睛正盯着那条边。
   */
  distance?: number;
  /** 关掉（例如容器根本不滚动时）。关掉时两条带子的进度会被清零。 */
  disabled?: boolean;
}

export interface UseScrollEdgeResult<S extends HTMLElement, E extends HTMLElement> {
  /**
   * 装到**滚动容器**上。
   *
   * 是 **callback ref** 而不是 RefObject —— 滚动容器随时可能被换掉
   * （Radix Tabs 默认卸载未选中的面板，切一次标签页就换一个元素），
   * 而 RefObject 的赋值不触发任何 effect，监听会挂在已经离开文档的旧元素上，
   * 表现是「切过一次标签页之后边缘效果就不动了」。
   */
  scrollRef: (el: S | null) => void;
  /** 装到顶部那条 `<GlassScrollEdge edge="top">` 上 */
  topRef: RefObject<E | null>;
  /** 装到底部那条 `<GlassScrollEdge edge="bottom">` 上 */
  bottomRef: RefObject<E | null>;
  /** 手动重算。内容长度突变之后调它。 */
  sync: () => void;
}

/**
 * 把滚动位置换算成两条边缘带的强度。
 *
 * ⚠️ **刻意不用 React state。** 滚动每帧 setState 会把整棵内容子树重渲染一遍 ——
 * 而这条效果唯一要改的只是两个 `opacity`。所以直接往 DOM 元素的 style 上写
 * `--lg-edge-progress`，React 全程不知道有人在滚。
 *
 * 顶/底分别算：顶部带子看 `scrollTop`，底部带子看剩余可滚距离 ——
 * 内容已经滚到底了，底下没有东西再钻到栏底下去，那条雾就该退场。
 */
export function useScrollEdge<S extends HTMLElement, E extends HTMLElement = HTMLDivElement>(
  options: UseScrollEdgeOptions = {},
): UseScrollEdgeResult<S, E> {
  const { distance = 24, disabled = false } = options;
  // 元素进 state（而不是 ref），才能让下面的 effect 在容器被换掉时重新绑定
  const [scrollEl, setScrollEl] = useState<S | null>(null);
  const scrollRef = useCallback((el: S | null) => setScrollEl(el), []);
  const topRef = useRef<E | null>(null);
  const bottomRef = useRef<E | null>(null);
  const frame = useRef<number | null>(null);

  const write = useCallback((el: E | null, v: number) => {
    el?.style.setProperty('--lg-edge-progress', v.toFixed(3));
  }, []);

  const sync = useCallback(() => {
    const el = scrollEl;
    if (!el) return;
    if (disabled) {
      write(topRef.current, 0);
      write(bottomRef.current, 0);
      return;
    }
    const d = Math.max(1, distance);
    const remaining = el.scrollHeight - el.clientHeight - el.scrollTop;
    write(topRef.current, Math.min(1, Math.max(0, el.scrollTop / d)));
    /**
     * `remaining` 会有亚像素残留（缩放、deviceScaleFactor=2 时尤其），
     * 减 1 是为了让「滚到底」真的判成 0，不然底部那条雾永远留着一丝。
     */
    write(bottomRef.current, Math.min(1, Math.max(0, (remaining - 1) / d)));
  }, [disabled, distance, scrollEl, write]);

  useEffect(() => {
    const el = scrollEl;
    if (!el) return;

    const schedule = () => {
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        sync();
      });
    };

    el.addEventListener('scroll', schedule, { passive: true });
    /**
     * 内容长度变了同样要重算 —— 切标签页、图片加载完、列表展开都算。
     * 观察容器本身还不够（它的高度没变），得连内容一起看。
     */
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);

    sync();
    return () => {
      el.removeEventListener('scroll', schedule);
      ro.disconnect();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [scrollEl, sync]);

  return { scrollRef, topRef, bottomRef, sync };
}
