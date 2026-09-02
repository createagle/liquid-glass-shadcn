'use client';

import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

export default function PopoverDemo() {
  return (
    <Popover>
      <PopoverTrigger>显示详情</PopoverTrigger>
      <PopoverContent aria-label="详情">
        <div className="flex flex-col gap-1 text-[15px]">
          <span className="text-[var(--lg-label-secondary)]">拍摄于</span>
          <span>2026 年 3 月 14 日 18:02</span>
          <span className="text-[var(--lg-label-secondary)]">1/120s · ISO 400</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
