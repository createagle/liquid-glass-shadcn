'use client';

import { Separator } from '@/components/ui/separator';

export default function SeparatorDemo() {
  return (
    <div className="flex w-full max-w-[370px] flex-col gap-3 text-[15px]">
      <span>Liquid Glass UI</span>
      <Separator />
      <div className="flex h-5 items-center gap-3 text-[13px] text-[var(--lg-label-secondary)]">
        <span>文档</span>
        <Separator orientation="vertical" />
        <span>组件</span>
        <Separator orientation="vertical" />
        <span>源码</span>
      </div>
    </div>
  );
}
