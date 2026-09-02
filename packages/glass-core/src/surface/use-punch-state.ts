'use client';

import { useCallback, useState } from 'react';
import type { GlassPunch } from './punch.js';

/**
 * 洞的位置在值上相等吗。
 *
 * 用 0.01px 的容差而不是严格相等：`getBoundingClientRect()` 会返回
 * 1e-13 量级的浮点噪声，严格比较会把「完全没动」判成「变了」。
 * 0.01px 远在任何显示设备的分辨率之下，不会掩盖真实的位移。
 */
export function punchEquals(a: GlassPunch | null, b: GlassPunch | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const near = (x: number, y: number) => Math.abs(x - y) < 0.01;
  return (
    near(a.x, b.x) &&
    near(a.y, b.y) &&
    near(a.width, b.width) &&
    near(a.height, b.height) &&
    near(a.radius, b.radius)
  );
}

/**
 * 挖洞状态。**setter 在值没变时不会触发重渲染。**
 *
 * ── 为什么需要这个，而不是直接 useState ──────────────────────────────
 *
 * 挖洞的位置都是从 `getBoundingClientRect()` 量出来的，观察器每触发一次就
 * 产生一个**新对象**。直接 `setState(新对象)` 的话，值没变也会重渲染 ——
 * 而如果上层把 punch 放进了 context value，重渲染又会产出新的 context 对象，
 * 于是订阅它的 effect 再跑一遍、再量一次、再 set 一次……
 *
 * Tabs 就是这么栽的：`TabsTrigger` 的同步 effect 依赖整个 ctx，而 ctx 的
 * memo 依赖 punch —— 一个闭环。表现是控制台刷屏
 * "Maximum update depth exceeded"，画面**看不出任何异常**（每次算出来的值
 * 都一样），但两个观察器每帧被拆掉重建。
 *
 * 从 Phase 3 第一个组件起就一直在，直到做文档站时才被 Next 的
 * React 严格模式暴露出来 —— 因为在此之前**没有任何测试看过控制台**。
 * 现在有了：`tests/console.behavior.spec.ts`。
 */
export function usePunchState(): [GlassPunch | null, (p: GlassPunch | null) => void] {
  const [punch, setPunchRaw] = useState<GlassPunch | null>(null);
  const setPunch = useCallback((next: GlassPunch | null) => {
    setPunchRaw((prev) => (punchEquals(prev, next) ? prev : next));
  }, []);
  return [punch, setPunch];
}
