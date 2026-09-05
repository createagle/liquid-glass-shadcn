'use client';

import { ScrollArea } from '@/components/ui/scroll-area';

/**
 * 打开滚动边缘效果（PROJECT_SPEC §13 的硬性要求）。
 *
 * ⚠️ 方向是**把背景内容压暗模糊**，不是把栏自己变实 ——
 * 这一点与 SPEC 的字面表述相反，理由记在 `@createagle/glass-core` 的 scroll-edge.tsx。
 *
 * ⚠️ 它默认**关着**：只有「内容会滑到某条栏底下」时才该打开，
 * 普通滚动容器加上去只是白白压暗上下两条边。
 */
export default function ScrollAreaEdges() {
  return (
    <ScrollArea edges type="always" className="w-[240px]" style={{ height: 180 }}>
      <div className="flex flex-col gap-2 p-3 text-[15px]">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i}>第 {i + 1} 项</span>
        ))}
      </div>
    </ScrollArea>
  );
}
