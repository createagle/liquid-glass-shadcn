'use client';

import { Button } from '@/components/ui/button';
import { Toaster, toast } from '@/components/ui/toast';

/**
 * 命令式用法：任意位置调 `toast()`，页面上放一个 `<Toaster />`。
 *
 * 可以试试：**指针停在通知上，倒计时会暂停**；**向右滑能把它推走**。
 * 这两件事都是 Radix 做的 —— 本库负责的是它的皮，不是行为。
 */
export default function ToastDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="glass"
        onClick={() => toast({ title: '已保存', description: '改动会同步到所有设备。' })}
      >
        普通通知
      </Button>
      <Button
        variant="destructive"
        onClick={() =>
          toast({
            variant: 'destructive',
            title: '同步失败',
            description: '检查网络后重试。',
          })
        }
      >
        失败通知
      </Button>
      <Toaster />
    </div>
  );
}
