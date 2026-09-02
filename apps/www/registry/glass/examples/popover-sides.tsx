'use client';

import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

/**
 * `side` / `align` 由 Radix 的碰撞检测兜底：放不下时会自动翻到对面，
 * 所以贴着视口边缘时看到的方向可能与传入的不一样 —— 那是正确行为。
 */
export default function PopoverSides() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
        <Popover key={side}>
          <PopoverTrigger>{side}</PopoverTrigger>
          <PopoverContent side={side} align="center" aria-label={`${side} 方向的浮层`}>
            <span className="text-[15px]">side=&quot;{side}&quot;</span>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}
