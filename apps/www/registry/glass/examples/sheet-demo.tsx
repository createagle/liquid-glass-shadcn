'use client';

import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';

export default function SheetDemo() {
  return (
    <Sheet>
      <SheetTrigger>打开面板</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>共享位置</SheetTitle>
          <SheetDescription>选择一位联系人，位置会在一小时后自动停止共享。</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <p className="text-[15px] text-[var(--lg-label-secondary)]">
            往上拖能切到更高的档位，往下甩可以关闭。
          </p>
        </SheetBody>
        <SheetFooter>
          <SheetClose variant="prominent">开始共享</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
