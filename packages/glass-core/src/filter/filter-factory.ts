/**
 * 滤镜工厂。对应 PROJECT_SPEC §5.2。
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ ⚠️ 两条来自 Phase 0 实测的硬性约束，踩中任何一条都会**静默失效**      │
 * │   （不报错、不告警，只是完全没有折射效果，极难事后 debug）           │
 * │                                                                     │
 * │ 1. 承载滤镜的 <svg> 必须有**非零的 width / height 属性**。            │
 * │    PROJECT_SPEC §5.2 原文建议的                                      │
 * │      `position:fixed; width:0; height:0; pointer-events:none`        │
 * │    如果写成**属性**就是错的 —— feImage 会完全不产出内容。            │
 * │    正确做法：属性给非零值（10×10 即可），用 **CSS** 压成 0 来隐藏。   │
 * │                                                                     │
 * │ 2. feImage 上**不能用百分比尺寸**。百分比按宿主 <svg> 的视口解析，    │
 * │    不是按被滤镜作用的元素。必须写绝对用户单位 = 目标元素像素尺寸。    │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * 完整实验矩阵见 docs/research/optics-web.md §3.6。
 */

import {
  createDisplacementMap,
  displacementKey,
  type DisplacementChannel,
  type DisplacementMapOptions,
} from './displacement-map.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const CONTAINER_ID = 'lg-filter-defs';
const FILTER_PREFIX = 'lg-refract-';

export interface RefractionOptions extends DisplacementMapOptions {
  /**
   * 基准折射强度。负值表示「向内推挤」，与上游 React Bits 的 distortionScale 同义。
   * 由 --lg-refract-{1..3} 阶梯提供默认值。
   */
  distortionScale?: number;
  /** R 通道相对基准的偏移量 —— 三个通道的差值就是色散强度 */
  redOffset?: number;
  greenOffset?: number;
  blueOffset?: number;
  /** 采样通道。默认 R/B，理由见 displacement-map.ts 顶部注释。 */
  xChannel?: DisplacementChannel;
  yChannel?: DisplacementChannel;
  /** 最后一道柔化，抹掉通道合成产生的硬边 */
  postBlur?: number;
}

/** 默认值来自 Phase 1 视觉标定，见 docs/research/optics-web.md §3.7 */
export const REFRACTION_DEFAULTS = {
  distortionScale: -180,
  redOffset: 0,
  greenOffset: 18,
  blueOffset: 38,
  xChannel: 'R' as DisplacementChannel,
  yChannel: 'B' as DisplacementChannel,
  postBlur: 0.3,
} as const;

interface CacheEntry {
  id: string;
  filter: SVGFilterElement;
  refCount: number;
}

const cache = new Map<string, CacheEntry>();
let container: SVGSVGElement | null = null;

/**
 * 全局唯一的 defs 容器。所有滤镜挂在这里，避免每个组件塞一个 `<svg>`。
 *
 * 属性 10×10（非零，见文件头约束 1）；CSS 压成 0 来隐藏。
 */
export function getFilterContainer(): SVGSVGElement {
  if (container?.isConnected) return container;

  const existing = document.getElementById(CONTAINER_ID);
  if (existing instanceof SVGSVGElement) {
    container = existing;
    return container;
  }

  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('id', CONTAINER_ID);
  svg.setAttribute('aria-hidden', 'true');
  // ↓ 非零属性。改成 0 会让整条折射链静默失效。
  svg.setAttribute('width', '10');
  svg.setAttribute('height', '10');
  svg.setAttribute('focusable', 'false');
  svg.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;pointer-events:none;opacity:0';
  svg.appendChild(document.createElementNS(SVGNS, 'defs'));
  document.body.appendChild(svg);
  container = svg;
  return svg;
}

function filterKey(o: RefractionOptions): string {
  const r = { ...REFRACTION_DEFAULTS, ...o };
  return [
    displacementKey(o),
    r.distortionScale,
    r.redOffset,
    r.greenOffset,
    r.blueOffset,
    r.xChannel,
    r.yChannel,
    r.postBlur,
  ].join('|');
}

function el(name: string, attrs: Record<string, string | number>): SVGElement {
  const node = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** 只保留单个通道 + alpha 的色彩矩阵 */
function channelMatrix(channel: 'r' | 'g' | 'b'): string {
  const rows = {
    r: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',
    g: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0',
    b: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0',
  };
  return rows[channel];
}

function buildFilter(id: string, o: RefractionOptions): SVGFilterElement {
  const r = { ...REFRACTION_DEFAULTS, ...o };
  const map = createDisplacementMap(o);

  const filter = document.createElementNS(SVGNS, 'filter');
  filter.setAttribute('id', id);
  filter.setAttribute('x', '0%');
  filter.setAttribute('y', '0%');
  filter.setAttribute('width', '100%');
  filter.setAttribute('height', '100%');
  filter.setAttribute('filterUnits', 'objectBoundingBox');
  // primitiveUnits 保持 userSpaceOnUse（默认值），以便 feImage 写绝对像素
  filter.setAttribute('primitiveUnits', 'userSpaceOnUse');
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  // ↓ 绝对用户单位，不是百分比（见文件头约束 2）
  filter.appendChild(
    el('feImage', {
      href: map.href,
      x: 0,
      y: 0,
      width: map.width,
      height: map.height,
      preserveAspectRatio: 'none',
      result: 'map',
    }),
  );

  // 三通道分别位移 → 隔离通道 → screen 合并。通道间的 scale 差值即色散。
  const channels: Array<{ key: 'r' | 'g' | 'b'; offset: number }> = [
    { key: 'r', offset: r.redOffset },
    { key: 'g', offset: r.greenOffset },
    { key: 'b', offset: r.blueOffset },
  ];

  for (const { key, offset } of channels) {
    filter.appendChild(
      el('feDisplacementMap', {
        in: 'SourceGraphic',
        in2: 'map',
        xChannelSelector: r.xChannel,
        yChannelSelector: r.yChannel,
        scale: r.distortionScale + offset,
        result: `disp_${key}`,
      }),
    );
    filter.appendChild(
      el('feColorMatrix', {
        in: `disp_${key}`,
        type: 'matrix',
        values: channelMatrix(key),
        result: key,
      }),
    );
  }

  filter.appendChild(el('feBlend', { in: 'r', in2: 'g', mode: 'screen', result: 'rg' }));
  filter.appendChild(el('feBlend', { in: 'rg', in2: 'b', mode: 'screen', result: 'rgb' }));
  filter.appendChild(el('feGaussianBlur', { in: 'rgb', stdDeviation: r.postBlur }));

  return filter;
}

/**
 * 取得（或创建）一个折射滤镜，返回其 id。
 * 相同参数的多个实例共享同一个 `<filter>` 定义，用引用计数管理生命周期。
 */
export function acquireFilter(o: RefractionOptions): string {
  const key = filterKey(o);
  const hit = cache.get(key);
  if (hit) {
    hit.refCount += 1;
    return hit.id;
  }

  const id = FILTER_PREFIX + cache.size.toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  const filter = buildFilter(id, o);
  getFilterContainer().querySelector('defs')?.appendChild(filter);
  cache.set(key, { id, filter, refCount: 1 });
  return id;
}

/**
 * 名额释放的订阅。
 *
 * 性能红线是**先到先得**：超限时后来的实例被拒，退回 Tier B。
 * 但「被拒」必须是**可恢复**的 —— 切一下标签页造成的一瞬间超编，
 * 不该让那个实例余生都比旁边的兄弟少一层玻璃。
 *
 * 实测踩到的就是这个：首页 Hero 从「资料库」切到「设置」时，
 * 旧面板的实例还没退场、新面板的已经在申请，中间有一帧到了 9 个；
 * Tab Bar 的选中胶囊正好是那一帧申请的，于是**永久**停在 Tier B ——
 * 整页稳定在 8 个（不超编）之后它也不会自己回来，
 * 因为拒绝路径直接 return 了，effect 的依赖再没变过。
 */
const waiters = new Set<() => void>();

/** 订阅「有名额被还回来了」。返回退订函数。 */
export function onFilterReleased(fn: () => void): () => void {
  waiters.add(fn);
  return () => {
    waiters.delete(fn);
  };
}

/** 释放一个折射滤镜。引用计数归零时从 DOM 摘掉，避免 defs 无限膨胀。 */
export function releaseFilter(o: RefractionOptions): void {
  const key = filterKey(o);
  const hit = cache.get(key);
  if (!hit) return;
  hit.refCount -= 1;
  if (hit.refCount <= 0) {
    hit.filter.remove();
    cache.delete(key);
  }
  if (waiters.size > 0) {
    /*
     * 快照 + 微任务：本函数是在 React 的 effect 清理里被调的，
     * 同步回调会在同一次提交里再触发 setState，且回调自己可能退订，
     * 边遍历边改 Set 是未定义行为。推到微任务里等这次提交收尾。
     */
    const snapshot = [...waiters];
    queueMicrotask(() => {
      for (const fn of snapshot) fn();
    });
  }
}

/** 当前活跃的折射实例数 —— 用于 PROJECT_SPEC §5.2 的性能红线告警。 */
export function activeFilterCount(): number {
  let n = 0;
  for (const entry of cache.values()) n += entry.refCount;
  return n;
}

/** 仅供测试 / 调试页使用：清空所有缓存的滤镜。 */
export function resetFilters(): void {
  for (const entry of cache.values()) entry.filter.remove();
  cache.clear();
}
