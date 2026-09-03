'use client';

// 这个模块导出的全是 hook。**没有这行指令，任何从服务端组件 import
// `@glass/core` 的人都会构建失败** —— barrel 会把它一起拖进 RSC 图。
// 做文档站时被 Next 的 webpack 构建抓到；Turbopack 那边不报，更隐蔽。
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  acquireFilter,
  activeFilterCount,
  onFilterReleased,
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

/**
 * 零面积 = 还没被画出来，不建滤镜、不占 §5.2 的名额。
 *
 * 要挡的是**根本不在文档里**的那种实例：Select 为了在关闭状态下也能拿到
 * value→label 的映射，会把子树 createPortal 到一个**游离的 DocumentFragment**
 * 里（Radix 自己也用这招）。游离子树的 effect 照跑、ResizeObserver 照报 ——
 * 报的是 0×0。而 `quantize(0)` 是 1，于是每个隐形实例都**真的申请了一个滤镜、
 * 真的占着名额**，却永远不会被画到屏幕上。
 *
 * 实测：文档站首页 activeFilterCount() = 8，页面上只有 7 个指示器；
 * /docs/components/select 更明显，8 对 6 —— 差额正好等于页面上 Select 的个数。
 * 首页 Hero 的 Tab Bar 胶囊被挤下 Tier A，根因就在这儿。
 *
 * ⚠️ 判据是**零面积**，不是「小于某个尺寸」。第一版写了「短边 < 8px 就跳过」，
 * 结果把 Sheet 的抓手（36×5，货真价实的 Layer I）一起毙了 ——
 * tests/sheet.behavior.spec.ts 立刻红了。库里确实存在极扁的强玻璃。
 *
 * 元素后来被接进文档时 ResizeObserver 会因为尺寸变化再报一次，
 * 那时自然就建了 —— 不需要额外去监听 isConnected。
 */
function isPaintable(w: number, h: number): boolean {
  return w > 0 && h > 0;
}

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

/**
 * 折射强度档位 —— **短边的比例**，不是绝对像素。
 *
 * ⚠️ 这里原先是绝对值（-110 / -180 / -260），是 Phase 1 在调试页上按
 * 117×45 这一个尺寸标定出来的。做 Tabs 时暴露了问题：
 *
 *   85×54 的指示器上，-180 意味着边缘位移 ±90px —— **超过元素本身的宽度**。
 *   边缘区域于是采样到完全无关的远处内容，整体糊成一团不贴合胶囊的团块，
 *   并在边界留下一道生硬的深色闭合曲线。
 *
 * 绝对值从原理上就不成立：同一套参数要同时服务 24px 的 Slider knob 与
 * 390px 宽的 Sheet，只有比例才可能两头都对。
 *
 * 校准依据：`docs/research/screenshots/refraction-ab.png` 的 A/B 对照，
 * 在 85×54 上比例 0.7 让条纹在边缘渐进弯曲、中心近乎不失真，
 * 且折射区域正确填满胶囊。原 -180 ÷ 54 ≈ 3.3，高了近 5 倍。
 */
const REFRACT_RATIO = { 1: -0.45, 2: -0.7, 3: -1.0 } as const;

/**
 * 色散档位 —— 相对 |distortionScale| 的比例。
 *
 * 同样从绝对值改为比例：色散偏移量是加在位移量上的，位移随尺寸缩放了，
 * 偏移量不跟着缩放就会在小元素上变成整片彩虹。
 *
 * 原绝对值（green 18 / blue 38）在 85×54 上实测是**整片彩虹**而非边缘彩边，
 * A/B 对照里降到 green 5 / blue 12 才读起来像玻璃 —— 即 |scale|≈37.8 的
 * 0.13 与 0.32。
 */
const DISPERSE_RATIO = {
  1: { green: 0.065, blue: 0.16 },
  2: { green: 0.13, blue: 0.32 },
  3: { green: 0.2, blue: 0.48 },
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
    fixedWidth != null && fixedHeight != null && isPaintable(fixedWidth, fixedHeight)
      ? { w: quantize(fixedWidth), h: quantize(fixedHeight) }
      : null,
  );
  const [throttled, setThrottled] = useState(false);

  // 显式尺寸变化时同步
  useEffect(() => {
    if (fixedWidth == null || fixedHeight == null) return;
    if (!isPaintable(fixedWidth, fixedHeight)) {
      setMeasured((prev) => (prev === null ? prev : null));
      return;
    }
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
      // 量化之前判零：quantize(0) 是 1，量化之后就分不出「零面积」和「1px」了
      if (!isPaintable(rect.width, rect.height)) {
        setMeasured((prev) => (prev === null ? prev : null));
        return;
      }
      const next = { w: quantize(rect.width), h: quantize(rect.height) };
      setMeasured((prev) => (prev && prev.w === next.w && prev.h === next.h ? prev : next));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [fixedWidth, fixedHeight]);

  const refraction = useMemo<RefractionOptions | null>(() => {
    if (disabled || !measured) return null;
    // 位移与色散都按**短边**缩放 —— 理由见 REFRACT_RATIO 的注释
    const scale = REFRACT_RATIO[intensity] * Math.min(measured.w, measured.h);
    return {
      width: measured.w,
      height: measured.h,
      radius,
      distortionScale: scale,
      redOffset: REFRACTION_DEFAULTS.redOffset,
      greenOffset: Math.abs(scale) * DISPERSE_RATIO[dispersion].green,
      blueOffset: Math.abs(scale) * DISPERSE_RATIO[dispersion].blue,
      ...overrides,
    };
  }, [disabled, measured, radius, intensity, dispersion, overrides]);

  const [filterId, setFilterId] = useState<string | null>(null);
  /** 被红线挡下之后递增，逼 effect 再试一次 */
  const [retry, setRetry] = useState(0);
  /** 同一次「参数没变」的等待里，延迟重检只安排一次，避免无限自旋 */
  const rechecked = useRef(false);
  /** 同一个实例只警告一次，别让重试把控制台刷满 */
  const warned = useRef(false);

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
      if (isDev() && !warned.current) {
        warned.current = true;
        console.warn(
          `[@glass/core] 同屏折射实例已达上限 ${MAX_ACTIVE_REFRACTIONS}，` +
            `本实例回退到 Tier B 渲染路径。` +
            `请减少同屏强玻璃元素，或用 <GlassContainer> 合并。`,
        );
      }
      /*
       * ⚠️ 这里**必须**留一条回来的路，不能直接 return。
       *
       * 超编常常只是一瞬间的事 —— 切换标签页时旧面板的实例还没全退场、
       * 新面板的已经在申请，中间会有一帧顶到红线。谁赶上那一帧谁被拒，
       * 而拒绝路径如果就此收工，它的依赖（refraction）此后再没变过，
       * effect 永远不会重跑：整页早就回到 8 个以内了，它还停在 Tier B，
       * 表现是「这一个胶囊的玻璃跟旁边的不一样」，而且只有刷新才好。
       *
       * 两条路都要，因为它们盖的是不同的情形：
       *
       *   延迟重检   本次提交内部的瞬时超编。**这种情况下拒绝就是最后一个事件**，
       *              之后不会再有任何 release 来叫醒它 —— 只订阅是叫不醒的。
       *              一次性，不自旋：第二次仍被拒就老老实实去等订阅。
       *   订阅       之后别人卸载、真的腾出名额。
       */
      let raf = 0;
      if (!rechecked.current && typeof requestAnimationFrame === 'function') {
        rechecked.current = true;
        raf = requestAnimationFrame(() => setRetry((n) => n + 1));
      }
      const unsubscribe = onFilterReleased(() => setRetry((n) => n + 1));
      return () => {
        if (raf) cancelAnimationFrame(raf);
        unsubscribe();
      };
    }

    const id = acquireFilter(refraction);
    setFilterId(id);
    setThrottled(false);
    // 拿到名额了，下次再被挤下去时还能再安排一次延迟重检
    rechecked.current = false;
    return () => {
      releaseFilter(refraction);
    };
  }, [refraction, retry]);

  return {
    ref,
    filterId,
    backdropFilter: filterId ? `url(#${filterId})` : undefined,
    ready: filterId != null,
    throttled,
  };
}
