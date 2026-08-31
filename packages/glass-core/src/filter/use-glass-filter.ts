import { useEffect, useMemo, useRef, useState } from 'react';
import {
  acquireFilter,
  activeFilterCount,
  releaseFilter,
  REFRACTION_DEFAULTS,
  type RefractionOptions,
} from './filter-factory.js';

/**
 * `useGlassFilter` —— PROJECT_SPEC §5.2 指定的对外 hook。
 *
 * 负责三件事：
 *   1. 用 ResizeObserver 跟踪目标元素尺寸，尺寸变化时重建滤镜（**不是每帧重建**）
 *   2. 按尺寸量化，避免 1px 抖动导致滤镜频繁重建
 *   3. 执行性能红线：活跃折射实例超限时退回 Tier B 渲染路径
 */

/** PROJECT_SPEC §5.2 的性能红线。⚠️ 这个数字是 SPEC 的 [推定] 值，Apple 并未给出任何上限。 */
export const MAX_ACTIVE_REFRACTIONS = 8;

/** 尺寸量化步长（px）。小于该步长的变化不重建滤镜。 */
const SIZE_QUANTUM = 2;

const quantize = (n: number) => Math.max(1, Math.round(n / SIZE_QUANTUM) * SIZE_QUANTUM);

/**
 * dev 模式判定。不引 `@types/node` —— 本包刻意保持零运行时依赖，
 * 打包器会把 `process.env.NODE_ENV` 静态替换掉，浏览器直跑时则安全地落到 false。
 */
function isDev(): boolean {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env?.['NODE_ENV'] !== 'production' && g.process?.env != null;
}

export interface UseGlassFilterOptions {
  /** 折射强度档位，对应 --lg-refract-{1..3}。也可直接传 distortionScale 覆盖。 */
  intensity?: 1 | 2 | 3;
  /** 色散强度档位，对应 --lg-disperse-{1..3} */
  dispersion?: 1 | 2 | 3;
  radius?: number;
  /** 显式尺寸。不传则通过 ref 自动测量。 */
  width?: number;
  height?: number;
  /** 关闭折射（例如 reduced-transparency 生效时） */
  disabled?: boolean;
  /** 直接覆盖底层参数，调试页用 */
  overrides?: Partial<RefractionOptions>;
}

export interface UseGlassFilterResult<T extends HTMLElement> {
  /** 挂到目标元素上；不传显式尺寸时用于自动测量 */
  ref: React.RefObject<T | null>;
  /** `url(#id)` 里的 id；未就绪或被禁用时为 null */
  filterId: string | null;
  /** 可直接写进 style 的 backdrop-filter 值；未就绪时为 undefined */
  backdropFilter: string | undefined;
  ready: boolean;
  /** 是否因为超过性能红线而被降级 */
  throttled: boolean;
}

const REFRACT_STEPS = { 1: -110, 2: -180, 3: -260 } as const;
const DISPERSE_STEPS = {
  1: { greenOffset: 9, blueOffset: 19 },
  2: { greenOffset: 18, blueOffset: 38 },
  3: { greenOffset: 28, blueOffset: 58 },
} as const;

export function useGlassFilter<T extends HTMLElement = HTMLElement>(
  options: UseGlassFilterOptions = {},
): UseGlassFilterResult<T> {
  const {
    intensity = 2,
    dispersion = 2,
    radius = 16,
    width: fixedWidth,
    height: fixedHeight,
    disabled = false,
    overrides,
  } = options;

  const ref = useRef<T>(null);
  const [measured, setMeasured] = useState<{ w: number; h: number } | null>(
    fixedWidth != null && fixedHeight != null
      ? { w: quantize(fixedWidth), h: quantize(fixedHeight) }
      : null,
  );
  const [throttled, setThrottled] = useState(false);

  // 显式尺寸变化时同步
  useEffect(() => {
    if (fixedWidth == null || fixedHeight == null) return;
    setMeasured((prev) => {
      const next = { w: quantize(fixedWidth), h: quantize(fixedHeight) };
      return prev && prev.w === next.w && prev.h === next.h ? prev : next;
    });
  }, [fixedWidth, fixedHeight]);

  // 自动测量：ResizeObserver + 尺寸量化
  useEffect(() => {
    if (fixedWidth != null && fixedHeight != null) return;
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const next = { w: quantize(rect.width), h: quantize(rect.height) };
      setMeasured((prev) => (prev && prev.w === next.w && prev.h === next.h ? prev : next));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [fixedWidth, fixedHeight]);

  const refraction = useMemo<RefractionOptions | null>(() => {
    if (disabled || !measured) return null;
    return {
      width: measured.w,
      height: measured.h,
      radius,
      distortionScale: REFRACT_STEPS[intensity],
      redOffset: REFRACTION_DEFAULTS.redOffset,
      ...DISPERSE_STEPS[dispersion],
      ...overrides,
    };
  }, [disabled, measured, radius, intensity, dispersion, overrides]);

  const [filterId, setFilterId] = useState<string | null>(null);

  useEffect(() => {
    if (!refraction) {
      setFilterId(null);
      setThrottled(false);
      return;
    }

    // 性能红线：超限时不再创建新滤镜，交由调用方走 Tier B 路径
    if (activeFilterCount() >= MAX_ACTIVE_REFRACTIONS) {
      setFilterId(null);
      setThrottled(true);
      if (isDev()) {
        console.warn(
          `[@glass/core] 同屏折射实例已达上限 ${MAX_ACTIVE_REFRACTIONS}，` +
            `本实例回退到 Tier B 渲染路径。` +
            `请减少同屏强玻璃元素，或用 <GlassContainer> 合并。`,
        );
      }
      return;
    }

    const id = acquireFilter(refraction);
    setFilterId(id);
    setThrottled(false);
    return () => {
      releaseFilter(refraction);
    };
  }, [refraction]);

  return {
    ref,
    filterId,
    backdropFilter: filterId ? `url(#${filterId})` : undefined,
    ready: filterId != null,
    throttled,
  };
}
