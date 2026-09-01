'use client';

import { useEffect, useRef, useState } from 'react';
import { probeBackdrop } from './backdrop-probe.js';
import { resolveLegibleAlpha, type LegibilityMode } from './legibility.js';

/**
 * 逐元素的可读性 alpha —— `legibility: 'adaptive'` 的执行端。
 *
 * 探测这块玻璃背后的实际背景，只把不透明度抬到刚好够用。
 * 探测不出来就返回 `null`，调用方回落到根节点上的 `guaranteed` 地板。
 *
 * ── 重算时机 ──────────────────────────────────────────────────────
 * 挂载、滚动、窗口尺寸变化、元素自身尺寸变化。全部经 rAF 合流，
 * 一帧最多算一次。**没有**监听任意 DOM 变动（MutationObserver 太贵，
 * 且背景内容变化通常伴随滚动或尺寸变化）。
 *
 * ── 为什么不做插值动画 ────────────────────────────────────────────
 * alpha 变化会让玻璃明显「呼吸」。这里只在**跨过阈值**时才更新（见 EPSILON），
 * 避免滚动时每帧微调导致的闪烁。真正的过渡由 `.lg-surface` 上已有的
 * `transition: background-color` 负责。
 */

/** alpha 变化小于这个量就不重渲染，避免滚动时的抖动 */
const EPSILON = 0.02;

export interface UseAdaptiveAlphaOptions<T extends HTMLElement> {
  /**
   * 被测元素。**由调用方提供**而不是本 hook 自建 ——
   * `GlassSurface` 上已经挂了折射滤镜的 ref，同一个元素不能挂两个 ref。
   */
  ref: { current: T | null };
  mode: LegibilityMode;
  scheme: 'light' | 'dark';
  /** 档位插值出的原始 alpha（美学意图） */
  rawAlpha: number;
  /** 关掉探测（例如该 surface 不承载文字） */
  disabled?: boolean | undefined;
}

export function useAdaptiveAlpha<T extends HTMLElement>(
  options: UseAdaptiveAlphaOptions<T>,
): { alpha: number | null; probed: boolean } {
  const { ref, mode, scheme, rawAlpha, disabled = false } = options;
  const [alpha, setAlpha] = useState<number | null>(null);
  const [probed, setProbed] = useState(false);

  const active = mode === 'adaptive' && !disabled;

  // 用 ref 存最新值，免得每次变化都重装监听
  const latest = useRef({ scheme, rawAlpha, alpha });
  latest.current = { scheme, rawAlpha, alpha };

  useEffect(() => {
    if (!active) {
      setAlpha(null);
      setProbed(false);
      return;
    }
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    let cancelled = false;

    const recompute = () => {
      frame = 0;
      if (cancelled) return;
      const samples = probeBackdrop(el);
      if (!samples) {
        // 测不出 → 交回给 guaranteed，绝不静默降低保证
        setProbed(false);
        setAlpha(null);
        return;
      }
      const next = resolveLegibleAlpha(
        latest.current.rawAlpha,
        latest.current.scheme,
        'adaptive',
        samples,
      );
      setProbed(true);
      const prev = latest.current.alpha;
      if (prev === null || Math.abs(prev - next) >= EPSILON) setAlpha(next);
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(recompute);
    };

    schedule();

    window.addEventListener('scroll', schedule, { passive: true, capture: true });
    window.addEventListener('resize', schedule, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(el);

    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
      ro.disconnect();
    };
  }, [active, scheme, rawAlpha]);

  return { alpha, probed };
}
