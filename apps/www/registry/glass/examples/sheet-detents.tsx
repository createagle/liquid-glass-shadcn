'use client';

import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from '@/components/ui/sheet';

/**
 * 自定义档位。传进来的数组会自动升序排序，`defaultDetent` 是排序后的索引。
 * 面板始终按**最高档**渲染、靠位移露出当前档 —— 改 height 会触发重排，拖起来会卡。
 */
export default function SheetDetents() {
  return (
    <Sheet>
      <SheetTrigger>三档面板</SheetTrigger>
      <SheetContent detents={[0.3, 0.6, 0.95]} defaultDetent={0}>
        <SheetHeader>
          <SheetTitle>附近的地点</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <p className="text-[15px] text-[var(--lg-label-secondary)]">
            往上拖会吸到 60% 和 95% 两档，往下甩关闭。
          </p>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
