'use client';

import { DisclosureIndicator } from '@/components/ui/collapsible';

/**
 * 五档尺寸。**圆角是查表，不是比例算的** ——
 * 16/20/24 恰好是「边长 ÷ 4」，28 起直接变成正圆（均实测）。
 * 用一个比例硬套过去，28 那一档会得到 7 而不是圆。
 */
export default function CollapsibleSizes() {
  return (
    <div className="flex items-center gap-4">
      {[16, 20, 24, 28, 36].map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <DisclosureIndicator size={size} />
          <span className="text-[11px] text-[var(--lg-label-tertiary)]">{size}</span>
        </div>
      ))}
    </div>
  );
}
