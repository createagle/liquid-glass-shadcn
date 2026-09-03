'use client';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * ⚠️ 骨架块自己是 `aria-hidden` 的 —— 一堆没有内容的方块对屏幕阅读器是噪音。
 * 「正在加载」这件事由**外层容器**的 `aria-busy` 承担，像下面这样。
 */
export default function SkeletonDemo() {
  return (
    <div aria-busy="true" aria-label="正在加载" className="flex w-full max-w-[370px] gap-3">
      <Skeleton style={{ width: 40, height: 40, borderRadius: '50%' }} />
      <div className="flex flex-1 flex-col justify-center gap-2">
        <Skeleton style={{ height: 12, width: '70%' }} />
        <Skeleton style={{ height: 12, width: '45%' }} />
      </div>
    </div>
  );
}
