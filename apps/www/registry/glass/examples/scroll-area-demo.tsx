'use client';

import { ScrollArea } from '@/components/ui/scroll-area';

/**
 * 滚动条几何全部实测（滑块 6 厚、全圆角、槽宽 12、两侧内缩 3）。
 *
 * ⚠️ 默认 `type="scroll"`（滚动时才显示），对应 macOS 系统设置里
 * 「显示滚动条：滚动时」那一档 —— 而不是 Radix 默认的 `hover`
 * （触屏上没有 hover，那一档等于永远不显示）。
 */
export default function ScrollAreaDemo() {
  return (
    <ScrollArea type="always" className="w-[240px]" style={{ height: 180 }}>
      <div className="flex flex-col gap-2 p-3 text-[15px]">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i}>第 {i + 1} 项</span>
        ))}
      </div>
    </ScrollArea>
  );
}
