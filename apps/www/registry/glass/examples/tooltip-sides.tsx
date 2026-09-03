'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * 四个方向。空间不够时 Radix 会自己翻边，这里给的是**首选**方向。
 *
 * 同一个 Provider 下还有「跳过延迟」的接力行为：看过一个之后
 * 再指向旁边那个会立刻出现，不用再等 400ms。
 */
export default function TooltipSides() {
  const sides = ['top', 'right', 'bottom', 'left'] as const;
  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-3">
        {sides.map((side) => (
          <Tooltip key={side}>
            <TooltipTrigger className="h-11 px-4 bg-[var(--lg-fill-secondary)] text-[15px]">
              {side}
            </TooltipTrigger>
            <TooltipContent side={side}>出现在 {side}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
